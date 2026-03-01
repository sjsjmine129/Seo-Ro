"use client";

import { useCallback, useEffect, useState } from "react";
import { useZxing } from "react-zxing";
import { X } from "lucide-react";

type BarcodeScannerProps = {
	onResult: (isbn: string) => void;
	onClose: () => void;
};

export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
	const [error, setError] = useState<string | null>(null);

	const handleResult = useCallback(
		(result: { getText: () => string }) => {
			const text = result.getText().replace(/-/g, "").replace(/\s/g, "");
			if (/^\d{10,13}$/.test(text)) {
				onResult(text);
			}
		},
		[onResult],
	);

	const { ref } = useZxing({
		onDecodeResult: handleResult,
		onError: (err) => setError(String(err)),
		constraints: { video: { facingMode: "environment" } },
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
			{error && (
				<p className="bg-accent/90 px-4 py-2 text-center text-sm text-white">
					{error}
				</p>
			)}
		</div>
	);
}
