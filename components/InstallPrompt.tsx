"use client";

import { Share, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallPrompt() {
	const pathname = usePathname();
	const { shouldShow, platform, dismiss, triggerInstall } = useInstallPrompt();

	if (pathname !== "/") return null;
	if (!shouldShow) return null;

	return (
		<div
			className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[calc(65px+env(safe-area-inset-bottom)+12px)] pt-2"
			role="dialog"
			aria-labelledby="install-prompt-title"
		>
			<div className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl border border-primary/20 bg-white/95 shadow-xl backdrop-blur-md">
				<div className="relative px-4 pb-4 pt-5">
					<button
						type="button"
						onClick={dismiss}
						className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-black/5 hover:text-foreground"
						aria-label="닫기"
					>
						<X className="h-5 w-5" strokeWidth={2} />
					</button>

					<h2
						id="install-prompt-title"
						className="pr-10 text-base font-semibold text-foreground"
					>
						서로를 앱처럼 써보세요
					</h2>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						앱으로 설치하면 더 빠르고 편하게 책을 교환할 수 있어요!
					</p>

					{platform === "ios" ? (
						<div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-sm leading-relaxed text-foreground">
							<p className="flex flex-wrap items-center gap-x-1 gap-y-1">
								하단의
								<span className="inline-flex items-center gap-0.5 rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-primary shadow-sm">
									<Share className="h-4 w-4" strokeWidth={2} />
									공유
								</span>
								버튼을 누르고,
							</p>
							<p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
								<span className="inline-flex items-center gap-0.5 rounded-md bg-white/80 px-1.5 py-0.5 font-medium text-primary shadow-sm">
									<Plus className="h-4 w-4" strokeWidth={2} />
									홈 화면에 추가
								</span>
								를 선택해 주세요.
							</p>
						</div>
					) : (
						<button
							type="button"
							onClick={() => void triggerInstall()}
							className="mt-4 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-white shadow-md transition-opacity hover:opacity-90"
						>
							앱 설치하기
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
