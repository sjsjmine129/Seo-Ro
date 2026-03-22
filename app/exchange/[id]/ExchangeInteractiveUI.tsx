"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, MapPin, X, Hourglass, MailQuestion, CalendarClock, PartyPopper, ExternalLink } from "lucide-react";
import {
	cancelExchange,
	cancelScheduledExchange,
	rejectExchange,
	proposeTimes,
	counterRequestExchange,
	respondToCounterRequest,
	getRequesterAvailableBooksInLibrary,
	confirmExchangeTime,
	cancelExchangeNoMatchingTime,
	markExchangeCompleted,
	reportNoShow,
	sendManualReminder,
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
	proposed_times?: string[] | null;
	meet_at?: string | null;
	requester_completed?: boolean;
	owner_completed?: boolean;
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
		<div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-primary/20 bg-white/70 p-4 backdrop-blur-md">
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
		const h = hour.toString().padStart(2, "0");
		const min = minute.toString().padStart(2, "0");
		return `${y}-${m}-${d}T${h}:${min}:00+09:00`;
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
				className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-primary/20 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
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
				<div className="border-t border-primary/20 p-4">
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

function toSlotKey(date: Date, hour: number, minute: number): string {
	const y = date.getFullYear();
	const m = (date.getMonth() + 1).toString().padStart(2, "0");
	const d = date.getDate().toString().padStart(2, "0");
	const h = hour.toString().padStart(2, "0");
	const min = minute.toString().padStart(2, "0");
	return `${y}-${m}-${d}T${h}:${min}:00+09:00`;
}

function normalizeSlotKey(s: string): string {
	const d = new Date(s);
	const y = d.getFullYear();
	const m = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	const h = d.getHours().toString().padStart(2, "0");
	const min = d.getMinutes().toString().padStart(2, "0");
	return `${y}-${m}-${day}T${h}:${min}:00`;
}

function TimeConfirmationModal({
	exchangeId,
	proposedTimes,
	onSuccess,
}: {
	exchangeId: string;
	proposedTimes: string[];
	onSuccess: () => void;
}) {
	const router = useRouter();
	const [selectedTime, setSelectedTime] = useState<string | null>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);

	const proposedSet = new Set(proposedTimes.map(normalizeSlotKey));

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

	const handleConfirm = async () => {
		if (!selectedTime) {
			alert("시간을 선택해 주세요.");
			return;
		}
		setIsConfirming(true);
		try {
			await confirmExchangeTime(exchangeId, selectedTime);
			onSuccess();
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "확정 실패");
		} finally {
			setIsConfirming(false);
		}
	};

	const handleNoMatchingTime = async () => {
		if (
			!window.confirm(
				"제안받은 시간 중 맞는 시간이 없나요? 아쉽지만 교환이 취소됩니다. 7일 후에 다시 시도해보세요!",
			)
		)
			return;
		setIsCanceling(true);
		try {
			await cancelExchangeNoMatchingTime(exchangeId);
			router.refresh();
			router.push("/");
		} catch (err) {
			alert(err instanceof Error ? err.message : "취소 실패");
		} finally {
			setIsCanceling(false);
		}
	};

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				상대방이 제안한 시간 중 하나를 선택해 주세요.
			</p>
			<div className="max-h-[40vh] overflow-y-auto">
				{days.map((date) => (
					<div key={date.toISOString()} className="mb-4">
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
								const normalized = normalizeSlotKey(key);
								const isAllowed = proposedSet.has(normalized);
								const isSelected = selectedTime && normalizeSlotKey(selectedTime) === normalized;
								const allowedTime = proposedTimes.find((t) => normalizeSlotKey(t) === normalized) ?? key;
								return (
									<button
										key={key}
										type="button"
										disabled={!isAllowed}
										onClick={() => isAllowed && setSelectedTime(allowedTime)}
										className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
											!isAllowed
												? "cursor-not-allowed bg-neutral-100 text-neutral-400 opacity-50"
												: isSelected
													? "border-2 border-primary bg-primary text-white"
													: "border border-primary/40 bg-white/80 text-foreground hover:bg-primary/10"
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
			<div className="flex flex-col gap-2">
				<button
					type="button"
					onClick={handleConfirm}
					disabled={!selectedTime || isConfirming}
					className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isConfirming ? "확정 중..." : "이 시간으로 약속 확정하기"}
				</button>
				<button
					type="button"
					onClick={handleNoMatchingTime}
					disabled={isCanceling}
					className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
				>
					{isCanceling ? "취소 중..." : "맞는 시간이 없음 (교환 취소)"}
				</button>
			</div>
		</div>
	);
}


function NoShowModal({
	isOpen,
	onClose,
	onSendReminder,
	onCancelExchange,
	isReporting,
	isSendingReminder,
}: {
	isOpen: boolean;
	onClose: () => void;
	onSendReminder: () => Promise<void>;
	onCancelExchange: () => Promise<void>;
	isReporting: boolean;
	isSendingReminder: boolean;
}) {
	if (!isOpen) return null;
	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="border-b border-primary/20 px-4 py-3">
					<h3 className="text-base font-semibold text-foreground">
						상대방이 오지 않나요?
					</h3>
					<p className="mt-1.5 text-sm text-muted-foreground">
						상대방이 깜빡했을 수 있어요. 알림을 먼저 보내보시겠어요? 취소하면 교환이 종료됩니다.
					</p>
				</div>
				<div className="flex flex-col gap-2 p-4">
					<button
						type="button"
						onClick={async () => {
							await onSendReminder();
						}}
						disabled={isSendingReminder}
						className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isSendingReminder ? "보내는 중..." : "상대방에게 알림 보내기"}
					</button>
					<button
						type="button"
						onClick={async () => {
							await onCancelExchange();
							onClose();
						}}
						disabled={isReporting}
						className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
					>
						{isReporting ? "처리 중..." : "교환 취소하기"}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="mt-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
					>
						닫기
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
				className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-primary/20 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
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
											: "border-primary/20 bg-white/60 hover:bg-white/80"
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
					<div className="border-t border-primary/20 p-4">
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
	const [showNoShowModal, setShowNoShowModal] = useState(false);
	const [isCompleting, setIsCompleting] = useState(false);
	const [isReportingNoShow, setIsReportingNoShow] = useState(false);
	const [isSendingReminder, setIsSendingReminder] = useState(false);

	const myBook = isRequester ? exchange.requester_book : exchange.owner_book;
	const targetBook = isRequester ? exchange.owner_book : exchange.requester_book;
	const isEnded = exchange.status === "REJECTED" || exchange.status === "CANCELED";

	const handleCancel = async () => {
		if (!window.confirm("교환을 취소하시겠습니까?")) return;
		try {
			await cancelExchange(exchange.id);
			router.refresh();
			router.push("/");
		} catch (err) {
			alert(err instanceof Error ? err.message : "취소 실패");
		}
	};

	const handleReject = async () => {
		if (!window.confirm("교환 요청을 거절하시겠습니까?")) return;
		try {
			await rejectExchange(exchange.id);
			router.refresh();
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
			<main className="mx-auto w-full max-w-lg space-y-4">
				<h1 className="text-xl font-bold text-foreground">
					교환 진행 중
				</h1>

				{/* Location - Above Match-up, clickable link to library */}
				<Link
					href={`/library/${exchange.library.id}`}
					className="group flex items-center gap-2 rounded-xl border border-primary/20 bg-white/60 px-4 py-3 backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-white/80"
				>
					<MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
					<div className="min-w-0 flex-1">
						<p className="font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline">
							{exchange.library.name}
						</p>
						{exchange.library.address && (
							<p className="text-sm text-muted-foreground truncate">
								{exchange.library.address}
							</p>
						)}
					</div>
				</Link>

				{/* Match-up Card */}
				<section className="rounded-2xl border border-primary/20 bg-white/60 p-4 shadow-sm backdrop-blur-md">
					<div className="flex items-stretch gap-4">
						<Link
							href={`/book/${myBook.id}`}
							className="flex flex-1 transition-transform hover:scale-[1.02]"
						>
							<BookCard book={myBook} label="내 책" />
						</Link>
						<div className="flex flex-shrink-0 items-center">
							<span className="text-2xl text-muted-foreground">↔</span>
						</div>
						<Link
							href={`/book/${targetBook.id}`}
							className="flex flex-1 transition-transform hover:scale-[1.02]"
						>
							<BookCard book={targetBook} label="받는 책" />
						</Link>
					</div>
				</section>

				{/* Status: REQUESTED */}
				{exchange.status === "REQUESTED" && (
					<section className="rounded-2xl border border-primary/20 bg-white/60 p-4 shadow-sm backdrop-blur-md">
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
					<section className="rounded-2xl border border-primary/20 bg-white/60 p-4 shadow-sm backdrop-blur-md">
						{isOwner ? (
							<WaitMessageCard
								icon={CalendarClock}
								title="상대방이 편한 시간을 고르고 있어요."
								description="제안하신 시간 중 하나를 상대방이 선택하면 교환 약속이 최종 확정됩니다!"
							/>
						) : isRequester && (exchange.proposed_times?.length ?? 0) > 0 ? (
							<TimeConfirmationModal
								exchangeId={exchange.id}
								proposedTimes={exchange.proposed_times ?? []}
								onSuccess={() => router.refresh()}
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
					<section className="rounded-2xl border border-primary/20 bg-white/60 p-4 shadow-sm backdrop-blur-md">
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

				{/* Status: SCHEDULED - Appointment Ticket */}
				{exchange.status === "SCHEDULED" && (
					<section>
						<div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-white/90 to-primary/5 p-4 shadow-lg shadow-primary/5 backdrop-blur-md">
							<div className="mb-3 flex items-center gap-3">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
									<PartyPopper className="h-6 w-6 text-primary" strokeWidth={2} />
								</div>
								<h3 className="text-lg font-bold text-foreground">
									교환 약속이 확정되었습니다!
								</h3>
							</div>
							<div className="space-y-3 rounded-xl border border-primary/20 bg-white/60 p-4 backdrop-blur-md">
								{exchange.meet_at && (
									<div>
										<p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
											날짜 & 시간
										</p>
										<p className="text-base font-semibold text-foreground">
											{new Date(exchange.meet_at).toLocaleDateString("ko-KR", {
												year: "numeric",
												month: "long",
												day: "numeric",
												weekday: "long",
											})}{" "}
											{new Date(exchange.meet_at).toLocaleTimeString("ko-KR", {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
								)}
								<div>
									<p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
										장소
									</p>
									<a
										href={`https://map.naver.com/v5/search/${encodeURIComponent(
											exchange.library.address
												? `${exchange.library.name} ${exchange.library.address}`
												: exchange.library.name,
										)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1.5 text-base font-semibold text-blue-600 hover:underline"
									>
										{exchange.library.name}
										<ExternalLink className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
									</a>
									{exchange.library.address && (
										<p className="mt-0.5 text-sm text-muted-foreground">
											{exchange.library.address}
										</p>
									)}
								</div>
							</div>
							<p className="mt-3 text-center text-sm text-muted-foreground">
								약속된 장소에서 만나 책을 교환한 후, 아래 버튼을 눌러주세요.
							</p>
							{(() => {
								const isBeforeMeeting = exchange.meet_at ? new Date() < new Date(exchange.meet_at) : false;
								return (
									<div className="mt-3 flex flex-col gap-2">
										<button
											type="button"
											onClick={async () => {
												if (isBeforeMeeting) {
													alert("약속 시간이 지난 후에 누를 수 있습니다.");
													return;
												}
												if (!window.confirm("교환을 완료 하시겠습니까?")) return;
												setIsCompleting(true);
												try {
													await markExchangeCompleted(exchange.id, isRequester ? "requester" : "owner");
													router.refresh();
												} catch (err) {
													alert(err instanceof Error ? err.message : "확인 실패");
												} finally {
													setIsCompleting(false);
												}
											}}
											disabled={
												isCompleting ||
												(isRequester ? exchange.requester_completed : exchange.owner_completed)
											}
											className={`w-full rounded-xl border py-3 text-base font-semibold backdrop-blur-md transition-opacity disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-neutral-400 disabled:text-white ${
												isBeforeMeeting
													? "border-neutral-400 bg-neutral-400 text-white opacity-70"
													: "border-primary/20 bg-primary text-white hover:opacity-90"
											}`}
										>
											{(isRequester ? exchange.requester_completed : exchange.owner_completed)
												? "상대방의 완료를 기다리는 중입니다"
												: isCompleting
													? "처리 중..."
													: "교환 완료!"}
										</button>
										<button
											type="button"
											onClick={() => {
												if (isBeforeMeeting) {
													alert("약속 시간이 지난 후에 누를 수 있습니다.");
													return;
												}
												setShowNoShowModal(true);
											}}
											disabled={isCompleting || isReportingNoShow}
											className={`w-full rounded-xl border-2 py-3 text-sm font-medium backdrop-blur-md transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:text-red-700 ${
												isBeforeMeeting
													? "border-neutral-300 bg-transparent text-neutral-400 opacity-70"
													: "border-red-300 bg-transparent text-red-700 hover:bg-red-50"
											}`}
										>
											{isReportingNoShow ? "처리 중..." : "상대방이 오지 않아요"}
										</button>
										<button
											type="button"
											onClick={async () => {
												if (!window.confirm("교환 일정을 취소하시겠습니까? 상대방에게 알림이 전달됩니다."))
													return;
												try {
													await cancelScheduledExchange(
														exchange.id,
														exchange.requester_book.id,
														exchange.owner_book.id,
													);
													router.refresh();
													router.push("/");
												} catch (err) {
													alert(err instanceof Error ? err.message : "취소 실패");
												}
											}}
											disabled={isCompleting}
											className="w-full rounded-xl border border-primary/20 bg-transparent py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
										>
											일정 취소하기
										</button>
									</div>
								);
							})()}
						</div>
					</section>
				)}

				{/* Status: COMPLETED - Exchange Success */}
				{exchange.status === "COMPLETED" && (
					<section className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-white/90 to-primary/5 p-4 shadow-lg shadow-primary/5 backdrop-blur-md">
						<div className="mb-3 flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
								<PartyPopper className="h-6 w-6 text-primary" strokeWidth={2} />
							</div>
							<h3 className="text-lg font-bold text-foreground">
								교환이 성공적으로 완료되었습니다!
							</h3>
						</div>
						<p className="mb-4 text-sm leading-relaxed text-muted-foreground">
							서로(Seo-Ro)에서 책을 나눈 보상으로 책장 점수 2점이 지급되었습니다. 다음 교환도 기대할게요!
						</p>
						<Link
							href="/"
							className="block w-full rounded-xl bg-primary py-3 text-center text-base font-semibold text-white transition-opacity hover:opacity-90"
						>
							홈으로 돌아가기
						</Link>
					</section>
				)}

				{/* Other statuses: ACCEPTED */}
				{!["REQUESTED", "TIME_PROPOSED", "COUNTER_REQUESTED", "REJECTED", "CANCELED", "SCHEDULED", "COMPLETED"].includes(
					exchange.status,
				) && (
					<section className="rounded-2xl border border-primary/20 bg-white/60 p-4 shadow-sm backdrop-blur-md">
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
			{showNoShowModal && (
				<NoShowModal
					isOpen={showNoShowModal}
					onClose={() => setShowNoShowModal(false)}
					onSendReminder={async () => {
						setIsSendingReminder(true);
						try {
							await sendManualReminder(exchange.id);
							alert("상대방에게 알림을 보냈습니다.");
							setShowNoShowModal(false);
						} catch (err) {
							alert(err instanceof Error ? err.message : "알림 전송 실패");
						} finally {
							setIsSendingReminder(false);
						}
					}}
					onCancelExchange={async () => {
						setIsReportingNoShow(true);
						try {
							await reportNoShow(
								exchange.id,
								exchange.requester_book.id,
								exchange.owner_book.id,
							);
							setShowNoShowModal(false);
							router.refresh();
						} catch (err) {
							alert(err instanceof Error ? err.message : "처리 실패");
						} finally {
							setIsReportingNoShow(false);
						}
					}}
					isReporting={isReportingNoShow}
					isSendingReminder={isSendingReminder}
				/>
			)}
		</>
	);
}
