"use client";

import { AnimatePresence, motion } from "framer-motion";

const backdropTransition = { duration: 0.25 };
const panelSpring = {
	type: "spring" as const,
	bounce: 0,
	duration: 0.35,
};

type CenterModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	zIndexBase?: number;
};

/**
 * Centered dialog with fading backdrop + scale/fade panel (framer-motion).
 */
export default function CenterModal({
	open,
	onClose,
	children,
	className = "",
	zIndexBase = 9998,
}: CenterModalProps) {
	const zBackdrop = zIndexBase;
	const zLayer = zIndexBase + 1;

	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						key="center-modal-backdrop"
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
						className="fixed inset-0 flex items-center justify-center pointer-events-none p-4"
						style={{ zIndex: zLayer }}
					>
						<motion.div
							key="center-modal-panel"
							className={className}
							initial={{ opacity: 0, scale: 0.96, y: 16 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.96, y: 16 }}
							transition={panelSpring}
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
