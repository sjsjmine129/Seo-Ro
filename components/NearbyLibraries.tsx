/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
	formatDistanceLabel,
	getNearbyLibraries,
	type CurrentLibraryForNearby,
} from "@/lib/nearbyLibraries";

type Props = {
	currentLibrary: CurrentLibraryForNearby;
};

export default async function NearbyLibraries({ currentLibrary }: Props) {
	const supabase = await createClient();
	const libraries = await getNearbyLibraries(supabase, currentLibrary);

	if (libraries.length === 0) return null;

	return (
		<section
			className="mt-8 px-4"
			aria-labelledby="nearby-libraries-heading"
		>
			<h2
				id="nearby-libraries-heading"
				className="mb-3 text-base font-semibold text-foreground"
			>
				근처의 다른 도서관
			</h2>
			<div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 [-webkit-overflow-scrolling:touch] hide-scrollbar">
				{libraries.map((lib) => (
					<Link
						key={lib.id}
						href={`/library/${lib.id}`}
						className="flex w-[14rem] shrink-0 snap-start flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-opacity hover:opacity-90"
					>
						<div className="min-w-0">
							<p className="line-clamp-2 text-sm font-medium text-foreground">
								{lib.name}
							</p>
							<p className="mt-1 text-sm text-blue-500">
								{formatDistanceLabel(lib.distanceKm)}
							</p>
							{lib.address ? (
								<p className="mt-0.5 truncate text-xs text-gray-500">
									{lib.address}
								</p>
							) : null}
						</div>

						<div className="mt-auto border-t border-gray-100 pt-3">
							{lib.totalBooks > 0 ? (
								<div className="flex min-h-[2.75rem] items-center gap-3">
									{lib.bookThumbnails.length > 0 ? (
										<div className="flex shrink-0 pl-0.5">
											{lib.bookThumbnails.map((url, i) => (
												<img
													key={`${lib.id}-thumb-${i}`}
													src={url}
													alt=""
													className={`h-11 w-8 rounded-sm object-cover shadow-sm ring-2 ring-white ${
														i > 0 ? "-ml-2" : ""
													}`}
												/>
											))}
										</div>
									) : null}
									<span className="text-xs text-gray-600">
										총 {lib.totalBooks}권
									</span>
								</div>
							) : (
								<p className="text-xs text-gray-400">
									아직 꽂힌 책이 없어요
								</p>
							)}
						</div>
					</Link>
				))}
			</div>
		</section>
	);
}
