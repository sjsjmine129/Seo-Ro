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
				className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth scroll-pl-3 scroll-pr-3 px-3 pb-4 [-webkit-overflow-scrolling:touch] hide-scrollbar"
			>
				{books.map((b) => (
					<Link
						key={b.id}
						href={`/book/${b.id}`}
						className="w-[7.25rem] shrink-0 snap-start"
					>
						<div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-primary/20 bg-neutral-200 shadow-sm">
							{b.thumbnail_url ? (
								<img
									src={b.thumbnail_url}
									alt={b.title}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-white/60">
									<BookOpen
										className="h-8 w-8 text-neutral-400"
										strokeWidth={1.5}
									/>
								</div>
							)}
						</div>
						<p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-foreground">
							{b.title}
						</p>
						<p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
							{b.libraryName}
						</p>
					</Link>
				))}
			</div>
		</section>
	);
}
