import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { loadChatRoomPageData } from "@/lib/chat/loadChatRoomPageData";
import { rowToUiMessage } from "@/lib/chat/parseChatMessage";
import ChatRoomClient from "./ChatRoomClient";

export default async function ChatRoomPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const bundle = await loadChatRoomPageData(supabase, id, user.id);
	if (!bundle) {
		notFound();
	}

	const initialMessages = bundle.messageRows.map(rowToUiMessage);

	return (
		<ChatRoomClient
			roomId={bundle.roomId}
			currentUserId={user.id}
			isInitiator={user.id === bundle.initiator.id}
			initiator={bundle.initiator}
			receiver={bundle.receiver}
			postBook={bundle.postBook}
			initialOfferBook={bundle.offerBook}
			meetingLibrary={bundle.meetingLibrary}
			initialMessages={initialMessages}
			initialRoomStatus={bundle.status}
			initialLeftByUserIds={bundle.leftByUserIds}
			initialAppointmentAt={bundle.appointmentAt}
		/>
	);
}
