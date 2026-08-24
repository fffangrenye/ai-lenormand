"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getSession, signIn, signUp } from "@/lib/project-store";

function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"signin" | "signup" | null>(null);
  const returnTo = searchParams.get("returnTo") || "/deep";

  useEffect(() => {
    if (getSession()) {
      router.replace(returnTo.startsWith("/") ? returnTo : "/deep");
    }
  }, [returnTo, router]);

  async function submitAuth(mode: "signin" | "signup") {
    const value = email.trim();

    if (!value || !value.includes("@")) {
      setError("请输入一个可用于登录的邮箱。");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }

    setSubmitting(mode);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        await signUp(value, password);
        setMessage("账号已创建并登录。");
      } else {
        await signIn(value, password);
      }
      router.replace(returnTo.startsWith("/") ? returnTo : "/deep");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败，请稍后再试。");
    } finally {
      setSubmitting(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAuth("signin");
  }

  return (
    <main className="min-h-dvh bg-paper px-5 py-5 text-ink">
      <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col">
        <Link href="/" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/70 shadow-sm">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="sr-only">返回首页</span>
        </Link>

        <div className="flex flex-1 items-center">
          <form onSubmit={handleSubmit} className="w-full rounded-[6px] border border-ink/10 bg-[#FFFDF8]/86 p-6 shadow-paper">
            <p className="text-[12px] uppercase tracking-[0.2em] text-clay/70">Deep Reading</p>
            <h1 className="mt-4 font-serif text-[32px] leading-[1.05] text-ink">登录后进入你的故事</h1>
            <p className="mt-4 text-[14px] leading-6 text-ink/58">
              登录后可以用项目制持续提问，保存过往记忆，并结合上下文解读你内心的困惑。抽牌后，也可以围绕这次牌面继续追问。
            </p>

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

            <label className="mt-5 block text-[13px] text-ink/62" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              minLength={6}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
                setMessage("");
              }}
              placeholder="至少 6 位"
              className="mt-2 h-12 w-full rounded-[4px] border border-ink/12 bg-white/70 px-4 text-[15px] outline-none transition focus:border-ink/35"
            />

            {error ? <p className="mt-3 text-[13px] text-[#8E4D4A]">{error}</p> : null}
            {message ? <p className="mt-3 text-[13px] text-ink/48">{message}</p> : null}

            <button
              type="submit"
              disabled={Boolean(submitting)}
              className="mt-7 h-12 w-full rounded-full bg-[#6E2638] px-5 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft transition active:scale-[0.99]"
            >
              {submitting === "signin" ? "登录中" : "登录"}
            </button>

            <button
              type="button"
              disabled={Boolean(submitting)}
              onClick={() => void submitAuth("signup")}
              className="mt-3 h-12 w-full rounded-full border border-ink/12 px-5 text-[13px] uppercase tracking-[0.12em] text-ink/56 transition active:scale-[0.99] disabled:opacity-50"
            >
              {submitting === "signup" ? "注册中" : "创建账号"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper" />}>
      <LoginClient />
    </Suspense>
  );
}
