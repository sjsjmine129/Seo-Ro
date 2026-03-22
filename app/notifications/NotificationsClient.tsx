"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import {
	getNotifications,
	markAllAsRead,
	deleteAllNotifications,
	type Notification,
} from "@/app/actions/notifications";
import NotificationItem from "./NotificationItem";
import BottomNav from "@/components/BottomNav";

export default function NotificationsClient() {
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getNotifications().then((data) => {
			setNotifications(data);
			setLoading(false);
		});
	}, []);

	const handleMarkAllRead = async () => {
		await markAllAsRead();
		setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
	};

	const handleDeleteAll = async () => {
		await deleteAllNotifications();
		setNotifications([]);
	};

	const handleItemDeleted = (id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	};

	return (
		<main className="relative min-h-screen bg-background pb-20">
			<div className="mx-auto w-full max-w-lg">
				{/* Header: edge-to-edge border, padded content */}
				<header className="sticky top-0 z-30 -mt-4 flex w-full items-center justify-between border-b border-primary/20 bg-white/90 px-4 py-3 backdrop-blur-md">
					<h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
						<Bell className="h-5 w-5 text-primary" />
						알림
					</h1>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleMarkAllRead}
							disabled={notifications.length === 0}
							className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
						>
							<CheckCheck className="h-4 w-4" />
							모두 읽음
						</button>
						<button
							type="button"
							onClick={handleDeleteAll}
							disabled={notifications.length === 0}
							className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
						>
							<Trash2 className="h-4 w-4" />
							모두 삭제
						</button>
					</div>
				</header>

				{/* List: padded content */}
				<div className="w-full space-y-3 px-4 py-4">
				{loading ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<Bell className="mb-3 h-12 w-12 animate-pulse opacity-50" />
						<p className="text-sm">알림을 불러오는 중...</p>
					</div>
				) : notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<Bell className="mb-3 h-12 w-12 opacity-30" strokeWidth={1.5} />
						<p className="text-sm">알림이 없습니다.</p>
					</div>
				) : (
					<AnimatePresence mode="popLayout">
						{notifications.map((n) => (
							<NotificationItem
								key={n.id}
								notification={n}
								onDeleted={() => handleItemDeleted(n.id)}
							/>
						))}
					</AnimatePresence>
				)}
				</div>
			</div>

			<BottomNav />
		</main>
	);
}
