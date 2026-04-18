"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import LibraryFilter from "@/components/LibraryFilter";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboarding } from "@/hooks/useOnboarding";

type Library = { id: string; name: string };

type MainHomeStickyHeaderProps = {
	libraries: Library[];
	selectedId: string | null;
	selectedLibraryName: string | null;
	unreadNotificationCount: number;
};

export default function MainHomeStickyHeader({
	libraries,
	selectedId,
	selectedLibraryName,
	unreadNotificationCount,
}: MainHomeStickyHeaderProps) {
	const notificationsGuide = useOnboarding("notifications");
	const showNotificationsTooltip = notificationsGuide.shouldShow;

	return (
		<div className="sticky top-4 z-40 mb-6 flex w-full items-start justify-between gap-2">
			<div className="min-w-0 flex-1">
				<LibraryFilter
					libraries={libraries}
					selectedId={selectedId}
					selectedLibraryName={selectedLibraryName}
				/>
			</div>
			<div className="relative mt-0.5 shrink-0">
				<Link
					href="/notifications"
					className="relative flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-white/70 text-primary shadow-md backdrop-blur-md transition-colors hover:bg-white/90"
					aria-label="알림"
				>
					<Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
					{unreadNotificationCount > 0 ? (
						<span
							className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500"
							aria-hidden
						/>
					) : null}
				</Link>
				{showNotificationsTooltip ? (
					<OnboardingTooltip
						message="앗, 빨간 점이 생겼네요! 새 교환 요청이나 메시지를 확인해 보세요."
						position="top"
						align="right"
						onClose={() => {
							notificationsGuide.markAsSeen();
						}}
					/>
				) : null}
			</div>
		</div>
	);
}
