import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleTagManager, GoogleAnalytics } from "@next/third-parties/google";
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

export const metadata: Metadata = {
  title: "Seo-Ro | A Station where Books meet People",
  description: "Location-based P2P book exchange at public libraries",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
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
        </div>
      </body>
    </html>
  );
}
