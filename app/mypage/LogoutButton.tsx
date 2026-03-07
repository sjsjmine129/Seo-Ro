"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleLogout = async () => {
		setIsLoading(true);
		try {
			const supabase = createClient();
			await supabase.auth.signOut();
			router.push("/login");
			router.refresh();
		} catch {
			setIsLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={isLoading}
			className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/40 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/60 hover:text-foreground disabled:opacity-50"
		>
			{isLoading ? (
				<>
					<Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
					로그아웃 중...
				</>
			) : (
				<>
					<LogOut className="h-4 w-4" strokeWidth={2} />
					로그아웃
				</>
			)}
		</button>
	);
}
