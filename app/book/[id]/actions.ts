"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

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
