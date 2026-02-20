import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ChevronRight, BookOpen } from "lucide-react";
import NaverMap from "@/components/NaverMap";
import BottomNav from "@/components/BottomNav";
import LibraryDetailClient from "./LibraryDetailClient";
import { addInterest, removeInterest } from "./actions";

function getMaxAllowed(bookshelfScore: number): number {
	if (bookshelfScore < 10) return 2;
	if (bookshelfScore < 30) return 3;
	if (bookshelfScore < 50) return 4;
	return 5;
}

type Book = {
	id: string;
	title: string;
	authors: string | null;
	thumbnail_url: string | null;
	condition: string;
};

async function getLibrary(
	supabase: Awaited<ReturnType<typeof createClient>>,
	id: string,
) {
	const { data, error } = await supabase
		.from("libraries")
		.select("id, name, library_type, address, homepage_url, lat, lng")
		.eq("id", id)
		.single();

	if (error || !data) return null;
	return data;
}

async function getBooksAtLibrary(
	supabase: Awaited<ReturnType<typeof createClient>>,
	libraryId: string,
): Promise<Book[]> {
	const { data, error } = await supabase
		.from("books")
		.select(
			"id, title, authors, thumbnail_url, condition, book_libraries!inner(library_id)",
		)
		.eq("status", "AVAILABLE")
		.eq("book_libraries.library_id", libraryId)
		.order("last_bumped_at", { ascending: false })
		.limit(6);

	if (error) return [];

	return (data ?? []).map((b) => ({
		id: b.id,
		title: b.title,
		authors: b.authors ?? null,
		thumbnail_url: b.thumbnail_url ?? null,
		condition: b.condition ?? "B",
	}));
}

export default async function LibraryDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	const { id } = await params;

	const [library, books] = await Promise.all([
		getLibrary(supabase, id),
		getBooksAtLibrary(supabase, id),
	]);

	if (!library) notFound();

	const { data: userLibraries } = await supabase
		.from("user_interested_libraries")
		.select("library_id")
		.eq("user_id", user.id);

	const interestedIds = new Set(
		(userLibraries ?? []).map((r) => r.library_id),
	);
	const isInterested = interestedIds.has(id);
	const userLibraryCount = userLibraries?.length ?? 0;

	const { data: profile } = await supabase
		.from("users")
		.select("bookshelf_score")
		.eq("id", user.id)
		.single();

	const bookshelfScore = profile?.bookshelf_score ?? 1;
	const maxAllowed = getMaxAllowed(bookshelfScore);

	const homeUrl = `/?libraryId=${id}`;

	return (
		<>
			<div className="flex min-h-screen flex-col bg-background px-4 pb-36 pt-6">
				<NaverMap
					lat={Number(library.lat)}
					lng={Number(library.lng)}
					libraryName={library.name}
				/>

				{/* Header */}
				<h1 className="text-xl font-bold text-foreground">
					{library.name}
				</h1>
				{library.address && (
					<p className="mt-1 flex items-start gap-2 text-sm text-foreground/70">
						<MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary/70" />
						{library.address}
					</p>
				)}

				{/* Action buttons */}
				<div className="mt-6">
					<LibraryDetailClient
						library={{
							id: library.id,
							name: library.name,
							address: library.address ?? null,
							homepage_url: library.homepage_url ?? null,
						}}
						isInterested={isInterested}
						userLibraryCount={userLibraryCount}
						maxAllowed={maxAllowed}
						onAddInterest={addInterest}
						onRemoveInterest={removeInterest}
					/>
				</div>

				{/* Recent books */}
				<section className="mt-8">
					<h2 className="mb-3 text-base font-semibold text-foreground">
						이 도서관에 새로 꽂힌 책
					</h2>
					{books.length === 0 ? (
						<p className="rounded-xl border border-white/40 bg-white/60 py-8 text-center text-sm text-foreground/60">
							등록된 책이 없습니다. <br />이 도서관에 제일 먼저
							책을 꽂아주세요!
						</p>
					) : (
						<div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
							{books.map((book) => (
								<Link
									key={book.id}
									href={`/book/${book.id}`}
									className="flex w-[110px] flex-none flex-col overflow-hidden rounded-xl border border-white/40 bg-white/90 shadow-sm backdrop-blur-md sm:w-[130px]"
								>
									<div className="relative aspect-[3/4] w-full bg-neutral-200">
										{book.thumbnail_url ? (
											<img
												src={book.thumbnail_url}
												alt={book.title}
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-neutral-400">
												<BookOpen
													className="h-10 w-10"
													strokeWidth={1.5}
												/>
											</div>
										)}
										<span className="absolute right-1 top-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
											{book.condition}급
										</span>
									</div>
									<div className="p-2">
										<p className="line-clamp-2 text-sm font-medium text-foreground">
											{book.title}
										</p>
										<p className="mt-0.5 truncate text-xs text-foreground/60">
											{book.authors ?? "—"}
										</p>
									</div>
								</Link>
							))}
							<Link
								href={homeUrl}
								className="flex w-[110px] flex-none flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-8 text-primary sm:w-[130px]"
							>
								<ChevronRight className="h-6 w-6" />
								<span className="text-center text-sm font-medium">
									이 도서관에 꽂힌 책
									<br />
									전체 보기
								</span>
							</Link>
						</div>
					)}
				</section>
			</div>

			{/* Floating bottom button - above BottomNav */}
			<Link
				href={homeUrl}
				className="fixed left-0 right-0 z-40 flex items-center justify-center bg-primary py-4 text-base font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
				style={{ bottom: "calc(65px + env(safe-area-inset-bottom))" }}
			>
				해당 도서관에 꽂힌 책 보기
			</Link>

			<BottomNav />
		</>
	);
}
