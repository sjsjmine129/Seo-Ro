"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, User, Quote, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookImageCarousel from "@/components/BookImageCarousel";
import BottomSheetModal from "@/components/BottomSheetModal";
import ConditionBadgeWithTooltip, {
	CONDITION_DESCRIPTIONS,
} from "@/components/ConditionBadgeWithTooltip";
import LibraryLocationsBadge from "./components/LibraryLocationsBadge";
import type { LibraryItem } from "./components/LibraryLocationsBadge";
import UserProfileModal from "@/components/UserProfileModal";
import {
	createOrGetChatRoom,
	deleteBook,
	getMyOfferBooksForListing,
} from "./actions";
import type { ChatBookPreview } from "@/lib/types/chat";

type BookDetailClientProps = {
	book: {
		id: string;
		owner_id: string;
		title: string;
		authors: string | null;
		publisher: string | null;
		thumbnail_url: string | null;
		user_images: string[];
		user_review: string | null;
		condition: string;
		status: string;
		owner: {
			nickname: string | null;
			profile_image: string | null;
			bookshelf_score: number;
		} | null;
	};
	libraries: LibraryItem[];
	conditionColor: string;
	conditionLabel: string;
	isOwner: boolean;
	hasActiveExchange: boolean;
};

export default function BookDetailClient({
	book,
	libraries,
	conditionColor,
	conditionLabel,
	isOwner,
	hasActiveExchange,
}: BookDetailClientProps) {
	const router = useRouter();
	const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
	const [isOwnerProfileOpen, setIsOwnerProfileOpen] = useState(false);
	const [isCreatingChat, setIsCreatingChat] = useState(false);
	const [selectOfferOpen, setSelectOfferOpen] = useState(false);
	const [offerCandidates, setOfferCandidates] = useState<ChatBookPreview[]>(
		[],
	);
	const [loadingOffers, setLoadingOffers] = useState(false);
	const [offerLoadError, setOfferLoadError] = useState<string | null>(null);

	const isSwappingWithOther =
		book.status === "SWAPPING" && !hasActiveExchange;
	const canOpenChat =
		!isOwner &&
		libraries.length > 0 &&
		!isSwappingWithOther &&
		(book.status === "AVAILABLE" || hasActiveExchange);

	const registerBookHref =
		libraries[0]?.id != null
			? `/book/new?libraryId=${encodeURIComponent(libraries[0].id)}`
			: "/book/new";

	const openSelectOfferSheet = () => {
		setSelectOfferOpen(true);
		setOfferLoadError(null);
		setLoadingOffers(true);
		void (async () => {
			try {
				const list = await getMyOfferBooksForListing(book.id);
				setOfferCandidates(list);
			} catch (e) {
				setOfferCandidates([]);
				setOfferLoadError(
					e instanceof Error
						? e.message
						: "목록을 불러오지 못했습니다.",
				);
			} finally {
				setLoadingOffers(false);
			}
		})();
	};

	const handleResumeChat = async () => {
		if (isCreatingChat || !canOpenChat) return;
		setIsCreatingChat(true);
		try {
			const roomId = await createOrGetChatRoom(book.id, book.owner_id);
			router.push(`/chat/${roomId}`);
		} catch (err) {
			alert(
				err instanceof Error ? err.message : "채팅방을 열지 못했습니다.",
			);
		} finally {
			setIsCreatingChat(false);
		}
	};

	const handleConfirmOfferBook = async (offerBookId: string) => {
		if (isCreatingChat) return;
		setIsCreatingChat(true);
		setOfferLoadError(null);
		try {
			const roomId = await createOrGetChatRoom(
				book.id,
				book.owner_id,
				offerBookId,
			);
			setSelectOfferOpen(false);
			router.push(`/chat/${roomId}`);
		} catch (err) {
			alert(
				err instanceof Error ? err.message : "채팅방을 열지 못했습니다.",
			);
		} finally {
			setIsCreatingChat(false);
		}
	};

	const handleDelete = async () => {
		if (book.status !== "AVAILABLE") return;
		if (!window.confirm("이 책을 정말 삭제하시겠습니까?")) return;
		try {
			await deleteBook(book.id);
			router.push("/");
		} catch (err) {
			alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
		}
	};

	return (
		<>
			<div className="relative flex w-full flex-col">
				<div
					className="sticky z-40 mb-4 flex justify-between items-center px-4 "
					style={{
						top: "calc(1rem + env(safe-area-inset-top, 0px))",
					}}
				>
					<BackButton />
					{libraries.length > 0 && (
						<LibraryLocationsBadge
							libraries={libraries}
							onOpenChange={setIsLibraryModalOpen}
						/>
					)}
				</div>

				<main className="flex flex-col gap-8 px-6 pb-6 pt-4">
					{/* Image Carousel */}
					<div className="overflow-hidden rounded-2xl border border-primary/20 bg-white/60 shadow-sm">
						<BookImageCarousel
							images={
								[
									book.thumbnail_url,
									...(book.user_images ?? []),
								].filter(Boolean) as string[]
							}
							alt={book.title}
						/>
					</div>

					{/* Book Header: Title + Author/Publisher | User Profile */}
					<section>
						<div className="flex items-start justify-between gap-3 sm:gap-4">
							{/* Left: Title + Badge, then Author/Publisher (takes remaining width) */}
							<div className="min-w-0 flex-1 flex flex-col pr-1">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2 flex-wrap">
										<h1 className="text-xl font-bold text-foreground">
											{book.title}
										</h1>
										<div className="flex items-center gap-2">
											<ConditionBadgeWithTooltip
												label={conditionLabel}
												className={conditionColor}
											/>
											{CONDITION_DESCRIPTIONS[
												book.condition
											] && (
												<span className="text-sm text-neutral-500">
													{
														CONDITION_DESCRIPTIONS[
															book.condition
														]
													}
												</span>
											)}
										</div>
									</div>
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
							{/* Right: profile card — width fits content; score stays one line */}
							<div className="ml-auto w-fit shrink-0 flex flex-col gap-2 rounded-xl border border-primary/20 bg-white/60 shadow-sm backdrop-blur-md">
								<button
									type="button"
									onClick={() => setIsOwnerProfileOpen(true)}
									className="flex items-center gap-3 rounded-xl px-4 py-2 text-left transition-colors hover:bg-white/70 active:scale-[0.99]"
								>
									{book.owner?.profile_image ? (
										<img
											src={book.owner.profile_image}
											alt={
												book.owner.nickname ??
												"닉네임 없음"
											}
											className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/60"
										/>
									) : (
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-neutral-600">
											<User
												className="h-5 w-5"
												strokeWidth={2}
											/>
										</div>
									)}
									<div className="flex flex-col gap-0.5">
										<p className="text-sm font-medium text-foreground">
											{book.owner?.nickname ?? "알 수 없음"}
										</p>
										{!isOwner && (
											<span className="mt-0.5 shrink-0 whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
												책장 점수{" "}
												{book.owner?.bookshelf_score ??
													0}
												권
											</span>
										)}
									</div>
								</button>
								{isOwner && (
									<button
										type="button"
										onClick={handleDelete}
										disabled={book.status !== "AVAILABLE"}
										className={`flex w-full items-center justify-center gap-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
											book.status === "AVAILABLE"
												? "text-red-600 hover:bg-red-50"
												: "cursor-not-allowed bg-neutral-200/80 text-neutral-400"
										}`}
									>
										<Trash2 className="h-3.5 w-3.5" />
										삭제하기
									</button>
								)}
							</div>
						</div>
					</section>

					{/* User Review Section */}
					{book.user_review && (
						<section>
							<blockquote className="flex items-center gap-3 rounded-xl border border-primary/20 bg-white/70 px-4 py-4 backdrop-blur-md">
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

				{/* Floating Bottom Action — owner: edit; others: exchange flow */}
				{!isLibraryModalOpen &&
					!isOwnerProfileOpen &&
					!selectOfferOpen && (
					<div
						className="fixed left-0 right-0 z-40 px-4"
						style={{
							bottom: "calc(65px + 16px + env(safe-area-inset-bottom))",
						}}
					>
						<div className="mx-auto max-w-lg">
							{isOwner ? (
								book.status === "AVAILABLE" ? (
									<Link
										href={`/book/${book.id}/edit`}
										className="block w-full rounded-xl bg-primary py-4 text-center text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.99]"
									>
										등록 내용 수정하기
									</Link>
								) : (
									<p className="rounded-xl border border-primary/20 bg-white/70 py-4 text-center text-sm text-muted-foreground backdrop-blur-md">
										교환 중인 책은 수정할 수 없어요
									</p>
								)
							) : isSwappingWithOther ? (
								<button
									type="button"
									disabled
									className="w-full cursor-not-allowed rounded-xl bg-neutral-400 py-4 text-base font-semibold text-white shadow-lg"
								>
									교환 진행 중인 책입니다
								</button>
							) : canOpenChat ? (
								<button
									type="button"
									disabled={isCreatingChat}
									onClick={() =>
										void (hasActiveExchange
											? handleResumeChat()
											: openSelectOfferSheet())
									}
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
								>
									{isCreatingChat ? (
										<>
											<Loader2
												className="h-5 w-5 animate-spin"
												aria-hidden
											/>
											연결 중…
										</>
									) : hasActiveExchange ? (
										"채팅으로 이어가기"
									) : (
										"바꿔읽기"
									)}
								</button>
							) : null}
						</div>
					</div>
				)}

				<UserProfileModal
					userId={book.owner_id}
					isOpen={isOwnerProfileOpen}
					onClose={() => setIsOwnerProfileOpen(false)}
				/>

				<BottomSheetModal
					open={selectOfferOpen}
					onClose={() => setSelectOfferOpen(false)}
					className="pointer-events-auto max-h-[min(75vh,560px)] w-full max-w-lg overflow-hidden rounded-2xl border border-primary/15 bg-glass-bg shadow-xl"
				>
					<div className="flex max-h-[min(75vh,560px)] flex-col p-4">
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0">
								<p className="text-sm font-semibold text-foreground">
									바꿔읽기로 줄 책 선택
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									이 책이 등록된 도서관과 같은 허브에 올린 내 책만
									선택할 수 있어요.
								</p>
							</div>
							<Link
								href={registerBookHref}
								onClick={() => setSelectOfferOpen(false)}
								className="shrink-0 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
							>
								새 책 등록
							</Link>
						</div>
						{offerLoadError ? (
							<p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
								{offerLoadError}
							</p>
						) : null}
						<div className="mt-3 flex-1 overflow-y-auto">
							{loadingOffers ? (
								<p className="py-10 text-center text-sm text-muted-foreground">
									불러오는 중…
								</p>
							) : offerCandidates.length === 0 ? (
								<div className="flex flex-col items-center gap-4 py-10 text-center">
									<p className="max-w-[260px] text-sm text-muted-foreground">
										조건에 맞는 내 책이 없어요. 같은 도서관에 책을
										등록한 뒤 다시 시도해 주세요.
									</p>
									<Link
										href={registerBookHref}
										onClick={() => setSelectOfferOpen(false)}
										className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
									>
										책 등록하기
									</Link>
								</div>
							) : (
								<ul className="flex flex-col gap-2">
									{offerCandidates.map((b) => (
										<li key={b.id}>
											<button
												type="button"
												disabled={isCreatingChat}
												className="flex w-full items-center gap-3 rounded-xl border border-primary/15 bg-white/80 px-3 py-2 text-left text-sm transition-colors hover:bg-white disabled:opacity-50"
												onClick={() =>
													void handleConfirmOfferBook(b.id)
												}
											>
												<div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-neutral-200">
													{b.thumbnail_url ? (
														<img
															src={b.thumbnail_url}
															alt=""
															className="h-full w-full object-cover"
														/>
													) : (
														<div className="flex h-full w-full items-center justify-center">
															<BookOpen className="h-4 w-4 text-neutral-400" />
														</div>
													)}
												</div>
												<span className="line-clamp-2 font-medium text-foreground">
													{b.title}
												</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
						<button
							type="button"
							className="mt-3 w-full rounded-xl py-2 text-sm text-muted-foreground"
							onClick={() => setSelectOfferOpen(false)}
						>
							닫기
						</button>
					</div>
				</BottomSheetModal>
			</div>
		</>
	);
}
