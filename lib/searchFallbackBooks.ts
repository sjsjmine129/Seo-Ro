import type { SupabaseClient } from "@supabase/supabase-js";

export type SearchFallbackBook = {
	id: string;
	title: string;
	thumbnail_url: string | null;
	libraryName: string;
};

type BookLibRow = {
	library_id: string;
	libraries: { id: string; name: string } | null;
};

function normalizeBookLibraries(
	bl: BookLibRow[] | BookLibRow | null,
): { libraryId: string; libraryName: string }[] {
	if (!bl) return [];
	const arr = Array.isArray(bl) ? bl : [bl];
	return arr
		.filter((x) => x.libraries)
		.map((x) => ({
			libraryId: x.library_id,
			libraryName: (x.libraries as { name: string }).name ?? "도서관",
		}));
}

const POOL_LIMIT = 48;
export const SEARCH_FALLBACK_COUNT = 10;

/**
 * Recent AVAILABLE books, preferring the user's interested libraries when set.
 */
export async function fetchSearchFallbackBooks(
	supabase: SupabaseClient,
): Promise<SearchFallbackBook[]> {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	let libraryIds: string[] = [];
	if (user) {
		const { data: libData } = await supabase
			.from("user_interested_libraries")
			.select("library_id")
			.eq("user_id", user.id);
		libraryIds = (libData ?? []).map((r) => r.library_id);
	}

	let query = supabase
		.from("books")
		.select(
			"id, title, thumbnail_url, book_libraries!inner(library_id, libraries(id, name))",
		)
		.eq("status", "AVAILABLE")
		.order("last_bumped_at", { ascending: false })
		.limit(POOL_LIMIT);

	if (libraryIds.length > 0) {
		query = query.in("book_libraries.library_id", libraryIds);
	}

	const { data, error } = await query;
	if (error || !data?.length) return [];

	const seen = new Set<string>();
	const result: SearchFallbackBook[] = [];

	for (const row of data as unknown as Array<{
		id: string;
		title: string;
		thumbnail_url: string | null;
		book_libraries: BookLibRow[] | BookLibRow | null;
	}>) {
		if (seen.has(row.id)) continue;
		seen.add(row.id);
		const libs = normalizeBookLibraries(row.book_libraries);
		if (libs.length === 0) continue;
		result.push({
			id: row.id,
			title: row.title,
			thumbnail_url: row.thumbnail_url,
			libraryName: libs[0].libraryName,
		});
		if (result.length >= SEARCH_FALLBACK_COUNT) break;
	}

	return result;
}
