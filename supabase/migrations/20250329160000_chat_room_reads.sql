-- Per-user read cursor for hybrid chat (unread dots on list + bottom nav).
CREATE TABLE public.chat_room_reads (
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_chat_room_reads_user ON public.chat_room_reads (user_id);

COMMENT ON TABLE public.chat_room_reads IS 'Last time each participant read the thread; used for unread badges.';

ALTER TABLE public.chat_room_reads ENABLE ROW LEVEL SECURITY;

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
