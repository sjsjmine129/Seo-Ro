import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";
import { absolutePublicUrl, getPublicSiteUrl } from "@/lib/siteUrl";
import InstallPrompt from "@/components/InstallPrompt";
import "./globals.css";

// Favicon: after changing app/icon.png or app/apple-icon.png, restart the dev server
// (`next dev`) and hard-refresh or clear the browser cache so the tab icon updates reliably.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Canonical origin for metadataBase, og:url, and resolved OG image URLs (default: seo-ro.vercel.app). */
const siteUrl = getPublicSiteUrl();
const metadataBase = new URL(siteUrl);
const ogImageUrl = absolutePublicUrl("/og-image.png");

export const metadata: Metadata = {
  metadataBase,
  title: "서로(Seo-Ro) - 우리 동네 도서관 책 교환 커뮤니티",
  description:
    "다 읽은 책, 동네 도서관에서 이웃과 교환해보세요. 서로 책을 나누며 연결되는 따뜻한 경험!",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "서로(Seo-Ro) - 우리 동네 도서관 책 교환 커뮤니티",
    description: "다 읽은 책, 동네 도서관에서 이웃과 교환해보세요!",
    url: siteUrl,
    siteName: "서로(Seo-Ro)",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "서로(Seo-Ro) 서비스 썸네일",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "서로(Seo-Ro) - 우리 동네 책 교환",
    description: "동네 도서관에서 이웃과 책을 교환해보세요!",
    images: [ogImageUrl],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <GoogleTagManager gtmId="GTM-PCBFQ55L" />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
        {/* Mobile-first PWA: max-width on desktop, centered, safe-area aware */}
        <div className="mx-auto min-h-screen w-full max-w-lg bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
          {children}
          <InstallPrompt />
        </div>
      </body>
    </html>
  );
}
