-- Add requester_completed and owner_completed for dual-confirmation exchange completion
ALTER TABLE public.exchanges
ADD COLUMN IF NOT EXISTS requester_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS owner_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exchanges.requester_completed IS 'Requester confirmed they completed the physical book exchange';
COMMENT ON COLUMN public.exchanges.owner_completed IS 'Owner confirmed they completed the physical book exchange';
