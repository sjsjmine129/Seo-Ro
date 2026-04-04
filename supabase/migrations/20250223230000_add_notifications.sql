-- =============================================================================
-- Notifications table for Seo-Ro exchange events
-- =============================================================================

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

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- INSERT is done via service role (server actions, cron) which bypasses RLS

COMMENT ON TABLE public.notifications IS 'User notifications for exchange events and system messages';
