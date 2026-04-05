"use client";

import { AnimatePresence, motion } from "framer-motion";

const backdropTransition = { duration: 0.25 };
const sheetSpring = {
	type: "spring" as const,
	bounce: 0,
	duration: 0.4,
};

type BottomSheetModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	/** Tailwind classes for the sliding panel (include pointer-events-auto, width, rounded, bg, flex, overflow, etc.) */
	className?: string;
	zIndexBase?: number;
};

/**
 * Bottom sheet with fading backdrop + slide-up panel (framer-motion).
 */
export default function BottomSheetModal({
	open,
	onClose,
	children,
	className = "",
	zIndexBase = 9998,
}: BottomSheetModalProps) {
	const zBackdrop = zIndexBase;
	const zLayer = zIndexBase + 1;

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						key="bottom-sheet-backdrop"
						role="presentation"
						aria-hidden
						className="fixed inset-0 bg-black/40"
						style={{ zIndex: zBackdrop }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={backdropTransition}
						onClick={onClose}
					/>
					<div
						className="fixed inset-0 flex items-end justify-center pointer-events-none p-4 pb-[env(safe-area-inset-bottom)]"
						style={{ zIndex: zLayer }}
					>
						<motion.div
							key="bottom-sheet-panel"
							className={className}
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={sheetSpring}
							onClick={(e) => e.stopPropagation()}
						>
							{children}
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>
	);
}
