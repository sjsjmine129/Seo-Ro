import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/server";
import { insertNotification } from "@/app/actions/notifications";

/**
 * Cron route: Send REMINDER_30MIN notifications for exchanges meeting in ~30 minutes.
 * Configure in Vercel: vercel.json cron or Dashboard -> Project -> Settings -> Cron Jobs
 * Example: every 5 minutes
 */
export async function GET(request: Request) {
	// Optional: Verify cron secret to prevent public access
	const authHeader = request.headers.get("authorization");
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const supabase = createServiceRoleClient();

	// Find exchanges where meet_at is ~30 minutes from now
	const now = new Date();
	const windowStart = new Date(now.getTime() + 29 * 60 * 1000);
	const windowEnd = new Date(now.getTime() + 31 * 60 * 1000);

	const { data: exchanges, error } = await supabase
		.from("exchanges")
		.select("id, requester_id, owner_id, meet_at")
		.eq("status", "SCHEDULED")
		.not("meet_at", "is", null)
		.gte("meet_at", windowStart.toISOString())
		.lte("meet_at", windowEnd.toISOString());

	if (error) {
		console.error("[cron/reminders]", error.message);
		return NextResponse.json({ error: "Database error" }, { status: 500 });
	}

	let sent = 0;
	for (const ex of exchanges ?? []) {
		const meetTime = ex.meet_at ? new Date(ex.meet_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "";
		const title = "30분 후 만남 예정";
		const message = `도서관에서 만남이 예정되어 있습니다. (${meetTime})`;

		await insertNotification(ex.requester_id, "REMINDER_30MIN", title, message, `/exchange/${ex.id}`);
		await insertNotification(ex.owner_id, "REMINDER_30MIN", title, message, `/exchange/${ex.id}`);
		sent += 2;
	}

	return NextResponse.json({ ok: true, sent, count: exchanges?.length ?? 0 });
}
