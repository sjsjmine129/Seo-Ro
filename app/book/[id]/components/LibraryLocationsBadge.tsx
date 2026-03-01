"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, X } from "lucide-react";

export type LibraryItem = {
	id: string;
	name: string;
	address: string | null;
};

type LibraryLocationsBadgeProps = {
	libraries: LibraryItem[];
	onOpenChange?: (isOpen: boolean) => void;
};

export default function LibraryLocationsBadge({
	libraries,
	onOpenChange,
}: LibraryLocationsBadgeProps) {
	const [isOpen, setIsOpen] = useState(false);

	const setOpen = (open: boolean) => {
		setIsOpen(open);
		onOpenChange?.(open);
	};

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) setOpen(false);
	};

	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (libraries.length === 0) return null;

	const badgeText =
		libraries.length === 1
			? libraries[0].name
			: `${libraries[0].name} 외 ${libraries.length - 1}곳`;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-md transition-opacity hover:bg-white/80"
			>
				<MapPin
					className="h-4 w-4 flex-shrink-0 text-primary"
					strokeWidth={2}
				/>
				<span className="text-sm font-medium text-foreground">
					{badgeText}
				</span>
			</button>

			{isOpen && (
				<div
					onClick={handleBackdropClick}
					className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 p-4 pb-[env(safe-area-inset-bottom)]"
				>
					<div
						onClick={(e) => e.stopPropagation()}
						className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/40 bg-white/90 shadow-xl backdrop-blur-md"
					>
						<div className="flex items-center justify-between border-b border-white/40 px-4 py-3">
							<h3 className="text-base font-semibold text-foreground">
								꽂혀 있는 도서관
							</h3>
							<button
								type="button"
								onClick={() => setOpen(false)}
								className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-white/60 hover:text-foreground"
								aria-label="닫기"
							>
								<X className="h-5 w-5" />
							</button>
						</div>
						<ul className="max-h-[60vh] overflow-y-auto p-2">
							{libraries.map((lib) => (
								<li key={lib.id}>
									<Link
										href={`/library/${lib.id}`}
										onClick={() => setOpen(false)}
										className="flex flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/60"
									>
										<span className="font-medium text-foreground">
											{lib.name}
										</span>
										{lib.address && (
											<span className="flex items-start gap-1.5 text-xs text-foreground/70">
												<MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
												{lib.address}
											</span>
										)}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</>
	);
}
