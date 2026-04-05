"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, BookOpen, Library, ChevronRight } from "lucide-react";
import { requestExchange, getUserAvailableBooksInLibrary } from "@/app/actions/exchange";
import BottomSheetModal from "@/components/BottomSheetModal";
import InlineLoadingLogo from "@/components/InlineLoadingLogo";
import AnimatedLogo from "@/components/AnimatedLogo";

export type LibraryItem = {
	id: string;
	name: string;
	address: string | null;
};

type SelectMyBookModalProps = {
	isOpen: boolean;
	onClose: () => void;
	ownerBookId: string;
	libraries: LibraryItem[];
};

type ModalStep = "library" | "book" | "confirm";

export default function SelectMyBookModal({
	isOpen,
	onClose,
	ownerBookId,
	libraries,
}: SelectMyBookModalProps) {
	const router = useRouter();
	const [step, setStep] = useState<ModalStep>("library");
	const [selectedLibrary, setSelectedLibrary] = useState<LibraryItem | null>(null);
	const [myBooks, setMyBooks] = useState<{ id: string; title: string; thumbnail_url: string | null }[]>([]);
	const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
	const [isLoadingBooks, setIsLoadingBooks] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			const hasOneLibrary = libraries.length === 1;
			setStep(hasOneLibrary ? "book" : "library");
			setSelectedLibrary(hasOneLibrary ? libraries[0] : null);
			setMyBooks([]);
			setSelectedBookId(null);
		}
	}, [isOpen, libraries]);

	// Fetch user's books when library is selected and we're on book step
	useEffect(() => {
		if (!isOpen || !selectedLibrary || step !== "book") return;
		let cancelled = false;
		setIsLoadingBooks(true);
		getUserAvailableBooksInLibrary(selectedLibrary.id).then((books) => {
			if (!cancelled) {
				setMyBooks(books);
				setIsLoadingBooks(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [isOpen, selectedLibrary?.id, step]);

	const handleSelectLibrary = (lib: LibraryItem) => {
		setSelectedLibrary(lib);
		setStep("book");
		setSelectedBookId(null);
	};

	const handleSelectBook = (bookId: string) => {
		setSelectedBookId(bookId);
		setStep("confirm");
	};

	const handleBack = () => {
		if (step === "book") {
			setStep("library");
			setSelectedLibrary(null);
			setMyBooks([]);
		} else if (step === "confirm") {
			setStep("book");
			setSelectedBookId(null);
		}
	};

	const handleConfirm = async () => {
		if (!selectedLibrary || !selectedBookId) return;
		setIsSubmitting(true);
		try {
			const { exchangeId } = await requestExchange(
				selectedBookId,
				ownerBookId,
				selectedLibrary.id,
			);
			onClose();
			router.push(`/exchange/${exchangeId}`);
		} catch (err) {
			alert(err instanceof Error ? err.message : "교환 신청에 실패했습니다.");
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (isOpen) document.body.style.overflow = "hidden";
		else document.body.style.overflow = "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	const displayLibrary = selectedLibrary ?? libraries[0] ?? null;

	return (
		<BottomSheetModal
			open={isOpen}
			onClose={onClose}
			className="pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-primary/20 bg-background/95 shadow-xl backdrop-blur-md"
		>
				<div className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
					{step !== "library" ? (
						<button
							type="button"
							onClick={handleBack}
							className="flex items-center gap-1 text-sm font-medium text-foreground/70"
						>
							← 뒤로
						</button>
					) : (
						<span />
					)}
					<h3 className="text-base font-semibold text-foreground">
						{step === "library"
							? "도서관 선택"
							: step === "book"
								? "내 책 선택"
								: "교환 신청 확인"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-white/60"
						aria-label="닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="max-h-[65vh] overflow-y-auto p-4 pb-28">
					{step === "library" && (
						<ul className="flex flex-col gap-1">
							{libraries.map((lib) => (
								<li key={lib.id}>
									<button
										type="button"
										onClick={() => handleSelectLibrary(lib)}
										className="flex w-full items-center justify-between rounded-xl border border-primary/20 bg-white/60 px-4 py-3 text-left transition-colors hover:bg-white/80"
									>
										<span className="font-medium text-foreground">{lib.name}</span>
										<ChevronRight className="h-5 w-5 text-foreground/50" />
									</button>
								</li>
							))}
						</ul>
					)}

					{step === "book" && (
						<>
							{isLoadingBooks ? (
								<InlineLoadingLogo
									className="h-16 w-16"
									paddingClassName="py-12"
								/>
							) : myBooks.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
									<Library
										className="h-16 w-16 text-muted-foreground/50"
										strokeWidth={1.5}
									/>
									<p className="text-muted-foreground">
										이 도서관에 등록된 책이 없네요!
										<br />
										지금 책을 등록해보세요.
									</p>
									<Link
										href={`/shelve?libraryId=${displayLibrary?.id}`}
										onClick={onClose}
										className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
									>
										책 등록하러 가기
									</Link>
								</div>
							) : (
								<ul className="flex flex-col gap-2">
									{myBooks.map((book) => (
										<li key={book.id}>
											<button
												type="button"
												onClick={() => handleSelectBook(book.id)}
												className="flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-white/60 p-3 text-left transition-colors hover:bg-white/80"
											>
												<div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-neutral-200">
													{book.thumbnail_url ? (
														<img
															src={book.thumbnail_url}
															alt={book.title}
															className="h-full w-full object-cover"
														/>
													) : (
														<div className="flex h-full w-full items-center justify-center">
															<BookOpen className="h-6 w-6 text-neutral-400" />
														</div>
													)}
												</div>
												<span className="flex-1 truncate text-sm font-medium text-foreground">
													{book.title}
												</span>
												<ChevronRight className="h-5 w-5 flex-shrink-0 text-foreground/50" />
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					)}

					{step === "confirm" && selectedBookId && (
						<div className="flex flex-col gap-4">
							<p className="text-sm text-muted-foreground">
								선택한 내 책으로 교환을 신청합니다.
							</p>
							<button
								type="button"
								onClick={handleConfirm}
								disabled={isSubmitting}
								className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-primary py-4 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
							>
								{isSubmitting ? (
									<AnimatedLogo className="h-14 w-14" />
								) : (
									"이 책으로 교환 신청하기"
								)}
							</button>
						</div>
					)}
				</div>
		</BottomSheetModal>
	);
}
