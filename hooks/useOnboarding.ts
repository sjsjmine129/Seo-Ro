"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(stepKey: string): string {
	return `has_seen_guide_${stepKey}`;
}

/**
 * One-time onboarding step: reads `localStorage` key `has_seen_guide_${stepKey}`.
 * `shouldShow` stays false until mounted (avoids SSR/hydration mismatch).
 */
export function useOnboarding(stepKey: string): {
	shouldShow: boolean;
	markAsSeen: () => void;
} {
	const [shouldShow, setShouldShow] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			setShouldShow(localStorage.getItem(storageKey(stepKey)) !== "true");
		} catch {
			setShouldShow(false);
		}
	}, [stepKey]);

	const markAsSeen = useCallback(() => {
		if (typeof window === "undefined") return;
		try {
			localStorage.setItem(storageKey(stepKey), "true");
		} catch {
			// private mode / quota
		}
		setShouldShow(false);
	}, [stepKey]);

	return { shouldShow, markAsSeen };
}
