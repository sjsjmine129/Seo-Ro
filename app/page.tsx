import { createClient } from "@/utils/supabase/server";
import BottomNav from "@/components/BottomNav";
import LibraryFilter from "@/components/LibraryFilter";
import BookCard from "@/components/BookCard";
import Logo from "@/components/Logo";
import { Library } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

function getLibraryNameFromBook(book: { book_libraries?: unknown }): string {
	const bl = book.book_libraries;
	if (!bl) return "도서관";
	const arr = Array.isArray(bl) ? bl : [bl];
	const first = arr.find(
		(x: { libraries?: { name?: string }; library_id?: string }) =>
			x.libraries,
	);
	if (!first?.libraries) return "도서관";
	const name = (first.libraries as { name?: string }).name;
	return name ?? "도서관";
}

type Library = { id: string; name: string };

async function getUserLibraries(
	supabase: Awaited<
		ReturnType<typeof import("@/utils/supabase/server").createClient>
	>,
	userId: string,
): Promise<Library[]> {
	console.log("[getUserLibraries] userId:", userId);

	const { data, error } = await supabase
		.from("user_interested_libraries")
		.select("library_id, libraries (id, name)")
		.eq("user_id", userId);

	if (error) {
		console.error("[getUserLibraries] Error:", error);
		return [];
	}
	console.log(
		"[getUserLibraries] Raw data from user_interested_libraries:",
		JSON.stringify(data, null, 2),
	);

	const libraries = (data ?? []).map((row: Record<string, unknown>) => {
		const lib = row.libraries;
		const libObj =
			lib && typeof lib === "object" && !Array.isArray(lib)
				? (lib as { id?: string; name?: string })
				: null;
		return {
			id: row.library_id as string,
			name: libObj?.name ?? "Unknown Library",
		};
	});
	console.log("[getUserLibraries] Final mapped libraries:", libraries);
	return libraries;
}

async function getLibraryName(
	supabase: Awaited<
		ReturnType<typeof import("@/utils/supabase/server").createClient>
	>,
	libraryId: string,
): Promise<string | null> {
	const { data } = await supabase
		.from("libraries")
		.select("name")
		.eq("id", libraryId)
		.single();
	return data?.name ?? null;
}

async function getBooks(
	supabase: Awaited<
		ReturnType<typeof import("@/utils/supabase/server").createClient>
	>,
	libraryId: string | undefined,
	userLibraryIds: string[],
) {
	console.log(
		"[getBooks] libraryId:",
		libraryId,
		"userLibraryIds:",
		userLibraryIds,
	);

	const baseSelect =
		"id, title, authors, thumbnail_url, condition, user_review, users!owner_id(nickname, bookshelf_score)";
	const libSelect = "book_libraries!inner(library_id, libraries(id, name))";

	let query;

	if (libraryId && libraryId !== "all") {
		query = supabase
			.from("books")
			.select(`${baseSelect}, ${libSelect}`)
			.eq("status", "AVAILABLE")
			.eq("book_libraries.library_id", libraryId)
			.order("last_bumped_at", { ascending: false });
	} else if (userLibraryIds.length > 0) {
		query = supabase
			.from("books")
			.select(`${baseSelect}, ${libSelect}`)
			.eq("status", "AVAILABLE")
			.in("book_libraries.library_id", userLibraryIds)
			.order("last_bumped_at", { ascending: false });
	} else {
		query = supabase
			.from("books")
			.select(`${baseSelect}, ${libSelect}`)
			.eq("status", "AVAILABLE")
			.order("last_bumped_at", { ascending: false });
	}

	const { data, error } = await query;

	if (error) {
		console.error("[getBooks] Error:", error);
		throw error;
	}
	console.log(
		"[getBooks] Raw data from books:",
		JSON.stringify(data, null, 2),
	);

	// Dedupe by book id (a book can appear in multiple book_libraries rows)
	const seen = new Set<string>();
	return (data ?? []).filter((b) => {
		if (seen.has(b.id)) return false;
		seen.add(b.id);
		return true;
	});
}

export default async function Home({
	searchParams,
}: {
	searchParams: Promise<{ libraryId?: string }>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const searchParamsResolved = await searchParams;
	const { libraryId } = searchParamsResolved;
	console.log("[Home] Resolved searchParams:", searchParamsResolved);

	let libraries: Library[] = [];
	let books: Awaited<ReturnType<typeof getBooks>> = [];
	let selectedLibraryName: string | null = null;
	let errorMessage: string | null = null;

	try {
		libraries = await getUserLibraries(supabase, user.id);
		if (libraryId && libraryId !== "all") {
			selectedLibraryName = await getLibraryName(supabase, libraryId);
		}
		const isInterestedFilter = !libraryId || libraryId === "all";
		const hasNoInterestedLibraries = libraries.length === 0;
		if (isInterestedFilter && hasNoInterestedLibraries) {
			books = [];
		} else {
			books = await getBooks(
				supabase,
				libraryId,
				libraries.map((l) => l.id),
			);
		}
	} catch (err) {
		console.error("[Home] Caught error (full object):", err);
		errorMessage =
			err instanceof Error
				? err.message
				: "Failed to load books. Please try again.";
	}

	const selectedId = libraryId ?? "all";
	const isEmptyInterestedLibraries =
		selectedId === "all" && libraries.length === 0 && books.length === 0;

	return (
		<>
			<main className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<LibraryFilter
					libraries={libraries}
					selectedId={selectedId}
					selectedLibraryName={selectedLibraryName}
				/>

				{errorMessage ? (
					<div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-center text-sm text-red-700">
						{errorMessage}
					</div>
				) : books.length === 0 ? (
					isEmptyInterestedLibraries ? (
						<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-16 text-center">
							<Library
								className="h-16 w-16 text-muted-foreground/50"
								strokeWidth={1.5}
							/>
							<p className="text-center text-muted-foreground">
								관심 도서관이 없네요. 관심도서관을 등록해
								주세요!
							</p>
							<Link
								href="/search?tab=library"
								className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
							>
								도서관 검색하러 가기
							</Link>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
							<p className="text-foreground/70">
								도서관에 등록된 책이 아직 없어요. 제일 먼저 책을
								등록해 보세요!
							</p>
							<Link
								href="/shelve"
								className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
							>
								교환할 책 꽂기
							</Link>
						</div>
					)
				) : (
					<div className="flex flex-col gap-3">
						{books.map((book) => {
							const bl = book.book_libraries;
							const blArr = Array.isArray(bl)
								? bl
								: bl
									? [bl]
									: [];
							const isInterested =
								libraries.length > 0 &&
								blArr.some((x: { library_id?: string }) =>
									libraries.some(
										(l) => l.id === x.library_id,
									),
								);

							return (
								<BookCard
									key={book.id}
									id={book.id}
									title={book.title ?? ""}
									authors={book.authors ?? null}
									thumbnailUrl={book.thumbnail_url ?? null}
									condition={book.condition ?? "B"}
									libraryName={getLibraryNameFromBook(book)}
									isInterestedLibrary={isInterested}
									isSwapped={false}
								/>
							);
						})}
					</div>
				)}
			</main>
			<BottomNav />
		</>
	);
}
