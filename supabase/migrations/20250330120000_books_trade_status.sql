-- Trading / reserved flag for listings (appointment accepted, etc.)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS trade_status TEXT NOT NULL DEFAULT 'AVAILABLE';

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_trade_status_check;

ALTER TABLE public.books
  ADD CONSTRAINT books_trade_status_check
  CHECK (trade_status IN ('AVAILABLE', 'TRADING', 'COMPLETED'));

COMMENT ON COLUMN public.books.trade_status IS 'Listing reservation: AVAILABLE | TRADING (약속 잡힘) | COMPLETED';

CREATE INDEX IF NOT EXISTS idx_books_trade_status_last_bumped
  ON public.books (trade_status, last_bumped_at DESC);
