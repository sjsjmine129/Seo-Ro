/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
	getRecommendedBooks,
	type CurrentBookForRecommendation,
} from "@/lib/recommendedBooks";

type Props = {
	currentBook: CurrentBookForRecommendation;
};

/**
 * Horizontal strip matches `app/library/[id]/page.tsx` — "이 도서관에 새로 꽂힌 책":
 * `-mx-*` + `px-*` on the same scroll row (parent section uses matching horizontal padding).
 */
export default async function RecommendedBooks({ currentBook }: Props) {
	const supabase = await createClient();
	const books = await getRecommendedBooks(supabase, currentBook);

	if (books.length === 0) return null;

	return (
		<section className="mt-8 px-6" aria-labelledby="recommended-books-heading">
			<h2
				id="recommended-books-heading"
				className="mb-3 text-base font-semibold text-foreground"
			>
				이런 책은 어떠세요?
			</h2>
			<div
				className="-mx-6 mt-2 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
			>
				{books.map((b) => (
					<Link
						key={b.id}
						href={`/book/${b.id}`}
						className="flex w-[110px] flex-none flex-col overflow-hidden rounded-xl border border-primary/20 bg-white/90 shadow-sm backdrop-blur-md sm:w-[130px]"
					>
						<div className="relative aspect-[3/4] w-full bg-neutral-200">
							{b.thumbnail_url ? (
								<img
									src={b.thumbnail_url}
									alt={b.title}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-neutral-400">
									<BookOpen
										className="h-10 w-10"
										strokeWidth={1.5}
									/>
								</div>
							)}
						</div>
						<div className="p-2">
							<p className="line-clamp-2 text-sm font-medium text-foreground">
								{b.title}
							</p>
							<p className="mt-0.5 truncate text-xs text-foreground/60">
								{b.libraryName}
							</p>
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
