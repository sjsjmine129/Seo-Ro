"use client";

import { useState, useRef, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { updateUserProfile } from "./actions";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	initialNickname: string;
	initialProfileImage: string | null;
	onSuccess: () => void;
};

export default function ProfileEditModal({
	isOpen,
	onClose,
	initialNickname,
	initialProfileImage,
	onSuccess,
}: Props) {
	const [nickname, setNickname] = useState(initialNickname);
	const [profileImage, setProfileImage] = useState<string | null>(
		initialProfileImage,
	);
	const [file, setFile] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setNickname(initialNickname);
			setProfileImage(initialProfileImage);
			setFile(null);
			setError(null);
		}
	}, [isOpen, initialNickname, initialProfileImage]);

	if (!isOpen) return null;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (f && f.type.startsWith("image/")) {
			setFile(f);
			setProfileImage(URL.createObjectURL(f));
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			await updateUserProfile(nickname.trim(), file);
			onSuccess();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "저장 실패");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
					<h3 className="text-base font-semibold text-foreground">
						프로필 수정
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground"
						aria-label="닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					{/* Avatar */}
					<div className="flex flex-col items-center gap-3">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-white/60 bg-white/40 object-cover transition-opacity hover:opacity-90"
						>
							{profileImage ? (
								<img
									src={profileImage}
									alt="프로필"
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
									👤
								</div>
							)}
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handleFileChange}
							className="hidden"
						/>
						<span className="text-xs text-muted-foreground">
							클릭하여 사진 변경
						</span>
					</div>

					{/* Nickname */}
					<div>
						<label
							htmlFor="profile-nickname"
							className="mb-1.5 block text-sm font-medium text-foreground"
						>
							닉네임
						</label>
						<input
							id="profile-nickname"
							type="text"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							className="w-full rounded-xl border border-white/60 bg-white/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							placeholder="닉네임"
							maxLength={30}
						/>
					</div>

					{error && (
						<p className="text-sm text-red-600">{error}</p>
					)}

					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 rounded-xl border border-white/60 bg-white/40 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/60"
						>
							취소
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{isSubmitting ? (
								<Loader2 className="mx-auto h-5 w-5 animate-spin" />
							) : (
								"저장"
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
