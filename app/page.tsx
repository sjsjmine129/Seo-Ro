import { createClient } from "@/utils/supabase/server";
import BottomNav from "@/components/BottomNav";
import LibraryFilter from "@/components/LibraryFilter";
import { BookOpen, Library } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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
								href="/search"
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
								<Link
									key={book.id}
									href={`/book/${book.id}`}
									className="block transition-opacity hover:opacity-95"
								>
									<article className="flex gap-4 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
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
								</Link>
							);
						})}
					</div>
				)}
			</main>
			<BottomNav />
		</>
	);
}
