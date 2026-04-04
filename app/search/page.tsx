"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Library, MapPin, BookOpen } from "lucide-react";
import InlineLoadingLogo from "@/components/InlineLoadingLogo";
import BookCard from "@/components/BookCard";
import { createClient } from "@/utils/supabase/client";
import BottomNav from "@/components/BottomNav";

const PAGE_SIZE = 15;
const LOCATION_FETCH_LIMIT = 500;
const BOOK_SEARCH_DEBOUNCE_MS = 300;

type LibraryItem = {
	id: string;
	name: string;
	address: string | null;
	lat: number;
	lng: number;
};

type BookLibrary = {
	library_id: string;
	libraries: { id: string; name: string } | null;
};

type BookItem = {
	id: string;
	title: string;
	authors: string | null;
	thumbnail_url: string | null;
	condition: string;
	status: string;
	book_libraries: BookLibrary[] | BookLibrary | null;
};

type BookResult = {
	id: string;
	title: string;
	authors: string | null;
	thumbnail_url: string | null;
	condition: string;
	status: string;
	libraryName: string;
	libraryId: string;
	isInterestedLibrary: boolean;
};

function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371; // Earth radius in km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function normalizeBookLibraries(
	bl: BookLibrary[] | BookLibrary | null,
): { libraryId: string; libraryName: string }[] {
	if (!bl) return [];
	const arr = Array.isArray(bl) ? bl : [bl];
	return arr
		.filter((x) => x.libraries)
		.map((x) => ({
			libraryId: x.library_id,
			libraryName: (x.libraries as { name: string }).name ?? "",
		}));
}

export default function SearchPage() {
	const searchParams = useSearchParams();
	const tabFromUrl = searchParams.get("tab") ?? "library";
	const isLibraryTab = tabFromUrl === "library";

	const [searchText, setSearchText] = useState("");
	const [showLocationButton, setShowLocationButton] = useState(false);
	const locationButtonTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const [userLocation, setUserLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [libraryResults, setLibraryResults] = useState<LibraryItem[]>([]);
	const [bookResults, setBookResults] = useState<BookResult[]>([]);
	const [page, setPage] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [geoError, setGeoError] = useState<string | null>(null);
	const sortedWithLocationRef = useRef<LibraryItem[]>([]);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const bookSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const router = useRouter();
	const supabase = useMemo(() => createClient(), []);

	const updateTab = useCallback(
		(tab: "library" | "book") => {
			const params = new URLSearchParams(searchParams.toString());
			params.set("tab", tab);
			router.replace(`/search?${params.toString()}`);
		},
		[router, searchParams],
	);

	const fetchLibrariesFromSupabase = useCallback(
		async (q: string, p: number, append: boolean) => {
			setIsLoading(true);
			try {
				let query = supabase
					.from("libraries")
					.select("id, name, address, lat, lng");

				const trimmed = q.trim();
				if (trimmed) {
					const pattern = `%${trimmed}%`;
					query = query.or(
						`name.ilike.${pattern},address.ilike.${pattern}`,
					);
				}

				if (userLocation) {
					const { data, error } =
						await query.limit(LOCATION_FETCH_LIMIT);
					if (error) throw error;
					let items = (data ?? []) as LibraryItem[];
					items = items
						.map((lib) => ({
							...lib,
							lat: Number(lib.lat),
							lng: Number(lib.lng),
						}))
						.sort((a, b) => {
							const dA = haversineDistance(
								userLocation.lat,
								userLocation.lng,
								a.lat,
								a.lng,
							);
							const dB = haversineDistance(
								userLocation.lat,
								userLocation.lng,
								b.lat,
								b.lng,
							);
							return dA - dB;
						});
					sortedWithLocationRef.current = items;
					const start = p * PAGE_SIZE;
					const pageItems = items.slice(start, start + PAGE_SIZE);
					setLibraryResults((prev) =>
						append ? [...prev, ...pageItems] : pageItems,
					);
					setHasMore(start + pageItems.length < items.length);
				} else {
					const from = p * PAGE_SIZE;
					const to = from + PAGE_SIZE - 1;
					const { data, error } = await query
						.range(from, to)
						.order("name");
					if (error) throw error;
					const items = (data ?? []).map(
						(
							lib: LibraryItem & { lat?: unknown; lng?: unknown },
						) => ({
							id: lib.id,
							name: lib.name,
							address: lib.address ?? null,
							lat: Number(lib.lat),
							lng: Number(lib.lng),
						}),
					) as LibraryItem[];
					setLibraryResults((prev) =>
						append ? [...prev, ...items] : items,
					);
					setHasMore(items.length === PAGE_SIZE);
				}
			} catch (err) {
				console.error("fetchLibraries error:", err);
				setLibraryResults([]);
				setHasMore(false);
			} finally {
				setIsLoading(false);
			}
		},
		[supabase, userLocation],
	);

	const fetchBooksFromSupabase = useCallback(
		async (q: string) => {
			setIsLoading(true);
			try {
				const trimmed = q.trim().toLowerCase();
				if (!trimmed) {
					setBookResults([]);
					return;
				}

				const pattern = `%${trimmed}%`;

				const { data: { user } } = await supabase.auth.getUser();
				let interestedLibraryIds = new Set<string>();
				if (user) {
					const { data: libData } = await supabase
						.from("user_interested_libraries")
						.select("library_id")
						.eq("user_id", user.id);
					interestedLibraryIds = new Set(
						(libData ?? []).map((r) => r.library_id),
					);
				}

				const { data: booksData, error } = await supabase
					.from("books")
					.select(
						"id, title, authors, thumbnail_url, condition, status, book_libraries(library_id, libraries(id, name))",
					)
					.or(`title.ilike.${pattern},authors.ilike.${pattern}`)
					.neq("status", "HIDDEN")
					.limit(100);

				if (error) throw error;

				const books = (booksData ?? []) as BookItem[];
				const available: BookResult[] = [];
				const availableOther: BookResult[] = [];
				const fallback: BookResult[] = [];

				for (const b of books) {
					const libs = normalizeBookLibraries(b.book_libraries);
					if (libs.length === 0) continue;
					const first = libs[0];
					const isInterested = libs.some((l) =>
						interestedLibraryIds.has(l.libraryId),
					);

					const item: BookResult = {
						id: b.id,
						title: b.title,
						authors: b.authors,
						thumbnail_url: b.thumbnail_url,
						condition: b.condition ?? "B",
						status: b.status,
						libraryName: first.libraryName,
						libraryId: first.libraryId,
						isInterestedLibrary: isInterested,
					};

					if (b.status === "AVAILABLE") {
						if (isInterested) available.push(item);
						else availableOther.push(item);
					} else if (
						b.status === "SWAPPED" ||
						b.status === "SWAPPING"
					) {
						fallback.push(item);
					}
				}

				const hasAvailable = available.length > 0 || availableOther.length > 0;
				const sorted = [
					...available,
					...availableOther,
					...(hasAvailable ? [] : fallback),
				];
				setBookResults(sorted);
			} catch (err) {
				console.error("fetchBooks error:", err);
				setBookResults([]);
			} finally {
				setIsLoading(false);
			}
		},
		[supabase],
	);

	useEffect(() => {
		if (!isLibraryTab) return;
		setPage(0);
		if (searchText.trim() || userLocation) {
			fetchLibrariesFromSupabase(searchText, 0, false);
		} else {
			setLibraryResults([]);
			setHasMore(false);
		}
	}, [isLibraryTab, searchText, userLocation, fetchLibrariesFromSupabase]);

	useEffect(() => {
		if (!isLibraryTab) return;
		if (bookSearchTimeoutRef.current) {
			clearTimeout(bookSearchTimeoutRef.current);
			bookSearchTimeoutRef.current = null;
		}
		setBookResults([]);
		return () => {
			if (bookSearchTimeoutRef.current) {
				clearTimeout(bookSearchTimeoutRef.current);
			}
		};
	}, [isLibraryTab]);

	useEffect(() => {
		if (isLibraryTab) return;
		if (bookSearchTimeoutRef.current) {
			clearTimeout(bookSearchTimeoutRef.current);
		}
		const q = searchText.trim();
		if (!q) {
			setBookResults([]);
			return;
		}
		bookSearchTimeoutRef.current = setTimeout(() => {
			fetchBooksFromSupabase(q);
			bookSearchTimeoutRef.current = null;
		}, BOOK_SEARCH_DEBOUNCE_MS);
		return () => {
			if (bookSearchTimeoutRef.current) {
				clearTimeout(bookSearchTimeoutRef.current);
			}
		};
	}, [isLibraryTab, searchText, fetchBooksFromSupabase]);

	useEffect(() => {
		if (!isLibraryTab || !userLocation || libraryResults.length === 0)
			return;
		const el = loadMoreRef.current;
		if (!el || !hasMore || isLoading) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (!entry?.isIntersecting) return;
				const nextPage = page + 1;
				const start = nextPage * PAGE_SIZE;
				const pageItems = sortedWithLocationRef.current.slice(
					start,
					start + PAGE_SIZE,
				);
				if (pageItems.length === 0) return;
				setLibraryResults((prev) => [...prev, ...pageItems]);
				setHasMore(
					start + pageItems.length <
						sortedWithLocationRef.current.length,
				);
				setPage(nextPage);
			},
			{ root: null, rootMargin: "100px", threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [
		isLibraryTab,
		userLocation,
		libraryResults.length,
		hasMore,
		isLoading,
		page,
	]);

	useEffect(() => {
		if (!isLibraryTab || userLocation) return;
		const el = loadMoreRef.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (!entry?.isIntersecting || isLoading || !hasMore) return;
				const nextPage = page + 1;
				fetchLibrariesFromSupabase(searchText, nextPage, true);
				setPage(nextPage);
			},
			{ root: null, rootMargin: "100px", threshold: 0.1 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [
		isLibraryTab,
		userLocation,
		searchText,
		page,
		hasMore,
		isLoading,
		fetchLibrariesFromSupabase,
	]);

	const handleLocationClick = useCallback(() => {
		setGeoError(null);
		if (!navigator.geolocation) {
			setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const { latitude, longitude } = pos.coords;
				setUserLocation({ lat: latitude, lng: longitude });
				setPage(0);
			},
			() => {
				setGeoError(
					"위치 정보를 가져올 수 없습니다. 권한을 확인해 주세요.",
				);
			},
			{ enableHighAccuracy: true },
		);
	}, []);

	const handleLocationMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		if (locationButtonTimeoutRef.current) {
			clearTimeout(locationButtonTimeoutRef.current);
			locationButtonTimeoutRef.current = null;
		}
		handleLocationClick();
	};

	const handleInputBlur = () => {
		locationButtonTimeoutRef.current = setTimeout(() => {
			setShowLocationButton(false);
			locationButtonTimeoutRef.current = null;
		}, 150);
	};

	const hasActiveLibrarySearch = searchText.trim() || userLocation;
	const hasActiveBookSearch = searchText.trim().length > 0;
	const showLibraryResults = isLibraryTab && hasActiveLibrarySearch;
	const showBookResults = !isLibraryTab && hasActiveBookSearch;
	const libraryResultsEmpty =
		showLibraryResults &&
		libraryResults.length === 0 &&
		!isLoading;
	const bookResultsEmpty =
		showBookResults && bookResults.length === 0 && !isLoading;
	const showLibraryInitialGuide = isLibraryTab && !hasActiveLibrarySearch;
	const showBookInitialGuide = !isLibraryTab && !hasActiveBookSearch;

	return (
		<>
			<div className="flex min-h-screen flex-col bg-background px-4 pb-32 pt-6">
				{/* Toggle: 도서관 검색 | 책 검색 */}
				<div className="mb-4 flex rounded-xl border border-primary/20 bg-white/60 p-1 shadow-sm backdrop-blur-md">
					<button
						type="button"
						onClick={() => updateTab("library")}
						className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
							isLibraryTab
								? "bg-primary text-white shadow-sm"
								: "text-foreground/70 hover:text-foreground"
						}`}
					>
						도서관 검색
					</button>
					<button
						type="button"
						onClick={() => updateTab("book")}
						className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
							!isLibraryTab
								? "bg-primary text-white shadow-sm"
								: "text-foreground/70 hover:text-foreground"
						}`}
					>
						책 검색
					</button>
				</div>

				{/* Library initial guide */}
				{showLibraryInitialGuide && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<div className="rounded-full bg-primary/10 p-4">
							<Library
								className="h-12 w-12 text-primary"
								strokeWidth={1.5}
							/>
						</div>
						<p className="max-w-[260px] text-base text-foreground/80">
							책을 교환하고 싶은 도서관을 검색해보세요.
						</p>
					</div>
				)}

				{/* Book initial guide */}
				{showBookInitialGuide && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
						<div className="rounded-full bg-primary/10 p-4">
							<BookOpen
								className="h-12 w-12 text-primary"
								strokeWidth={1.5}
							/>
						</div>
						<p className="max-w-[260px] text-base text-foreground/80">
							제목 또는 저자로 검색해보세요.
						</p>
					</div>
				)}

				{/* Library empty */}
				{libraryResultsEmpty && (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="text-foreground/70">
							검색 결과가 없습니다.
						</p>
						<p className="text-sm text-foreground/50">
							다른 키워드로 검색해 보세요.
						</p>
					</div>
				)}

				{/* Book empty */}
				{bookResultsEmpty && (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="text-foreground/70">
							검색 결과가 없습니다.
						</p>
						<p className="text-sm text-foreground/50">
							다른 키워드로 검색해 보세요.
						</p>
					</div>
				)}

				{/* Library results */}
				{showLibraryResults && libraryResults.length > 0 && (
					<ul className="flex flex-col gap-3 pb-4">
						{libraryResults.map((lib) => (
							<li key={lib.id}>
								<Link
									href={`/library/${lib.id}`}
									className="block rounded-2xl border border-primary/20 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-opacity hover:opacity-90"
								>
									<h3 className="font-semibold text-foreground">
										{lib.name}
									</h3>
									<p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/70">
										<MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary/70" />
										{lib.address ?? "주소 없음"}
									</p>
									{userLocation && (
										<p className="mt-1 text-xs text-primary">
											{haversineDistance(
												userLocation.lat,
												userLocation.lng,
												lib.lat,
												lib.lng,
											).toFixed(2)}{" "}
											km
										</p>
									)}
								</Link>
							</li>
						))}
						<div ref={loadMoreRef} className="h-4" />
						{isLoading && (
							<InlineLoadingLogo
								className="h-12 w-12"
								paddingClassName="py-4"
							/>
						)}
						{!hasMore && libraryResults.length > 0 && (
							<p className="py-2 text-center text-sm text-foreground/50">
								모두 불러왔습니다
							</p>
						)}
					</ul>
				)}

				{/* Book results */}
				{showBookResults && bookResults.length > 0 && (
					<ul className="flex flex-col gap-3 pb-4">
						{bookResults.map((book) => (
							<li key={book.id}>
								<BookCard
									id={book.id}
									title={book.title}
									authors={book.authors}
									thumbnailUrl={book.thumbnail_url}
									condition={book.condition}
									libraryName={book.libraryName}
									isInterestedLibrary={book.isInterestedLibrary}
									isSwapped={
										book.status === "SWAPPED" ||
										book.status === "SWAPPING"
									}
								/>
							</li>
						))}
						{isLoading && (
							<InlineLoadingLogo
								className="h-14 w-14"
								paddingClassName="py-4"
							/>
						)}
					</ul>
				)}

				{/* Loading skeleton for book search */}
				{!isLibraryTab &&
					hasActiveBookSearch &&
					isLoading &&
					bookResults.length === 0 && (
						<div className="flex flex-col gap-3 py-4">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="flex gap-4 rounded-2xl border border-primary/20 bg-white/60 p-4"
								>
									<div className="h-24 w-16 flex-shrink-0 animate-pulse rounded-md bg-neutral-200" />
									<div className="flex-1 space-y-2">
										<div className="h-4 max-w-[75%] animate-pulse rounded bg-neutral-200" />
										<div className="h-3 max-w-[50%] animate-pulse rounded bg-neutral-200" />
										<div className="h-3 max-w-[33%] animate-pulse rounded bg-neutral-200" />
									</div>
								</div>
							))}
						</div>
					)}

				{/* Fixed search bar */}
				<div className="fixed bottom-4 left-0 right-0 z-40 flex flex-col items-center pb-[calc(65px+env(safe-area-inset-bottom))] pl-4 pr-4 pt-2">
					{isLibraryTab && showLocationButton && (
						<button
							type="button"
							onMouseDown={handleLocationMouseDown}
							className="mb-2 flex w-full max-w-lg items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white/90 px-4 py-3 text-sm font-medium text-primary shadow-md backdrop-blur-md"
						>
							<MapPin className="h-4 w-4" />
							현재 위치로 가까운 도서관 찾기
						</button>
					)}
					<div className="flex w-full max-w-lg items-center gap-2 rounded-2xl border border-primary/20 bg-white/90 px-4 py-3 shadow-md backdrop-blur-md">
						{isLibraryTab ? (
							<Library className="h-5 w-5 flex-shrink-0 text-foreground/50" />
						) : (
							<BookOpen className="h-5 w-5 flex-shrink-0 text-foreground/50" />
						)}
						<input
							type="search"
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							onFocus={() => {
								if (isLibraryTab) {
									if (locationButtonTimeoutRef.current) {
										clearTimeout(
											locationButtonTimeoutRef.current,
										);
										locationButtonTimeoutRef.current = null;
									}
									setShowLocationButton(true);
								}
							}}
							onBlur={handleInputBlur}
							placeholder={
								isLibraryTab
									? "도서관 이름 또는 주소"
									: "제목 또는 저자 검색"
							}
							className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-foreground/50 focus:outline-none"
							aria-label={
								isLibraryTab ? "도서관 검색" : "책 검색"
							}
						/>
					</div>
					{geoError && isLibraryTab && (
						<p className="mt-2 w-full max-w-lg text-center text-sm text-accent">
							{geoError}
						</p>
					)}
				</div>
			</div>
			<BottomNav />
		</>
	);
}
