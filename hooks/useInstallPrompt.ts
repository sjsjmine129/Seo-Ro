"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "seo-ro-install-prompt-dismissed-at";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

/** Chromium PWA install prompt (DOM type may be missing in older TS libs). */
export type PwaBeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallPlatform = "ios" | "android" | "desktop";

function getIsStandalone(): boolean {
	if (typeof window === "undefined") return true;
	if (window.matchMedia("(display-mode: standalone)").matches) return true;
	const nav = window.navigator as Navigator & { standalone?: boolean };
	if (nav.standalone === true) return true;
	return false;
}

function detectPlatform(ua: string): InstallPlatform {
	if (/Android/i.test(ua)) return "android";
	if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
	// iPadOS 13+ reports as MacIntel with touch
	if (
		/MacIntel/i.test(ua) &&
		typeof navigator !== "undefined" &&
		navigator.maxTouchPoints > 1
	) {
		return "ios";
	}
	return "desktop";
}

function isDismissedWithinWindow(): boolean {
	if (typeof window === "undefined") return true;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return false;
	const t = parseInt(raw, 10);
	if (Number.isNaN(t)) return false;
	return Date.now() - t < DISMISS_MS;
}

export function useInstallPrompt() {
	const [ready, setReady] = useState(false);
	const [isInstalled, setIsInstalled] = useState(true);
	const [platform, setPlatform] = useState<InstallPlatform>("desktop");
	const [dismissed, setDismissed] = useState(true);
	const [deferredPrompt, setDeferredPrompt] =
		useState<PwaBeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		setIsInstalled(getIsStandalone());
		setDismissed(isDismissedWithinWindow());
		setPlatform(detectPlatform(navigator.userAgent));
		setReady(true);

		const onInstalled = () => setIsInstalled(true);
		window.addEventListener("appinstalled", onInstalled);

		const mq = window.matchMedia("(display-mode: standalone)");
		const onMq = () => setIsInstalled(getIsStandalone());
		mq.addEventListener("change", onMq);

		const onBeforeInstall = (e: Event) => {
			e.preventDefault();
			setDeferredPrompt(e as PwaBeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", onBeforeInstall);

		return () => {
			window.removeEventListener("appinstalled", onInstalled);
			mq.removeEventListener("change", onMq);
			window.removeEventListener("beforeinstallprompt", onBeforeInstall);
		};
	}, []);

	const dismiss = useCallback(() => {
		localStorage.setItem(STORAGE_KEY, String(Date.now()));
		setDismissed(true);
	}, []);

	const triggerInstall = useCallback(async () => {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		await deferredPrompt.userChoice;
		setDeferredPrompt(null);
	}, [deferredPrompt]);

	const shouldShow = useMemo(() => {
		if (!ready || isInstalled || dismissed) return false;
		if (platform === "ios") return true;
		return deferredPrompt !== null;
	}, [ready, isInstalled, dismissed, platform, deferredPrompt]);

	return {
		shouldShow,
		platform,
		deferredPrompt,
		dismiss,
		triggerInstall,
		isInstalled,
		canInstallWithPrompt: deferredPrompt !== null,
	};
}
