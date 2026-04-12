"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
	Home,
	Search,
	BookPlus,
	MessageCircle,
	User,
	type LucideIcon,
} from "lucide-react";
import { getUnreadSummary } from "@/app/actions/unreadSummary";

type NavItem = {
	href: string;
	label: string;
	icon: LucideIcon;
	isFab?: boolean;
};

const NAV_ITEMS: NavItem[] = [
	{ href: "/", label: "홈", icon: Home },
	{ href: "/search", label: "검색", icon: Search },
	{ href: "/shelve", label: "책 꽂기", icon: BookPlus, isFab: true },
	{ href: "/chat", label: "채팅", icon: MessageCircle },
	{ href: "/mypage", label: "마이페이지", icon: User },
];

export default function BottomNav() {
	const pathname = usePathname();
	const [chatUnread, setChatUnread] = useState(false);

	useEffect(() => {
		let alive = true;
		const load = () => {
			void getUnreadSummary().then((s) => {
				if (alive) setChatUnread(s.chatUnread);
			});
		};
		load();
		const id = window.setInterval(load, 18000);
		const onVis = () => {
			if (document.visibilityState === "visible") load();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			alive = false;
			window.clearInterval(id);
			document.removeEventListener("visibilitychange", onVis);
		};
	}, [pathname]);

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-50 flex h-[65px] items-end justify-center pb-[env(safe-area-inset-bottom)]"
			aria-label="하단 탐색"
		>
			{/* Glassmorphism bar: bg-glass-bg backdrop-blur-md border-primary/20 */}
			<div className="relative mx-auto flex h-16 rounded-t-2xl w-full max-w-lg items-center justify-around border-t border-primary/20 bg-glass-bg px-2 backdrop-blur-md">
				{NAV_ITEMS.map((item) => {
					if (item.isFab) {
						return (
							<div
								key={item.href}
								className="relative flex flex-1 justify-center"
							>
								<Link
									href={item.href}
									className="absolute -top-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-xl transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
									aria-label={item.label}
								>
									<BookPlus
										className="h-6 w-6"
										strokeWidth={2}
									/>
								</Link>
							</div>
						);
					}

					const isActive =
						item.href === "/chat"
							? pathname === "/chat" || pathname.startsWith("/chat/")
							: pathname === item.href;
					const Icon = item.icon;
					const showChatDot = item.href === "/chat" && chatUnread;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${isActive ? "text-primary" : "text-neutral-500"}`}
							aria-label={item.label}
							aria-current={isActive ? "page" : undefined}
						>
							<span className="relative inline-flex">
								<Icon
									className="h-6 w-6"
									strokeWidth={2}
									aria-hidden
								/>
								{showChatDot ? (
									<span
										className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-background bg-red-500"
										aria-hidden
									/>
								) : null}
							</span>
							<span className="text-[10px] font-medium">
								{item.label}
							</span>
							{isActive && (
								<span
									className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary"
									aria-hidden
								/>
							)}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
