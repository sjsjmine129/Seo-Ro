-- =============================================================================
-- Seo-Ro (서로) - Supabase Schema
-- Location-based P2P book exchange platform at public libraries.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. ENUM TYPES
-- -----------------------------------------------------------------------------

CREATE TYPE book_condition AS ENUM ('S', 'A', 'B', 'C', 'D');
-- S: New, A: Like New, B: Good, C: Fair, D: Poor

CREATE TYPE book_status AS ENUM ('AVAILABLE', 'SWAPPING', 'SWAPPED', 'HIDDEN');

CREATE TYPE exchange_status AS ENUM (
  'REQUESTED',
  'ACCEPTED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELED',
  'REJECTED'
);

-- -----------------------------------------------------------------------------
-- 3. TABLES
-- -----------------------------------------------------------------------------

-- 3.1 Users
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

-- 3.2 Libraries (Hubs)
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

-- 3.3 User Interested Libraries
CREATE TABLE public.user_interested_libraries (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, library_id)
);

-- Function: Dynamic Limit Check based on Bookshelf Score
CREATE OR REPLACE FUNCTION check_user_interested_libraries_max()
RETURNS TRIGGER AS $$
DECLARE
  current_score INTEGER;
  max_allowed INTEGER;
  current_count INTEGER;
BEGIN
  -- Get User Score
  SELECT bookshelf_score INTO current_score 
  FROM public.users 
  WHERE id = NEW.user_id;
  
  -- Define Limits
  IF current_score < 10 THEN
    max_allowed := 2;   -- Default / Beginner
  ELSIF current_score < 30 THEN
    max_allowed := 3;   -- 10+ vols
  ELSIF current_score < 50 THEN
    max_allowed := 4;   -- 30+ vols
  ELSE
    max_allowed := 5;   -- 50+ vols (Expert)
  END IF;

  -- Check Count
  SELECT COUNT(*) INTO current_count 
  FROM public.user_interested_libraries
  WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limit reached. Your current score (%) allows max % libraries.', current_score, max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_interested_libraries_max
  BEFORE INSERT ON public.user_interested_libraries
  FOR EACH ROW EXECUTE FUNCTION check_user_interested_libraries_max();

-- 3.4 Books
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

-- 3.5 Book-Library Mapping
CREATE TABLE public.book_libraries (
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, library_id)
);

-- 3.6 Exchanges
CREATE TABLE public.exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  owner_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  meet_at TIMESTAMPTZ,
  status exchange_status NOT NULL DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exchanges_different_users CHECK (requester_id != owner_id),
  CONSTRAINT exchanges_different_books CHECK (requester_book_id != owner_book_id)
);

-- 3.7 Updated_at Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exchanges_updated_at BEFORE UPDATE ON public.exchanges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_books_owner_id ON public.books(owner_id);
CREATE INDEX idx_books_status ON public.books(status);
CREATE INDEX idx_books_last_bumped_at ON public.books(last_bumped_at DESC);
CREATE INDEX idx_book_libraries_library_id ON public.book_libraries(library_id);
CREATE INDEX idx_exchanges_requester_id ON public.exchanges(requester_id);
CREATE INDEX idx_exchanges_owner_id ON public.exchanges(owner_id);

-- -----------------------------------------------------------------------------
-- 5. AUTH TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, bookshelf_score)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'), 1);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. RLS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interested_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for brevity, functionality remains same)
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