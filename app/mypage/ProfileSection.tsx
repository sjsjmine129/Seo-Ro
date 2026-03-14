"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Library } from "lucide-react";
import ProfileEditModal from "./ProfileEditModal";

type LibraryItem = { id: string; name: string };
type Props = {
	nickname: string;
	profileImage: string | null;
	bookshelfScore: number;
	libraries: LibraryItem[];
};

export default function ProfileSection({
	nickname,
	profileImage,
	bookshelfScore,
	libraries,
}: Props) {
	const router = useRouter();
	const [showEditModal, setShowEditModal] = useState(false);

	return (
		<>
			<section className="relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-white/80 to-white/30 p-5 shadow-xl shadow-primary/5 backdrop-blur-xl">
				<div className="flex flex-row items-center gap-5 text-left">
					{/* Avatar - left */}
					<div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white/60 shadow-md">
						{profileImage ? (
							<img
								src={profileImage}
								alt={nickname}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-white/40 text-2xl text-muted-foreground">
								👤
							</div>
						)}
					</div>

					{/* Text & Edit - right */}
					<div className="min-w-0 flex-1">
						<h2 className="text-lg font-bold text-foreground">
							{nickname || "닉네임 없음"}
						</h2>
						<div className="mt-0.5 flex items-center gap-1.5">
							<span className="text-xl font-bold text-primary">
								{bookshelfScore}
							</span>
							<span className="text-xs text-muted-foreground">
								책장 점수
							</span>
						</div>
						<button
							type="button"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								setShowEditModal(true);
							}}
							className="mt-3 rounded-full border border-white/40 bg-white/60 px-4 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-white/80"
							aria-label="프로필 수정"
						>
							프로필 수정
						</button>
					</div>
				</div>

				{/* Interested Libraries */}
				<div className="mt-4">
					<p className="mb-2 text-xs font-medium text-muted-foreground">
						관심 도서관
					</p>
					{libraries.length === 0 ? (
						<Link
							href="/search?tab=library"
							className="inline-flex items-center gap-2 rounded-xl border border-dashed border-white/60 bg-white/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-white/60"
						>
							<Library className="h-4 w-4" strokeWidth={2} />
							도서관 추가하기
						</Link>
					) : (
						<div className="flex flex-wrap gap-2">
							{libraries.map((lib) => (
								<Link
									key={lib.id}
									href={`/library/${lib.id}`}
									className="rounded-lg border border-white/60 bg-white/50 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/70"
								>
									{lib.name}
								</Link>
							))}
						</div>
					)}
				</div>
			</section>

			<ProfileEditModal
				isOpen={showEditModal}
				onClose={() => setShowEditModal(false)}
				initialNickname={nickname}
				initialProfileImage={profileImage}
				onSuccess={() => {
					router.refresh();
					setShowEditModal(false);
				}}
			/>
		</>
	);
}
