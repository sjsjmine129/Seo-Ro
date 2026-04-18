/** Max rows in `user_interested_libraries` per user (관심 도서관). */
export const MAX_FAVORITE_LIBRARIES = 8;

/** Per-book reservation for hybrid chat / 약속 (separate from lifecycle `book_status`). */
export type BookTradeStatus = "AVAILABLE" | "TRADING" | "COMPLETED";

/** Sort key: lower = earlier in listings (AVAILABLE first). */
export function bookTradeStatusRank(s: string | null | undefined): number {
	if (!s || s === "AVAILABLE") return 0;
	if (s === "COMPLETED") return 1;
	return 2;
}
