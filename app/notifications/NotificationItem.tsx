"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
	CheckCircle2,
	Clock,
	AlertTriangle,
	MailQuestion,
	CalendarClock,
	XCircle,
	ThumbsUp,
	Trash2,
	Bell,
	RefreshCw,
	type LucideIcon,
} from "lucide-react";
import { markAsRead, deleteNotification, type Notification, type NotificationType } from "@/app/actions/notifications";

const ICON_MAP: Record<NotificationType, LucideIcon> = {
	REQUEST: MailQuestion,
	COUNTER: RefreshCw,
	ACCEPTED: ThumbsUp,
	SCHEDULED: CalendarClock,
	REMINDER_30MIN: Clock,
	NO_SHOW: AlertTriangle,
	HALF_COMPLETED: CheckCircle2,
	FULLY_COMPLETED: CheckCircle2,
	CANCELED: XCircle,
	REJECTED: XCircle,
	SYSTEM: Bell,
};

type Props = {
	notification: Notification;
	onDeleted: () => void;
};

export default function NotificationItem({ notification, onDeleted }: Props) {
	const router = useRouter();
	const Icon = ICON_MAP[notification.type] ?? Bell;

	const handleClick = async () => {
		if (!notification.is_read) {
			await markAsRead(notification.id);
		}
		if (notification.link) {
			router.push(notification.link);
		}
	};

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		await deleteNotification(notification.id);
		onDeleted();
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 1, height: "auto" }}
			exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
			className="overflow-hidden"
		>
			<div
				role="button"
				tabIndex={0}
				onClick={handleClick}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleClick();
					}
				}}
				className="flex cursor-pointer items-center gap-3 rounded-xl border border-primary/20 bg-white/70 px-4 py-3 backdrop-blur-md transition-colors hover:bg-white/90 active:scale-[0.99]"
			>
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
					<Icon className="h-5 w-5" strokeWidth={2} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						{!notification.is_read && (
							<span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
						)}
						<p className="truncate text-sm font-medium text-foreground">
							{notification.title}
						</p>
					</div>
					<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
						{notification.message}
					</p>
					<p className="mt-1 text-[10px] text-muted-foreground">
						{formatRelativeTime(notification.created_at)}
					</p>
				</div>
				<button
					type="button"
					onClick={handleDelete}
					className="flex shrink-0 items-center justify-center rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
					aria-label="알림 삭제"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
		</motion.div>
	);
}

function formatRelativeTime(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "방금 전";
	if (diffMins < 60) return `${diffMins}분 전`;
	if (diffHours < 24) return `${diffHours}시간 전`;
	if (diffDays < 7) return `${diffDays}일 전`;
	return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
