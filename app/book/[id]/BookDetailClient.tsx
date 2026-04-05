"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Quote, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookImageCarousel from "@/components/BookImageCarousel";
import ConditionBadgeWithTooltip, {
	CONDITION_DESCRIPTIONS,
} from "@/components/ConditionBadgeWithTooltip";
import LibraryLocationsBadge from "./components/LibraryLocationsBadge";
import type { LibraryItem } from "./components/LibraryLocationsBadge";
import SelectMyBookModal from "./components/SelectMyBookModal";
import UserProfileModal from "@/components/UserProfileModal";
import { deleteBook } from "./actions";

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
	isAvailable: boolean;
	activeExchangeId: string | null;
};

export default function BookDetailClient({
	book,
	libraries,
	conditionColor,
	conditionLabel,
	isOwner,
	isAvailable,
	activeExchangeId,
}: BookDetailClientProps) {
	const router = useRouter();
	const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
	const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
	const [isOwnerProfileOpen, setIsOwnerProfileOpen] = useState(false);

	const inActiveExchange = !!activeExchangeId;
	const isSwappingWithOther = book.status === "SWAPPING" && !inActiveExchange;
	const canRequestSwap =
		!isOwner && book.status === "AVAILABLE" && libraries.length > 0;

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
						<div className="flex justify-between items-start gap-4">
							{/* Left: Title + Badge, then Author/Publisher */}
							<div className="min-w-0 flex-1 flex flex-col">
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
							{/* Right: Owner Profile - tappable card */}
							<div className="flex w-[min(100%,11rem)] flex-shrink-0 flex-col gap-1.5 rounded-2xl border border-primary/20 bg-white/60 p-2 shadow-sm">
								<button
									type="button"
									onClick={() => setIsOwnerProfileOpen(true)}
									className="flex w-full items-center gap-2.5 rounded-xl p-1 text-left transition-colors hover:bg-white/70 active:scale-[0.99]"
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
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-foreground">
											{book.owner?.nickname ?? "알 수 없음"}
										</p>
										{!isOwner && (
											<span className="mt-0.5 inline-block shrink-0 whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
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
										className={`flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
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

				{/* Floating Bottom Action - hidden when modals open; show only for non-owners */}
				{!isLibraryModalOpen &&
					!isSwapModalOpen &&
					!isOwnerProfileOpen &&
					!isOwner && (
					<div
						className="fixed left-0 right-0 z-40 px-4"
						style={{
							bottom: "calc(65px + 16px + env(safe-area-inset-bottom))",
						}}
					>
						<div className="mx-auto max-w-lg">
							{inActiveExchange ? (
								<Link
									href={`/exchange/${activeExchangeId}`}
									className="block w-full rounded-xl bg-primary py-4 text-center text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.99]"
								>
									교환 화면으로 이동
								</Link>
							) : isSwappingWithOther ? (
								<button
									type="button"
									disabled
									className="w-full cursor-not-allowed rounded-xl bg-neutral-400 py-4 text-base font-semibold text-white shadow-lg"
								>
									교환 진행 중인 책입니다
								</button>
							) : canRequestSwap ? (
								<button
									type="button"
									onClick={() => setIsSwapModalOpen(true)}
									className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.99]"
								>
									바꿔읽기
								</button>
							) : null}
						</div>
					</div>
				)}

				<SelectMyBookModal
					isOpen={isSwapModalOpen}
					onClose={() => setIsSwapModalOpen(false)}
					ownerBookId={book.id}
					libraries={libraries}
				/>
				<UserProfileModal
					userId={book.owner_id}
					isOpen={isOwnerProfileOpen}
					onClose={() => setIsOwnerProfileOpen(false)}
				/>
			</div>
		</>
	);
}
