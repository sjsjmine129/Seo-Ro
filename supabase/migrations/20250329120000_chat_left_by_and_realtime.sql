-- Users who left hide the room from their list only; other participant still sees the thread.
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS left_by_user_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.chat_rooms.left_by_user_ids IS 'Participants who removed this room from their chat list; they remain initiator/receiver for RLS.';

-- Realtime postgres_changes respects RLS; FULL replica identity helps deliver row payloads reliably.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- If inserts still do not sync to the other client, confirm in Supabase Dashboard:
-- Database → Replication → `messages` is in the `supabase_realtime` publication.
