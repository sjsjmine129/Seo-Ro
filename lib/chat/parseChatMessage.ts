import type {
	ChatMessageRow,
	ChatUiMessage,
	SystemBookChangePayload,
	SystemAppointmentPayload,
} from "@/lib/types/chat";

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function parseBookChangePayload(content: string): SystemBookChangePayload | null {
	try {
		const parsed: unknown = JSON.parse(content);
		if (!isRecord(parsed) || parsed.kind !== "SYSTEM_BOOK_CHANGE") return null;
		if (typeof parsed.newOfferBookId !== "string") return null;
		const prev = parsed.previousOfferBookId;
		return {
			kind: "SYSTEM_BOOK_CHANGE",
			previousOfferBookId: typeof prev === "string" ? prev : null,
			newOfferBookId: parsed.newOfferBookId,
			summary:
				typeof parsed.summary === "string" ? parsed.summary : undefined,
		};
	} catch {
		return null;
	}
}

function parseAppointmentPayload(content: string): SystemAppointmentPayload | null {
	try {
		const parsed: unknown = JSON.parse(content);
		if (!isRecord(parsed) || parsed.kind !== "SYSTEM_APPOINTMENT") return null;
		if (typeof parsed.libraryId !== "string" || typeof parsed.meetAt !== "string")
			return null;
		const proposedBy = parsed.proposedByUserId;
		return {
			kind: "SYSTEM_APPOINTMENT",
			libraryId: parsed.libraryId,
			libraryName:
				typeof parsed.libraryName === "string" ? parsed.libraryName : undefined,
			meetAt: parsed.meetAt,
			summary:
				typeof parsed.summary === "string" ? parsed.summary : undefined,
			proposedByUserId:
				typeof proposedBy === "string" ? proposedBy : undefined,
		};
	} catch {
		return null;
	}
}

/** Maps a DB row to UI message; falls back to a plain text line if JSON is invalid. */
export function rowToUiMessage(row: ChatMessageRow): ChatUiMessage {
	if (row.message_type === "TEXT") {
		return {
			id: row.id,
			sender_id: row.sender_id,
			type: "TEXT",
			text: row.content,
			created_at: row.created_at,
		};
	}

	if (row.message_type === "SYSTEM_BOOK_CHANGE") {
		const payload = parseBookChangePayload(row.content);
		if (payload) {
			return {
				id: row.id,
				sender_id: row.sender_id,
				type: "SYSTEM_BOOK_CHANGE",
				payload,
				created_at: row.created_at,
			};
		}
	}

	if (row.message_type === "SYSTEM_APPOINTMENT") {
		const payload = parseAppointmentPayload(row.content);
		if (payload) {
			return {
				id: row.id,
				sender_id: row.sender_id,
				type: "SYSTEM_APPOINTMENT",
				payload,
				created_at: row.created_at,
			};
		}
	}

	return {
		id: row.id,
		sender_id: row.sender_id,
		type: "TEXT",
		text: "이 내용을 표시할 수 없습니다.",
		created_at: row.created_at,
	};
}
