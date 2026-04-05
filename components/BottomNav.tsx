"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Home,
	Search,
	BookPlus,
	Bell,
	User,
	type LucideIcon,
} from "lucide-react";
import { getUnreadCount } from "@/app/actions/notifications";

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
	{ href: "/notifications", label: "알림", icon: Bell },
	{ href: "/mypage", label: "마이페이지", icon: User },
];

export default function BottomNav() {
	const pathname = usePathname();
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		getUnreadCount().then(setUnreadCount);
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

					const isActive = pathname === item.href;
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 rounded-lg transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${isActive ? "text-primary" : "text-neutral-500"}`}
							aria-label={item.label}
							aria-current={isActive ? "page" : undefined}
						>
							<span className="relative">
								<Icon
									className="h-6 w-6"
									strokeWidth={2}
									aria-hidden
								/>
								{item.href === "/notifications" && unreadCount > 0 && (
									<span
										className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
										aria-label={`읽지 않은 알림 ${unreadCount}개`}
									>
										{unreadCount > 99 ? "99+" : unreadCount}
									</span>
								)}
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
