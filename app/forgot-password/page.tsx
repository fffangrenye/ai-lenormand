"use client";

import Link from "@/components/SiteLink";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/AnalyticsTracker";
import { requestPasswordResetCode } from "@/lib/project-store";

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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

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

    if (cooldownSeconds > 0) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    trackAnalyticsEvent("password_reset_code_requested");

    try {
      await requestPasswordResetCode(value);
      setMessage("已发送");
      setCooldownSeconds(60);
    } catch (resetError) {
      setError(getFriendlyResetError(resetError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flora-page px-5 py-5">
      <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[460px] flex-col">
        <Link prefetch={false} href="/login" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/70 shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="sr-only">返回登录</span>
        </Link>

        <div className="flex flex-1 items-center">
          <form onSubmit={handleSubmit} className="flora-panel my-8 w-full sm:p-9">
            <p className="flora-eyebrow">Flora Lenormand</p>
            <h1 className="flora-title mt-3 text-[30px] sm:text-[34px]">忘记密码</h1>
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
              className="flora-field mt-3 rounded-2xl py-3.5"
            />

            {error ? <p className="mt-3 text-[13px] text-[#8E4D4A]">{error}</p> : null}
            {message ? <p className="mt-3 text-[13px] leading-5 text-ink/52">{message}</p> : null}

            <button
              type="submit"
              disabled={submitting || cooldownSeconds > 0}
              className="flora-primary mt-7 w-full"
            >
              {submitting ? "发送中" : cooldownSeconds > 0 ? `${cooldownSeconds}s 后可重新发送` : "发送重置邮件"}
            </button>

            <Link prefetch={false}
              href="/login"
              className="flora-secondary mt-3 w-full"
            >
              返回登录
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
