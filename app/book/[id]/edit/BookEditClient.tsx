/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
	Camera,
	BookOpen,
	ChevronLeft,
	X,
	Library,
	MapPin,
	HelpCircle,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import AnimatedLogo from "@/components/AnimatedLogo";
import {
	searchLibraries,
	getUserInterestedLibraries,
	getAllLibrariesWithCoords,
	type LibraryInfo,
	type LibraryWithCoords,
} from "@/app/shelve/actions";
import { updateBook } from "../actions";

const CONDITION_OPTIONS = [
	{ value: "S" as const, label: "S급", desc: "새 책" },
	{ value: "A" as const, label: "A급", desc: "거의 새 책" },
	{ value: "B" as const, label: "B급", desc: "사용감 있음" },
	{ value: "C" as const, label: "C급", desc: "헌 책" },
	{ value: "D" as const, label: "D급", desc: "파손 있음" },
];

function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371;
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

type BookForEdit = {
	id: string;
	title: string;
	authors: string | null;
	publisher: string | null;
	isbn: string | null;
	thumbnail_url: string | null;
	user_images: string[];
	user_review: string | null;
	condition: string;
};

type Props = {
	book: BookForEdit;
	initialLibraries: LibraryInfo[];
};

function isCondition(v: string): v is "S" | "A" | "B" | "C" | "D" {
	return ["S", "A", "B", "C", "D"].includes(v);
}

export default function BookEditClient({ book, initialLibraries }: Props) {
	const router = useRouter();
	const [keepImageUrls, setKeepImageUrls] = useState<string[]>(() => [
		...(book.user_images ?? []),
	]);
	const [newFiles, setNewFiles] = useState<File[]>([]);
	const [condition, setCondition] = useState<"S" | "A" | "B" | "C" | "D">(
		isCondition(book.condition) ? book.condition : "B",
	);
	const [userReview, setUserReview] = useState(book.user_review ?? "");
	const [selectedLibraries, setSelectedLibraries] =
		useState<LibraryInfo[]>(initialLibraries);
	const [librarySearchQuery, setLibrarySearchQuery] = useState("");
	const [librarySearchResults, setLibrarySearchResults] = useState<
		LibraryInfo[]
	>([]);
	const [showLibrarySearch, setShowLibrarySearch] = useState(false);
	const [showConditionHelp, setShowConditionHelp] = useState(false);
	const [nearbyLibraries, setNearbyLibraries] = useState<LibraryWithCoords[]>(
		[],
	);
	const [isFindingNearby, setIsFindingNearby] = useState(false);
	const [geoError, setGeoError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const totalImages = keepImageUrls.length + newFiles.length;

	const newFilePreviewUrls = useMemo(
		() => newFiles.map((f) => URL.createObjectURL(f)),
		[newFiles],
	);

	useEffect(() => {
		return () => {
			newFilePreviewUrls.forEach((u) => URL.revokeObjectURL(u));
		};
	}, [newFilePreviewUrls]);

	useEffect(() => {
		if (!librarySearchQuery.trim()) {
			setLibrarySearchResults([]);
			return;
		}
		const t = setTimeout(() => {
			searchLibraries(librarySearchQuery).then(setLibrarySearchResults);
		}, 300);
		return () => clearTimeout(t);
	}, [librarySearchQuery]);

	const handleRemoveKept = useCallback((url: string) => {
		setKeepImageUrls((prev) => prev.filter((u) => u !== url));
	}, []);

	const handleRemoveNew = useCallback((index: number) => {
		setNewFiles((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleImageAdd = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (!files?.length) return;

			const cap = 3 - keepImageUrls.length - newFiles.length;
			if (cap <= 0) {
				alert("사진은 최대 3장까지 등록할 수 있습니다.");
				e.target.value = "";
				return;
			}

			const toAdd = Math.min(cap, files.length);
			const compressionOptions = {
				maxSizeMB: 0.8,
				maxWidthOrHeight: 1280,
				useWebWorker: true,
			};
			const added: File[] = [];
			for (let i = 0; i < toAdd; i++) {
				try {
					const compressed = await imageCompression(
						files[i],
						compressionOptions,
					);
					if (compressed.size > 5 * 1024 * 1024) {
						setError(`이미지 ${i + 1}이(가) 5MB를 초과합니다.`);
						continue;
					}
					added.push(compressed);
				} catch {
					added.push(files[i]);
				}
			}
			setNewFiles((prev) => [...prev, ...added]);
			e.target.value = "";
		},
		[keepImageUrls.length, newFiles.length],
	);

	const handleAddInterestedLibraries = useCallback(async () => {
		const libs = await getUserInterestedLibraries();
		setSelectedLibraries((prev) => {
			const existing = new Set(prev.map((l) => l.id));
			const toAdd = libs.filter((l) => !existing.has(l.id));
			return [...prev, ...toAdd];
		});
	}, []);

	const handleAddLibrary = useCallback((lib: LibraryInfo) => {
		setSelectedLibraries((prev) => {
			if (prev.some((l) => l.id === lib.id)) return prev;
			return [...prev, lib];
		});
		setLibrarySearchQuery("");
	}, []);

	const handleRemoveLibrary = useCallback((id: string) => {
		setSelectedLibraries((prev) => prev.filter((l) => l.id !== id));
	}, []);

	const handleFindNearby = useCallback(() => {
		setGeoError(null);
		if (!navigator.geolocation) {
			setGeoError("이 브라우저는 위치 서비스를 지원하지 않습니다.");
			return;
		}
		setIsFindingNearby(true);
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const { latitude, longitude } = pos.coords;
				try {
					const libs = await getAllLibrariesWithCoords();
					const sorted = [...libs].sort((a, b) => {
						const dA = haversineDistance(
							latitude,
							longitude,
							a.lat,
							a.lng,
						);
						const dB = haversineDistance(
							latitude,
							longitude,
							b.lat,
							b.lng,
						);
						return dA - dB;
					});
					setNearbyLibraries(sorted.slice(0, 15));
				} catch {
					setGeoError("도서관 목록을 불러오지 못했습니다.");
					setNearbyLibraries([]);
				} finally {
					setIsFindingNearby(false);
				}
			},
			() => {
				setGeoError(
					"위치 정보를 가져올 수 없습니다. 권한을 확인해 주세요.",
				);
				setIsFindingNearby(false);
			},
			{ enableHighAccuracy: true },
		);
	}, []);

	const canSubmit = useMemo(() => {
		if (totalImages < 1) return false;
		if (!userReview.trim() || userReview.length > 100) return false;
		if (selectedLibraries.length < 1) return false;
		return true;
	}, [totalImages, userReview, selectedLibraries.length]);

	const handleSubmit = useCallback(async () => {
		if (!canSubmit || isSubmitting) return;
		setIsSubmitting(true);
		setError(null);
		let succeeded = false;
		try {
			const formData = new FormData();
			formData.append(
				"meta",
				JSON.stringify({
					bookId: book.id,
					condition,
					user_review: userReview.trim(),
					keepImageUrls,
					libraryIds: selectedLibraries.map((l) => l.id),
				}),
			);
			newFiles.forEach((f, i) => formData.append(`image-${i}`, f));
			await updateBook(formData);
			succeeded = true;
			router.refresh();
			router.replace(`/book/${book.id}`);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "수정에 실패했습니다.";
			setError(message);
			alert(message);
		} finally {
			if (!succeeded) {
				setIsSubmitting(false);
			}
		}
	}, [
		book.id,
		canSubmit,
		condition,
		userReview,
		keepImageUrls,
		selectedLibraries,
		newFiles,
		router,
		isSubmitting,
	]);

	return (
		<>
			{isSubmitting && (
				<div
					className="fixed inset-0 z-[200] flex items-center justify-center bg-background/75 px-6 backdrop-blur-sm"
					role="status"
					aria-live="polite"
					aria-busy="true"
				>
					<div className="flex max-w-xs flex-col items-center gap-5 rounded-2xl border border-primary/25 bg-white/95 px-10 py-9 text-center shadow-xl backdrop-blur-md">
						<div className="animate-pulse">
							<AnimatedLogo className="mx-auto h-20 w-20 shrink-0 md:h-24 md:w-24" />
						</div>
						<p className="text-sm font-medium text-foreground">수정 중...</p>
					</div>
				</div>
			)}
			<div className="relative mx-auto flex min-h-screen max-w-lg flex-col pb-40">
				<div
					className="sticky z-40 mb-4 flex items-center justify-between px-4"
					style={{
						top: "calc(1rem + env(safe-area-inset-top, 0px))",
					}}
				>
					<BackButton />
				</div>

				<main className="flex flex-col gap-6 px-4 pt-2">
					{error && (
						<div className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
							{error}
						</div>
					)}

					<div className="rounded-2xl border border-primary/20 bg-white/70 p-4 backdrop-blur-md">
						<p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							책 정보 (읽기 전용)
						</p>
						<div className="flex gap-3">
							{book.thumbnail_url ? (
								<img
									src={book.thumbnail_url}
									alt=""
									className="h-24 w-[4.5rem] shrink-0 rounded-lg object-cover"
								/>
							) : (
								<div className="flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-lg bg-neutral-200">
									<BookOpen className="h-10 w-10 text-neutral-400" />
								</div>
							)}
							<div className="min-w-0 flex-1 space-y-1">
								<p className="font-semibold text-foreground">
									{book.title}
								</p>
								{book.authors && (
									<p className="text-sm text-foreground/80">
										저자: {book.authors}
									</p>
								)}
								{book.publisher && (
									<p className="text-sm text-foreground/80">
										출판사: {book.publisher}
									</p>
								)}
								<p className="text-sm text-foreground/80">
									ISBN: {book.isbn?.trim() || "—"}
								</p>
							</div>
						</div>
					</div>

					<div>
						<h3 className="mb-2 text-sm font-semibold">
							직접 찍은 사진 ({totalImages} / 3)
						</h3>
						<div className="flex flex-wrap gap-3">
							{keepImageUrls.map((url) => (
								<div
									key={url}
									className="relative aspect-[3/4] w-20 overflow-hidden rounded-xl border border-primary/20 bg-white/60"
								>
									<img
										src={url}
										alt=""
										className="h-full w-full object-cover"
									/>
									<button
										type="button"
										onClick={() => handleRemoveKept(url)}
										className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
										aria-label="사진 제거"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							))}
							{newFiles.map((file, i) => (
								<div
									key={`${file.name}-${i}-${file.lastModified}`}
									className="relative aspect-[3/4] w-20 overflow-hidden rounded-xl border border-primary/20 bg-white/60"
								>
									<img
										src={newFilePreviewUrls[i] ?? ""}
										alt=""
										className="h-full w-full object-cover"
									/>
									<button
										type="button"
										onClick={() => handleRemoveNew(i)}
										className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
										aria-label="사진 제거"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							))}
							{totalImages < 3 && (
								<label className="flex aspect-[3/4] w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:bg-primary/10">
									<Camera className="h-6 w-6" />
									<span className="text-xs">추가</span>
									<input
										type="file"
										accept="image/*"
										multiple
										onChange={handleImageAdd}
										className="hidden"
									/>
								</label>
							)}
						</div>
					</div>

					<div className="relative">
						<div className="mb-2 flex items-center gap-2">
							<h3 className="text-sm font-semibold">책 상태</h3>
							<button
								type="button"
								onClick={() =>
									setShowConditionHelp((prev) => !prev)
								}
								className={`rounded-full p-0.5 transition-colors focus:outline-none ${
									showConditionHelp
										? "text-primary"
										: "text-foreground/50 hover:text-primary"
								}`}
								aria-label="상태 등급 설명"
							>
								<HelpCircle className="h-4 w-4" />
							</button>
						</div>
						{showConditionHelp && (
							<div
								className="fixed inset-0 z-[60] bg-black/20"
								onClick={() => setShowConditionHelp(false)}
							>
								<div
									onClick={(e) => e.stopPropagation()}
									className="absolute left-1/2 top-1/2 z-[61] w-72 max-w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-primary/20 bg-white/95 px-4 py-3 text-xs leading-relaxed text-foreground shadow-lg backdrop-blur-md"
								>
									<div className="space-y-1">
										{CONDITION_OPTIONS.map((opt) => (
											<p key={opt.value}>
												{opt.label}: {opt.desc}
											</p>
										))}
									</div>
									<button
										type="button"
										onClick={() =>
											setShowConditionHelp(false)
										}
										className="mt-2 text-primary"
									>
										닫기
									</button>
								</div>
							</div>
						)}
						<div className="flex flex-wrap gap-2">
							{CONDITION_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setCondition(opt.value)}
									className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
										condition === opt.value
											? "bg-primary text-white"
											: "border border-primary/20 bg-white/70 text-foreground backdrop-blur-md hover:bg-white/90"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>

					<div>
						<h3 className="mb-2 text-sm font-semibold">
							한 줄 소개 (필수, 100자 이내)
						</h3>
						<textarea
							value={userReview}
							onChange={(e) =>
								setUserReview(e.target.value.slice(0, 100))
							}
							placeholder="이 책의 매력을 한 줄로 소개해 주세요"
							rows={3}
							className="w-full rounded-xl border border-primary/20 bg-white/70 px-4 py-3 text-sm placeholder:text-foreground/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
						<p className="mt-1 text-right text-xs text-foreground/60">
							{userReview.length} / 100
						</p>
					</div>

					<div>
						<h3 className="mb-2 text-sm font-semibold">
							꽂은 도서관 (최소 1개)
						</h3>
						<div className="mb-3 flex flex-wrap gap-2">
							{selectedLibraries.map((lib) => (
								<span
									key={lib.id}
									className="flex items-center gap-1 rounded-full border border-primary/20 bg-white/70 px-3 py-1.5 text-sm backdrop-blur-md"
								>
									{lib.name}
									<button
										type="button"
										onClick={() =>
											handleRemoveLibrary(lib.id)
										}
										className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-white/60"
										aria-label="제거"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</span>
							))}
						</div>

						<button
							type="button"
							onClick={handleAddInterestedLibraries}
							className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
						>
							<Library className="h-5 w-5" />내 관심 도서관 모두
							추가
						</button>

						<div className="mb-3 flex gap-2">
							<button
								type="button"
								onClick={handleFindNearby}
								disabled={isFindingNearby}
								className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white/70 px-4 py-3 text-sm font-medium backdrop-blur-md transition-opacity hover:bg-white/90 disabled:opacity-50"
							>
								<MapPin className="h-5 w-5 shrink-0 text-primary" />
								{isFindingNearby
									? "찾는 중..."
									: "내 주변 도서관 찾기"}
							</button>
						</div>
						{geoError && (
							<p className="mb-2 text-sm text-accent">
								{geoError}
							</p>
						)}
						{nearbyLibraries.length > 0 && (
							<div className="mb-3">
								<p className="mb-2 text-xs font-medium text-foreground/70">
									가까운 도서관
								</p>
								<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
									{nearbyLibraries.map((lib) => (
										<button
											key={lib.id}
											type="button"
											onClick={() =>
												handleAddLibrary(lib)
											}
											className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-white/70 px-3 py-2 text-sm backdrop-blur-md transition-opacity hover:bg-white/90"
										>
											<MapPin className="h-3.5 w-3.5 text-primary/70" />
											{lib.name}
										</button>
									))}
								</div>
							</div>
						)}

						<div className="flex gap-2">
							<div className="flex flex-1 items-center gap-2 rounded-xl border border-primary/20 bg-white/70 px-4 py-3 backdrop-blur-md">
								<MapPin className="h-5 w-5 shrink-0 text-foreground/50" />
								<input
									type="search"
									value={librarySearchQuery}
									onChange={(e) => {
										setLibrarySearchQuery(e.target.value);
										setShowLibrarySearch(true);
									}}
									onFocus={() => setShowLibrarySearch(true)}
									placeholder="도서관 검색"
									className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-foreground/50 focus:outline-none"
								/>
							</div>
						</div>

						{showLibrarySearch &&
							librarySearchResults.length > 0 && (
								<ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-primary/20 bg-white/70 backdrop-blur-md">
									{librarySearchResults.map((lib) => (
										<li key={lib.id}>
											<button
												type="button"
												onClick={() =>
													handleAddLibrary(lib)
												}
												className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-white/60"
											>
												<MapPin className="h-4 w-4 text-primary/70" />
												{lib.name}
											</button>
										</li>
									))}
								</ul>
							)}
					</div>

					<div className="flex flex-col gap-3 pb-4">
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!canSubmit || isSubmitting}
							className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{isSubmitting ? "수정 중..." : "수정 완료"}
						</button>
						<button
							type="button"
							disabled={isSubmitting}
							onClick={() => router.push(`/book/${book.id}`)}
							className="flex items-center justify-center gap-1 text-sm text-foreground/70 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<ChevronLeft className="h-4 w-4" />
							취소하고 돌아가기
						</button>
					</div>
				</main>
			</div>
		</>
	);
}
