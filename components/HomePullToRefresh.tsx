"use client";

import {
	useRef,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import AnimatedLogo from "@/components/AnimatedLogo";

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_DISPLAY_PX = 96;
const DAMPING = 0.42;
const REFRESH_MIN_VISIBLE_MS = 700;

type Props = {
	children: ReactNode;
};

/**
 * Pull down at scroll top to refetch the home feed (router.refresh).
 * Shows AnimatedLogo while pulling and during refresh.
 */
export default function HomePullToRefresh({ children }: Props) {
	const router = useRouter();
	const wrapRef = useRef<HTMLDivElement>(null);
	const [pullDisplay, setPullDisplay] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const refreshingRef = useRef(false);

	const startY = useRef(0);
	const tracking = useRef(false);
	const maxRawPull = useRef(0);

	useEffect(() => {
		refreshingRef.current = refreshing;
	}, [refreshing]);

	const endPullVisual = useCallback(() => {
		setPullDisplay(0);
		tracking.current = false;
		maxRawPull.current = 0;
	}, []);

	useEffect(() => {
		const el = wrapRef.current;
		if (!el) return;

		const scrollTop = () =>
			window.scrollY || document.documentElement.scrollTop;

		const onTouchStart = (e: TouchEvent) => {
			if (refreshingRef.current) return;
			if (scrollTop() > 4) return;
			tracking.current = true;
			startY.current = e.touches[0].clientY;
			maxRawPull.current = 0;
		};

		const onTouchMove = (e: TouchEvent) => {
			if (!tracking.current || refreshingRef.current) return;
			if (scrollTop() > 4) {
				endPullVisual();
				return;
			}
			const raw = e.touches[0].clientY - startY.current;
			if (raw <= 0) {
				setPullDisplay(0);
				return;
			}
			maxRawPull.current = Math.max(maxRawPull.current, raw);
			e.preventDefault();
			setPullDisplay(Math.min(raw * DAMPING, MAX_PULL_DISPLAY_PX));
		};

		const onTouchEnd = () => {
			if (!tracking.current) return;
			const shouldRefresh =
				maxRawPull.current >= PULL_THRESHOLD_PX &&
				!refreshingRef.current;
			tracking.current = false;
			setPullDisplay(0);
			maxRawPull.current = 0;

			if (shouldRefresh) {
				setRefreshing(true);
				router.refresh();
				window.setTimeout(() => {
					setRefreshing(false);
				}, REFRESH_MIN_VISIBLE_MS);
			}
		};

		const onTouchCancel = () => {
			endPullVisual();
		};

		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd);
		el.addEventListener("touchcancel", onTouchCancel);

		return () => {
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
			el.removeEventListener("touchcancel", onTouchCancel);
		};
	}, [router, endPullVisual]);

	const showIndicator = pullDisplay > 6 || refreshing;
	const indicatorHeight = refreshing
		? 76
		: Math.max(0, Math.round(pullDisplay) + 20);
	const pullOpacity = refreshing
		? 1
		: Math.min(1, pullDisplay / (PULL_THRESHOLD_PX * DAMPING));

	return (
		<div ref={wrapRef} className="relative">
			<div
				className="flex flex-col items-center justify-end overflow-hidden transition-[height,opacity] duration-200 ease-out"
				style={{
					height: showIndicator ? indicatorHeight : 0,
					opacity: showIndicator ? 1 : 0,
				}}
				aria-hidden={!showIndicator}
			>
				<div
					className={
						refreshing ? "animate-pulse pb-2" : "pb-1"
					}
					style={{ opacity: refreshing ? 1 : pullOpacity }}
				>
					<AnimatedLogo className="mx-auto h-12 w-12 shrink-0 md:h-14 md:w-14" />
				</div>
				{refreshing && (
					<p className="pb-2 text-center text-xs font-medium text-muted-foreground">
						새로고침 중...
					</p>
				)}
			</div>
			{children}
		</div>
	);
}
