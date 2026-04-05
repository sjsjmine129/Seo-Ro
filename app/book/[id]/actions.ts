"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

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
