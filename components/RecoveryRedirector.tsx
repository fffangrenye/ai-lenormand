"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RecoveryRedirector() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const isRecoveryLink = hashParams.get("type") === "recovery" && Boolean(hashParams.get("access_token"));
    const hasRecoveryError = Boolean(hashParams.get("error") || hashParams.get("error_description"));
    if ((!isRecoveryLink && !hasRecoveryError) || pathname === "/reset-password") return;

    window.location.replace(`/reset-password${hash}`);
  }, [pathname]);

  return null;
}
