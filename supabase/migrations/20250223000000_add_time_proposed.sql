-- Add TIME_PROPOSED to exchange_status enum
ALTER TYPE exchange_status ADD VALUE IF NOT EXISTS 'TIME_PROPOSED';

-- Add proposed_times column (array of ISO timestamp strings)
ALTER TABLE public.exchanges
ADD COLUMN IF NOT EXISTS proposed_times JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.exchanges.proposed_times IS 'Array of proposed meeting times as ISO strings, e.g. ["2025-02-23T07:00:00+09:00", ...]';
