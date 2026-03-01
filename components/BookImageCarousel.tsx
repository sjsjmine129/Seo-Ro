"use client";

import { useRef, useState, useEffect } from "react";

type BookImageCarouselProps = {
	images: string[];
	alt: string;
};

export default function BookImageCarousel({ images, alt }: BookImageCarouselProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el || images.length <= 1) return;

		const handleScroll = () => {
			const scrollLeft = el.scrollLeft;
			const width = el.offsetWidth;
			const index = Math.round(scrollLeft / width);
			setActiveIndex(Math.min(index, images.length - 1));
		};

		el.addEventListener("scroll", handleScroll);
		return () => el.removeEventListener("scroll", handleScroll);
	}, [images.length]);

	const safeImages = images?.length ? images : [];

	if (safeImages.length === 0) {
		return (
			<div className="flex h-[250px] w-full items-center justify-center bg-white/40">
				<span className="text-sm text-neutral-500">No image</span>
			</div>
		);
	}

	return (
		<div className="relative w-full">
			<div
				ref={scrollRef}
				className="flex h-[250px] w-full snap-x snap-mandatory overflow-x-auto bg-white/40 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
			>
				{safeImages.map((url, i) => (
					<div
						key={url + i}
						className="relative flex h-full w-full flex-shrink-0 snap-center items-center justify-center bg-[#F9F5EB]/50"
					>
						<img
							src={url}
							alt={`${alt} - ${i + 1}`}
							className="h-full w-full object-contain"
						/>
					</div>
				))}
			</div>
			{safeImages.length > 1 && (
				<div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
					{activeIndex + 1} / {safeImages.length}
				</div>
			)}
		</div>
	);
}
