/* eslint-disable @next/next/no-img-element */
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/app/mypage/LogoutButton";
import ProfileSection from "@/app/mypage/ProfileSection";
import { BookOpen, ArrowRight } from "lucide-react";

const ONGOING_STATUSES = [
	"REQUESTED",
	"COUNTER_REQUESTED",
	"ACCEPTED",
	"SCHEDULED",
	"TIME_PROPOSED",
];
const ENDED_STATUSES = ["COMPLETED", "CANCELED", "REJECTED"];

const STATUS_LABELS: Record<string, string> = {
	REQUESTED: "교환 요청됨",
	COUNTER_REQUESTED: "다른 책 요청됨",
	ACCEPTED: "수락됨",
	SCHEDULED: "시간 조율 중",
	TIME_PROPOSED: "시간 제안됨",
	COMPLETED: "교환 완료",
	CANCELED: "취소됨",
	REJECTED: "거절됨",
};

type ExchangeWithBooks = {
	id: string;
	status: string;
	requester_id: string;
	owner_id: string;
	requester_book: { id: string; title: string; thumbnail_url: string | null };
	owner_book: { id: string; title: string; thumbnail_url: string | null };
};

type UserProfile = {
	nickname: string;
	profile_image: string | null;
	bookshelf_score: number;
};

type LibraryItem = { id: string; name: string };
type BookItem = { id: string; title: string; thumbnail_url: string | null };

async function getUserProfile(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
): Promise<UserProfile | null> {
	const { data, error } = await supabase
		.from("users")
		.select("nickname, profile_image, bookshelf_score")
		.eq("id", userId)
		.single();
	if (error || !data) return null;
	return data as UserProfile;
}

async function getInterestedLibraries(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
): Promise<LibraryItem[]> {
	const { data, error } = await supabase
		.from("user_interested_libraries")
		.select("library_id, libraries (id, name)")
		.eq("user_id", userId);
	if (error) return [];

	return (data ?? []).map((row: Record<string, unknown>) => {
		const lib = row.libraries;
		const libObj =
			lib && typeof lib === "object" && !Array.isArray(lib)
				? (lib as { id?: string; name?: string })
				: null;
		return {
			id: row.library_id as string,
			name: libObj?.name ?? "Unknown",
		};
	});
}

async function getAllExchanges(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
): Promise<ExchangeWithBooks[]> {
	const { data, error } = await supabase
		.from("exchanges")
		.select(
			`
			id, status, requester_id, owner_id,
			requester_book:books!requester_book_id(id, title, thumbnail_url),
			owner_book:books!owner_book_id(id, title, thumbnail_url)
		`,
		)
		.or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
		.order("created_at", { ascending: false });

	if (error) return [];

	const normalized = (data ?? []).map((row: Record<string, unknown>) => {
		const rb = row.requester_book;
		const ob = row.owner_book;
		return {
			id: row.id,
			status: row.status,
			requester_id: row.requester_id,
			owner_id: row.owner_id,
			requester_book: Array.isArray(rb) ? rb[0] : rb,
			owner_book: Array.isArray(ob) ? ob[0] : ob,
		};
	}) as ExchangeWithBooks[];

	// Sort: ongoing first, then ended
	return normalized.sort((a, b) => {
		const aOngoing = ONGOING_STATUSES.includes(a.status);
		const bOngoing = ONGOING_STATUSES.includes(b.status);
		if (aOngoing && !bOngoing) return -1;
		if (!aOngoing && bOngoing) return 1;
		return 0;
	});
}

async function getMyBooks(
	supabase: Awaited<ReturnType<typeof createClient>>,
	userId: string,
): Promise<BookItem[]> {
	const { data, error } = await supabase
		.from("books")
		.select("id, title, thumbnail_url")
		.eq("owner_id", userId)
		.order("created_at", { ascending: false })
		.limit(50);

	if (error) return [];
	return (data ?? []) as BookItem[];
}

export default async function MyPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	const [profile, libraries, exchanges, books] = await Promise.all([
		getUserProfile(supabase, user.id),
		getInterestedLibraries(supabase, user.id),
		getAllExchanges(supabase, user.id),
		getMyBooks(supabase, user.id),
	]);

	const displayProfile = profile ?? {
		nickname: user.email?.split("@")[0] ?? "User",
		profile_image: null,
		bookshelf_score: 1,
	};

	return (
		<>
			<div className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<main className="mx-auto w-full max-w-lg space-y-6">
					<h1 className="text-xl font-bold text-foreground">마이페이지</h1>

					{/* Profile Section */}
					<ProfileSection
						nickname={displayProfile.nickname}
						profileImage={displayProfile.profile_image}
						bookshelfScore={displayProfile.bookshelf_score}
						libraries={libraries}
					/>

					{/* Exchanges Section - Horizontal Scroll */}
					<section>
						<h2 className="mb-3 text-base font-semibold text-foreground">
							내 교환 내역
						</h2>
						<div className="flex snap-x gap-4 overflow-x-auto pb-4 scroll-smooth [-webkit-overflow-scrolling:touch]">
							{exchanges.length === 0 ? (
								<div className="flex min-w-full flex-col items-center justify-center rounded-2xl border border-primary/20 bg-white/60 py-12 backdrop-blur-md">
									<BookOpen className="mb-2 h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
									<p className="text-center text-sm text-muted-foreground">
										아직 진행 중인 교환이 없어요. 원하는 책을 찾아보세요!
									</p>
								</div>
							) : (
								exchanges.map((ex) => {
									const isRequester = ex.requester_id === user.id;
									const myBook = isRequester ? ex.requester_book : ex.owner_book;
									const theirBook = isRequester ? ex.owner_book : ex.requester_book;
									const statusLabel = STATUS_LABELS[ex.status] ?? ex.status;
									const isEnded = ENDED_STATUSES.includes(ex.status);

									return (
										<Link
											key={ex.id}
											href={`/exchange/${ex.id}`}
											className={`flex w-56 min-w-56 snap-center flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-primary/20 p-4 shadow-sm backdrop-blur-md transition-opacity hover:opacity-90 ${
												isEnded ? "bg-neutral-100/80 opacity-60 grayscale-[50%]" : "bg-white/60"
											}`}
										>
											<span className="mb-3 block text-xs font-medium text-primary">
												{statusLabel}
											</span>
											<div className="flex flex-1 items-center justify-center gap-2 py-2">
												<div className="flex h-32 w-24 flex-shrink-0 overflow-hidden rounded-md bg-neutral-200 shadow-sm">
													{myBook?.thumbnail_url ? (
														<img
															src={myBook.thumbnail_url}
															alt={myBook?.title ?? ""}
															className="h-full w-full object-cover"
														/>
													) : (
														<div className="flex h-full w-full items-center justify-center">
															<BookOpen className="h-10 w-10 text-neutral-400" strokeWidth={1.5} />
														</div>
													)}
												</div>
												<ArrowRight className="h-5 w-5 flex-shrink-0 text-muted-foreground/60" strokeWidth={2} aria-hidden />
												<div className="flex h-32 w-24 flex-shrink-0 overflow-hidden rounded-md bg-neutral-200 shadow-sm">
													{theirBook?.thumbnail_url ? (
														<img
															src={theirBook.thumbnail_url}
															alt={theirBook?.title ?? ""}
															className="h-full w-full object-cover"
														/>
													) : (
														<div className="flex h-full w-full items-center justify-center">
															<BookOpen className="h-10 w-10 text-neutral-400" strokeWidth={1.5} />
														</div>
													)}
												</div>
											</div>
											<p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
												{theirBook?.title ?? "—"}
											</p>
										</Link>
									);
								})
							)}
						</div>
					</section>

					{/* My Books Section - Horizontal Scroll */}
					<section>
						<h2 className="mb-3 text-base font-semibold text-foreground">
							내가 꽂은 책
						</h2>
						<div className="flex snap-x gap-4 overflow-x-auto pb-4 scroll-smooth [-webkit-overflow-scrolling:touch]">
							{books.length === 0 ? (
								<div className="flex min-w-full flex-col items-center justify-center rounded-2xl border border-primary/20 bg-white/60 py-12 backdrop-blur-md">
									<BookOpen className="mb-2 h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
									<p className="mb-3 text-center text-sm text-muted-foreground">
										아직 등록한 책이 없어요. 첫 책을 꽂아보세요!
									</p>
									<Link
										href="/shelve"
										className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
									>
										책 꽂기
									</Link>
								</div>
							) : (
								books.map((book) => (
									<Link
										key={book.id}
										href={`/book/${book.id}`}
										className="flex w-28 min-w-28 snap-center flex-shrink-0 flex-col overflow-hidden rounded-xl border border-primary/20 bg-white/60 shadow-sm backdrop-blur-md transition-opacity hover:opacity-90"
									>
										<div className="aspect-[2/3] w-full overflow-hidden rounded-t-xl bg-neutral-200">
											{book.thumbnail_url ? (
												<img
													src={book.thumbnail_url}
													alt={book.title}
													className="h-full w-full object-cover"
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center">
													<BookOpen className="h-6 w-6 text-neutral-400" strokeWidth={1.5} />
												</div>
											)}
										</div>
										<p className="line-clamp-2 px-1.5 py-1.5 text-[11px] font-medium text-foreground">
											{book.title}
										</p>
									</Link>
								))
							)}
						</div>
					</section>

					{/* Logout - footer */}
					<div className="w-full pt-4">
						<LogoutButton variant="footer" />
					</div>
				</main>
			</div>
			<BottomNav />
		</>
	);
}