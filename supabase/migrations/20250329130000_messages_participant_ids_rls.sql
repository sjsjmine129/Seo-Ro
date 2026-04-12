-- Realtime-friendly RLS: avoid EXISTS/subqueries on messages (wal2json often drops events).
-- Denormalize room participants onto each message row.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS participant_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE public.messages m
SET participant_ids = ARRAY[r.initiator_id, r.receiver_id]
FROM public.chat_rooms r
WHERE r.id = m.room_id;

DROP POLICY IF EXISTS "messages_select_room_participants" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_room_participants" ON public.messages;

-- SELECT: single predicate, no joins (Realtime can evaluate inline).
CREATE POLICY "messages_select_by_participant_ids"
  ON public.messages FOR SELECT
  USING (auth.uid() = ANY (participant_ids));

-- INSERT: real sender only; policy shape requested (OR) with spoofing guard on sender_id.
CREATE POLICY "messages_insert_by_participant_ids"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = ANY (participant_ids)
      OR auth.uid() = sender_id
    )
  );

COMMENT ON COLUMN public.messages.participant_ids IS 'Room participants [initiator_id, receiver_id]; copied on insert for RLS without subqueries.';
