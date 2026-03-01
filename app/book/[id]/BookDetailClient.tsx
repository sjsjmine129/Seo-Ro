"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Quote, Trash2 } from "lucide-react";
import BackButton from "@/components/BackButton";
import BookImageCarousel from "@/components/BookImageCarousel";
import ConditionBadgeWithTooltip from "@/components/ConditionBadgeWithTooltip";
import LibraryLocationsBadge from "./components/LibraryLocationsBadge";
import type { LibraryItem } from "./components/LibraryLocationsBadge";
import { deleteBook } from "./actions";

type BookDetailClientProps = {
	book: {
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
	};
	libraries: LibraryItem[];
	conditionColor: string;
	conditionLabel: string;
	isOwner: boolean;
	isAvailable: boolean;
};

export default function BookDetailClient({
	book,
	libraries,
	conditionColor,
	conditionLabel,
	isOwner,
	isAvailable,
}: BookDetailClientProps) {
	const router = useRouter();
	const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);

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
			<div className="relative mx-auto flex min-h-screen max-w-lg flex-col pb-40">
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

				<main className="flex flex-col px-6 pt-4">
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
									{isOwner ? (
										<button
											type="button"
											onClick={handleDelete}
											disabled={book.status !== "AVAILABLE"}
											className={`mt-0.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
												book.status === "AVAILABLE"
													? "text-red-600 hover:bg-red-50"
													: "cursor-not-allowed bg-neutral-200 text-neutral-400"
											}`}
										>
											<Trash2 className="h-3.5 w-3.5" />
											삭제하기
										</button>
									) : (
										<span className="mt-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
											책장 점수{" "}
											{book.owner?.bookshelf_score ?? 0}권
										</span>
									)}
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

				{/* Floating Bottom Action - hidden when library modal is open */}
				{!isLibraryModalOpen && (
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
				)}
			</div>
		</>
	);
}
