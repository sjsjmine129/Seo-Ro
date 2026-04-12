"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveExchangeForBook } from "@/app/actions/exchange";
import { insertNotification } from "@/app/actions/notifications";

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

/**
 * Opens a hybrid negotiation thread: reuses the newest room for this initiator + post book
 * only when `left_by_user_ids` is still empty; otherwise creates a new room (fresh thread).
 */
export async function createOrGetChatRoom(
	postBookId: string,
	receiverId: string,
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
		.select("id, owner_id, status")
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

	const { data: created, error: insertError } = await supabase
		.from("chat_rooms")
		.insert({
			post_book_id: postBookId,
			initiator_id: user.id,
			receiver_id: receiverId,
			initiator_offer_book_id: null,
		})
		.select("id")
		.single();

	if (insertError || !created) {
		throw new Error(insertError?.message ?? "채팅방을 만들지 못했습니다.");
	}

	const { error: welcomeError } = await supabase.from("messages").insert({
		room_id: created.id,
		sender_id: user.id,
		message_type: "TEXT",
		content: NEW_CHAT_WELCOME_TEXT,
	});

	if (welcomeError) {
		await supabase.from("chat_rooms").delete().eq("id", created.id);
		throw new Error(
			welcomeError.message ?? "시작 메시지를 저장하지 못했습니다.",
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
