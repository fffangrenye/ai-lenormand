"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { requestPasswordResetCode } from "@/lib/project-store";
import { getPasswordResetRedirectUrl } from "@/lib/site-config";

function getFriendlyResetError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate") || message.includes("limit") || message.includes("频繁")) {
    return "请求过于频繁，请稍后再试。";
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("abort")) {
    return "网络暂时不稳定，请稍后再试。";
  }
  return "重置邮件发送失败，请稍后再试。";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resetRedirectUrl = getPasswordResetRedirectUrl(typeof window !== "undefined" ? window.location.origin : undefined);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();

    if (!value) {
      setError("请输入你的注册邮箱。");
      return;
    }

    if (!value.includes("@")) {
      setError("请输入正确的邮箱格式。");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    trackAnalyticsEvent("password_reset_code_requested");

    try {
      await requestPasswordResetCode(value);
      setMessage("如果该邮箱已注册，我们会向它发送密码重置链接，请检查收件箱和垃圾邮件。");
    } catch (resetError) {
      setError(getFriendlyResetError(resetError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-paper px-5 py-5 text-ink">
      <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col">
        <Link href="/login" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/70 shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="sr-only">返回登录</span>
        </Link>

        <div className="flex flex-1 items-center">
          <form onSubmit={handleSubmit} className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/86 p-6 shadow-paper">
            <p className="text-[12px] uppercase tracking-[0.2em] text-clay/70">Flora Lenormand</p>
            <h1 className="mt-4 font-serif text-[32px] leading-[1.05] text-ink">忘记密码</h1>
            <p className="mt-4 text-[14px] leading-6 text-ink/58">输入你的注册邮箱，我们会发送密码重置链接。</p>

            <label className="mt-8 block text-[13px] text-ink/62" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-[4px] border border-ink/12 bg-white/70 px-4 text-[15px] outline-none transition focus:border-ink/35"
            />

            {error ? <p className="mt-3 text-[13px] text-[#8E4D4A]">{error}</p> : null}
            {message ? <p className="mt-3 text-[13px] leading-5 text-ink/52">{message}</p> : null}
            {message ? (
              <p className="mt-3 rounded-[5px] border border-ink/8 bg-ivory/48 p-3 text-[12px] leading-5 text-ink/46">
                新邮件应该跳回：{resetRedirectUrl}。如果邮件仍然打开旧的 AI Lenormand 地址，需要在 Supabase 的 URL Configuration 里把 Site URL 和 Redirect URLs 改成 Flora 地址。
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 h-12 w-full rounded-full bg-[#6E2638] px-5 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft transition active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? "发送中" : "发送重置邮件"}
            </button>

            <Link
              href="/login"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-full border border-ink/12 px-5 text-[13px] uppercase tracking-[0.12em] text-ink/56 transition active:scale-[0.99]"
            >
              返回登录
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
