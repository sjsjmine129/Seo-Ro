import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";

/**
 * Internal API to trigger a push notification for a user.
 * Protected by CRON_SECRET or similar - typically called from server actions,
 * or from a cron/webhook. For now, we support a POST with auth.
 */
export async function POST(request: Request) {
	const authHeader = request.headers.get("authorization");
	const secret = process.env.PUSH_SEND_SECRET;
	if (secret && authHeader !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let body: { userId: string; title: string; body: string; url?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { userId, title, body, url } = body;
	if (!userId || !title || !body) {
		return NextResponse.json(
			{ error: "Missing userId, title, or body" },
			{ status: 400 },
		);
	}

	try {
		const { sent, failed } = await sendPushToUser(userId, {
			title,
			body,
			url: url ?? "/",
		});
		return NextResponse.json({ ok: true, sent, failed });
	} catch (err) {
		console.error("[push/send]", err);
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Send failed" },
			{ status: 500 },
		);
	}
}
