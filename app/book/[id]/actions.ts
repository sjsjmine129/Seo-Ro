"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveExchangeForBook } from "@/app/actions/exchange";
import { insertNotification } from "@/app/actions/notifications";
import type {
	ChatBookPreview,
	SystemBookChangePayload,
} from "@/lib/types/chat";

const NEW_CHAT_WELCOME_TEXT =
	"새로운 바꿔읽기 대화가 시작되었습니다. 반갑게 인사해 보세요! 👋";

const BUCKET_NAME = "book_images";
const MAX_IMAGE_SIZE_MB = 5;

export type UpdateBookMeta = {
	bookId: string;
	condition: "S" | "A" | "B" | "C" | "D";
	user_review: string;
	keepImageUrls: string[];
	libraryIds: string[];
};

export async function updateBook(formData: FormData): Promise<void> {
	const metaStr = formData.get("meta") as string | null;
	if (!metaStr) throw new Error("필수 데이터가 없습니다.");

	const meta = JSON.parse(metaStr) as UpdateBookMeta;
	const { bookId, condition, user_review, keepImageUrls, libraryIds } = meta;

	const imageFiles: File[] = [];
	let i = 0;
	while (true) {
		const file = formData.get(`image-${i}`) as File | null;
		if (!file || !(file instanceof File)) break;
		imageFiles.push(file);
		i++;
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: book, error: fetchError } = await supabase
		.from("books")
		.select("owner_id, status, user_images")
		.eq("id", bookId)
		.single();

	if (fetchError || !book || book.owner_id !== user.id) {
		throw new Error("수정 권한이 없습니다.");
	}
	if (book.status !== "AVAILABLE") {
		throw new Error("교환 가능한 상태의 책만 수정할 수 있습니다.");
	}

	const previousUrls = new Set((book.user_images as string[]) ?? []);
	for (const url of keepImageUrls) {
		if (!previousUrls.has(url)) {
			throw new Error("유효하지 않은 사진이 포함되어 있습니다.");
		}
	}

	if (!user_review?.trim()) {
		throw new Error("한 줄 소개를 입력해 주세요.");
	}
	if (user_review.length > 100) {
		throw new Error("소개글은 100자 이하여야 합니다.");
	}
	if (libraryIds.length === 0) {
		throw new Error("최소 1개의 도서관을 선택해 주세요.");
	}
	if (keepImageUrls.length + imageFiles.length === 0) {
		throw new Error("최소 1장의 사진이 필요합니다.");
	}
	if (keepImageUrls.length + imageFiles.length > 3) {
		throw new Error("사진은 최대 3장까지 등록할 수 있습니다.");
	}

	const uploadedUrls: string[] = [];
	const stamp = Date.now();

	for (let j = 0; j < imageFiles.length; j++) {
		const file = imageFiles[j];
		if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
			throw new Error(`이미지 ${j + 1}이(가) 5MB를 초과합니다.`);
		}
		const ext = file.name.split(".").pop() || "jpg";
		const path = `${user.id}/${bookId}/${stamp}-${j}.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from(BUCKET_NAME)
			.upload(path, file, {
				contentType: file.type,
				upsert: true,
			});

		if (uploadError) {
			throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
		}

		const { data: urlData } = supabase.storage
			.from(BUCKET_NAME)
			.getPublicUrl(path);
		uploadedUrls.push(urlData.publicUrl);
	}

	const finalUserImages = [...keepImageUrls, ...uploadedUrls];

	const { error: updateError } = await supabase
		.from("books")
		.update({
			user_images: finalUserImages,
			user_review: user_review.trim(),
			condition,
		})
		.eq("id", bookId)
		.eq("owner_id", user.id);

	if (updateError) {
		throw new Error(`수정 실패: ${updateError.message}`);
	}

	const { error: delBlError } = await supabase
		.from("book_libraries")
		.delete()
		.eq("book_id", bookId);

	if (delBlError) {
		throw new Error(`도서관 정보 갱신 실패: ${delBlError.message}`);
	}

	for (const libId of libraryIds) {
		const { error: insError } = await supabase.from("book_libraries").insert({
			book_id: bookId,
			library_id: libId,
		});
		if (insError) {
			throw new Error(`도서관 연결 실패: ${insError.message}`);
		}
	}
}

export async function deleteBook(bookId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: book, error: fetchError } = await supabase
		.from("books")
		.select("owner_id")
		.eq("id", bookId)
		.single();

	if (fetchError || !book || book.owner_id !== user.id) {
		throw new Error("삭제 권한이 없습니다.");
	}

	const { error } = await supabase.from("books").delete().eq("id", bookId);

	if (error) {
		throw new Error(`삭제 실패: ${error.message}`);
	}
}

/** Lists current user's AVAILABLE books registered at the same hub(s) as the listed book (for pre-chat offer selection). */
export async function getMyOfferBooksForListing(
	postBookId: string,
): Promise<ChatBookPreview[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: postLibs, error: libError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", postBookId);

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
		.eq("trade_status", "AVAILABLE")
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

/**
 * Opens a hybrid negotiation thread: reuses the newest room for this initiator + post book
 * only when `left_by_user_ids` is still empty; otherwise creates a new room (fresh thread).
 * New rooms require `initiatorOfferBookId` (same-hub AVAILABLE book owned by the initiator).
 * Omitted when resuming an existing open thread (`채팅으로 이어가기`).
 */
export async function createOrGetChatRoom(
	postBookId: string,
	receiverId: string,
	initiatorOfferBookId?: string,
): Promise<string> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	if (user.id === receiverId) {
		throw new Error("본인의 책에는 바꿔읽기를 신청할 수 없습니다.");
	}

	const { data: book, error: bookError } = await supabase
		.from("books")
		.select("id, owner_id, status, trade_status")
		.eq("id", postBookId)
		.single();

	if (bookError || !book) {
		throw new Error("책을 찾을 수 없습니다.");
	}
	if (book.owner_id !== receiverId) {
		throw new Error("도서 정보가 일치하지 않습니다.");
	}
	if (book.owner_id === user.id) {
		throw new Error("본인의 책에는 바꿔읽기를 신청할 수 없습니다.");
	}
	if (book.trade_status === "TRADING") {
		throw new Error(
			"교환 약속이 잡힌 책입니다. 약속이 끝난 뒤에 다시 시도해 주세요.",
		);
	}

	const { data: roomCandidates, error: existingError } = await supabase
		.from("chat_rooms")
		.select("id, left_by_user_ids, created_at")
		.eq("post_book_id", postBookId)
		.eq("initiator_id", user.id)
		.order("created_at", { ascending: false });

	if (existingError) {
		throw new Error(existingError.message);
	}

	const reusable = (roomCandidates ?? []).find(
		(r) => !(r.left_by_user_ids?.length ?? 0),
	);
	if (reusable?.id) {
		return reusable.id;
	}

	const hasLegacyExchange = await getActiveExchangeForBook(postBookId, user.id);
	const canOpenNewNegotiation =
		book.status === "AVAILABLE" || !!hasLegacyExchange;

	if (!canOpenNewNegotiation) {
		throw new Error("지금은 바꿔읽기를 신청할 수 없는 상태입니다.");
	}

	if (!initiatorOfferBookId?.trim()) {
		throw new Error("교환할 책을 먼저 선택해 주세요.");
	}

	const { data: postLibs, error: plError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", postBookId);

	if (plError || !postLibs?.length) {
		throw new Error("요청 도서의 도서관 정보를 찾을 수 없습니다.");
	}

	const libIds = new Set(postLibs.map((l) => l.library_id));

	const { data: offerBook, error: offerErr } = await supabase
		.from("books")
		.select("id, title, thumbnail_url, owner_id, status, trade_status")
		.eq("id", initiatorOfferBookId)
		.single();

	if (offerErr || !offerBook) {
		throw new Error("선택한 책을 찾을 수 없습니다.");
	}
	if (
		offerBook.owner_id !== user.id ||
		offerBook.status !== "AVAILABLE" ||
		offerBook.trade_status === "TRADING"
	) {
		throw new Error("선택한 책으로 바꿔읽기를 제안할 수 없습니다.");
	}

	const { data: offerLibs, error: olError } = await supabase
		.from("book_libraries")
		.select("library_id")
		.eq("book_id", initiatorOfferBookId);

	if (olError || !offerLibs?.length) {
		throw new Error("선택한 책의 도서관 정보가 없습니다.");
	}

	const sharesHub = offerLibs.some((l) => libIds.has(l.library_id));
	if (!sharesHub) {
		throw new Error("요청 도서와 같은 도서관에 등록된 책만 제안할 수 있습니다.");
	}

	const { data: created, error: insertError } = await supabase
		.from("chat_rooms")
		.insert({
			post_book_id: postBookId,
			initiator_id: user.id,
			receiver_id: receiverId,
			initiator_offer_book_id: initiatorOfferBookId,
		})
		.select("id")
		.single();

	if (insertError || !created) {
		throw new Error(insertError?.message ?? "채팅방을 만들지 못했습니다.");
	}

	const participantIds = [user.id, receiverId];

	const { error: welcomeError } = await supabase.from("messages").insert({
		room_id: created.id,
		sender_id: user.id,
		participant_ids: participantIds,
		message_type: "TEXT",
		content: NEW_CHAT_WELCOME_TEXT,
	});

	if (welcomeError) {
		await supabase.from("chat_rooms").delete().eq("id", created.id);
		throw new Error(
			welcomeError.message ?? "시작 메시지를 저장하지 못했습니다.",
		);
	}

	const initialOfferPayload: SystemBookChangePayload = {
		kind: "SYSTEM_BOOK_CHANGE",
		changeTarget: "OFFER_BOOK",
		previousOfferBookId: null,
		newOfferBookId: offerBook.id,
		summary: `교환으로 「${offerBook.title}」을(를) 제안했습니다.`,
	};

	const { error: offerMsgError } = await supabase.from("messages").insert({
		room_id: created.id,
		sender_id: user.id,
		participant_ids: participantIds,
		message_type: "SYSTEM_BOOK_CHANGE",
		content: JSON.stringify(initialOfferPayload),
	});

	if (offerMsgError) {
		await supabase.from("messages").delete().eq("room_id", created.id);
		await supabase.from("chat_rooms").delete().eq("id", created.id);
		throw new Error(
			offerMsgError.message ?? "제안 책 메시지를 저장하지 못했습니다.",
		);
	}

	await insertNotification(
		receiverId,
		"SYSTEM",
		"새로운 대화",
		"회원님의 책에 새로운 바꿔읽기 요청이 도착했습니다.",
		`/chat/${created.id}`,
	);

	revalidatePath("/chat");

	return created.id;
}
