/** Formats exchange `meet_at` for Korean email copy (Asia/Seoul). */
export function formatMeetAtForEmail(iso: string | null): string {
	if (!iso) return "(시간 미정)";
	try {
		return new Intl.DateTimeFormat("ko-KR", {
			dateStyle: "full",
			timeStyle: "short",
			timeZone: "Asia/Seoul",
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}
