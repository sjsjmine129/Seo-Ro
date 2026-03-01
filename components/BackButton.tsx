"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton() {
	const router = useRouter();

	return (
		<button
			type="button"
			onClick={() => router.back()}
			className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/60 p-2 shadow-sm backdrop-blur-md transition-opacity hover:bg-white/80"
			aria-label="뒤로가기"
		>
			<ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2} />
		</button>
	);
}
