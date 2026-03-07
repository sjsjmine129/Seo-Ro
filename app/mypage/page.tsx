import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import BackButton from "@/components/BackButton";
import { BookOpen, ArrowRight } from "lucide-react";

const ACTIVE_STATUSES = [
	"REQUESTED",
	"COUNTER_REQUESTED",
	"ACCEPTED",
	"SCHEDULED",
	"TIME_PROPOSED",
] as const;

const STATUS_LABELS: Record<string, string> = {
	REQUESTED: "교환 요청됨",
	COUNTER_REQUESTED: "다른 책 요청됨",
	ACCEPTED: "수락됨",
	SCHEDULED: "시간 조율 중",
	TIME_PROPOSED: "시간 제안됨",
};

type ExchangeWithBooks = {
	id: string;
	status: string;
	requester_id: string;
	owner_id: string;
	requester_book: { id: string; title: string; thumbnail_url: string | null };
	owner_book: { id: string; title: string; thumbnail_url: string | null };
};

async function getActiveExchanges(
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
		.in("status", ACTIVE_STATUSES)
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

	return normalized;
}

export default async function MyPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	const exchanges = await getActiveExchanges(supabase, user.id);

	return (
		<>
			<div className="flex min-h-screen flex-col px-4 pb-32 pt-4">
				<div className="mb-4">
					<BackButton />
				</div>

				<main className="mx-auto w-full max-w-lg">
					<h1 className="text-xl font-bold text-foreground">마이페이지</h1>

					{/* Active Exchanges Section */}
					<section className="mt-8">
						<h2 className="mb-3 text-base font-semibold text-foreground">
							진행 중인 교환
						</h2>
						<div className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
							{exchanges.length === 0 ? (
								<p className="py-6 text-center text-sm text-muted-foreground">
									현재 진행 중인 교환이 없습니다.
								</p>
							) : (
								<ul className="flex flex-col gap-3">
									{exchanges.map((ex) => {
										const isRequester = ex.requester_id === user.id;
										const myBook = isRequester ? ex.requester_book : ex.owner_book;
										const theirBook = isRequester ? ex.owner_book : ex.requester_book;
										const statusLabel =
											STATUS_LABELS[ex.status] ?? ex.status;

										return (
											<li key={ex.id}>
												<Link
													href={`/exchange/${ex.id}`}
													className="block rounded-xl border border-white/40 bg-white/70 p-4 transition-colors hover:bg-white/90"
												>
													<div className="mb-2 flex items-center justify-between">
														<span className="text-xs font-medium text-primary">
															{statusLabel}
														</span>
													</div>
													<div className="flex items-center gap-3">
														{/* My book (giving) */}
														<div className="flex w-24 flex-shrink-0 flex-col items-center gap-1">
															<div className="relative h-14 w-10 overflow-hidden rounded bg-neutral-200">
																{myBook?.thumbnail_url ? (
																	<img
																		src={myBook.thumbnail_url}
																		alt={myBook?.title ?? ""}
																		className="h-full w-full object-cover"
																	/>
																) : (
																	<div className="flex h-full w-full items-center justify-center">
																		<BookOpen
																			className="h-5 w-5 text-neutral-400"
																			strokeWidth={1.5}
																		/>
																	</div>
																)}
															</div>
															<span className="line-clamp-2 text-center text-[10px] text-foreground/80">
																내가 주는 책
															</span>
															<p className="line-clamp-2 text-center text-xs font-medium text-foreground">
																{myBook?.title ?? "—"}
															</p>
														</div>

														<ArrowRight
															className="h-5 w-5 flex-shrink-0 text-muted-foreground/60"
															strokeWidth={2}
														/>

														{/* Their book (receiving) */}
														<div className="flex min-w-0 flex-1 flex-col items-center gap-1">
															<div className="relative h-14 w-10 overflow-hidden rounded bg-neutral-200">
																{theirBook?.thumbnail_url ? (
																	<img
																		src={theirBook.thumbnail_url}
																		alt={theirBook?.title ?? ""}
																		className="h-full w-full object-cover"
																	/>
																) : (
																	<div className="flex h-full w-full items-center justify-center">
																		<BookOpen
																			className="h-5 w-5 text-neutral-400"
																			strokeWidth={1.5}
																		/>
																	</div>
																)}
															</div>
															<span className="line-clamp-2 text-center text-[10px] text-foreground/80">
																받는 책
															</span>
															<p className="line-clamp-2 text-center text-xs font-medium text-foreground">
																{theirBook?.title ?? "—"}
															</p>
														</div>
													</div>
												</Link>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</section>
				</main>
			</div>
			<BottomNav />
		</>
	);
}
