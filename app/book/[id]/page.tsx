import { createClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, User, Quote } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import BackButton from "@/components/BackButton";
import BookImageCarousel from "@/components/BookImageCarousel";
import ConditionBadgeWithTooltip from "@/components/ConditionBadgeWithTooltip";

const CONDITION_LABELS: Record<string, string> = {
	S: "S급",
	A: "A급",
	B: "B급",
	C: "C급",
	D: "D급",
};

const CONDITION_COLORS: Record<string, string> = {
	S: "bg-primary text-white",
	A: "bg-primary/80 text-white",
	B: "bg-primary/60 text-white",
	C: "bg-neutral-500 text-white",
	D: "bg-neutral-400 text-white",
};

type BookDetail = {
	id: string;
	title: string;
	authors: string | null;
	publisher: string | null;
	user_images: string[];
	user_review: string | null;
	condition: string;
	status: string;
	owner: {
		nickname: string | null;
		profile_image: string | null;
		bookshelf_score: number;
	} | null;
	book_libraries: Array<{
		library_id: string;
		libraries: {
			id: string;
			name: string;
		} | null;
	}>;
};

async function getBookDetail(
	supabase: Awaited<ReturnType<typeof createClient>>,
	bookId: string,
): Promise<BookDetail | null> {
	const { data, error } = await supabase
		.from("books")
		.select(
			`
			id, title, authors, publisher, user_images, user_review, condition, status,
			owner:users!owner_id(nickname, profile_image, bookshelf_score),
			book_libraries(library_id, libraries(id, name))
		`,
		)
		.eq("id", bookId)
		.single();

	if (error || !data) return null;

	return data as unknown as BookDetail;
}

export default async function BookDetailPage({
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
	const book = await getBookDetail(supabase, id);

	if (!book) notFound();

	const library = book.book_libraries?.[0]?.libraries ?? null;
	const conditionColor =
		CONDITION_COLORS[book.condition] ?? CONDITION_COLORS.B;
	const conditionLabel =
		CONDITION_LABELS[book.condition] ?? book.condition + "급";
	const isAvailable = book.status === "AVAILABLE";

	return (
		<>
			<div className="relative mx-auto flex min-h-screen max-w-lg flex-col pb-40">
				{/* Sticky header: BackButton (left) + Library badge (right). Content scrolls behind. */}
				<div
					className="sticky z-40 mb-4 flex justify-between items-center px-4 "
					style={{
						top: "calc(1rem + env(safe-area-inset-top, 0px))",
					}}
				>
					<BackButton />
					{library && (
						<Link
							href={`/library/${library.id}`}
							className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-md transition-opacity hover:bg-white/80"
						>
							<MapPin
								className="h-4 w-4 flex-shrink-0 text-primary"
								strokeWidth={2}
							/>
							<span className="text-sm font-medium text-foreground">
								{library.name}
							</span>
						</Link>
					)}
				</div>

				<main className="flex flex-col px-6 pt-2">
					{/* Image Carousel */}
					<div className="overflow-hidden rounded-2xl border border-white/40 bg-white/60 shadow-sm">
						<BookImageCarousel
							images={book.user_images ?? []}
							alt={book.title}
						/>
					</div>

					{/* Book Header: Title + Author/Publisher | User Profile */}
					<section className="mt-4">
						<div className="flex justify-between items-start gap-4">
							{/* Left: Title + Badge, then Author/Publisher */}
							<div className="min-w-0 flex-1 flex flex-col">
								<div className="flex items-center gap-2 flex-wrap">
									<h1 className="text-xl font-bold text-foreground">
										{book.title}
									</h1>
									<ConditionBadgeWithTooltip
										label={conditionLabel}
										className={conditionColor}
									/>
								</div>
								<div className="mt-1 flex flex-col gap-0.5 text-sm text-foreground/70">
									{book.authors && (
										<span>저자: {book.authors}</span>
									)}
									{book.publisher && (
										<span>출판사: {book.publisher}</span>
									)}
								</div>
							</div>
							{/* Right: Owner Profile - horizontal card */}
							<div className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-white/40 bg-white/60 p-2.5 shadow-sm">
								{book.owner?.profile_image ? (
									<img
										src={book.owner.profile_image}
										alt={book.owner.nickname ?? "Owner"}
										className="h-10 w-10 rounded-full object-cover ring-2 ring-white/60"
									/>
								) : (
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-300 text-neutral-600">
										<User
											className="h-5 w-5"
											strokeWidth={2}
										/>
									</div>
								)}
								<div className="flex flex-col items-start">
									<p className="max-w-[80px] truncate text-sm font-medium text-foreground">
										{book.owner?.nickname ?? "알 수 없음"}
									</p>
									<span className="mt-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
										책장 점수{" "}
										{book.owner?.bookshelf_score ?? 0}권
									</span>
								</div>
							</div>
						</div>
					</section>

					{/* User Review Section */}
					{book.user_review && (
						<section className="mt-4">
							<blockquote className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/70 px-4 py-4 backdrop-blur-md">
								<Quote
									className="h-6 w-6 flex-shrink-0 text-primary/40"
									strokeWidth={1.5}
								/>
								<p className="text-sm italic leading-relaxed text-foreground/90">
									{book.user_review}
								</p>
							</blockquote>
						</section>
					)}
				</main>

				{/* Floating Bottom Action */}
				<div
					className="fixed left-0 right-0 z-40 px-4"
					style={{
						bottom: "calc(65px + 16px + env(safe-area-inset-bottom))",
					}}
				>
					<div className="mx-auto max-w-lg">
						<button
							type="button"
							disabled={!isAvailable}
							className={`w-full rounded-xl py-4 text-base font-semibold text-white shadow-lg transition-all ${
								isAvailable
									? "bg-primary hover:opacity-90 active:scale-[0.99]"
									: "cursor-not-allowed bg-neutral-400"
							}`}
						>
							{isAvailable ? "바꿔읽기" : "교환 중인 책입니다"}
						</button>
					</div>
				</div>
			</div>

			<BottomNav />
		</>
	);
}
