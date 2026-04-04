"use client";

import { motion } from "framer-motion";

/**
 * Stacked-books logo: `public/1.png` (top) … `public/8.png` (bottom). Each file is
 * the same canvas size with the book placed in-frame; layers are stacked with
 * `absolute inset-0` so transparency lines up. Use: `<AnimatedLogo className="..." />`.
 */

const SPRING = {
	type: "spring" as const,
	stiffness: 200,
	damping: 15,
};

const BOOK_IMAGES = [
	"/1.png",
	"/2.png",
	"/3.png",
	"/4.png",
	"/5.png",
	"/6.png",
	"/7.png",
	"/8.png",
] as const;

type AnimatedLogoProps = {
	className?: string;
};

export default function AnimatedLogo({ className }: AnimatedLogoProps) {
	return (
		<div
			className={`relative mx-auto aspect-square w-32 max-w-full overflow-visible ${className ?? ""}`}
			aria-hidden
		>
			{BOOK_IMAGES.map((src, index) => {
				/* Top book first (`1.png` → delay 0), bottom last (`8.png` → 0.7s). */
				const delay = index * 0.1;

				return (
					<motion.img
						key={src}
						src={src}
						alt=""
						draggable={false}
						className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
						initial={{ y: -80, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{
							...SPRING,
							delay,
						}}
					/>
				);
			})}
		</div>
	);
}
