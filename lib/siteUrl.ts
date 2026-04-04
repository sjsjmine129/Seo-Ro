/**
 * Public site origin for Open Graph, Twitter, Kakao link previews, and absolute asset URLs.
 * Kakao scrapers require https:// absolute URLs (never localhost or bare paths).
 */

export const PRODUCTION_SITE_URL = "https://seo-ro.vercel.app" as const;

/**
 * Resolves the canonical site URL. Uses `NEXT_PUBLIC_SITE_URL` when set (e.g. Vercel env),
 * otherwise production default `https://seo-ro.vercel.app`.
 */
export function getPublicSiteUrl(): string {
	const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
	if (!raw) {
		return PRODUCTION_SITE_URL;
	}
	const noTrail = raw.replace(/\/$/, "");
	if (noTrail.startsWith("http://") || noTrail.startsWith("https://")) {
		return noTrail;
	}
	return `https://${noTrail.replace(/^https?:\/\//, "")}`;
}

/**
 * Absolute https URL for a path (e.g. `/og-image.png`) or returns input if already absolute.
 * Use for Kakao `imageUrl`, etc.
 */
export function absolutePublicUrl(pathOrUrl: string): string {
	const p = pathOrUrl.trim();
	if (p.startsWith("http://") || p.startsWith("https://")) {
		return p;
	}
	const base = getPublicSiteUrl().replace(/\/$/, "");
	const path = p.startsWith("/") ? p : `/${p}`;
	return `${base}${path}`;
}
