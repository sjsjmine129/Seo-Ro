"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Library, MapPin } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import BottomNav from "@/components/BottomNav";

const PAGE_SIZE = 15;
const LOCATION_FETCH_LIMIT = 500;

type LibraryItem = {
	id: string;
	name: string;
	address: string | null;
	lat: number;
	lng: number;
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

export default function SearchPage() {
	const [searchText, setSearchText] = useState("");
	const [showLocationButton, setShowLocationButton] = useState(false);
	const locationButtonTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const [userLocation, setUserLocation] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [results, setResults] = useState<LibraryItem[]>([]);
	const [page, setPage] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [geoError, setGeoError] = useState<string | null>(null);
	const sortedWithLocationRef = useRef<LibraryItem[]>([]);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const supabase = useMemo(() => createClient(), []);

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
					setResults((prev) =>
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
					setResults((prev) =>
						append ? [...prev, ...items] : items,
					);
					setHasMore(items.length === PAGE_SIZE);
				}
			} catch (err) {
				console.error("fetchLibraries error:", err);
				setResults([]);
				setHasMore(false);
			} finally {
				setIsLoading(false);
			}
		},
		[supabase, userLocation],
	);

	useEffect(() => {
		setPage(0);
		if (searchText.trim() || userLocation) {
			fetchLibrariesFromSupabase(searchText, 0, false);
		} else {
			setResults([]);
			setHasMore(false);
		}
	}, [searchText, userLocation, fetchLibrariesFromSupabase]);

	useEffect(() => {
		if (!userLocation || results.length === 0) return;
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
				setResults((prev) => [...prev, ...pageItems]);
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
	}, [userLocation, results.length, hasMore, isLoading, page]);

	useEffect(() => {
		if (userLocation) return;
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

	const hasActiveSearch = searchText.trim() || userLocation;
	const showResults = hasActiveSearch;
	const showInitialGuide = !hasActiveSearch;

	return (
		<>
			<div className="flex min-h-screen flex-col bg-background px-4 pb-32 pt-6">
				{showInitialGuide && (
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

				{showResults && results.length === 0 && !isLoading && (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="text-foreground/70">
							검색 결과가 없습니다.
						</p>
						<p className="text-sm text-foreground/50">
							다른 키워드로 검색해 보세요.
						</p>
					</div>
				)}

				{showResults && results.length > 0 && (
					<ul className="flex flex-col gap-3 pb-4">
						{results.map((lib) => (
							<li key={lib.id}>
								<Link
									href={`/library/${lib.id}`}
									className="block rounded-2xl border border-white/40 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-opacity hover:opacity-90"
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
							<p className="py-2 text-center text-sm text-foreground/60">
								더 불러오는 중...
							</p>
						)}
						{!hasMore && results.length > 0 && (
							<p className="py-2 text-center text-sm text-foreground/50">
								모두 불러왔습니다
							</p>
						)}
					</ul>
				)}

				<div className="fixed bottom-4 left-0 right-0 z-40 flex flex-col items-center pb-[calc(65px+env(safe-area-inset-bottom))] pl-4 pr-4 pt-2">
					{showLocationButton && (
						<button
							type="button"
							onMouseDown={handleLocationMouseDown}
							className="mb-2 flex w-full max-w-lg items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/90 px-4 py-3 text-sm font-medium text-primary shadow-md backdrop-blur-md"
						>
							<MapPin className="h-4 w-4" />
							현재 위치로 가까운 도서관 찾기
						</button>
					)}
					<div className="flex w-full max-w-lg items-center gap-2 rounded-2xl border border-white/40 bg-white/90 px-4 py-3 shadow-md backdrop-blur-md">
						<Library className="h-5 w-5 flex-shrink-0 text-foreground/50" />
						<input
							type="search"
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							onFocus={() => {
								if (locationButtonTimeoutRef.current) {
									clearTimeout(
										locationButtonTimeoutRef.current,
									);
									locationButtonTimeoutRef.current = null;
								}
								setShowLocationButton(true);
							}}
							onBlur={handleInputBlur}
							placeholder="도서관 이름 또는 주소"
							className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-foreground/50 focus:outline-none"
							aria-label="도서관 검색"
						/>
					</div>
					{geoError && (
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
