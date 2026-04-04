import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let subscription: { endpoint: string; keys: { auth: string; p256dh: string } };
	try {
		subscription = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { endpoint, keys } = subscription;
	if (!endpoint || !keys?.auth || !keys?.p256dh) {
		return NextResponse.json(
			{ error: "Missing endpoint, keys.auth, or keys.p256dh" },
			{ status: 400 },
		);
	}

	const { error } = await supabase.from("push_subscriptions").upsert(
		{
			user_id: user.id,
			endpoint,
			auth: keys.auth,
			p256dh: keys.p256dh,
		},
		{ onConflict: "user_id,endpoint" },
	);

	if (error) {
		console.error("[push/subscribe]", error.message);
		return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
	}

	return NextResponse.json({ ok: true });
}
