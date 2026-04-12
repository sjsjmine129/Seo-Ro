/**
 * Hybrid chat (book exchange) — mirrors `chat_rooms` / `messages` in Supabase.
 * JSON payloads in `content` for system messages: validate at send/parse at read.
 */

export const CHAT_ROOM_STATUSES = [
	"NEGOTIATING",
	"APPOINTMENT_SET",
	"COMPLETED",
] as const;

export type ChatRoomStatus = (typeof CHAT_ROOM_STATUSES)[number];

export const CHAT_MESSAGE_TYPES = [
	"TEXT",
	"SYSTEM_BOOK_CHANGE",
	"SYSTEM_APPOINTMENT",
] as const;

export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

/** Row shape for `public.chat_rooms` */
export interface ChatRoomRow {
	id: string;
	post_book_id: string;
	initiator_id: string;
	receiver_id: string;
	initiator_offer_book_id: string | null;
	status: ChatRoomStatus;
	/** Set when a proposed appointment is accepted (ISO timestamptz). */
	appointment_at?: string | null;
	/** Users who hid this room from their list (soft leave). */
	left_by_user_ids?: string[];
	created_at: string;
	updated_at: string;
}

/** Row shape for `public.messages` */
export interface ChatMessageRow {
	id: string;
	room_id: string;
	sender_id: string;
	/** [initiator_id, receiver_id] — denormalized for RLS / Realtime. */
	participant_ids?: string[];
	message_type: ChatMessageType;
	content: string;
	created_at: string;
}

/** Stored in `content` for SYSTEM_BOOK_CHANGE */
export interface SystemBookChangePayload {
	kind: "SYSTEM_BOOK_CHANGE";
	/** Which side of the swap changed (default: initiator's offer book). */
	changeTarget?: "OFFER_BOOK" | "POST_BOOK";
	previousOfferBookId: string | null;
	newOfferBookId: string;
	previousPostBookId?: string | null;
	newPostBookId?: string;
	summary?: string;
}

/** Example payload for SYSTEM_APPOINTMENT */
export interface SystemAppointmentPayload {
	kind: "SYSTEM_APPOINTMENT";
	libraryId: string;
	libraryName?: string;
	meetAt: string;
	summary?: string;
	/** Optional for future accept/decline flows */
	proposedByUserId?: string;
}

/** Meeting hub for this thread: derived from `post_book_id` registration (read-only in UI). */
export interface ChatMeetingLibrary {
	id: string;
	name: string;
}

export type SystemMessagePayload =
	| SystemBookChangePayload
	| SystemAppointmentPayload;

/** UI: participant snapshot (joined from users) */
export interface ChatParticipantPreview {
	id: string;
	nickname: string | null;
	profile_image: string | null;
}

/** UI: book chip in header or cards */
export interface ChatBookPreview {
	id: string;
	title: string;
	thumbnail_url: string | null;
}

/** UI: normalized message for rendering */
export type ChatUiMessage =
	| {
			id: string;
			sender_id: string;
			type: "TEXT";
			text: string;
			created_at: string;
	  }
	| {
			id: string;
			sender_id: string;
			type: "SYSTEM_BOOK_CHANGE";
			payload: SystemBookChangePayload;
			created_at: string;
	  }
	| {
			id: string;
			sender_id: string;
			type: "SYSTEM_APPOINTMENT";
			payload: SystemAppointmentPayload;
			created_at: string;
	  };
