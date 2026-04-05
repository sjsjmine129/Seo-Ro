import type { createClient } from "@/utils/supabase/server";

const SCORE_SAME_LIBRARY = 50;
const SCORE_SAME_AUTHOR = 40;
/** DB에 장르 컬럼이 없어 같은 출판사를 유사 분류(장르) 프록시로 사용합니다. */
const SCORE_SIMILAR_GENRE_PUBLISHER = 30;
const SCORE_SAME_OWNER = 20;
const SCORE_NEW_WITHIN_DAYS = 10;
const NEWNESS_MS = 7 * 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 200;
export const RECOMMENDED_COUNT = 10;

export type CurrentBookForRecommendation = {
	id: string;
	owner_id: string;
	authors: string | null;
	publisher: string | null;
	book_libraries: Array<{ library_id: string }>;
};

export type RecommendedBook = {
	id: string;
	title: string;
	thumbnail_url: string | null;
	libraryName: string;
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type LibraryRef = { id: string; name: string };

type BookLibrariesRow = {
	library_id: string;
	libraries: LibraryRef | LibraryRef[] | null;
};

type CandidateRow = {
	id: string;
	owner_id: string;
	title: string;
	authors: string | null;
	publisher: string | null;
	thumbnail_url: string | null;
	created_at: string;
	book_libraries: BookLibrariesRow[] | BookLibrariesRow | null;
};

function singleLibrary(
	lib: LibraryRef | LibraryRef[] | null | undefined,
): LibraryRef | null {
	if (!lib) return null;
	return Array.isArray(lib) ? (lib[0] ?? null) : lib;
}

function normalizeBookLibraries(
	bl: CandidateRow["book_libraries"],
): BookLibrariesRow[] {
	if (!bl) return [];
	return Array.isArray(bl) ? bl : [bl];
}

function firstLibraryName(blRows: BookLibrariesRow[]): string {
	for (const r of blRows) {
		const lib = singleLibrary(r.libraries);
		if (lib?.name) return lib.name;
	}
	return "도서관";
}

function normPublisher(p: string | null): string {
	return p?.trim().toLowerCase() ?? "";
}

function authorTokens(authors: string | null): string[] {
	if (!authors) return [];
	return authors
		.split(/[,，、/|]+/)
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean);
}

function sharesAuthor(a: string | null, b: string | null): boolean {
	const ta = authorTokens(a);
	const tb = authorTokens(b);
	if (ta.length === 0 || tb.length === 0) return false;
	for (const x of ta) {
		for (const y of tb) {
			if (x === y) return true;
			if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)))
				return true;
		}
	}
	return false;
}

/**
 * 현재 책을 제외한 교환 가능 책을 가져와 추천 점수로 정렬한 뒤 상위 N권을 반환합니다.
 */
export async function getRecommendedBooks(
	supabase: SupabaseServer,
	current: CurrentBookForRecommendation,
): Promise<RecommendedBook[]> {
	const currentLibIds = new Set(
		(current.book_libraries ?? []).map((bl) => bl.library_id),
	);

	const { data, error } = await supabase
		.from("books")
		.select(
			`
			id,
			owner_id,
			title,
			authors,
			publisher,
			thumbnail_url,
			created_at,
			book_libraries(library_id, libraries(id, name))
		`,
		)
		.neq("id", current.id)
		.eq("status", "AVAILABLE")
		.order("last_bumped_at", { ascending: false })
		.limit(CANDIDATE_LIMIT);

	if (error || !data?.length) return [];

	const now = Date.now();

	const scored = (data as unknown as CandidateRow[]).map((row) => {
		let score = 0;
		const blRows = normalizeBookLibraries(row.book_libraries);
		const candidateLibIds = blRows.map((r) => r.library_id);

		if (candidateLibIds.some((lid) => currentLibIds.has(lid))) {
			score += SCORE_SAME_LIBRARY;
		}
		if (sharesAuthor(current.authors, row.authors)) {
			score += SCORE_SAME_AUTHOR;
		}
		const pubA = normPublisher(current.publisher);
		const pubB = normPublisher(row.publisher);
		if (pubA && pubA === pubB) {
			score += SCORE_SIMILAR_GENRE_PUBLISHER;
		}
		if (row.owner_id === current.owner_id) {
			score += SCORE_SAME_OWNER;
		}
		const createdMs = new Date(row.created_at).getTime();
		if (!Number.isNaN(createdMs) && now - createdMs <= NEWNESS_MS) {
			score += SCORE_NEW_WITHIN_DAYS;
		}

		return {
			score,
			id: row.id,
			title: row.title,
			thumbnail_url: row.thumbnail_url,
			libraryName: firstLibraryName(blRows),
		};
	});

	return scored
		.sort((a, b) => b.score - a.score)
		.slice(0, RECOMMENDED_COUNT)
		.map(({ score: _score, ...rest }) => rest);
}
