"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const rawData = atob(b64);
	const output = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; i++) {
		output[i] = rawData.charCodeAt(i);
	}
	return output;
}

export default function PushPrompt() {
	const [status, setStatus] = useState<"idle" | "loading" | "granted" | "denied" | "unsupported">("idle");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			!("serviceWorker" in navigator) ||
			!("PushManager" in window)
		) {
			setStatus("unsupported");
			return;
		}
		if (Notification.permission === "granted") {
			setStatus("granted");
			return;
		}
		if (Notification.permission === "denied") {
			setStatus("denied");
			return;
		}
		setStatus("idle");
	}, []);

	const subscribe = async () => {
		const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
		if (!publicKey) {
			setError("VAPID 키가 설정되지 않았습니다.");
			return;
		}

		setStatus("loading");
		setError(null);

		try {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setStatus("denied");
				return;
			}

			const reg = await navigator.serviceWorker.register("/sw.js", {
				scope: "/",
			});
			await reg.update();

			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
			});

			const subJson = sub.toJSON();
			const res = await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					endpoint: subJson.endpoint,
					keys: {
						auth: subJson.keys?.auth,
						p256dh: subJson.keys?.p256dh,
					},
				}),
				credentials: "include",
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? "구독 저장 실패");
			}

			setStatus("granted");
		} catch (err) {
			setError(err instanceof Error ? err.message : "알림 설정 실패");
			setStatus("idle");
		}
	};

	if (status === "unsupported" || status === "granted" || status === "denied") {
		return null;
	}

	return (
		<div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
			<div className="flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
					<Bell className="h-5 w-5 text-primary" strokeWidth={2} />
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="text-sm font-semibold text-foreground">
						실시간 알림 받기
					</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						앱을 사용하지 않을 때도 교환 요청, 약속 알림 등을 받아보세요.
					</p>
					<button
						type="button"
						onClick={subscribe}
						disabled={status === "loading"}
						className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{status === "loading" ? "설정 중..." : "알림 허용"}
					</button>
					{error && (
						<p className="mt-2 text-xs text-red-600">{error}</p>
					)}
				</div>
			</div>
		</div>
	);
}
