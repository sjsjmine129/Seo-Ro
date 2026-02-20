"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, BookPlus, Bell, User } from "lucide-react";

const NAV_ITEMS = [
	{ href: "/", label: "Home", icon: Home },
	{ href: "/search", label: "Search", icon: Search },
	{ href: "/shelve", label: "Shelve", icon: BookPlus, isFab: true },
	{
		href: "/notifications",
		label: "Notifications",
		icon: Bell,
		showDot: true,
	},
	{ href: "/my-library", label: "My Library", icon: User },
] as const;

export default function BottomNav() {
	const pathname = usePathname();

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-50 flex h-[65px] items-end justify-center pb-[env(safe-area-inset-bottom)]"
			aria-label="Bottom navigation"
		>
			{/* Glassmorphism bar: bg-white/90 backdrop-blur-md border-white/40 */}
			<div className="relative mx-auto flex h-16 w-full max-w-lg items-center justify-around border-t border-white/40 bg-white/90 px-2 backdrop-blur-md">
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
								{item.showDot && (
									<span
										className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent"
										aria-hidden
									/>
								)}
							</span>
							<span className="text-[10px] font-medium">
								{item.label === "Notifications"
									? "Alerts"
									: item.label}
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
