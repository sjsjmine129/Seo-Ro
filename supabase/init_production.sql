-- =============================================================================
-- Seo-Ro (서로) — Unified production database initialization
--
-- Run ONCE in the Supabase SQL Editor on a new, empty project.
-- Consolidates: schema.sql, migrations (time/counter enum values & columns are
-- already reflected below), notifications, push_subscriptions, storage.sql
--
-- Order: Extensions → Enums → Tables → Indexes → Functions → Triggers →
--        Table RLS → Storage buckets → Storage RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
-- Supabase provides gen_random_uuid() (pgcrypto) by default. Uncomment if needed:
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. ENUM TYPES
-- -----------------------------------------------------------------------------

CREATE TYPE book_condition AS ENUM ('S', 'A', 'B', 'C', 'D');
-- S: New, A: Like New, B: Good, C: Fair, D: Poor

CREATE TYPE book_status AS ENUM ('AVAILABLE', 'SWAPPING', 'SWAPPED', 'HIDDEN');

CREATE TYPE exchange_status AS ENUM (
  'REQUESTED',
  'COUNTER_REQUESTED',
  'ACCEPTED',
  'SCHEDULED',
  'TIME_PROPOSED',
  'COMPLETED',
  'CANCELED',
  'REJECTED'
);

-- -----------------------------------------------------------------------------
-- 3. TABLES (core)
-- -----------------------------------------------------------------------------

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT,
  profile_image TEXT,
  bookshelf_score INTEGER NOT NULL DEFAULT 1 CHECK (bookshelf_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'User profiles linked to auth.users';
COMMENT ON COLUMN public.users.bookshelf_score IS 'Score determines max libraries (2~5). Starts at 1.';

CREATE TABLE public.libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  library_type TEXT,
  address TEXT,
  homepage_url TEXT,
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.libraries IS 'Korea Public Library Standard Data';

CREATE TABLE public.user_interested_libraries (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, library_id)
);

CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  isbn TEXT,
  title TEXT NOT NULL,
  authors TEXT,
  publisher TEXT,
  thumbnail_url TEXT,
  user_images TEXT[] NOT NULL,
  user_review VARCHAR(100),
  condition book_condition NOT NULL,
  status book_status NOT NULL DEFAULT 'AVAILABLE',
  last_bumped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.book_libraries (
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, library_id)
);

CREATE TABLE public.exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  owner_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  meet_at TIMESTAMPTZ,
  proposed_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  status exchange_status NOT NULL DEFAULT 'REQUESTED',
  requester_completed BOOLEAN NOT NULL DEFAULT false,
  owner_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchanges_different_users CHECK (requester_id != owner_id),
  CONSTRAINT exchanges_different_books CHECK (requester_book_id != owner_book_id)
);

COMMENT ON COLUMN public.exchanges.proposed_times IS 'Array of proposed meeting times as ISO strings, e.g. ["2025-02-23T07:00:00+09:00", ...]';
COMMENT ON COLUMN public.exchanges.requester_completed IS 'Requester confirmed they completed the physical book exchange';
COMMENT ON COLUMN public.exchanges.owner_completed IS 'Owner confirmed they completed the physical book exchange';

-- -----------------------------------------------------------------------------
-- 3b. TABLES (notifications & push) — from migrations 20250223230000, 20250223240000
-- -----------------------------------------------------------------------------

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN (
    'REQUEST', 'COUNTER', 'ACCEPTED', 'SCHEDULED', 'REMINDER_30MIN',
    'NO_SHOW', 'HALF_COMPLETED', 'FULLY_COMPLETED', 'CANCELED', 'REJECTED', 'SYSTEM'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'User notifications for exchange events and system messages';

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscription endpoints for PWA notifications';

-- -----------------------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX idx_books_owner_id ON public.books(owner_id);
CREATE INDEX idx_books_status ON public.books(status);
CREATE INDEX idx_books_last_bumped_at ON public.books(last_bumped_at DESC);
CREATE INDEX idx_book_libraries_library_id ON public.book_libraries(library_id);
CREATE INDEX idx_exchanges_requester_id ON public.exchanges(requester_id);
CREATE INDEX idx_exchanges_owner_id ON public.exchanges(owner_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- -----------------------------------------------------------------------------
-- 5. FUNCTIONS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_user_interested_libraries_max()
RETURNS TRIGGER AS $$
DECLARE
  current_score INTEGER;
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  SELECT bookshelf_score INTO current_score
  FROM public.users
  WHERE id = NEW.user_id;

  IF current_score < 10 THEN
    max_allowed := 2;
  ELSIF current_score < 30 THEN
    max_allowed := 3;
  ELSIF current_score < 50 THEN
    max_allowed := 4;
  ELSE
    max_allowed := 5;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.user_interested_libraries
  WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limit reached. Your current score (%) allows max % libraries.', current_score, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, bookshelf_score)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'), 1);
  RETURN NEW;
END;
$$;

-- From migration 20250223210000_add_increment_bookshelf_score.sql
CREATE OR REPLACE FUNCTION public.increment_bookshelf_score(user_ids UUID[], delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.users SET bookshelf_score = bookshelf_score + delta WHERE id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS
-- -----------------------------------------------------------------------------

CREATE TRIGGER trigger_user_interested_libraries_max
  BEFORE INSERT ON public.user_interested_libraries
  FOR EACH ROW EXECUTE FUNCTION public.check_user_interested_libraries_max();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exchanges_updated_at BEFORE UPDATE ON public.exchanges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY — tables
-- -----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interested_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "libraries_select" ON public.libraries FOR SELECT USING (true);

CREATE POLICY "user_interested_libraries_select_own" ON public.user_interested_libraries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_interested_libraries_insert_own" ON public.user_interested_libraries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_interested_libraries_delete_own" ON public.user_interested_libraries FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "books_select" ON public.books FOR SELECT USING (status != 'HIDDEN' OR owner_id = auth.uid());
CREATE POLICY "books_insert_own" ON public.books FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "books_update_own" ON public.books FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "books_delete_own" ON public.books FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "book_libraries_select" ON public.book_libraries FOR SELECT USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_libraries.book_id AND (b.status != 'HIDDEN' OR b.owner_id = auth.uid())));
CREATE POLICY "book_libraries_insert_own" ON public.book_libraries FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_libraries.book_id AND b.owner_id = auth.uid()));
CREATE POLICY "book_libraries_delete_own" ON public.book_libraries FOR DELETE USING (EXISTS (SELECT 1 FROM public.books b WHERE b.id = book_libraries.book_id AND b.owner_id = auth.uid()));

CREATE POLICY "exchanges_select" ON public.exchanges FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);
CREATE POLICY "exchanges_insert" ON public.exchanges FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "exchanges_update" ON public.exchanges FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- INSERT on notifications is intended for service role / server-side only (bypasses RLS).

-- -----------------------------------------------------------------------------
-- 8. STORAGE — buckets (from storage.sql; avatars migration merged here)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('book_images', 'book_images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. STORAGE — RLS policies (from storage.sql + avatars migration)
-- -----------------------------------------------------------------------------

CREATE POLICY "book_images_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'book_images');

CREATE POLICY "book_images_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'book_images');

CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- End of init_production.sql
-- Next: import library CSV if applicable; configure Auth providers; set env keys.
-- =============================================================================
