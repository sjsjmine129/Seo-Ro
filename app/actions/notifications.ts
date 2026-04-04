"use server";

import { createClient, createServiceRoleClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/push";

export type NotificationType =
	| "REQUEST"
	| "COUNTER"
	| "ACCEPTED"
	| "SCHEDULED"
	| "REMINDER_30MIN"
	| "NO_SHOW"
	| "HALF_COMPLETED"
	| "FULLY_COMPLETED"
	| "CANCELED"
	| "REJECTED"
	| "SYSTEM";

export type Notification = {
	id: string;
	user_id: string;
	type: NotificationType;
	title: string;
	message: string;
	link: string | null;
	is_read: boolean;
	created_at: string;
};

/** Insert notification(s) - uses service role to allow inserting for any user */
export async function insertNotification(
	userId: string,
	type: NotificationType,
	title: string,
	message: string,
	link?: string,
) {
	const supabase = createServiceRoleClient();
	const { error } = await supabase.from("notifications").insert({
		user_id: userId,
		type,
		title,
		message,
		link: link ?? null,
	});
	if (error) console.error("[notifications] insert failed:", error.message);

	try {
		await sendPushToUser(userId, {
			title,
			body: message,
			url: link ?? "/",
		});
	} catch {
		// Push fails silently (e.g. user not subscribed, VAPID not configured)
	}
}

/** Insert notifications for multiple users */
export async function insertNotificationsForUsers(
	userIds: string[],
	type: NotificationType,
	title: string,
	message: string,
	link?: string,
) {
	const supabase = createServiceRoleClient();
	const rows = userIds.map((user_id) => ({
		user_id,
		type,
		title,
		message,
		link: link ?? null,
	}));
	const { error } = await supabase.from("notifications").insert(rows);
	if (error) console.error("[notifications] bulk insert failed:", error.message);

	for (const userId of userIds) {
		try {
			await sendPushToUser(userId, {
				title,
				body: message,
				url: link ?? "/",
			});
		} catch {
			// Push fails silently (e.g. user not subscribed, VAPID not configured)
		}
	}
}

export async function getUnreadCount(): Promise<number> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return 0;

	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("user_id", user.id)
		.eq("is_read", false);

	if (error) return 0;
	return count ?? 0;
}

export async function getNotifications(limit = 50): Promise<Notification[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from("notifications")
		.select("id, user_id, type, title, message, link, is_read, created_at")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) return [];
	return (data ?? []) as Notification[];
}

export async function markAsRead(notificationId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase
		.from("notifications")
		.update({ is_read: true })
		.eq("id", notificationId)
		.eq("user_id", user.id);

	revalidatePath("/notifications");
}

export async function markAllAsRead() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase
		.from("notifications")
		.update({ is_read: true })
		.eq("user_id", user.id);

	revalidatePath("/notifications");
	revalidatePath("/");
}

export async function deleteNotification(notificationId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase
		.from("notifications")
		.delete()
		.eq("id", notificationId)
		.eq("user_id", user.id);

	revalidatePath("/notifications");
}

export async function deleteAllNotifications() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("notifications").delete().eq("user_id", user.id);

	revalidatePath("/notifications");
	revalidatePath("/");
}
