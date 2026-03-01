"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const BUCKET_NAME = "book_images";
const MAX_IMAGE_SIZE_MB = 5;

export type NaverBookItem = {
	title: string;
	link: string;
	image: string;
	author: string;
	publisher: string;
	pubdate: string;
	isbn: string;
	description: string;
};

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/<[^>]*>/g, "");
}

export async function searchNaverBook(query: string): Promise<NaverBookItem[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
	const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		console.error("NAVER_SEARCH_CLIENT_ID or NAVER_SEARCH_CLIENT_SECRET not set");
		return [];
	}

	const url = new URL("https://openapi.naver.com/v1/search/book.json");
	url.searchParams.set("query", trimmed);
	url.searchParams.set("display", "10");

	const res = await fetch(url.toString(), {
		headers: {
			"X-Naver-Client-Id": clientId,
			"X-Naver-Client-Secret": clientSecret,
		},
	});

	if (!res.ok) {
		console.error("Naver Book Search API error:", res.status);
		return [];
	}

	const data = (await res.json()) as { items?: NaverBookItem[] };
	const items = data.items ?? [];
	return items.map((item) => ({
		...item,
		title: decodeHtmlEntities(item.title),
		author: decodeHtmlEntities(item.author),
		publisher: decodeHtmlEntities(item.publisher),
		description: decodeHtmlEntities(item.description ?? ""),
	}));
}

export type LibraryInfo = { id: string; name: string };

export async function getLibraryById(
	libraryId: string,
): Promise<LibraryInfo | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("libraries")
		.select("id, name")
		.eq("id", libraryId)
		.single();

	if (error || !data) return null;
	return { id: data.id, name: data.name };
}

export async function getUserInterestedLibraries(): Promise<LibraryInfo[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from("user_interested_libraries")
		.select("library_id, libraries(id, name)")
		.eq("user_id", user.id);

	if (error) return [];

	return (data ?? []).map((row: { library_id: string; libraries: { id: string; name: string } | null }) => ({
		id: row.library_id,
		name: row.libraries?.name ?? "Unknown",
	}));
}

export async function searchLibraries(query: string): Promise<LibraryInfo[]> {
	const supabase = await createClient();
	const trimmed = query.trim();

	let q = supabase.from("libraries").select("id, name");
	if (trimmed) {
		const pattern = `%${trimmed}%`;
		q = q.or(`name.ilike.${pattern},address.ilike.${pattern}`);
	}
	const { data, error } = await q.limit(20).order("name");
	if (error) return [];

	return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

export type ShelveBookInput = {
	title: string;
	authors: string | null;
	publisher: string | null;
	isbn: string | null;
	thumbnail_url: string | null;
	condition: "S" | "A" | "B" | "C" | "D";
	user_review: string;
};

export async function shelveBook(formData: FormData): Promise<{ bookId: string }> {
	const bookStr = formData.get("book") as string;
	const libraryIdsStr = formData.get("libraryIds") as string;
	if (!bookStr || !libraryIdsStr) {
		throw new Error("필수 데이터가 없습니다.");
	}
	const book = JSON.parse(bookStr) as ShelveBookInput;
	const libraryIds = JSON.parse(libraryIdsStr) as string[];

	const imageFiles: File[] = [];
	let i = 0;
	while (true) {
		const file = formData.get(`image-${i}`) as File | null;
		if (!file || !(file instanceof File)) break;
		imageFiles.push(file);
		i++;
	}

	const supabase = await createClient();
	const bookId = crypto.randomUUID();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	if (imageFiles.length === 0) {
		throw new Error("최소 1장의 사진이 필요합니다.");
	}
	if (libraryIds.length === 0) {
		throw new Error("최소 1개의 도서관을 선택해 주세요.");
	}
	if (!book.user_review?.trim()) {
		throw new Error("한 줄 리뷰를 입력해 주세요.");
	}
	if (book.user_review.length > 100) {
		throw new Error("리뷰는 100자 이하여야 합니다.");
	}

	const uploadedUrls: string[] = [];

	for (let i = 0; i < imageFiles.length; i++) {
		const file = imageFiles[i];
		if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
			throw new Error(`이미지 ${i + 1}이(가) 5MB를 초과합니다.`);
		}
		const ext = file.name.split(".").pop() || "jpg";
		const path = `${user.id}/${bookId}/${i}.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from(BUCKET_NAME)
			.upload(path, file, {
				contentType: file.type,
				upsert: true,
			});

		if (uploadError) {
			console.error("Upload error:", uploadError);
			throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
		}

		const { data: urlData } = supabase.storage
			.from(BUCKET_NAME)
			.getPublicUrl(path);
		uploadedUrls.push(urlData.publicUrl);
	}

	const thumbnailUrl =
		book.thumbnail_url && book.thumbnail_url.trim()
			? book.thumbnail_url
			: uploadedUrls[0];

	const { error: bookError } = await supabase.from("books").insert({
		id: bookId,
		owner_id: user.id,
		isbn: book.isbn || null,
		title: book.title,
		authors: book.authors || null,
		publisher: book.publisher || null,
		thumbnail_url: thumbnailUrl,
		user_images: uploadedUrls,
		user_review: book.user_review.trim(),
		condition: book.condition,
		status: "AVAILABLE",
	});

	if (bookError) {
		console.error("Book insert error:", bookError);
		throw new Error(`책 등록 실패: ${bookError.message}`);
	}

	for (const libId of libraryIds) {
		const { error: blError } = await supabase.from("book_libraries").insert({
			book_id: bookId,
			library_id: libId,
		});
		if (blError) {
			console.error("Book library insert error:", blError);
			throw new Error(`도서관 연결 실패: ${blError.message}`);
		}
	}

	return { bookId };
}
