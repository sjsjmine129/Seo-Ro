"use client";

import { useState, useRef, useEffect } from "react";

const TOOLTIP_TEXT =
	"S: 새 책, A: 거의 새 책, B: 사용감 있음, C: 헌 책, D: 파손 있음";

type ConditionBadgeWithTooltipProps = {
	label: string;
	className: string;
};

export default function ConditionBadgeWithTooltip({
	label,
	className,
}: ConditionBadgeWithTooltipProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	return (
		<div
			ref={containerRef}
			className="relative"
		>
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				onMouseEnter={() => setIsOpen(true)}
				onMouseLeave={() => setIsOpen(false)}
				className={`rounded-md px-2 py-0.5 text-xs font-semibold ${className}`}
				aria-label="책 상태 등급"
				aria-expanded={isOpen}
			>
				{label}
			</button>
			{(isOpen || undefined) && (
				<div
					className="absolute left-0 top-full z-[100] mt-1.5 min-w-[240px] rounded-lg border border-white/40 bg-white/95 px-3 py-2.5 text-left text-xs leading-relaxed text-foreground shadow-lg backdrop-blur-md"
					role="tooltip"
				>
					{TOOLTIP_TEXT}
				</div>
			)}
		</div>
	);
}
