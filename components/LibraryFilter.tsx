"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";

type Library = { id: string; name: string };

type Props = {
	libraries: Library[];
	selectedId: string | null;
};

export default function LibraryFilter({ libraries, selectedId }: Props) {
	const router = useRouter();
	const containerRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const displayLabel =
		!selectedId || selectedId === "all"
			? "내 관심 도서관"
			: (libraries.find((l) => l.id === selectedId)?.name ??
				"내 관심 도서관");

	const handleSelect = (libraryId: string) => {
		setIsOpen(false);
		const params = new URLSearchParams();
		if (libraryId !== "all") params.set("libraryId", libraryId);
		router.push(params.toString() ? `/?${params.toString()}` : "/");
	};

	const handleSearchClick = () => {
		setIsOpen(false);
		router.push("/search");
	};

	return (
		<div
			ref={containerRef}
			className="sticky top-4 z-40 mb-6 flex flex-col items-center"
		>
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className="flex cursor-pointer items-center gap-1 rounded-full border border-white/40 bg-white/70 px-6 py-2.5 text-sm font-semibold text-primary shadow-md backdrop-blur-md"
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				aria-label="Select library"
			>
				{displayLabel}
			</button>

			{isOpen && (
				<div
					className="absolute top-full z-50 mt-2 flex min-w-[200px] w-max flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/80 shadow-lg backdrop-blur-xl"
					role="listbox"
				>
					<button
						type="button"
						onClick={() => handleSelect("all")}
						className="cursor-pointer px-4 py-3 text-center text-sm text-gray-700 transition-colors hover:bg-white/50"
						role="option"
					>
						내 관심 도서관
					</button>
					{libraries.map((lib) => (
						<button
							key={lib.id}
							type="button"
							onClick={() => handleSelect(lib.id)}
							className="cursor-pointer px-4 py-3 text-center text-sm text-gray-700 transition-colors hover:bg-white/50"
							role="option"
						>
							{lib.name}
						</button>
					))}
					<div className="my-1 h-px bg-white/40" />
					<button
						type="button"
						onClick={handleSearchClick}
						className="cursor-pointer px-4 py-3 text-center text-sm text-gray-700 transition-colors hover:bg-white/50"
					>
						다른 도서관 찾아보기
					</button>
				</div>
			)}
		</div>
	);
}
