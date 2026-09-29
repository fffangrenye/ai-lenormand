"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { completePasswordReset } from "@/lib/project-store";

type RecoverySession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type RecoveryProof =
  | {
      kind: "session";
      session: RecoverySession;
    }
  | {
      kind: "token_hash";
      tokenHash: string;
    };

function readRecoverySessionFromLocation() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const params = hashParams.size ? hashParams : searchParams;
  const accessToken = params.get("access_token") || "";
  const refreshToken = params.get("refresh_token") || "";
  const expiresIn = Number(params.get("expires_in") || 3600);
  const tokenHash = searchParams.get("token_hash") || params.get("token_hash") || "";
  const type = searchParams.get("type") || params.get("type") || "";
  const errorDescription = params.get("error_description") || params.get("error");

  return {
    errorDescription,
    proof: tokenHash && (!type || type === "recovery")
      ? ({
          kind: "token_hash",
          tokenHash
        } satisfies RecoveryProof)
      : accessToken
        ? ({
            kind: "session",
            session: {
              accessToken,
              refreshToken,
              expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600
            }
          } satisfies RecoveryProof)
      : null
  };
}

function getFriendlyUpdateError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage.toLowerCase();
  if (message.includes("expired") || message.includes("invalid") || rawMessage.includes("失效")) {
    return "重置链接已失效，请重新申请。";
  }
  if (message.includes("rate") || message.includes("limit") || message.includes("频繁")) {
    return "请求过于频繁，请稍后再试。";
  }
  if (message.includes("weak") || message.includes("password") || rawMessage.includes("密码")) {
    return rawMessage || "新密码不符合要求，请换一个更强的密码。";
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("abort")) {
    return "网络暂时不稳定，请稍后再试。";
  }
  return rawMessage || "密码更新失败，请稍后再试。";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [recoveryProof, setRecoveryProof] = useState<RecoveryProof | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkedLink, setCheckedLink] = useState(false);

  useEffect(() => {
    const { errorDescription, proof } = readRecoverySessionFromLocation();

    if (proof) {
      setRecoveryProof(proof);
      setMessage("邮件链接已验证，请设置一个新密码。");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (errorDescription) {
      setError("重置链接已失效，请重新申请。");
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      setError("重置链接无效或已过期，请重新申请密码重置。");
    }

    setCheckedLink(true);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!recoveryProof) {
      setError("重置链接无效或已过期，请重新申请密码重置。");
      return;
    }

    if (newPassword.length < 8) {
      setError("新密码至少需要 8 位。");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    trackAnalyticsEvent("password_reset_submitted");

    try {
      await completePasswordReset(
        recoveryProof.kind === "token_hash"
          ? {
              tokenHash: recoveryProof.tokenHash,
              password: newPassword
            }
          : {
              accessToken: recoveryProof.session.accessToken,
              refreshToken: recoveryProof.session.refreshToken,
              expiresIn: recoveryProof.session.expiresIn,
              password: newPassword
            }
      );
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryProof(null);
      setMessage("密码已更新。正在返回登录页。");
      window.setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (resetError) {
      setError(getFriendlyUpdateError(resetError));
    } finally {
      setSubmitting(false);
    }
  }

  const canReset = Boolean(recoveryProof);

  return (
    <main className="min-h-dvh bg-paper px-5 py-5 text-ink">
      <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col">
        <Link href="/forgot-password" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/70 shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="sr-only">重新申请密码重置</span>
        </Link>

        <div className="flex flex-1 items-center">
          <form onSubmit={handleSubmit} className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/86 p-6 shadow-paper">
            <p className="text-[12px] uppercase tracking-[0.2em] text-clay/70">Flora Lenormand</p>
            <h1 className="mt-4 font-serif text-[32px] leading-[1.05] text-ink">设置新密码</h1>
            <p className="mt-4 text-[14px] leading-6 text-ink/58">
              {canReset ? "请输入新密码。更新成功后，你可以用新密码重新登录。" : "只有从最新重置邮件进入这里，才可以设置新密码。"}
            </p>

            {checkedLink && canReset ? (
              <>
                <label className="mt-8 block text-[13px] text-ink/62" htmlFor="new-password">
                  新密码
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  minLength={8}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="至少 8 位"
                  className="mt-2 h-12 w-full rounded-[4px] border border-ink/12 bg-white/70 px-4 text-[15px] outline-none transition focus:border-ink/35"
                />

                <label className="mt-5 block text-[13px] text-ink/62" htmlFor="confirm-password">
                  确认新密码
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  minLength={8}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                  }}
                  placeholder="再输入一次新密码"
                  className="mt-2 h-12 w-full rounded-[4px] border border-ink/12 bg-white/70 px-4 text-[15px] outline-none transition focus:border-ink/35"
                />
              </>
            ) : null}

            {error ? <p className="mt-3 text-[13px] text-[#8E4D4A]">{error}</p> : null}
            {message ? <p className="mt-3 text-[13px] leading-5 text-ink/52">{message}</p> : null}

            {canReset ? (
              <button
                type="submit"
                disabled={submitting}
                className="mt-7 h-12 w-full rounded-full bg-[#6E2638] px-5 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft transition active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? "更新中" : "更新密码"}
              </button>
            ) : null}

            <Link
              href={canReset ? "/login" : "/forgot-password"}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-full border border-ink/12 px-5 text-[13px] uppercase tracking-[0.12em] text-ink/56 transition active:scale-[0.99]"
            >
              {canReset ? "返回登录" : "重新发送重置邮件"}
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
