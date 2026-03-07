"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function requestExchange(
	requesterBookId: string,
	ownerBookId: string,
	libraryId: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	// Fetch owner_book to get owner_id and validate
	const { data: ownerBook, error: ownerErr } = await supabase
		.from("books")
		.select("owner_id")
		.eq("id", ownerBookId)
		.single();

	if (ownerErr || !ownerBook) {
		throw new Error("책 정보를 찾을 수 없습니다.");
	}

	const ownerId = ownerBook.owner_id;
	if (ownerId === user.id) {
		throw new Error("자신의 책과는 교환할 수 없습니다.");
	}

	// Verify requester owns requesterBookId
	const { data: requesterBook } = await supabase
		.from("books")
		.select("owner_id")
		.eq("id", requesterBookId)
		.single();

	if (!requesterBook || requesterBook.owner_id !== user.id) {
		throw new Error("해당 책에 대한 권한이 없습니다.");
	}

	// Verify both books are in the library
	const { data: blData } = await supabase
		.from("book_libraries")
		.select("book_id")
		.eq("library_id", libraryId)
		.in("book_id", [requesterBookId, ownerBookId]);

	const bookIdsInLib = new Set((blData ?? []).map((r) => r.book_id));
	if (!bookIdsInLib.has(requesterBookId) || !bookIdsInLib.has(ownerBookId)) {
		throw new Error("선택한 도서관에 두 책이 모두 있어야 합니다.");
	}

	// 1. Update both books to SWAPPING
	const { error: update1 } = await supabase
		.from("books")
		.update({ status: "SWAPPING" })
		.eq("id", requesterBookId);

	if (update1) {
		throw new Error(`책 상태 업데이트 실패: ${update1.message}`);
	}

	const { error: update2 } = await supabase
		.from("books")
		.update({ status: "SWAPPING" })
		.eq("id", ownerBookId);

	if (update2) {
		// Rollback first book
		await supabase
			.from("books")
			.update({ status: "AVAILABLE" })
			.eq("id", requesterBookId);
		throw new Error(`책 상태 업데이트 실패: ${update2.message}`);
	}

	// 2. Insert exchange
	const { data: exchange, error: insertErr } = await supabase
		.from("exchanges")
		.insert({
			requester_id: user.id,
			owner_id: ownerId,
			requester_book_id: requesterBookId,
			owner_book_id: ownerBookId,
			library_id: libraryId,
			status: "REQUESTED",
			proposed_times: [],
		})
		.select("id")
		.single();

	if (insertErr) {
		// Rollback books
		await supabase
			.from("books")
			.update({ status: "AVAILABLE" })
			.in("id", [requesterBookId, ownerBookId]);
		throw new Error(`교환 신청 실패: ${insertErr.message}`);
	}

	return { exchangeId: exchange!.id };
}

async function revertBooksAndUpdateExchange(
	supabase: Awaited<ReturnType<typeof createClient>>,
	exchangeId: string,
	newStatus: "CANCELED" | "REJECTED",
) {
	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_book_id, owner_book_id")
		.eq("id", exchangeId)
		.single();

	if (!ex) throw new Error("교환 정보를 찾을 수 없습니다.");

	await supabase
		.from("books")
		.update({ status: "AVAILABLE" })
		.in("id", [ex.requester_book_id, ex.owner_book_id]);

	const { error } = await supabase
		.from("exchanges")
		.update({ status: newStatus })
		.eq("id", exchangeId);

	if (error) throw new Error(`상태 업데이트 실패: ${error.message}`);
}

export async function cancelExchange(exchangeId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.requester_id !== user.id) {
		throw new Error("취소 권한이 없습니다.");
	}
	if (ex.status !== "REQUESTED") {
		throw new Error("이미 처리된 교환입니다.");
	}

	await revertBooksAndUpdateExchange(supabase, exchangeId, "CANCELED");
}

export async function rejectExchange(exchangeId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("owner_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.owner_id !== user.id) {
		throw new Error("거절 권한이 없습니다.");
	}
	if (ex.status !== "REQUESTED") {
		throw new Error("이미 처리된 교환입니다.");
	}

	await revertBooksAndUpdateExchange(supabase, exchangeId, "REJECTED");
}

export async function confirmExchangeTime(
	exchangeId: string,
	selectedTime: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_id, status, proposed_times")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.requester_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}
	if (ex.status !== "TIME_PROPOSED") {
		throw new Error("이미 처리된 교환입니다.");
	}

	const proposed = (ex.proposed_times ?? []) as string[];
	const normalizedSelected = normalizeTimeForCompare(selectedTime);
	const isAllowed = proposed.some((t) => normalizeTimeForCompare(t) === normalizedSelected);
	if (!isAllowed) {
		throw new Error("제안된 시간 중에서 선택해 주세요.");
	}

	const { error } = await supabase
		.from("exchanges")
		.update({
			meet_at: selectedTime,
			status: "SCHEDULED",
		})
		.eq("id", exchangeId);

	if (error) throw new Error(`약속 확정 실패: ${error.message}`);
}

function normalizeTimeForCompare(t: string): string {
	const d = new Date(t);
	const y = d.getFullYear();
	const m = (d.getMonth() + 1).toString().padStart(2, "0");
	const day = d.getDate().toString().padStart(2, "0");
	const h = d.getHours().toString().padStart(2, "0");
	const min = d.getMinutes().toString().padStart(2, "0");
	return `${y}-${m}-${day}T${h}:${min}:00`;
}

export async function cancelExchangeNoMatchingTime(exchangeId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.requester_id !== user.id) {
		throw new Error("취소 권한이 없습니다.");
	}
	if (ex.status !== "TIME_PROPOSED") {
		throw new Error("이미 처리된 교환입니다.");
	}

	await revertBooksAndUpdateExchange(supabase, exchangeId, "CANCELED");
}

export async function proposeTimes(
	exchangeId: string,
	proposedTimes: string[],
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("owner_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.owner_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}
	if (ex.status !== "REQUESTED") {
		throw new Error("이미 처리된 교환입니다.");
	}
	if (!proposedTimes.length) {
		throw new Error("최소 1개 이상의 시간을 선택해 주세요.");
	}

	const { error } = await supabase
		.from("exchanges")
		.update({
			status: "TIME_PROPOSED",
			proposed_times: proposedTimes,
		})
		.eq("id", exchangeId);

	if (error) throw new Error(`시간 제안 실패: ${error.message}`);
}

export async function counterRequestExchange(
	exchangeId: string,
	currentRequesterBookId: string,
	newRequesterBookId: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("owner_id, requester_id, requester_book_id, library_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.owner_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}
	if (ex.status !== "REQUESTED") {
		throw new Error("이미 처리된 교환입니다.");
	}
	if (ex.requester_book_id !== currentRequesterBookId) {
		throw new Error("교환 정보가 변경되었습니다.");
	}
	if (newRequesterBookId === currentRequesterBookId) {
		throw new Error("다른 책을 선택해 주세요.");
	}

	// Verify new book belongs to requester and is in library
	const { data: newBook } = await supabase
		.from("books")
		.select("owner_id")
		.eq("id", newRequesterBookId)
		.single();

	if (!newBook || newBook.owner_id !== ex.requester_id) {
		throw new Error("해당 책에 대한 권한이 없습니다.");
	}

	const { data: bl } = await supabase
		.from("book_libraries")
		.select("book_id")
		.eq("library_id", ex.library_id)
		.eq("book_id", newRequesterBookId)
		.single();

	if (!bl) {
		throw new Error("선택한 책이 이 도서관에 없습니다.");
	}

	// 1. Set old requester book to AVAILABLE
	const { error: err1 } = await supabase
		.from("books")
		.update({ status: "AVAILABLE" })
		.eq("id", currentRequesterBookId);

	if (err1) throw new Error(`책 상태 업데이트 실패: ${err1.message}`);

	// 2. Set new requester book to SWAPPING
	const { error: err2 } = await supabase
		.from("books")
		.update({ status: "SWAPPING" })
		.eq("id", newRequesterBookId);

	if (err2) {
		await supabase
			.from("books")
			.update({ status: "SWAPPING" })
			.eq("id", currentRequesterBookId);
		throw new Error(`책 상태 업데이트 실패: ${err2.message}`);
	}

	// 3. Update exchange
	const { error: err3 } = await supabase
		.from("exchanges")
		.update({
			requester_book_id: newRequesterBookId,
			status: "COUNTER_REQUESTED",
		})
		.eq("id", exchangeId);

	if (err3) {
		await supabase
			.from("books")
			.update({ status: "AVAILABLE" })
			.eq("id", newRequesterBookId);
		await supabase
			.from("books")
			.update({ status: "SWAPPING" })
			.eq("id", currentRequesterBookId);
		throw new Error(`교환 업데이트 실패: ${err3.message}`);
	}
}
export async function respondToCounterRequest(
	exchangeId: string,
	isAccepted: boolean,
	requesterBookId: string,
	ownerBookId: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex || ex.requester_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}
	if (ex.status !== "COUNTER_REQUESTED") {
		throw new Error("이미 처리된 교환입니다.");
	}

	if (isAccepted) {
		const { error } = await supabase
			.from("exchanges")
			.update({ status: "REQUESTED" })
			.eq("id", exchangeId);

		if (error) throw new Error(`상태 업데이트 실패: ${error.message}`);
	} else {
		await supabase
			.from("books")
			.update({ status: "AVAILABLE" })
			.in("id", [requesterBookId, ownerBookId]);

		const { error } = await supabase
			.from("exchanges")
			.update({ status: "CANCELED" })
			.eq("id", exchangeId);

		if (error) throw new Error(`상태 업데이트 실패: ${error.message}`);
	}
}

export async function markExchangeCompleted(
	exchangeId: string,
	role: "requester" | "owner",
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select(
			"requester_id, owner_id, status, requester_completed, owner_completed, requester_book_id, owner_book_id",
		)
		.eq("id", exchangeId)
		.single();

	if (!ex) throw new Error("교환 정보를 찾을 수 없습니다.");
	if (ex.status !== "SCHEDULED") {
		throw new Error("이미 처리된 교환입니다.");
	}
	if (role === "requester" && ex.requester_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}
	if (role === "owner" && ex.owner_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}

	const updateField =
		role === "requester" ? { requester_completed: true } : { owner_completed: true };
	const { error: updateErr } = await supabase
		.from("exchanges")
		.update(updateField)
		.eq("id", exchangeId);

	if (updateErr) throw new Error(`확인 실패: ${updateErr.message}`);

	const { data: updated } = await supabase
		.from("exchanges")
		.select("requester_completed, owner_completed")
		.eq("id", exchangeId)
		.single();

	if (
		updated?.requester_completed === true &&
		updated?.owner_completed === true
	) {
		await supabase
			.from("books")
			.update({ status: "SWAPPED" })
			.in("id", [ex.requester_book_id, ex.owner_book_id]);

		await supabase
			.from("exchanges")
			.update({ status: "COMPLETED" })
			.eq("id", exchangeId);

		await supabase.rpc("increment_bookshelf_score", {
			user_ids: [ex.requester_id, ex.owner_id],
			delta: 2,
		});
	}
}

export async function reportNoShow(
	exchangeId: string,
	requesterBookId: string,
	ownerBookId: string,
) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: ex } = await supabase
		.from("exchanges")
		.select("requester_id, owner_id, status")
		.eq("id", exchangeId)
		.single();

	if (!ex) throw new Error("교환 정보를 찾을 수 없습니다.");
	if (ex.status !== "SCHEDULED") {
		throw new Error("이미 처리된 교환입니다.");
	}
	if (ex.requester_id !== user.id && ex.owner_id !== user.id) {
		throw new Error("권한이 없습니다.");
	}

	await supabase
		.from("books")
		.update({ status: "AVAILABLE" })
		.in("id", [requesterBookId, ownerBookId]);

	const { error } = await supabase
		.from("exchanges")
		.update({ status: "CANCELED" })
		.eq("id", exchangeId);

	if (error) throw new Error(`취소 실패: ${error.message}`);
}

export async function getRequesterAvailableBooksInLibrary(
	requesterId: string,
	libraryId: string,
	excludeBookId: string,
): Promise<BookForSwap[]> {
	const supabase = await createClient();

	const { data: books, error } = await supabase
		.from("books")
		.select(
			`
			id, title, thumbnail_url,
			book_libraries!inner(library_id)
		`,
		)
		.eq("owner_id", requesterId)
		.eq("status", "AVAILABLE")
		.eq("book_libraries.library_id", libraryId)
		.neq("id", excludeBookId);

	if (error) return [];

	const seen = new Set<string>();
	return (books ?? []).filter((b) => {
		if (seen.has(b.id)) return false;
		seen.add(b.id);
		return true;
	}) as BookForSwap[];
}

export async function getActiveExchangeForBook(
	bookId: string,
	userId: string,
): Promise<{ id: string } | null> {
	const supabase = await createClient();

	const { data } = await supabase
		.from("exchanges")
		.select("id")
		.or(`requester_book_id.eq.${bookId},owner_book_id.eq.${bookId}`)
		.in("status", [
			"REQUESTED",
			"ACCEPTED",
			"SCHEDULED",
			"TIME_PROPOSED",
			"COUNTER_REQUESTED",
		])
		.or(`requester_id.eq.${userId},owner_id.eq.${userId}`)
		.limit(1)
		.maybeSingle();

	return data;
}

export type BookForSwap = { id: string; title: string; thumbnail_url: string | null };

export async function getUserAvailableBooksInLibrary(
	libraryId: string,
): Promise<BookForSwap[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return [];

	const { data: books, error } = await supabase
		.from("books")
		.select(
			`
			id, title, thumbnail_url,
			book_libraries!inner(library_id)
		`,
		)
		.eq("owner_id", user.id)
		.eq("status", "AVAILABLE")
		.eq("book_libraries.library_id", libraryId);

	if (error) return [];

	const seen = new Set<string>();
	return (books ?? []).filter((b) => {
		if (seen.has(b.id)) return false;
		seen.add(b.id);
		return true;
	}) as BookForSwap[];
}
