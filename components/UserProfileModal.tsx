/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, User, BookOpen } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/utils/supabase/client";
import InlineLoadingLogo from "@/components/InlineLoadingLogo";

const enterTransition = { duration: 0.2, ease: [0, 0, 0.2, 1] as const };

type ProfileRow = {
	nickname: string | null;
	profile_image: string | null;
	bookshelf_score: number;
};

type BookRow = {
	id: string;
	title: string;
	thumbnail_url: string | null;
};

export type UserProfileModalProps = {
	userId: string;
	isOpen: boolean;
	onClose: () => void;
};

function ProfileHeader({ profile }: { profile: ProfileRow }) {
	return (
		<div className="flex items-center gap-4 p-5 pr-14">
			{profile.profile_image ? (
				<img
					src={profile.profile_image}
					alt={profile.nickname ?? ""}
					className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-black/5"
				/>
			) : (
				<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 ring-2 ring-black/5">
					<User className="h-8 w-8" strokeWidth={1.5} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-base font-bold text-foreground">
					{profile.nickname ?? "알 수 없음"}
				</p>
				<p className="mt-1 text-sm text-gray-500">책장 점수 {profile.bookshelf_score}권</p>
			</div>
		</div>
	);
}

export default function UserProfileModal({
	userId,
	isOpen,
	onClose,
}: UserProfileModalProps) {
	const [profile, setProfile] = useState<ProfileRow | null>(null);
	const [books, setBooks] = useState<BookRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen || !userId) return;

		let cancelled = false;
		setLoading(true);
		setError(null);
		setProfile(null);
		setBooks([]);

		const supabase = createClient();

		(async () => {
			const [userRes, booksRes] = await Promise.all([
				supabase
					.from("users")
					.select("nickname, profile_image, bookshelf_score")
					.eq("id", userId)
					.maybeSingle(),
				supabase
					.from("books")
					.select("id, title, thumbnail_url")
					.eq("owner_id", userId)
					.eq("status", "AVAILABLE")
					.order("last_bumped_at", { ascending: false }),
			]);

			if (cancelled) return;

			if (userRes.error) {
				setError("프로필을 불러오지 못했습니다.");
				setLoading(false);
				return;
			}
			if (!userRes.data) {
				setError("사용자를 찾을 수 없습니다.");
				setLoading(false);
				return;
			}

			setProfile({
				nickname: userRes.data.nickname,
				profile_image: userRes.data.profile_image,
				bookshelf_score: userRes.data.bookshelf_score ?? 1,
			});
			setBooks(booksRes.error ? [] : (booksRes.data ?? []));
			setLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [isOpen, userId]);

	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		else document.body.style.overflow = "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	const displayName = profile?.nickname?.trim() || "이웃";

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					key="user-profile-overlay"
					role="presentation"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={enterTransition}
					onClick={(e) => {
						if (e.target === e.currentTarget) onClose();
					}}
				>
					<motion.div
						key="user-profile-panel"
						role="dialog"
						aria-modal="true"
						aria-labelledby="user-profile-modal-title"
						className="relative w-[90vw] max-w-md overflow-hidden rounded-2xl bg-white shadow-lg"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={enterTransition}
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							onClick={onClose}
							className="absolute right-2 top-2 z-10 rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 hover:text-foreground"
							aria-label="닫기"
						>
							<X className="h-5 w-5" />
						</button>

						<h2 id="user-profile-modal-title" className="sr-only">
							이웃 프로필
						</h2>

						{loading && (
							<div className="flex justify-center px-5 py-14">
								<InlineLoadingLogo />
							</div>
						)}

						{!loading && error && (
							<p className="px-5 py-10 text-center text-sm text-gray-500">{error}</p>
						)}

						{!loading && profile && (
							<div className="flex flex-col">
								<ProfileHeader profile={profile} />
								<hr className="border-gray-100" />
								{books.length > 0 ? (
									<div className="p-5">
										<h3 className="mb-3 text-sm font-bold text-gray-800">
											이웃이 꽂은 책
										</h3>
										<div
											className="-mx-5 flex snap-x gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [-webkit-overflow-scrolling:touch] hide-scrollbar"
										>
											{books.map((b) => (
												<Link
													key={b.id}
													href={`/book/${b.id}`}
													onClick={onClose}
													className="w-[7.25rem] shrink-0 snap-start"
												>
													<div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-black/10 bg-neutral-200 shadow-sm">
														{b.thumbnail_url ? (
															<img
																src={b.thumbnail_url}
																alt={b.title}
																className="h-full w-full object-cover"
															/>
														) : (
															<div className="flex h-full w-full items-center justify-center bg-white">
																<BookOpen
																	className="h-8 w-8 text-neutral-400"
																	strokeWidth={1.5}
																/>
															</div>
														)}
													</div>
													<p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-foreground">
														{b.title}
													</p>
												</Link>
											))}
										</div>
									</div>
								) : (
									<div className="p-8 text-center text-sm text-gray-400">
										아직 {displayName}님은 책을 꽂지 않았어요
									</div>
								)}
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
