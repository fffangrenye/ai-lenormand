import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lenormand",
  description: "Mobile-first Lenormand reading prototype"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
