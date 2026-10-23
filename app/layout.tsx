import type { Metadata } from "next";
import { Noto_Serif_SC } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import { RecoveryRedirector } from "@/components/RecoveryRedirector";
import { getPublicSiteUrl } from "@/lib/site-config";
import "./globals.css";

const siteUrl = getPublicSiteUrl();
const siteTitle = "花语雷诺曼 · Flora Lenormand · 深度占卜";
const siteDescription = "每日运势 · 是与否 · 深度占卜";
const ogImageUrl = `${siteUrl}/og-flora-v3-20261022.jpg`;

const titleSerif = Noto_Serif_SC({
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-title-serif"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s · Flora Lenormand"
  },
  description: siteDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "Flora Lenormand",
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: ogImageUrl,
        secureUrl: ogImageUrl,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Flora Lenormand 花语雷诺曼"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImageUrl]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={titleSerif.variable}>
        {process.env.PAID_LOCAL_MODE !== "1" && <RecoveryRedirector />}
        {children}
        {process.env.PAID_LOCAL_MODE === "1" && <div className="pointer-events-none fixed inset-x-0 bottom-1 z-[100] text-center text-[10px] text-ink/40">雷诺曼 V3 · 支付为模拟 · {process.env.PAID_LOCAL_MODEL === "deepseek" ? "真实 AI · 记录仅存本机" : "本地模拟预览"} · 未部署</div>}
        {process.env.PAID_LOCAL_MODE !== "1" && <CookieConsent />}
      </body>
    </html>
  );
}
