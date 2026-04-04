import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	return <NotificationsClient />;
}
