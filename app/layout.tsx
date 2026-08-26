import type { Metadata } from "next";
import { Noto_Serif_SC } from "next/font/google";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const titleSerif = Noto_Serif_SC({
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-title-serif"
});

export const metadata: Metadata = {
  title: "AI Lenormand",
  description: "Mobile-first Lenormand reading prototype"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={titleSerif.variable}>
        <AnalyticsTracker />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
