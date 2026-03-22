import webpush from "web-push";
import { createServiceRoleClient } from "@/utils/supabase/server";

let vapidConfigured = false;

function ensureVapidConfig() {
	if (vapidConfigured) return;
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) {
		throw new Error(
			"NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set for Web Push",
		);
	}
	webpush.setVapidDetails("mailto:support@seoro.app", publicKey, privateKey);
	vapidConfigured = true;
}

export type PushPayload = {
	title: string;
	body: string;
	icon?: string;
	url?: string;
	tag?: string;
};

/**
 * Send a Web Push notification to all of a user's registered endpoints.
 * Call this from server actions when inserting in-app notifications.
 */
export async function sendPushToUser(
	userId: string,
	payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
	ensureVapidConfig();
	const supabase = createServiceRoleClient();

	const { data: subs, error } = await supabase
		.from("push_subscriptions")
		.select("id, endpoint, auth, p256dh")
		.eq("user_id", userId);

	if (error || !subs?.length) {
		return { sent: 0, failed: 0 };
	}

	const message = JSON.stringify({
		title: payload.title,
		body: payload.body,
		icon: payload.icon ?? "/apple-icon.png",
		url: payload.url ?? "/",
		tag: payload.tag ?? "seoro-notification",
	});

	let sent = 0;
	let failed = 0;
	const deadEndpoints: string[] = [];

	for (const sub of subs) {
		try {
			await webpush.sendNotification(
				{
					endpoint: sub.endpoint,
					keys: {
						auth: sub.auth,
						p256dh: sub.p256dh,
					},
				},
				message,
				{ TTL: 86400 },
			);
			sent++;
		} catch (err) {
			failed++;
			// 410 Gone or 404 = subscription expired, remove it
			const statusCode = err instanceof Error && "statusCode" in err ? (err as { statusCode?: number }).statusCode : 0;
			if (statusCode === 410 || statusCode === 404) {
				deadEndpoints.push(sub.endpoint);
			}
		}
	}

	// Remove expired subscriptions
	if (deadEndpoints.length > 0) {
		await supabase
			.from("push_subscriptions")
			.delete()
			.eq("user_id", userId)
			.in("endpoint", deadEndpoints);
	}

	return { sent, failed };
}
