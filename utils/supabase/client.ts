import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. `createBrowserClient` from `@supabase/ssr` uses an
 * internal singleton in the browser, so repeated calls share one connection
 * (correct for Realtime + auth cookie sync). Use this for all client components.
 */
export function createClient() {
	return createBrowserClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	);
}
