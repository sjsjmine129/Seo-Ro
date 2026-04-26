"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { X } from "lucide-react";

type BarcodeScannerProps = {
	onResult: (isbn: string) => void;
	onClose: () => void;
};

/** Normalize scan to ISBN-10 / ISBN-13 style string; returns null if not usable for search. */
function normalizeIsbnFromScan(raw: string): string | null {
	const compact = raw.replace(/[-\s]/g, "").toUpperCase();
	// ISBN-13 (EAN-13 bookland) or plain 13-digit
	if (/^\d{13}$/.test(compact)) return compact;
	// ISBN-10 including check letter X
	if (/^\d{9}[\dX]$/.test(compact)) return compact;
	// Some scanners emit 10 digits only (rare); still try Naver
	if (/^\d{10}$/.test(compact)) return compact;
	return null;
}

export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
	const [error, setError] = useState<string | null>(null);
	const [formatHint, setFormatHint] = useState<string | null>(null);

	const hints = useMemo(() => {
		const m = new Map<DecodeHintType, unknown>();
		m.set(DecodeHintType.POSSIBLE_FORMATS, [
			BarcodeFormat.EAN_13,
			BarcodeFormat.EAN_8,
			BarcodeFormat.UPC_A,
			BarcodeFormat.UPC_E,
		]);
		m.set(DecodeHintType.TRY_HARDER, true);
		return m;
	}, []);

	const handleResult = useCallback(
		(result: { getText: () => string }) => {
			const normalized = normalizeIsbnFromScan(result.getText());
			if (normalized) {
				setFormatHint(null);
				onResult(normalized);
				return;
			}
			setFormatHint(
				"인식된 코드가 ISBN 형식이 아니에요. 책 뒷면의 EAN 바코드를 맞춰 주세요.",
			);
		},
		[onResult],
	);

	const { ref } = useZxing({
		hints,
		onDecodeResult: handleResult,
		onDecodeError: () => {
			/* continuous decode noise — no UI */
		},
		onError: (err) => setError(String(err)),
		constraints: {
			audio: false,
			video: { facingMode: "environment" },
		},
	});

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-[100] flex flex-col bg-black">
			<div className="relative flex-1">
				<video
					ref={ref}
					className="h-full w-full object-cover"
					muted
					playsInline
					autoPlay
				/>
				<button
					type="button"
					onClick={onClose}
					className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
					aria-label="닫기"
				>
					<X className="h-6 w-6" />
				</button>
				<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
					<p className="text-center text-sm text-white">
						ISBN 바코드를 프레임 안에 맞춰 주세요
					</p>
				</div>
			</div>
			{(error || formatHint) && (
				<p className="bg-accent/90 px-4 py-2 text-center text-sm text-white">
					{error ?? formatHint}
				</p>
			)}
		</div>
	);
}
