"use client";

import { motion } from "framer-motion";

/**
 * Stacked-books mark inspired by `icon.png` — pure CSS; books fall and stack
 * with stagger from the bottom book upward.
 *
 * Test: import on `app/login/page.tsx` and swap in place of `<Logo />`, or
 * render on `app/loading.tsx` for a full-screen preview.
 */

const SPRING = {
	type: "spring" as const,
	stiffness: 200,
	damping: 15,
};

/** Top → bottom (DOM order: top book first, bottom book last). */
const BOOKS: { color: string; widthPct: number; labelSide: "left" | "right" }[] =
	[
		{ color: "#EC4899", widthPct: 84, labelSide: "right" },
		{ color: "#1D4ED8", widthPct: 91, labelSide: "left" },
		{ color: "#9333EA", widthPct: 96, labelSide: "right" },
		{ color: "#F87171", widthPct: 90, labelSide: "left" },
		{ color: "#22D3EE", widthPct: 94, labelSide: "right" },
		{ color: "#D8B4FE", widthPct: 88, labelSide: "left" },
		{ color: "#027EB1", widthPct: 92, labelSide: "right" },
		{ color: "#A45C4D", widthPct: 86, labelSide: "left" },
	];

type AnimatedLogoProps = {
	className?: string;
};

export default function AnimatedLogo({ className }: AnimatedLogoProps) {
	const n = BOOKS.length;

	return (
		<div
			className={`relative mx-auto aspect-square w-full max-w-[7.5rem] overflow-visible md:max-w-[8.5rem] ${className ?? ""}`}
			aria-hidden
		>
			<div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-end gap-0 overflow-visible pb-0.5">
				{BOOKS.map((book, index) => {
					/* Bottom book (last index) falls first: delay 0, 0.1, … toward top */
					const staggerDelay = (n - 1 - index) * 0.1;
					const z = index + 1;

					const label = (
						<div
							className="h-full shrink-0 rounded-md bg-[#FDFDFD] shadow-inner"
							style={{ width: "32%" }}
						/>
					);
					const cover = (
						<div
							className="h-full min-w-0 flex-1 rounded-md"
							style={{ backgroundColor: book.color }}
						/>
					);

					return (
						<motion.div
							key={index}
							className="mb-[-4px] flex h-[11%] min-h-[7px] items-stretch overflow-hidden rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.18),0_2px_4px_-2px_rgba(0,0,0,0.12)] last:mb-0"
							style={{
								width: `${book.widthPct}%`,
								zIndex: z,
							}}
							initial={{ y: -80, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{
								...SPRING,
								delay: staggerDelay,
							}}
						>
							<div className="flex h-full w-full gap-0.5 p-[3px]">
								{book.labelSide === "left" ? (
									<>
										{label}
										{cover}
									</>
								) : (
									<>
										{cover}
										{label}
									</>
								)}
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
