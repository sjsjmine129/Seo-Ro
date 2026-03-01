"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
	Search,
	Camera,
	Edit3,
	BookOpen,
	ChevronLeft,
	X,
	Library,
	MapPin,
	HelpCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import BackButton from "@/components/BackButton";
import BarcodeScanner from "./components/BarcodeScanner";
import {
	searchNaverBook,
	getLibraryById,
	getUserInterestedLibraries,
	searchLibraries,
	getAllLibrariesWithCoords,
	shelveBook,
	type NaverBookItem,
	type LibraryInfo,
	type LibraryWithCoords,
} from "./actions";
import imageCompression from "browser-image-compression";

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

type FormState = {
	book: {
		title: string;
		authors: string | null;
		publisher: string | null;
		isbn: string | null;
		thumbnail_url: string | null;
	};
	images: File[];
	condition: "S" | "A" | "B" | "C" | "D";
	userReview: string;
	selectedLibraries: LibraryInfo[];
};

const INITIAL_STATE: FormState = {
	book: {
		title: "",
		authors: null,
		publisher: null,
		isbn: null,
		thumbnail_url: null,
	},
	images: [],
	condition: "B",
	userReview: "",
	selectedLibraries: [],
};

export default function ShelvePage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [step, setStep] = useState(1);
	const [form, setForm] = useState<FormState>(INITIAL_STATE);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<NaverBookItem[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [showManualEntry, setShowManualEntry] = useState(false);
	const [manualTitle, setManualTitle] = useState("");
	const [manualAuthor, setManualAuthor] = useState("");
	const [manualPublisher, setManualPublisher] = useState("");
	const [showBarcode, setShowBarcode] = useState(false);
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

	const libraryIdFromUrl = searchParams.get("libraryId");
	const hasAppliedLibraryIdRef = useRef(false);

	useEffect(() => {
		createClient()
			.auth.getUser()
			.then(({ data: { user } }) => {
				if (!user) router.replace("/login");
			});
	}, [router]);

	useEffect(() => {
		if (!libraryIdFromUrl || hasAppliedLibraryIdRef.current) return;
		hasAppliedLibraryIdRef.current = true;
		getLibraryById(libraryIdFromUrl).then((lib) => {
			if (lib) {
				setForm((prev) => {
					if (prev.selectedLibraries.some((l) => l.id === lib.id))
						return prev;
					return {
						...prev,
						selectedLibraries: [...prev.selectedLibraries, lib],
					};
				});
			}
		});
	}, [libraryIdFromUrl]);

	const handleBookSearch = useCallback(async () => {
		if (!searchQuery.trim()) return;
		setIsSearching(true);
		setError(null);
		try {
			const results = await searchNaverBook(searchQuery);
			setSearchResults(results);
		} catch (err) {
			setError(err instanceof Error ? err.message : "검색 실패");
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, [searchQuery]);

	const handleSelectBook = useCallback((item: NaverBookItem) => {
		setForm((prev) => ({
			...prev,
			book: {
				title: item.title,
				authors: item.author || null,
				publisher: item.publisher || null,
				isbn: item.isbn || null,
				thumbnail_url: item.image || null,
			},
		}));
		setStep(2);
	}, []);

	const handleBarcodeResult = useCallback((isbn: string) => {
		setShowBarcode(false);
		searchNaverBook(isbn).then((results) => {
			if (results.length > 0) {
				handleSelectBook(results[0]);
			} else {
				setForm((prev) => ({
					...prev,
					book: { ...prev.book, isbn },
				}));
				setShowManualEntry(true);
			}
		});
	}, [handleSelectBook]);

	const handleManualSubmit = useCallback(() => {
		if (!manualTitle.trim()) return;
		setForm((prev) => ({
			...prev,
			book: {
				...prev.book,
				title: manualTitle.trim(),
				authors: manualAuthor.trim() || null,
				publisher: manualPublisher.trim() || null,
			},
		}));
		setShowManualEntry(false);
		setManualTitle("");
		setManualAuthor("");
		setManualPublisher("");
		setStep(2);
	}, [manualTitle, manualAuthor, manualPublisher]);

	const handleImageAdd = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files;
			if (!files || files.length === 0) return;

			const currentCount = form.images.length;
			const totalAfterAdd = currentCount + files.length;

			if (totalAfterAdd > 3) {
				alert("사진은 최대 3장까지 업로드할 수 있습니다.");
			}

			const toAdd = Math.min(3 - currentCount, files.length);
			if (toAdd <= 0) {
				e.target.value = "";
				return;
			}

			const compressionOptions = {
				maxSizeMB: 1,
				maxWidthOrHeight: 1920,
				useWebWorker: true,
			};

			const newFiles: File[] = [];
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
					newFiles.push(compressed);
				} catch {
					newFiles.push(files[i]);
				}
			}
			setForm((prev) => ({
				...prev,
				images: [...prev.images, ...newFiles],
			}));
			e.target.value = "";
		},
		[form.images.length],
	);

	const handleImageRemove = useCallback((index: number) => {
		setForm((prev) => ({
			...prev,
			images: prev.images.filter((_, i) => i !== index),
		}));
	}, []);

	const handleAddInterestedLibraries = useCallback(async () => {
		const libs = await getUserInterestedLibraries();
		setForm((prev) => {
			const existing = new Set(prev.selectedLibraries.map((l) => l.id));
			const toAdd = libs.filter((l) => !existing.has(l.id));
			return {
				...prev,
				selectedLibraries: [...prev.selectedLibraries, ...toAdd],
			};
		});
	}, []);

	const handleLibrarySearch = useCallback(async () => {
		if (!librarySearchQuery.trim()) return;
		try {
			const results = await searchLibraries(librarySearchQuery);
			setLibrarySearchResults(results);
		} catch {
			setLibrarySearchResults([]);
		}
	}, [librarySearchQuery]);

	useEffect(() => {
		if (!librarySearchQuery.trim()) {
			setLibrarySearchResults([]);
			return;
		}
		const timer = setTimeout(() => handleLibrarySearch(), 300);
		return () => clearTimeout(timer);
	}, [librarySearchQuery, handleLibrarySearch]);

	const handleAddLibrary = useCallback((lib: LibraryInfo) => {
		setForm((prev) => {
			if (prev.selectedLibraries.some((l) => l.id === lib.id))
				return prev;
			return {
				...prev,
				selectedLibraries: [...prev.selectedLibraries, lib],
			};
		});
		setLibrarySearchQuery("");
	}, []);

	const handleRemoveLibrary = useCallback((id: string) => {
		setForm((prev) => ({
			...prev,
			selectedLibraries: prev.selectedLibraries.filter(
				(l) => l.id !== id,
			),
		}));
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

	const canProceedStep3 = useMemo(() => {
		if (form.images.length < 1) return false;
		if (!form.userReview.trim()) return false;
		if (form.userReview.length > 100) return false;
		return true;
	}, [form.images.length, form.userReview]);
	const canSubmit = useMemo(
		() => form.selectedLibraries.length >= 1,
		[form.selectedLibraries.length],
	);

	const handleSubmit = useCallback(async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setError(null);
		try {
			const formData = new FormData();
			formData.append(
				"book",
				JSON.stringify({
					title: form.book.title,
					authors: form.book.authors,
					publisher: form.book.publisher,
					isbn: form.book.isbn,
					thumbnail_url: form.book.thumbnail_url,
					condition: form.condition,
					user_review: form.userReview.trim(),
				}),
			);
			formData.append(
				"libraryIds",
				JSON.stringify(form.selectedLibraries.map((l) => l.id)),
			);
			form.images.forEach((f, i) => formData.append(`image-${i}`, f));

			const { bookId } = await shelveBook(formData);
			router.push(`/book/${bookId}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "등록 실패");
		} finally {
			setIsSubmitting(false);
		}
	}, [form, canSubmit, router]);

	const hasCamera =
		typeof window !== "undefined" && "mediaDevices" in navigator;

	return (
		<>
			<div className="relative mx-auto flex min-h-screen max-w-lg flex-col pb-40">
				<div
					// className="sticky z-40 mb-4 flex justify-between items-center bg-transparent/80 px-4 backdrop-blur-sm"
					className="sticky z-40 mb-4 flex justify-between items-center px-4"
					style={{
						top: "calc(1rem + env(safe-area-inset-top, 0px))",
					}}
				>
					<BackButton />
					<div className="flex items-center gap-2 text-sm rounded-full border border-white/40 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-md transition-opacity hover:bg-white/80 font-medium text-foreground/70">
						<span>Step {step} / 3</span>
					</div>
				</div>

				<main className="flex flex-col gap-6 px-4 pt-2">
					{error && (
						<div className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
							{error}
						</div>
					)}

					{/* Step 1: Book Search & Selection */}
					{step === 1 && (
						<>
							<div className="space-y-4">
								<div className="flex gap-2">
									<div className="flex flex-1 items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-3 backdrop-blur-md">
										<Search className="h-5 w-5 flex-shrink-0 text-foreground/50" />
										<input
											type="search"
											value={searchQuery}
											onChange={(e) =>
												setSearchQuery(e.target.value)
											}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												handleBookSearch()
											}
											placeholder="책 제목, 저자, ISBN으로 검색"
											className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-foreground/50 focus:outline-none"
										/>
									</div>
									<button
										type="button"
										onClick={handleBookSearch}
										disabled={isSearching}
										className="rounded-xl border border-primary bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
									>
										{isSearching ? "검색 중..." : "검색"}
									</button>
								</div>

								<div className="flex flex-wrap gap-2">
									{hasCamera && (
										<button
											type="button"
											onClick={() => setShowBarcode(true)}
											className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-2.5 text-sm font-medium backdrop-blur-md transition-opacity hover:bg-white/90"
										>
											<Camera className="h-4 w-4" />
											바코드 스캔
										</button>
									)}
									<button
										type="button"
										onClick={() => setShowManualEntry(true)}
										className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-2.5 text-sm font-medium backdrop-blur-md transition-opacity hover:bg-white/90"
									>
										<Edit3 className="h-4 w-4" />
										직접 입력
									</button>
								</div>
							</div>

							{showManualEntry && (
								<div className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur-md">
									<h3 className="mb-3 text-sm font-semibold">
										직접 입력
									</h3>
									<div className="space-y-3">
										<input
											type="text"
											value={manualTitle}
											onChange={(e) =>
												setManualTitle(e.target.value)
											}
											placeholder="제목 (필수)"
											className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
										/>
										<input
											type="text"
											value={manualAuthor}
											onChange={(e) =>
												setManualAuthor(e.target.value)
											}
											placeholder="저자"
											className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
										/>
										<input
											type="text"
											value={manualPublisher}
											onChange={(e) =>
												setManualPublisher(
													e.target.value,
												)
											}
											placeholder="출판사"
											className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
										/>
									</div>
									<div className="mt-3 flex gap-2">
										<button
											type="button"
											onClick={() =>
												setShowManualEntry(false)
											}
											className="rounded-lg px-4 py-2 text-sm text-foreground/70"
										>
											취소
										</button>
										<button
											type="button"
											onClick={handleManualSubmit}
											disabled={!manualTitle.trim()}
											className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
										>
											확인
										</button>
									</div>
								</div>
							)}

							{searchResults.length > 0 && (
								<ul className="flex flex-col gap-2">
									{searchResults.map((item) => (
										<li key={item.isbn || item.link}>
											<button
												type="button"
												onClick={() =>
													handleSelectBook(item)
												}
												className="flex w-full gap-3 rounded-xl border border-white/40 bg-white/70 p-3 text-left backdrop-blur-md transition-opacity hover:bg-white/90"
											>
												{item.image ? (
													<img
														src={item.image}
														alt=""
														className="h-16 w-12 flex-shrink-0 object-cover"
													/>
												) : (
													<div className="flex h-16 w-12 flex-shrink-0 items-center justify-center bg-neutral-200">
														<BookOpen className="h-6 w-6 text-neutral-400" />
													</div>
												)}
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-foreground">
														{item.title}
													</p>
													<p className="text-xs text-foreground/70">
														{item.author} ·{" "}
														{item.publisher}
													</p>
												</div>
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					)}

					{/* Step 2: Photos, Condition, Review */}
					{step === 2 && (
						<>
							<div className="rounded-2xl border border-white/40 bg-white/70 p-4 backdrop-blur-md">
								<div className="mb-2 flex items-center gap-2">
									{form.book.thumbnail_url ? (
										<img
											src={form.book.thumbnail_url}
											alt=""
											className="h-12 w-9 object-cover"
										/>
									) : (
										<BookOpen className="h-12 w-12 text-neutral-400" />
									)}
									<div>
										<p className="font-semibold text-foreground">
											{form.book.title}
										</p>
										<p className="text-xs text-foreground/70">
											{form.book.authors ?? ""}{" "}
											{form.book.publisher &&
												`· ${form.book.publisher}`}
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setStep(1)}
									className="text-sm text-primary"
								>
									다른 책으로 변경
								</button>
							</div>

							<div>
								<h3 className="mb-2 text-sm font-semibold">
									사진 (1~3장, 필수) ({form.images.length} / 3)
								</h3>
								<div className="flex flex-wrap gap-3">
									{form.images.map((file, i) => (
										<div
											key={i}
											className="relative aspect-[3/4] w-20 overflow-hidden rounded-xl border border-white/40 bg-white/60"
										>
											<img
												src={URL.createObjectURL(file)}
												alt=""
												className="h-full w-full object-cover"
											/>
											<button
												type="button"
												onClick={() =>
													handleImageRemove(i)
												}
												className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
											>
												<X className="h-4 w-4" />
											</button>
										</div>
									))}
									{form.images.length < 3 && (
										<label className="flex aspect-[3/4] w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:bg-primary/10">
											<Camera className="h-6 w-6" />
											<span className="text-xs">
												추가
											</span>
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
									<h3 className="text-sm font-semibold">
										책 상태
									</h3>
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
											className="absolute left-1/2 top-1/2 z-[61] w-72 max-w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/40 bg-white/95 px-4 py-3 text-xs leading-relaxed text-foreground shadow-lg backdrop-blur-md"
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
										<div
											key={opt.value}
											className="group relative"
										>
											<button
												type="button"
												onClick={() =>
													setForm((prev) => ({
														...prev,
														condition: opt.value,
													}))
												}
												className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
													form.condition === opt.value
														? "bg-primary text-white"
														: "border border-white/40 bg-white/70 text-foreground backdrop-blur-md hover:bg-white/90"
												}`}
											>
												{opt.label}
											</button>
											<span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
												{opt.desc}
											</span>
										</div>
									))}
								</div>
							</div>

							<div>
								<h3 className="mb-2 text-sm font-semibold">
									한 줄 리뷰 (필수, 100자 이내)
								</h3>
								<textarea
									value={form.userReview}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											userReview: e.target.value.slice(
												0,
												100,
											),
										}))
									}
									placeholder="이 책의 매력을 한 줄로 소개해 주세요"
									rows={3}
									className="w-full rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm placeholder:text-foreground/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-primary/50"
								/>
								<p className="mt-1 text-right text-xs text-foreground/60">
									{form.userReview.length} / 100
								</p>
							</div>

							<button
								type="button"
								onClick={() => setStep(3)}
								disabled={!canProceedStep3}
								className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								다음
							</button>
						</>
					)}

					{/* Step 3: Library Selection */}
					{step === 3 && (
						<>
							<button
								type="button"
								onClick={() => setStep(2)}
								className="flex items-center gap-1 text-sm text-foreground/70"
							>
								<ChevronLeft className="h-4 w-4" />
								이전
							</button>

							<div>
								<h3 className="mb-2 text-sm font-semibold">
									꽂을 도서관 (최소 1개)
								</h3>
								<div className="mb-3 flex flex-wrap gap-2">
									{form.selectedLibraries.map((lib) => (
										<span
											key={lib.id}
											className="flex items-center gap-1 rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-sm backdrop-blur-md"
										>
											{lib.name}
											<button
												type="button"
												onClick={() =>
													handleRemoveLibrary(lib.id)
												}
												className="ml-0.5 -mr-1 rounded-full p-0.5 hover:bg-white/60"
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
									<Library className="h-5 w-5" />내 관심
									도서관 모두 추가
								</button>

								<div className="mb-3 flex gap-2">
									<button
										type="button"
										onClick={handleFindNearby}
										disabled={isFindingNearby}
										className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-3 text-sm font-medium backdrop-blur-md transition-opacity hover:bg-white/90 disabled:opacity-50"
									>
										<MapPin className="h-5 w-5 flex-shrink-0 text-primary" />
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
													className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/70 px-3 py-2 text-sm backdrop-blur-md transition-opacity hover:bg-white/90"
												>
													<MapPin className="h-3.5 w-3.5 text-primary/70" />
													{lib.name}
												</button>
											))}
										</div>
									</div>
								)}

								<div className="flex gap-2">
									<div className="flex flex-1 items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-4 py-3 backdrop-blur-md">
										<MapPin className="h-5 w-5 flex-shrink-0 text-foreground/50" />
										<input
											type="search"
											value={librarySearchQuery}
											onChange={(e) => {
												setLibrarySearchQuery(
													e.target.value,
												);
												setShowLibrarySearch(true);
											}}
											onFocus={() =>
												setShowLibrarySearch(true)
											}
											placeholder="도서관 검색"
											className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-foreground/50 focus:outline-none"
										/>
									</div>
								</div>

								{showLibrarySearch &&
									librarySearchResults.length > 0 && (
										<ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/40 bg-white/70 backdrop-blur-md">
											{librarySearchResults.map((lib) => (
												<li key={lib.id}>
													<button
														type="button"
														onClick={() =>
															handleAddLibrary(
																lib,
															)
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

							<button
								type="button"
								onClick={handleSubmit}
								disabled={!canSubmit || isSubmitting}
								className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							>
								{isSubmitting
									? "등록 중..."
									: "이 도서관에 책 꽂기"}
							</button>
						</>
					)}
				</main>
			</div>

			{showBarcode && (
				<BarcodeScanner
					onResult={handleBarcodeResult}
					onClose={() => setShowBarcode(false)}
				/>
			)}

			<BottomNav />
		</>
	);
}
