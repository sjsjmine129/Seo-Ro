"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, MapPin, X, Hourglass, MailQuestion, CalendarClock } from "lucide-react";
import {
	cancelExchange,
	rejectExchange,
	proposeTimes,
	counterRequestExchange,
	respondToCounterRequest,
	getRequesterAvailableBooksInLibrary,
} from "@/app/actions/exchange";

const CONDITION_LABELS: Record<string, string> = {
	S: "S급",
	A: "A급",
	B: "B급",
	C: "C급",
	D: "D급",
};

const EXCHANGE_STATUS_LABELS: Record<string, string> = {
	REQUESTED: "수락 대기 중",
	TIME_PROPOSED: "시간 조율 중",
	COUNTER_REQUESTED: "다른 책 요청됨",
	ACCEPTED: "교환 약속 확정",
	SCHEDULED: "교환 약속 확정",
	REJECTED: "거절된 교환",
	CANCELED: "취소된 교환",
	COMPLETED: "교환 완료",
};

function getExchangeStatusLabel(status: string): string {
	return EXCHANGE_STATUS_LABELS[status] ?? status;
}

function WaitMessageCard({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="rounded-lg bg-muted/30 p-6 text-center">
			<Icon className="mx-auto mb-3 h-12 w-12 text-primary/60" strokeWidth={1.5} />
			<h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
			<p className="mb-4 text-sm leading-relaxed text-muted-foreground">
				{description}
			</p>
			{children}
		</div>
	);
}

type BookInfo = {
	id: string;
	title: string;
	thumbnail_url: string | null;
	condition: string;
};

type ExchangeData = {
	id: string;
	status: string;
	requester_id: string;
	owner_id: string;
	requester_book: BookInfo;
	owner_book: BookInfo;
	library: { id: string; name: string; address: string | null };
};

type Props = {
	exchange: ExchangeData;
	isRequester: boolean;
	isOwner: boolean;
};

function BookCard({
	book,
	label,
}: {
	book: BookInfo;
	label: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-white/40 bg-white/70 p-4 backdrop-blur-md">
			<span className="text-xs font-medium text-primary">{label}</span>
			<div className="relative h-24 w-16 overflow-hidden rounded-lg bg-neutral-200">
				{book.thumbnail_url ? (
					<img
						src={book.thumbnail_url}
						alt={book.title}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center">
						<BookOpen
							className="h-8 w-8 text-neutral-400"
							strokeWidth={1.5}
						/>
					</div>
				)}
			</div>
			<p className="line-clamp-2 text-center text-sm font-medium text-foreground">
				{book.title}
			</p>
			<span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
				{CONDITION_LABELS[book.condition] ?? book.condition}
			</span>
		</div>
	);
}

function TimeSelectionModal({
	exchangeId,
	onClose,
	onSuccess,
}: {
	exchangeId: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
	const [isSubmitting, setIsSubmitting] = useState(false);

	const days: Date[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	for (let i = 0; i < 7; i++) {
		const d = new Date(today);
		d.setDate(today.getDate() + i);
		days.push(d);
	}

	const hours = Array.from({ length: 27 }, (_, i) => {
		const h = 7 + Math.floor(i / 2);
		const m = (i % 2) * 30;
		return { h, m, label: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}` };
	});

	const toSlotKey = (date: Date, hour: number, minute: number) => {
		const y = date.getFullYear();
		const m = (date.getMonth() + 1).toString().padStart(2, "0");
		const d = date.getDate().toString().padStart(2, "0");
		return `${y}-${m}-${d}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
	};

	const toggleSlot = (date: Date, hour: number, minute: number) => {
		const key = toSlotKey(date, hour, minute);
		setSelectedSlots((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	const handleSubmit = async () => {
		if (selectedSlots.size === 0) {
			alert("최소 하나의 시간을 선택해 주세요.");
			return;
		}
		setIsSubmitting(true);
		try {
			const times = Array.from(selectedSlots).sort();
			await proposeTimes(exchangeId, times);
			onSuccess();
		} catch (err) {
			alert(err instanceof Error ? err.message : "제안 실패");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 p-4 pb-[env(safe-area-inset-bottom)]"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="flex items-center justify-between border-b border-white/40 px-4 py-3">
					<h3 className="text-base font-semibold text-foreground">
						만남 시간 제안하기
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-white/60 hover:text-foreground"
						aria-label="닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4">
					<p className="mb-4 text-sm text-muted-foreground">
						가능한 시간을 선택해 주세요. (여러 개 선택 가능)
					</p>
					{days.map((date) => (
						<div key={date.toISOString()} className="mb-6">
							<p className="mb-2 text-sm font-medium text-foreground">
								{date.toLocaleDateString("ko-KR", {
									month: "long",
									day: "numeric",
									weekday: "short",
								})}
							</p>
							<div className="flex flex-wrap gap-2">
								{hours.map(({ h, m, label }) => {
									const key = toSlotKey(date, h, m);
									const isSelected = selectedSlots.has(key);
									return (
										<button
											key={key}
											type="button"
											onClick={() => toggleSlot(date, h, m)}
											className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
												isSelected
													? "bg-primary text-white"
													: "bg-white/60 text-foreground hover:bg-white/80"
											}`}
										>
											{label}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
				<div className="border-t border-white/40 p-4">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={isSubmitting || selectedSlots.size === 0}
						className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? "제안 중..." : "이 시간들로 제안하기"}
					</button>
				</div>
			</div>
		</div>
	);
}

function RequestDifferentBookModal({
	exchangeId,
	requesterId,
	libraryId,
	currentRequesterBookId,
	onClose,
	onSuccess,
}: {
	exchangeId: string;
	requesterId: string;
	libraryId: string;
	currentRequesterBookId: string;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const [books, setBooks] = useState<{ id: string; title: string; thumbnail_url: string | null }[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		getRequesterAvailableBooksInLibrary(requesterId, libraryId, currentRequesterBookId)
			.then(setBooks)
			.finally(() => setLoading(false));
	}, [requesterId, libraryId, currentRequesterBookId]);

	const handleSubmit = async () => {
		if (!selectedId) {
			alert("책을 선택해 주세요.");
			return;
		}
		setIsSubmitting(true);
		try {
			await counterRequestExchange(exchangeId, currentRequesterBookId, selectedId);
			onSuccess();
		} catch (err) {
			alert(err instanceof Error ? err.message : "요청 실패");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 p-4 pb-[env(safe-area-inset-bottom)]"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="flex items-center justify-between border-b border-white/40 px-4 py-3">
					<h3 className="text-base font-semibold text-foreground">
						다른 책 요청하기
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-white/60 hover:text-foreground"
						aria-label="닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4">
					{loading ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							불러오는 중...
						</p>
					) : books.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							상대방이 이 도서관에 등록한 다른 교환 가능한 책이 없습니다.
						</p>
					) : (
						<ul className="flex flex-col gap-2">
							{books.map((book) => (
								<button
									key={book.id}
									type="button"
									onClick={() => setSelectedId(book.id)}
									className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
										selectedId === book.id
											? "border-primary bg-primary/10"
											: "border-white/40 bg-white/60 hover:bg-white/80"
									}`}
								>
									<div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-neutral-200">
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
									<p className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
										{book.title}
									</p>
								</button>
							))}
						</ul>
					)}
				</div>
				{books.length > 0 && (
					<div className="border-t border-white/40 p-4">
						<button
							type="button"
							onClick={handleSubmit}
							disabled={isSubmitting || !selectedId}
							className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSubmitting ? "요청 중..." : "이 책으로 교환 요청하기"}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

export default function ExchangeInteractiveUI({
	exchange,
	isRequester,
	isOwner,
}: Props) {
	const router = useRouter();
	const [showTimeModal, setShowTimeModal] = useState(false);
	const [showCounterModal, setShowCounterModal] = useState(false);

	const myBook = isRequester ? exchange.requester_book : exchange.owner_book;
	const targetBook = isRequester ? exchange.owner_book : exchange.requester_book;
	const isEnded = exchange.status === "REJECTED" || exchange.status === "CANCELED";

	const handleCancel = async () => {
		if (!window.confirm("교환을 취소하시겠습니까?")) return;
		try {
			await cancelExchange(exchange.id);
			router.push("/");
		} catch (err) {
			alert(err instanceof Error ? err.message : "취소 실패");
		}
	};

	const handleReject = async () => {
		if (!window.confirm("교환 요청을 거절하시겠습니까?")) return;
		try {
			await rejectExchange(exchange.id);
			router.push("/");
		} catch (err) {
			alert(err instanceof Error ? err.message : "거절 실패");
		}
	};

	const handleProposeSuccess = () => {
		setShowTimeModal(false);
		router.refresh();
	};

	return (
		<>
			<main className="mx-auto w-full max-w-lg space-y-6">
				<h1 className="text-xl font-bold text-foreground">
					교환 진행 중
				</h1>

				{/* Match-up Card */}
				<section className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
					<div className="flex items-stretch gap-4">
						<BookCard book={myBook} label="내 책" />
						<div className="flex flex-shrink-0 items-center">
							<span className="text-2xl text-muted-foreground">↔</span>
						</div>
						<BookCard book={targetBook} label="받는 책" />
					</div>
				</section>

				{/* Location */}
				<section className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/60 px-4 py-3 backdrop-blur-md">
					<MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
					<div>
						<p className="font-medium text-foreground">
							{exchange.library.name}
						</p>
						{exchange.library.address && (
							<p className="text-sm text-muted-foreground">
								{exchange.library.address}
							</p>
						)}
					</div>
				</section>

				{/* Status: REQUESTED */}
				{exchange.status === "REQUESTED" && (
					<section className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
						{isRequester ? (
							<>
								<WaitMessageCard
									icon={Hourglass}
									title="두근두근! 상대방의 응답을 기다리고 있어요."
									description="상대방이 교환을 수락하고 약속 시간을 제안하거나, 회원님의 다른 책으로 교환을 역제안할 수도 있습니다. 조금만 기다려주세요!"
								/>
								<button
									type="button"
									onClick={handleCancel}
									className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
								>
									교환 취소
								</button>
							</>
						) : isOwner ? (
							<>
								<p className="mb-4 text-sm font-medium text-foreground">
									상대방이 교환을 요청했습니다!
								</p>
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={() => setShowTimeModal(true)}
										className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
									>
										교환 수락하고 시간 정하기
									</button>
									<button
										type="button"
										onClick={() => setShowCounterModal(true)}
										className="w-full rounded-xl border border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
									>
										다른 책 요청하기
									</button>
									<button
										type="button"
										onClick={handleReject}
										className="w-full rounded-xl border border-neutral-300 bg-white/80 py-3 text-sm font-medium text-foreground transition-colors hover:bg-neutral-100"
									>
										거절하기
									</button>
								</div>
							</>
						) : null}
					</section>
				)}

				{/* Status: TIME_PROPOSED */}
				{exchange.status === "TIME_PROPOSED" && (
					<section className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
						{isOwner ? (
							<WaitMessageCard
								icon={CalendarClock}
								title="상대방이 편한 시간을 고르고 있어요."
								description="제안하신 시간 중 하나를 상대방이 선택하면 교환 약속이 최종 확정됩니다!"
							/>
						) : (
							<p className="text-sm text-muted-foreground">
								상대방이 만남 시간을 제안했습니다. 곧 선택할 수 있습니다.
							</p>
						)}
					</section>
				)}

				{/* Status: COUNTER_REQUESTED */}
				{exchange.status === "COUNTER_REQUESTED" && (
					<section className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
						{isOwner ? (
							<WaitMessageCard
								icon={MailQuestion}
								title="새로운 책으로 교환을 제안했습니다!"
								description="상대방이 제안받은 책을 확인하고 있어요. 수락이 완료되면 약속 시간을 정할 수 있는 달력이 열립니다."
							/>
						) : (
							<>
								<p className="mb-4 text-sm font-medium text-foreground">
									상대방이 다른 책으로 교환을 원합니다!
								</p>
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={async () => {
											try {
												await respondToCounterRequest(
													exchange.id,
													true,
													exchange.requester_book.id,
													exchange.owner_book.id,
												);
												router.refresh();
											} catch (err) {
												alert(err instanceof Error ? err.message : "수락 실패");
											}
										}}
										className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
									>
										수락하기
									</button>
									<button
										type="button"
										onClick={async () => {
											if (!window.confirm("거절하고 교환을 취소하시겠습니까?")) return;
											try {
												await respondToCounterRequest(
													exchange.id,
													false,
													exchange.requester_book.id,
													exchange.owner_book.id,
												);
												router.push("/");
											} catch (err) {
												alert(err instanceof Error ? err.message : "취소 실패");
											}
										}}
										className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
									>
										거절하고 취소하기
									</button>
								</div>
							</>
						)}
					</section>
				)}

				{/* Status: REJECTED or CANCELED - Ended exchange */}
				{isEnded && (
					<section className="rounded-2xl border border-red-200/60 bg-red-50/50 p-4 shadow-sm backdrop-blur-md">
						<p className="mb-4 text-center text-sm text-red-800/90">
							{exchange.status === "REJECTED"
								? "이 교환은 거절되어 종료되었습니다."
								: "이 교환은 취소되어 종료되었습니다."}
						</p>
						<Link
							href="/"
							className="block w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-opacity hover:opacity-90"
						>
							홈으로 돌아가기
						</Link>
					</section>
				)}

				{/* Other statuses: ACCEPTED, SCHEDULED, COMPLETED */}
				{!["REQUESTED", "TIME_PROPOSED", "COUNTER_REQUESTED", "REJECTED", "CANCELED"].includes(
					exchange.status,
				) && (
					<section className="rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md">
						<p className="text-sm text-muted-foreground">
							상태: {getExchangeStatusLabel(exchange.status)}
						</p>
					</section>
				)}
			</main>

			{showTimeModal && (
				<TimeSelectionModal
					exchangeId={exchange.id}
					onClose={() => setShowTimeModal(false)}
					onSuccess={handleProposeSuccess}
				/>
			)}
			{showCounterModal && (
				<RequestDifferentBookModal
					exchangeId={exchange.id}
					requesterId={exchange.requester_id}
					libraryId={exchange.library.id}
					currentRequesterBookId={exchange.requester_book.id}
					onClose={() => setShowCounterModal(false)}
					onSuccess={() => {
						setShowCounterModal(false);
						router.refresh();
					}}
				/>
			)}
		</>
	);
}
