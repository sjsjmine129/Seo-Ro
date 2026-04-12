import type { createClient } from "@/utils/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type ChatListParticipant = {
	id: string;
	nickname: string | null;
	profile_image: string | null;
};

export type ChatListItem = {
	roomId: string;
	otherUser: ChatListParticipant;
	postBookThumbnail: string | null;
	preview: string;
	/** ISO timestamp for sorting / relative label (latest message or room activity) */
	sortTime: string;
};

type RoomRow = {
	id: string;
	created_at: string;
	updated_at: string;
	initiator_id: string;
	receiver_id: string;
	left_by_user_ids?: string[] | null;
	post_book: { thumbnail_url: string | null } | null;
	initiator: ChatListParticipant | null;
	receiver: ChatListParticipant | null;
};

type LatestMsg = {
	room_id: string;
	message_type: string;
	content: string;
	created_at: string;
};

export function messagePreviewForList(messageType: string, content: string): string {
	if (messageType === "TEXT") {
		const t = content.trim();
		return t || "(메시지 없음)";
	}
	if (messageType === "SYSTEM_APPOINTMENT") {
		return "약속 시간이 제안되었습니다";
	}
	if (messageType === "SYSTEM_BOOK_CHANGE") {
		return "교환할 책이 변경되었습니다";
	}
	return "새로운 안내가 있습니다";
}

export function formatChatListTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";

	const now = new Date();
	const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const diffDays = Math.round(
		(startToday.getTime() - startMsg.getTime()) / 86400000,
	);

	if (diffDays === 0) {
		return d.toLocaleTimeString("ko-KR", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	}
	if (diffDays === 1) return "어제";
	return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

async function fetchLatestMessagePerRoom(
	supabase: SupabaseServer,
	roomIds: string[],
): Promise<Map<string, LatestMsg>> {
	const map = new Map<string, LatestMsg>();
	if (roomIds.length === 0) return map;

	const rows = await Promise.all(
		roomIds.map(async (roomId) => {
			const { data } = await supabase
				.from("messages")
				.select("room_id, message_type, content, created_at")
				.eq("room_id", roomId)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();
			return data as LatestMsg | null;
		}),
	);

	for (const row of rows) {
		if (row?.room_id) map.set(row.room_id, row);
	}
	return map;
}

/**
 * Lists chat rooms for the current user. Rooms with no messages still appear:
 * preview/time fall back to placeholders and `chat_rooms` timestamps.
 */
export async function loadChatListItems(
	supabase: SupabaseServer,
	userId: string,
): Promise<ChatListItem[]> {
	const { data: rooms, error } = await supabase
		.from("chat_rooms")
		.select(
			`
			id,
			created_at,
			updated_at,
			initiator_id,
			receiver_id,
			left_by_user_ids,
			post_book:books!post_book_id(thumbnail_url),
			initiator:users!initiator_id(id, nickname, profile_image),
			receiver:users!receiver_id(id, nickname, profile_image)
		`,
		)
		.or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`);

	if (error || !rooms?.length) return [];

	const roomRows = (rooms as unknown as RoomRow[]).filter(
		(r) => !(r.left_by_user_ids ?? []).includes(userId),
	);
	if (!roomRows.length) return [];
	const roomIds = roomRows.map((r) => r.id);
	const latestByRoom = await fetchLatestMessagePerRoom(supabase, roomIds);

	const items: ChatListItem[] = roomRows.map((room) => {
		const isInitiator = room.initiator_id === userId;
		const rawOther = isInitiator ? room.receiver : room.initiator;
		const otherUser: ChatListParticipant = {
			id: rawOther?.id ?? (isInitiator ? room.receiver_id : room.initiator_id),
			nickname: rawOther?.nickname ?? null,
			profile_image: rawOther?.profile_image ?? null,
		};

		const latest = latestByRoom.get(room.id);
		const preview = latest
			? messagePreviewForList(latest.message_type, latest.content)
			: "";
		const sortTime = latest?.created_at ?? room.updated_at ?? room.created_at;

		return {
			roomId: room.id,
			otherUser,
			postBookThumbnail: room.post_book?.thumbnail_url ?? null,
			preview: preview || "아직 메시지가 없어요",
			sortTime,
		};
	});

	const timeRank = (iso: string) => {
		const t = new Date(iso).getTime();
		return Number.isNaN(t) ? 0 : t;
	};

	items.sort((a, b) => timeRank(b.sortTime) - timeRank(a.sortTime));

	return items;
}
