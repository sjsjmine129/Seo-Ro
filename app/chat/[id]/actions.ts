"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { insertNotification } from "@/app/actions/notifications";
import type {
	ChatBookPreview,
	SystemBookChangePayload,
	SystemAppointmentPayload,
	ChatMessageRow,
	ChatRoomStatus,
} from "@/lib/types/chat";
import {
	APPOINTMENT_ACCEPT_TEXT,
	APPOINTMENT_DECLINE_TEXT,
	LEAVE_CHAT_TEXT,
} from "@/lib/chat/chatRoomMessages";

export async function getInitiatorOfferBookCandidates(
	roomId: string,
): Promise<ChatBookPreview[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select("initiator_id, post_book_id, status")
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.status === "COMPLETED") {
		throw new Error("종료된 채팅방입니다.");
	}
	if (room.initiator_id !== user.id) {
		throw new Error("제안 책 변경은 대화를 시작한 분만 할 수 있습니다.");
	}

	const { data: postLibs, error: libError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", room.post_book_id);

	if (libError || !postLibs?.length) {
		throw new Error("요청 도서의 도서관 정보를 찾을 수 없습니다.");
	}

	const libIds = postLibs.map((l) => l.library_id);

	const { data: books, error: blError } = await supabase
		.from("books")
		.select(
			`
			id, title, thumbnail_url,
			book_libraries!inner(library_id)
		`,
		)
		.eq("owner_id", user.id)
		.eq("status", "AVAILABLE")
		.in("book_libraries.library_id", libIds);

	if (blError) throw new Error(blError.message);

	const seen = new Set<string>();
	const out: ChatBookPreview[] = [];

	for (const b of books ?? []) {
		if (seen.has(b.id)) continue;
		seen.add(b.id);
		out.push({
			id: b.id,
			title: b.title,
			thumbnail_url: b.thumbnail_url,
		});
	}

	out.sort((a, b) => a.title.localeCompare(b.title, "ko"));
	return out;
}

export type ChangeOfferBookResult = {
	offerBook: ChatBookPreview;
	messageRow: ChatMessageRow;
};

export async function changeInitiatorOfferBook(
	roomId: string,
	newOfferBookId: string,
): Promise<ChangeOfferBookResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select(
			"initiator_id, post_book_id, initiator_offer_book_id, receiver_id, status",
		)
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.status === "COMPLETED") {
		throw new Error("종료된 채팅방입니다.");
	}
	if (room.initiator_id !== user.id) {
		throw new Error("제안 책 변경은 대화를 시작한 분만 할 수 있습니다.");
	}

	const { data: postLibs, error: plError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", room.post_book_id);

	if (plError || !postLibs?.length) {
		throw new Error("요청 도서의 도서관 정보를 찾을 수 없습니다.");
	}

	const libIds = new Set(postLibs.map((l) => l.library_id));

	const { data: newBook, error: bookError } = await supabase
		.from("books")
		.select("id, title, thumbnail_url, owner_id, status")
		.eq("id", newOfferBookId)
		.single();

	if (bookError || !newBook) throw new Error("선택한 책을 찾을 수 없습니다.");
	if (newBook.owner_id !== user.id || newBook.status !== "AVAILABLE") {
		throw new Error("선택한 책으로 제안할 수 없습니다.");
	}

	const { data: offerLibs, error: olError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", newOfferBookId);

	if (olError || !offerLibs?.length) {
		throw new Error("선택한 책의 도서관 정보가 없습니다.");
	}

	const sharesHub = offerLibs.some((l) => libIds.has(l.library_id));
	if (!sharesHub) {
		throw new Error("요청 도서와 같은 도서관에 등록된 책만 제안할 수 있습니다.");
	}

	const { error: updError } = await supabase
		.from("chat_rooms")
		.update({ initiator_offer_book_id: newOfferBookId })
		.eq("id", roomId);

	if (updError) throw new Error(updError.message);

	const payload: SystemBookChangePayload = {
		kind: "SYSTEM_BOOK_CHANGE",
		previousOfferBookId: room.initiator_offer_book_id,
		newOfferBookId,
		summary: `제안 도서를 「${newBook.title}」(으)로 변경했습니다.`,
	};

	const { data: inserted, error: insError } = await supabase
		.from("messages")
		.insert({
			room_id: roomId,
			sender_id: user.id,
			message_type: "SYSTEM_BOOK_CHANGE",
			content: JSON.stringify(payload),
		})
		.select("id, room_id, sender_id, message_type, content, created_at")
		.single();

	if (insError || !inserted) throw new Error(insError?.message ?? "메시지 저장 실패");

	await insertNotification(
		room.receiver_id,
		"SYSTEM",
		"바꿔읽기",
		"상대방이 교환할 책을 변경했습니다.",
		`/chat/${roomId}`,
	);

	return {
		offerBook: {
			id: newBook.id,
			title: newBook.title,
			thumbnail_url: newBook.thumbnail_url,
		},
		messageRow: inserted as ChatMessageRow,
	};
}

export type ProposeAppointmentResult = {
	messageRow: ChatMessageRow;
};

export async function proposeAppointmentTime(
	roomId: string,
	meetAtIso: string,
): Promise<ProposeAppointmentResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const t = Date.parse(meetAtIso);
	if (Number.isNaN(t)) throw new Error("유효한 날짜·시간을 선택해 주세요.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select("post_book_id, initiator_id, receiver_id, status")
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.initiator_id !== user.id && room.receiver_id !== user.id) {
		throw new Error("이 채팅방에 참여 중이 아닙니다.");
	}
	if (room.status === "COMPLETED") {
		throw new Error("종료된 채팅방에서는 약속을 제안할 수 없습니다.");
	}

	const { data: libRows, error: libError } = await supabase
		.from("book_libraries")
		.select("libraries(id, name)")
		.eq("book_id", room.post_book_id);

	if (libError) throw new Error(libError.message);

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
			.map((r) => rowLibrary(r as { libraries: unknown }))
			.filter((x): x is { id: string; name: string } => x !== null) ?? [];

	libs.sort((a, b) => a.name.localeCompare(b.name, "ko"));
	const hub = libs[0] ?? { id: "", name: "등록된 도서관 없음" };

	const when = new Date(meetAtIso);
	const summary = `만남 제안: ${when.toLocaleString("ko-KR", {
		dateStyle: "medium",
		timeStyle: "short",
	})}`;

	const payload: SystemAppointmentPayload = {
		kind: "SYSTEM_APPOINTMENT",
		libraryId: hub.id,
		libraryName: hub.name,
		meetAt: new Date(t).toISOString(),
		summary,
		proposedByUserId: user.id,
	};

	const { data: inserted, error: insError } = await supabase
		.from("messages")
		.insert({
			room_id: roomId,
			sender_id: user.id,
			message_type: "SYSTEM_APPOINTMENT",
			content: JSON.stringify(payload),
		})
		.select("id, room_id, sender_id, message_type, content, created_at")
		.single();

	if (insError || !inserted) throw new Error(insError?.message ?? "메시지 저장 실패");

	const peerId =
		room.initiator_id === user.id ? room.receiver_id : room.initiator_id;
	await insertNotification(
		peerId,
		"SYSTEM",
		"바꿔읽기",
		"새로운 약속 시간이 제안되었습니다.",
		`/chat/${roomId}`,
	);

	return { messageRow: inserted as ChatMessageRow };
}

function parseAppointmentPayloadFromRow(content: string): SystemAppointmentPayload | null {
	try {
		const parsed: unknown = JSON.parse(content);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			(parsed as { kind?: string }).kind === "SYSTEM_APPOINTMENT"
		) {
			return parsed as SystemAppointmentPayload;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export type AppointmentResponseResult = {
	messageRow: ChatMessageRow;
	nextRoomStatus: ChatRoomStatus;
};

export async function acceptAppointment(
	roomId: string,
	messageId: string,
): Promise<AppointmentResponseResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select("initiator_id, receiver_id, status")
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.initiator_id !== user.id && room.receiver_id !== user.id) {
		throw new Error("이 채팅방에 참여 중이 아닙니다.");
	}
	if (room.status !== "NEGOTIATING") {
		throw new Error("이미 약속이 정해졌거나 대화가 종료되었습니다.");
	}

	const { data: msg, error: msgError } = await supabase
		.from("messages")
		.select("id, room_id, sender_id, message_type, content, created_at")
		.eq("id", messageId)
		.eq("room_id", roomId)
		.single();

	if (msgError || !msg || msg.message_type !== "SYSTEM_APPOINTMENT") {
		throw new Error("약속 메시지를 찾을 수 없습니다.");
	}

	const payload = parseAppointmentPayloadFromRow(msg.content);
	if (!payload) throw new Error("약속 정보를 읽을 수 없습니다.");

	const proposerId = payload.proposedByUserId ?? msg.sender_id;
	if (proposerId === user.id) {
		throw new Error("본인이 제안한 약속은 직접 수락할 수 없습니다.");
	}

	const { data: updatedRoom, error: updError } = await supabase
		.from("chat_rooms")
		.update({ status: "APPOINTMENT_SET" })
		.eq("id", roomId)
		.eq("status", "NEGOTIATING")
		.select("id")
		.maybeSingle();

	if (updError) throw new Error(updError.message);
	if (!updatedRoom) {
		throw new Error("이미 처리되었거나 약속을 수락할 수 없는 상태입니다.");
	}

	const { data: reply, error: repError } = await supabase
		.from("messages")
		.insert({
			room_id: roomId,
			sender_id: user.id,
			message_type: "TEXT",
			content: APPOINTMENT_ACCEPT_TEXT,
		})
		.select("id, room_id, sender_id, message_type, content, created_at")
		.single();

	if (repError || !reply) throw new Error(repError?.message ?? "응답 저장 실패");

	await insertNotification(
		proposerId,
		"SYSTEM",
		"바꿔읽기",
		"상대방이 제안한 약속 시간을 수락했습니다.",
		`/chat/${roomId}`,
	);

	return {
		messageRow: reply as ChatMessageRow,
		nextRoomStatus: "APPOINTMENT_SET",
	};
}

export async function declineAppointment(
	roomId: string,
	messageId: string,
): Promise<AppointmentResponseResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select("initiator_id, receiver_id, status")
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.initiator_id !== user.id && room.receiver_id !== user.id) {
		throw new Error("이 채팅방에 참여 중이 아닙니다.");
	}
	if (room.status !== "NEGOTIATING") {
		throw new Error("이미 약속이 정해졌거나 대화가 종료되어 거절할 수 없습니다.");
	}

	const { data: msg, error: msgError } = await supabase
		.from("messages")
		.select("id, room_id, sender_id, message_type, content, created_at")
		.eq("id", messageId)
		.eq("room_id", roomId)
		.single();

	if (msgError || !msg || msg.message_type !== "SYSTEM_APPOINTMENT") {
		throw new Error("약속 메시지를 찾을 수 없습니다.");
	}

	const payload = parseAppointmentPayloadFromRow(msg.content);
	if (!payload) throw new Error("약속 정보를 읽을 수 없습니다.");

	const proposerId = payload.proposedByUserId ?? msg.sender_id;
	if (proposerId === user.id) {
		throw new Error("본인이 제안한 약속은 직접 거절할 수 없습니다.");
	}

	const { data: reply, error: repError } = await supabase
		.from("messages")
		.insert({
			room_id: roomId,
			sender_id: user.id,
			message_type: "TEXT",
			content: APPOINTMENT_DECLINE_TEXT,
		})
		.select("id, room_id, sender_id, message_type, content, created_at")
		.single();

	if (repError || !reply) throw new Error(repError?.message ?? "응답 저장 실패");

	await insertNotification(
		proposerId,
		"SYSTEM",
		"바꿔읽기",
		"상대방이 약속 시간 제안을 거절했습니다.",
		`/chat/${roomId}`,
	);

	return {
		messageRow: reply as ChatMessageRow,
		nextRoomStatus: room.status as ChatRoomStatus,
	};
}

export type LeaveChatRoomResult = {
	messageRow: ChatMessageRow | null;
};

export async function leaveChatRoom(roomId: string): Promise<LeaveChatRoomResult> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("로그인이 필요합니다.");

	const { data: room, error: roomError } = await supabase
		.from("chat_rooms")
		.select("initiator_id, receiver_id, status, left_by_user_ids")
		.eq("id", roomId)
		.single();

	if (roomError || !room) throw new Error("채팅방을 찾을 수 없습니다.");
	if (room.initiator_id !== user.id && room.receiver_id !== user.id) {
		throw new Error("이 채팅방에 참여 중이 아닙니다.");
	}

	const prevLeft = (room.left_by_user_ids ?? []) as string[];
	if (prevLeft.includes(user.id)) {
		throw new Error("이미 나간 채팅방입니다.");
	}

	const peerId =
		room.initiator_id === user.id ? room.receiver_id : room.initiator_id;

	const leftByNext = [...new Set([...prevLeft, user.id])];
	const isFirstToLeave = prevLeft.length === 0;

	const updatePayload: {
		left_by_user_ids: string[];
		status?: "COMPLETED";
	} = { left_by_user_ids: leftByNext };

	if (isFirstToLeave) {
		updatePayload.status = "COMPLETED";
	}

	const { error: updError } = await supabase
		.from("chat_rooms")
		.update(updatePayload)
		.eq("id", roomId);

	if (updError) throw new Error(updError.message);

	if (!isFirstToLeave) {
		revalidatePath("/chat");
		return { messageRow: null };
	}

	const { data: inserted, error: insError } = await supabase
		.from("messages")
		.insert({
			room_id: roomId,
			sender_id: user.id,
			message_type: "TEXT",
			content: LEAVE_CHAT_TEXT,
		})
		.select("id, room_id, sender_id, message_type, content, created_at")
		.single();

	if (insError || !inserted) {
		throw new Error(insError?.message ?? "메시지 저장 실패");
	}

	await insertNotification(
		peerId,
		"SYSTEM",
		"바꿔읽기",
		LEAVE_CHAT_TEXT,
		`/chat/${roomId}`,
	);

	revalidatePath("/chat");

	return { messageRow: inserted as ChatMessageRow };
}
