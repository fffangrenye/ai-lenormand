import type { ReactNode } from "react";
import Link from "@/components/SiteLink";
import { AccountMenu } from "@/components/AccountMenu";

export function FloraHeader({ children }: { children?: ReactNode }) {
  return <header className="flora-header">
    <Link prefetch={false} href="/" className="flora-brand">Flora Lenormand</Link>
    <div className="flex items-center gap-2 sm:gap-3">{children}<AccountMenu /></div>
  </header>;
}
