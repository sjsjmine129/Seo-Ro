"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(stepKey: string): string {
	return `has_seen_guide_${stepKey}`;
}

/**
 * One-time onboarding step: reads `localStorage` key `has_seen_guide_${stepKey}`.
 * `shouldShow` stays false until mounted (avoids SSR/hydration mismatch).
 *
 * **PRD diagnostics:** `useEffect` logs localStorage read + computed visibility.
 */
export function useOnboarding(stepKey: string): {
	shouldShow: boolean;
	markAsSeen: () => void;
} {
	const [shouldShow, setShouldShow] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		let raw: string | null;
		try {
			raw = localStorage.getItem(storageKey(stepKey));
		} catch (e) {
			raw = null;
			console.warn(
				"🔍 [Onboarding Hook] localStorage read failed:",
				stepKey,
				e,
			);
		}
		const nextShow = raw !== "true";
		console.log(
			"🔍 [Onboarding Hook] Key:",
			stepKey,
			" | LocalStorage:",
			raw,
			" | shouldShow:",
			nextShow,
			"(after effect; React state was false until now on client)",
		);
		setShouldShow(nextShow);
	}, [stepKey]);

	const markAsSeen = useCallback(() => {
		if (typeof window === "undefined") return;
		const key = storageKey(stepKey);
		try {
			localStorage.setItem(key, "true");
			console.log("🔍 [Onboarding Hook] markAsSeen | Key:", stepKey, "| wrote:", key);
		} catch (e) {
			console.warn(
				"🔍 [Onboarding Hook] markAsSeen localStorage write failed:",
				stepKey,
				e,
			);
		}
		setShouldShow(false);
	}, [stepKey]);

	return { shouldShow, markAsSeen };
}
