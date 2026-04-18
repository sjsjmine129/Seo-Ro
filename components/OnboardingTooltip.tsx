"use client";

import { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";

export type OnboardingTooltipAlign = "left" | "center" | "right";

type OnboardingTooltipProps = {
	message: string;
	onClose: () => void;
	position: "top" | "bottom";
	align?: OnboardingTooltipAlign;
};

const BODY_BOX =
	"w-max min-w-[200px] max-w-[min(280px,calc(100vw-2rem))]";

/**
 * Floating speech bubble for one-time onboarding. Parent must be `position: relative`.
 * `bottom`: bubble sits above the anchor; pointer aims down.
 * `top`: bubble sits below the anchor; pointer aims up.
 *
 * **PRD diagnostics:** render log + `outline` + `getBoundingClientRect` in `useLayoutEffect`.
 */
export default function OnboardingTooltip({
	message,
	onClose,
	position,
	align = "center",
}: OnboardingTooltipProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const aboveAnchor = position === "bottom";

	const containerAlignClass =
		align === "center"
			? "left-1/2 -translate-x-1/2"
			: align === "left"
				? "left-0"
				: "right-0";

	const arrowAlignClass =
		align === "center"
			? "left-1/2 -translate-x-1/2"
			: align === "left"
				? "left-6"
				: "right-6";

	useLayoutEffect(() => {
		const el = rootRef.current;
		if (!el || typeof window === "undefined") return;
		const r = el.getBoundingClientRect();
		console.log("🟡 [Tooltip DOM]", {
			message: message.slice(0, 40),
			width: r.width,
			height: r.height,
			top: r.top,
			left: r.left,
			right: r.right,
			bottom: r.bottom,
			vw: window.innerWidth,
			vh: window.innerHeight,
			offScreenLeft: r.left < 0,
			offScreenRight: r.right > window.innerWidth,
			offScreenTop: r.top < 0,
			offScreenBottom: r.bottom > window.innerHeight,
			zeroSize: r.width === 0 || r.height === 0,
		});
	}, [message, position, align]);

	console.log("🟢 [Tooltip Rendered] Message:", message);

	return (
		<div
			ref={rootRef}
			role="dialog"
			aria-label="이용 안내"
			className={`pointer-events-auto absolute z-[100] outline outline-4 outline-red-500 ${BODY_BOX} ${containerAlignClass} animate-bounce ${
				aboveAnchor ? "bottom-full mb-3" : "top-full mt-3"
			}`}
		>
			<div
				className={`relative ${BODY_BOX} rounded-xl bg-primary px-3.5 py-2.5 pr-10 text-sm leading-snug text-primary-foreground shadow-lg`}
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground/90 transition-colors hover:bg-white/15 hover:text-white"
					aria-label="닫기"
				>
					<X className="h-4 w-4" strokeWidth={2} aria-hidden />
				</button>
				<p className="break-keep text-center text-white">{message}</p>
				{aboveAnchor ? (
					<div
						className={`pointer-events-none absolute top-full -mt-px h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-primary ${arrowAlignClass}`}
						aria-hidden
					/>
				) : (
					<div
						className={`pointer-events-none absolute bottom-full -mb-px h-0 w-0 border-x-[7px] border-b-[8px] border-x-transparent border-b-primary ${arrowAlignClass}`}
						aria-hidden
					/>
				)}
			</div>
		</div>
	);
}
