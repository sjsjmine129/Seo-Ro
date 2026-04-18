-- =============================================================================
-- Seo-Ro (서로) - Supabase Schema
-- Location-based P2P book exchange platform at public libraries.
-- Consolidated baseline (incremental migrations squashed into this file).
-- Run storage.sql afterward for buckets and storage RLS.
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
  'COUNTER_REQUESTED',
  'ACCEPTED',
  'SCHEDULED',
  'TIME_PROPOSED',
  'COMPLETED',
  'CANCELED',
  'REJECTED'
);

CREATE TYPE public.chat_room_status AS ENUM (
  'NEGOTIATING',
  'APPOINTMENT_SET',
  'COMPLETED'
);

CREATE TYPE public.chat_message_type AS ENUM (
  'TEXT',
  'SYSTEM_BOOK_CHANGE',
  'SYSTEM_APPOINTMENT'
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
COMMENT ON COLUMN public.users.bookshelf_score IS 'Community score (권). Starts at 1. 관심 도서관 cap is fixed at 8 (see check_user_interested_libraries_max).';

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

-- Function: Max 8 관심 도서관 per user (not tied to bookshelf_score)
CREATE OR REPLACE FUNCTION check_user_interested_libraries_max()
RETURNS TRIGGER AS $$
DECLARE
  max_allowed INTEGER := 8;
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.user_interested_libraries
  WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION '관심 도서관은 최대 8개까지 등록할 수 있습니다.';
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

-- 3.7 Notifications
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

-- 3.8 Push subscriptions (PWA)
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

-- 3.9 Hybrid chat (negotiation threads)
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  initiator_offer_book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  status public.chat_room_status NOT NULL DEFAULT 'NEGOTIATING',
  left_by_user_ids UUID[] NOT NULL DEFAULT '{}',
  appointment_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_rooms_distinct_participants CHECK (initiator_id <> receiver_id)
);

COMMENT ON TABLE public.chat_rooms IS 'Negotiation thread tied to a listed book; offer book may change over time.';
COMMENT ON COLUMN public.chat_rooms.post_book_id IS 'Book that was originally requested (receiver''s listing).';
COMMENT ON COLUMN public.chat_rooms.initiator_offer_book_id IS 'Book offered in return; nullable until chosen; may be updated.';
COMMENT ON COLUMN public.chat_rooms.left_by_user_ids IS 'Participants who removed this room from their chat list; they remain initiator/receiver for RLS.';
COMMENT ON COLUMN public.chat_rooms.appointment_at IS 'Confirmed meet time after receiver accepts a SYSTEM_APPOINTMENT proposal.';

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_type public.chat_message_type NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.messages IS 'Chat lines: plain TEXT or JSON string in content for SYSTEM_* types.';
COMMENT ON COLUMN public.messages.content IS 'Plain text for TEXT; JSON string for system action payloads.';
COMMENT ON COLUMN public.messages.participant_ids IS 'Room participants [initiator_id, receiver_id]; copied on insert for RLS without subqueries.';

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 3.10 Chat read cursors (unread badges)
CREATE TABLE public.chat_room_reads (
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

COMMENT ON TABLE public.chat_room_reads IS 'Last time each participant read the thread; used for unread badges.';

-- 3.11 Updated_at & bookshelf helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_bookshelf_score(user_ids UUID[], delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.users SET bookshelf_score = bookshelf_score + delta WHERE id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER books_updated_at BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER exchanges_updated_at BEFORE UPDATE ON public.exchanges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

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

CREATE INDEX idx_messages_room_created ON public.messages (room_id, created_at DESC);
CREATE INDEX idx_chat_rooms_post_book ON public.chat_rooms (post_book_id);
CREATE INDEX idx_chat_rooms_initiator ON public.chat_rooms (initiator_id);
CREATE INDEX idx_chat_rooms_receiver ON public.chat_rooms (receiver_id);
CREATE INDEX idx_chat_room_reads_user ON public.chat_room_reads (user_id);

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
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_reads ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "chat_rooms_select_participants"
  ON public.chat_rooms FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_rooms_insert_participants"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_rooms_update_participants"
  ON public.chat_rooms FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_select_by_participant_ids"
  ON public.messages FOR SELECT
  USING (auth.uid() = ANY (participant_ids));

CREATE POLICY "messages_insert_by_participant_ids"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = ANY (participant_ids)
      OR auth.uid() = sender_id
    )
  );

CREATE POLICY "chat_room_reads_select_own"
  ON public.chat_room_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "chat_room_reads_insert_own"
  ON public.chat_room_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_room_reads_update_own"
  ON public.chat_room_reads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_room_reads_delete_own"
  ON public.chat_room_reads FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT on notifications is intended for service role / server-side only (bypasses RLS).
