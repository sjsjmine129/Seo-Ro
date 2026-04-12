-- Hybrid chat rooms for book exchange negotiation (free text + system action cards).

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

CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  initiator_offer_book_id UUID REFERENCES public.books(id) ON DELETE SET NULL,
  status public.chat_room_status NOT NULL DEFAULT 'NEGOTIATING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chat_rooms_distinct_participants CHECK (initiator_id <> receiver_id)
);

COMMENT ON TABLE public.chat_rooms IS 'Negotiation thread tied to a listed book; offer book may change over time.';
COMMENT ON COLUMN public.chat_rooms.post_book_id IS 'Book that was originally requested (receiver''s listing).';
COMMENT ON COLUMN public.chat_rooms.initiator_offer_book_id IS 'Book offered in return; nullable until chosen; may be updated.';

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_type public.chat_message_type NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.messages IS 'Chat lines: plain TEXT or JSON string in content for SYSTEM_* types.';
COMMENT ON COLUMN public.messages.content IS 'Plain text for TEXT; JSON string for system action payloads.';

CREATE INDEX idx_messages_room_created ON public.messages (room_id, created_at DESC);
CREATE INDEX idx_chat_rooms_post_book ON public.chat_rooms (post_book_id);
CREATE INDEX idx_chat_rooms_initiator ON public.chat_rooms (initiator_id);
CREATE INDEX idx_chat_rooms_receiver ON public.chat_rooms (receiver_id);

CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_rooms_select_participants"
  ON public.chat_rooms FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_rooms_insert_participants"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "chat_rooms_update_participants"
  ON public.chat_rooms FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "messages_select_room_participants"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms r
      WHERE r.id = messages.room_id
        AND (r.initiator_id = auth.uid() OR r.receiver_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_room_participants"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_rooms r
      WHERE r.id = room_id
        AND (r.initiator_id = auth.uid() OR r.receiver_id = auth.uid())
    )
  );
