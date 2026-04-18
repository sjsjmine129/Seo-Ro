/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BookOpen, Library } from "lucide-react";

export type BookCardProps = {
	id: string;
	title: string;
	authors: string | null;
	thumbnailUrl: string | null;
	condition: string;
	libraryName: string;
	isInterestedLibrary?: boolean;
	isSwapped?: boolean;
	/** Hybrid chat: 약속 수락 후 예약됨 */
	isTrading?: boolean;
};

export default function BookCard({
	id,
	title,
	authors,
	thumbnailUrl,
	condition,
	libraryName,
	isInterestedLibrary = false,
	isSwapped = false,
	isTrading = false,
}: BookCardProps) {
	return (
		<Link
			href={`/book/${id}`}
			className={`block rounded-2xl border border-primary/20 bg-glass-bg p-4 shadow-sm backdrop-blur-md transition-opacity hover:opacity-90 ${
				isSwapped ? "opacity-60" : ""
			}`}
		>
			<div className="flex gap-4">
				<div
					className={`relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-neutral-200 ${
						isSwapped ? "grayscale" : ""
					} ${isTrading ? "opacity-75" : ""}`}
				>
					{thumbnailUrl ? (
						<img
							src={thumbnailUrl}
							alt={title}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<BookOpen className="h-8 w-8 text-neutral-400" strokeWidth={1.5} />
						</div>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						{isInterestedLibrary && !isSwapped && (
							<span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
								⭐ 관심 도서관
							</span>
						)}
						{isTrading && (
							<span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
								교환 약속 중
							</span>
						)}
						{isSwapped && (
							<span className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
								교환 완료
							</span>
						)}
						<span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
							{condition}급
						</span>
					</div>
					<h3 className="mt-1 line-clamp-2 font-semibold text-foreground">
						{title}
					</h3>
					{authors && (
						<p className="mt-0.5 line-clamp-1 text-sm text-foreground/70">
							{authors}
						</p>
					)}
					<p className="mt-1 flex items-center gap-1 text-xs text-primary">
						<Library className="h-3.5 w-3.5" strokeWidth={2} />
						{libraryName}
					</p>
				</div>
			</div>
		</Link>
	);
}
