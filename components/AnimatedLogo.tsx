"use client";

import { motion } from "framer-motion";

/**
 * Animated stacked-books logo using PNG slices from `public/1.png` … `public/8.png`.
 *
 * Prerequisites: place `1.png` (top / pink) through `8.png` (bottom / brown) in
 * `public/`. Use on the login page or any client view: `<AnimatedLogo className="..." />`.
 */

const SPRING = {
	type: "spring" as const,
	stiffness: 200,
	damping: 15,
};

/** Top → bottom: index 0 = `/1.png`, index 7 = `/8.png`. */
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

const BOOK_COUNT = BOOK_IMAGES.length;

type AnimatedLogoProps = {
	className?: string;
};

export default function AnimatedLogo({ className }: AnimatedLogoProps) {
	return (
		<div
			className={`relative mx-auto aspect-square w-full max-w-[7.5rem] overflow-visible md:max-w-[8.5rem] ${className ?? ""}`}
			aria-hidden
		>
			<div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-end overflow-visible pb-0.5">
				{BOOK_IMAGES.map((src, index) => {
					const staggerDelay = (BOOK_COUNT - 1 - index) * 0.1;
					/* Top book in front of lower layers */
					const zIndex = BOOK_COUNT - index;

					return (
						<motion.img
							key={src}
							src={src}
							alt=""
							draggable={false}
							className="relative mb-[-6px] h-auto w-full max-w-[min(100%,11rem)] shrink-0 object-contain object-bottom select-none last:mb-0"
							style={{ zIndex }}
							initial={{ y: -80, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							transition={{
								...SPRING,
								delay: staggerDelay,
							}}
						/>
					);
				})}
			</div>
		</div>
	);
}
