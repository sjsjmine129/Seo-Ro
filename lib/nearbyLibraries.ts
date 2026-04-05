import type { createClient } from "@/utils/supabase/server";

const EARTH_RADIUS_KM = 6371;
/** Number of closest libraries to return (5–10 range). */
export const NEARBY_LIBRARY_COUNT = 8;
/** ~±20km latitude band; Haversine sorts exact order. */
const BBOX_PAD_DEG = 0.2;
/** Fallback row cap when the bbox returns too few rows (dense cities rarely need this). */
const FALLBACK_FETCH_CAP = 1200;

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type CurrentLibraryForNearby = {
	id: string;
	lat: number;
	lng: number;
};

export type NearbyLibraryItem = {
	id: string;
	name: string;
	address: string | null;
	distanceKm: number;
	/** Up to 3 `thumbnail_url` values from recently bumped AVAILABLE books. */
	bookThumbnails: string[];
	/** Count of books with `status = AVAILABLE` at this library. */
	totalBooks: number;
};

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometers (Haversine). */
export function haversineDistanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

export function formatDistanceLabel(km: number): string {
	if (!Number.isFinite(km) || km < 0) return "—";
	if (km < 1) return `${Math.max(1, Math.round(km * 1000))}m`;
	return `${km.toFixed(1)}km`;
}

type LibraryRow = {
	id: string;
	name: string;
	address: string | null;
	lat: string | number;
	lng: string | number;
};

type BookAtLibraryRow = {
	id: string;
	thumbnail_url: string | null;
	status: string;
	last_bumped_at: string;
};

type BookLibraryJoinRow = {
	library_id: string;
	books: BookAtLibraryRow | BookAtLibraryRow[] | null;
};

const MAX_THUMB_PREVIEWS = 3;

function normalizeJoinedBook(
	books: BookLibraryJoinRow["books"],
): BookAtLibraryRow | null {
	if (!books) return null;
	return Array.isArray(books) ? (books[0] ?? null) : books;
}

async function attachBookStats(
	supabase: SupabaseServer,
	libraries: Omit<NearbyLibraryItem, "bookThumbnails" | "totalBooks">[],
): Promise<NearbyLibraryItem[]> {
	if (libraries.length === 0) return [];

	const ids = libraries.map((l) => l.id);

	const { data, error } = await supabase
		.from("book_libraries")
		.select(
			`
			library_id,
			books ( id, thumbnail_url, status, last_bumped_at )
		`,
		)
		.in("library_id", ids);

	if (error || !data?.length) {
		return libraries.map((l) => ({
			...l,
			bookThumbnails: [],
			totalBooks: 0,
		}));
	}

	type Entry = { thumb: string | null; bumped: string };
	const byLib = new Map<string, Entry[]>();

	for (const row of data as BookLibraryJoinRow[]) {
		const book = normalizeJoinedBook(row.books);
		if (!book || book.status !== "AVAILABLE") continue;
		const list = byLib.get(row.library_id) ?? [];
		list.push({
			thumb: book.thumbnail_url,
			bumped: book.last_bumped_at ?? "",
		});
		byLib.set(row.library_id, list);
	}

	return libraries.map((lib) => {
		const entries = byLib.get(lib.id) ?? [];
		entries.sort((a, b) => b.bumped.localeCompare(a.bumped));
		const totalBooks = entries.length;
		const bookThumbnails = entries
			.map((e) => e.thumb)
			.filter((u): u is string => Boolean(u))
			.slice(0, MAX_THUMB_PREVIEWS);

		return {
			...lib,
			bookThumbnails,
			totalBooks,
		};
	});
}

/**
 * Loads libraries from Supabase, scores by Haversine distance from the current hub,
 * excludes the current library, returns the closest {@link NEARBY_LIBRARY_COUNT}.
 */
export async function getNearbyLibraries(
	supabase: SupabaseServer,
	current: CurrentLibraryForNearby,
): Promise<NearbyLibraryItem[]> {
	const originLat = current.lat;
	const originLng = current.lng;

	const bbox = await supabase
		.from("libraries")
		.select("id, name, address, lat, lng")
		.neq("id", current.id)
		.gte("lat", originLat - BBOX_PAD_DEG)
		.lte("lat", originLat + BBOX_PAD_DEG)
		.gte("lng", originLng - BBOX_PAD_DEG)
		.lte("lng", originLng + BBOX_PAD_DEG);

	let rows: LibraryRow[] = !bbox.error
		? ((bbox.data ?? []) as LibraryRow[])
		: [];

	if (rows.length < NEARBY_LIBRARY_COUNT) {
		const wide = await supabase
			.from("libraries")
			.select("id, name, address, lat, lng")
			.neq("id", current.id)
			.limit(FALLBACK_FETCH_CAP);
		if (!wide.error && wide.data?.length) {
			rows = wide.data as LibraryRow[];
		}
	}

	if (!rows.length) return [];

	const scored = rows
		.map((row) => {
			const lat = Number(row.lat);
			const lng = Number(row.lng);
			if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
			const distanceKm = haversineDistanceKm(
				originLat,
				originLng,
				lat,
				lng,
			);
			return {
				id: row.id,
				name: row.name,
				address: row.address ?? null,
				distanceKm,
			};
		})
		.filter(
			(
				x,
			): x is {
				id: string;
				name: string;
				address: string | null;
				distanceKm: number;
			} => x !== null,
		);

	const closest = scored
		.sort((a, b) => a.distanceKm - b.distanceKm)
		.slice(0, NEARBY_LIBRARY_COUNT);

	return attachBookStats(supabase, closest);
}
