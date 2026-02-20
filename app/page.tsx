import { createClient } from "@/utils/supabase/server";
import BottomNav from "@/components/BottomNav";
import LibraryFilter from "@/components/LibraryFilter";
import { BookOpen } from "lucide-react";
import Link from "next/link";

const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111";

type Library = { id: string; name: string };

async function getUserLibraries(
	supabase: Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>,
): Promise<Library[]> {
	console.log("[getUserLibraries] MOCK_USER_ID:", MOCK_USER_ID);

	const { data, error } = await supabase
		.from("user_interested_libraries")
		.select("library_id, libraries (id, name)")
		.eq("user_id", MOCK_USER_ID);

	if (error) {
		console.error("[getUserLibraries] Error:", error);
		return [];
	}
	console.log("[getUserLibraries] Raw data from user_interested_libraries:", JSON.stringify(data, null, 2));

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

async function getBooks(
	supabase: Awaited<ReturnType<typeof import("@/utils/supabase/server").createClient>>,
	libraryId: string | undefined,
	userLibraryIds: string[],
) {
	console.log("[getBooks] libraryId:", libraryId, "userLibraryIds:", userLibraryIds);

	const baseSelect =
		"id, title, authors, thumbnail_url, condition, user_review, users!owner_id(nickname, bookshelf_score)";

	let query;

	if (libraryId && libraryId !== "all") {
		query = supabase
			.from("books")
			.select(`${baseSelect}, book_libraries!inner(library_id)`)
			.eq("status", "AVAILABLE")
			.eq("book_libraries.library_id", libraryId)
			.order("last_bumped_at", { ascending: false });
	} else if (userLibraryIds.length > 0) {
		query = supabase
			.from("books")
			.select(`${baseSelect}, book_libraries!inner(library_id)`)
			.eq("status", "AVAILABLE")
			.in("book_libraries.library_id", userLibraryIds)
			.order("last_bumped_at", { ascending: false });
	} else {
		query = supabase
			.from("books")
			.select(baseSelect)
			.eq("status", "AVAILABLE")
			.order("last_bumped_at", { ascending: false });
	}

	const { data, error } = await query;

	if (error) {
		console.error("[getBooks] Error:", error);
		throw error;
	}
	console.log("[getBooks] Raw data from books:", JSON.stringify(data, null, 2));

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
	const searchParamsResolved = await searchParams;
	const { libraryId } = searchParamsResolved;
	console.log("[Home] Resolved searchParams:", searchParamsResolved);

	let libraries: Library[] = [];
	let books: Awaited<ReturnType<typeof getBooks>> = [];
	let errorMessage: string | null = null;

	try {
		libraries = await getUserLibraries(supabase);
		books = await getBooks(supabase, libraryId, libraries.map((l) => l.id));
	} catch (err) {
		console.error("[Home] Caught error (full object):", err);
		errorMessage =
			err instanceof Error
				? err.message
				: "Failed to load books. Please try again.";
	}

	const selectedId = libraryId ?? "all";

	return (
		<>
			<main className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<LibraryFilter libraries={libraries} selectedId={selectedId} />

				{errorMessage ? (
					<div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-center text-sm text-red-700">
						{errorMessage}
					</div>
				) : books.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
						<p className="text-foreground/70">
							No books shelved here yet. Be the first!
						</p>
						<Link
							href="/shelve"
							className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
						>
							Shelve Book
						</Link>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{books.map((book) => {
							const owner =
								book.users &&
								typeof book.users === "object" &&
								!Array.isArray(book.users)
									? (book.users as {
											nickname: string | null;
											bookshelf_score: number;
										})
									: null;

							return (
								<article
									key={book.id}
									className="flex gap-4 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md"
								>
									{/* Thumbnail */}
									<div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-200 shadow-sm">
										{book.thumbnail_url ? (
											<img
												src={book.thumbnail_url}
												alt={book.title ?? "Book cover"}
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center bg-neutral-200 text-neutral-400">
												<BookOpen
													className="h-10 w-10"
													strokeWidth={1.5}
												/>
											</div>
										)}
									</div>

									{/* Details */}
									<div className="min-w-0 flex-1">
										<h2 className="truncate text-lg font-bold text-foreground">
											{book.title}
										</h2>
										<p className="text-sm text-neutral-500">
											{book.authors ?? "Unknown author"}
										</p>
										<span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
											{book.condition}급
										</span>
										{book.user_review && (
											<blockquote className="mt-2 rounded-md bg-white/40 p-2 text-sm italic text-gray-700">
												{book.user_review}
											</blockquote>
										)}
										{owner && (
											<p className="mt-2 text-right text-xs text-neutral-400">
												{owner.nickname ?? "Anonymous"}{" "}
												· {owner.bookshelf_score ?? 0}{" "}
												Vol
											</p>
										)}
									</div>
								</article>
							);
						})}
					</div>
				)}
			</main>
			<BottomNav />
		</>
	);
}
