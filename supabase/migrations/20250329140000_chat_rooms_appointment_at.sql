-- Persist agreed meeting time for chat header (set when appointment is accepted).
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.chat_rooms.appointment_at IS 'Confirmed meet time after receiver accepts a SYSTEM_APPOINTMENT proposal.';
