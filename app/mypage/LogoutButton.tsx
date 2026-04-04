"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import AnimatedLogo from "@/components/AnimatedLogo";
import { createClient } from "@/utils/supabase/client";

function LogoutConfirmModal({
	onCancel,
	onConfirm,
	isLoading,
}: {
	onCancel: () => void;
	onConfirm: () => void;
	isLoading: boolean;
}) {
	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
			onClick={(e) => e.target === e.currentTarget && onCancel()}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-white/90 shadow-xl backdrop-blur-md"
			>
				<div className="p-5">
					<p className="text-center text-base font-medium text-foreground">
						로그아웃 하시겠습니까?
					</p>
					<div className="mt-5 flex gap-3">
						<button
							type="button"
							onClick={onCancel}
							className="flex-1 rounded-xl border border-neutral-300 bg-white/60 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-white/80"
						>
							취소
						</button>
						<button
							type="button"
							onClick={onConfirm}
							disabled={isLoading}
							className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-red-600 disabled:opacity-50"
						>
							{isLoading ? (
								<span className="flex justify-center">
									<AnimatedLogo className="h-9 w-9" />
								</span>
							) : (
								"로그아웃"
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

type Props = {
	variant?: "default" | "header" | "footer";
};

export default function LogoutButton({ variant = "default" }: Props) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const handleLogout = async () => {
		setIsLoading(true);
		try {
			const supabase = createClient();
			await supabase.auth.signOut();
			router.push("/login");
			router.refresh();
		} catch {
			setIsLoading(false);
		}
	};

	const handleConfirmClick = () => {
		setShowConfirm(false);
		handleLogout();
	};

	if (variant === "header") {
		return (
			<>
				<button
					type="button"
					onClick={() => setShowConfirm(true)}
					disabled={isLoading}
					className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/50 hover:text-foreground disabled:opacity-50"
					aria-label="로그아웃"
				>
					{isLoading ? (
						<AnimatedLogo className="h-8 w-8" />
					) : (
						<>
							<LogOut className="h-4 w-4" strokeWidth={2} />
							로그아웃
						</>
					)}
				</button>
				{showConfirm && (
					<LogoutConfirmModal
						onCancel={() => setShowConfirm(false)}
						onConfirm={handleConfirmClick}
						isLoading={isLoading}
					/>
				)}
			</>
		);
	}

	if (variant === "footer") {
		return (
			<>
				<button
					type="button"
					onClick={() => setShowConfirm(true)}
					disabled={isLoading}
					className="w-full rounded-xl border border-neutral-300 bg-white/50 py-3 font-medium text-neutral-600 shadow-sm transition-colors hover:bg-white/80 disabled:opacity-50"
					aria-label="로그아웃"
				>
					{isLoading ? (
						<span className="flex justify-center">
							<AnimatedLogo className="h-9 w-9" />
						</span>
					) : (
						"로그아웃"
					)}
				</button>
				{showConfirm && (
					<LogoutConfirmModal
						onCancel={() => setShowConfirm(false)}
						onConfirm={handleConfirmClick}
						isLoading={isLoading}
					/>
				)}
			</>
		);
	}

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={isLoading}
			className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white/40 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground disabled:opacity-50"
		>
			{isLoading ? (
				<>
					<AnimatedLogo className="h-8 w-8" />
					로그아웃 중...
				</>
			) : (
				<>
					<LogOut className="h-4 w-4" strokeWidth={2} />
					로그아웃
				</>
			)}
		</button>
	);
}
