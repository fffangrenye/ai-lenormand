"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RecoveryRedirector() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (!hash && !search) return;

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(search);
    const isRecoveryLink = Boolean(hashParams.get("access_token"));
    const isRecoveryTokenHash = Boolean(searchParams.get("token_hash")) && (!searchParams.get("type") || searchParams.get("type") === "recovery");
    const hasRecoveryError = Boolean(hashParams.get("error") || hashParams.get("error_description") || searchParams.get("error") || searchParams.get("error_description"));
    if ((!isRecoveryLink && !isRecoveryTokenHash && !hasRecoveryError) || pathname === "/reset-password") return;

    window.location.replace(`/reset-password${search}${hash}`);
  }, [pathname]);

  return null;
}
