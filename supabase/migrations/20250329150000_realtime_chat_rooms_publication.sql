-- Deliver chat_rooms UPDATE events to Realtime (header: books, status, appointment_at).
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_publication_tables
		WHERE pubname = 'supabase_realtime'
			AND schemaname = 'public'
			AND tablename = 'chat_rooms'
	) THEN
		ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
	END IF;
END $$;
