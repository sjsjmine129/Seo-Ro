import { redirect } from "next/navigation";

/**
 * Canonical registration flow lives at `/shelve`. This route supports
 * `?libraryId=` deep links (e.g. from chat → 새 책 등록).
 */
export default async function BookNewRedirectPage({
	searchParams,
}: {
	searchParams: Promise<{ libraryId?: string }>;
}) {
	const { libraryId } = await searchParams;
	const q = libraryId
		? `?libraryId=${encodeURIComponent(libraryId)}`
		: "";
	redirect(`/shelve${q}`);
}
