"use server";

import { createClient } from "@/utils/supabase/server";
import { getUnreadCount } from "@/app/actions/notifications";
import { hasAnyUnreadChatRoom } from "@/lib/chat/loadChatList";

export type UnreadSummary = {
	notificationUnread: number;
	chatUnread: boolean;
};

export async function getUnreadSummary(): Promise<UnreadSummary> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return { notificationUnread: 0, chatUnread: false };
	}

	const notificationUnread = await getUnreadCount();
	const chatUnread = await hasAnyUnreadChatRoom(supabase, user.id);

	return { notificationUnread, chatUnread };
}
