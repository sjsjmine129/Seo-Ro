import type { createClient } from "@/utils/supabase/server";
import type {
	ChatBookPreview,
	ChatMeetingLibrary,
	ChatParticipantPreview,
	ChatRoomStatus,
	ChatMessageRow,
} from "@/lib/types/chat";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type RoomQueryRow = {
	id: string;
	status: ChatRoomStatus;
	post_book_id: string;
	initiator_id: string;
	receiver_id: string;
	left_by_user_ids?: string[] | null;
	initiator_offer_book_id: string | null;
	appointment_at?: string | null;
	post_book: {
		id: string;
		title: string;
		thumbnail_url: string | null;
	} | null;
	offer_book: {
		id: string;
		title: string;
		thumbnail_url: string | null;
	} | null;
	initiator: {
		id: string;
		nickname: string | null;
		profile_image: string | null;
	} | null;
	receiver: {
		id: string;
		nickname: string | null;
		profile_image: string | null;
	} | null;
};

export type ChatRoomPagePayload = {
	roomId: string;
	status: ChatRoomStatus;
	appointmentAt: string | null;
	leftByUserIds: string[];
	postBook: ChatBookPreview;
	offerBook: ChatBookPreview | null;
	initiator: ChatParticipantPreview;
	receiver: ChatParticipantPreview;
	meetingLibrary: ChatMeetingLibrary;
	messageRows: ChatMessageRow[];
};

function toParticipant(
	row: RoomQueryRow["initiator"],
	fallbackId: string,
): ChatParticipantPreview {
	return {
		id: row?.id ?? fallbackId,
		nickname: row?.nickname ?? null,
		profile_image: row?.profile_image ?? null,
	};
}

function toBookPreview(
	row: RoomQueryRow["post_book"],
	fallbackId: string,
): ChatBookPreview {
	return {
		id: row?.id ?? fallbackId,
		title: row?.title ?? "(제목 없음)",
		thumbnail_url: row?.thumbnail_url ?? null,
	};
}

export async function loadChatRoomPageData(
	supabase: SupabaseServer,
	roomId: string,
	currentUserId: string,
): Promise<ChatRoomPagePayload | null> {
	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select(
			`
			id,
			status,
			post_book_id,
			initiator_id,
			receiver_id,
			left_by_user_ids,
			initiator_offer_book_id,
			appointment_at,
			post_book:books!post_book_id(id, title, thumbnail_url),
			offer_book:books!initiator_offer_book_id(id, title, thumbnail_url),
			initiator:users!initiator_id(id, nickname, profile_image),
			receiver:users!receiver_id(id, nickname, profile_image)
		`,
		)
		.eq("id", roomId)
		.single();

	if (roomError || !room) return null;

	const r = room as unknown as RoomQueryRow;
	if (r.initiator_id !== currentUserId && r.receiver_id !== currentUserId) {
		return null;
	}

	const { data: libRows, error: libError } = await supabase
		.from("book_libraries")
		.select("library_id, libraries(id, name)")
		.eq("book_id", r.post_book_id);

	if (libError) return null;

	function rowLibrary(
		row: { libraries: unknown },
	): { id: string; name: string } | null {
		const L = row.libraries;
		const one = Array.isArray(L) ? L[0] : L;
		if (
			one &&
			typeof one === "object" &&
			"id" in one &&
			"name" in one &&
			typeof (one as { id: unknown }).id === "string" &&
			typeof (one as { name: unknown }).name === "string"
		) {
			return { id: (one as { id: string }).id, name: (one as { name: string }).name };
		}
		return null;
	}

	const libs =
		(libRows ?? [])
			.map((row) => rowLibrary(row as { libraries: unknown }))
			.filter((x): x is { id: string; name: string } => x !== null) ?? [];

	libs.sort((a, b) => a.name.localeCompare(b.name, "ko"));

	const meetingLibrary: ChatMeetingLibrary =
		libs.length > 0
			? { id: libs[0].id, name: libs[0].name }
			: { id: "", name: "등록된 도서관 없음" };

	const { data: msgRows, error: msgError } = await supabase
		.from("messages")
		.select("id, room_id, sender_id, message_type, content, created_at")
		.eq("room_id", roomId)
		.order("created_at", { ascending: true });

	if (msgError) return null;

	return {
		roomId: r.id,
		status: r.status,
		appointmentAt: r.appointment_at ?? null,
		leftByUserIds: r.left_by_user_ids ?? [],
		postBook: toBookPreview(r.post_book, r.post_book_id),
		offerBook: r.offer_book
			? {
					id: r.offer_book.id,
					title: r.offer_book.title,
					thumbnail_url: r.offer_book.thumbnail_url,
				}
			: null,
		initiator: toParticipant(r.initiator, r.initiator_id),
		receiver: toParticipant(r.receiver, r.receiver_id),
		meetingLibrary,
		messageRows: (msgRows ?? []) as ChatMessageRow[],
	};
}
