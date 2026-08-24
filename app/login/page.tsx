"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getSession, signIn } from "@/lib/project-store";

function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const returnTo = searchParams.get("returnTo") || "/deep";

  useEffect(() => {
    if (getSession()) {
      router.replace(returnTo.startsWith("/") ? returnTo : "/deep");
    }
  }, [returnTo, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();

    if (!value || !value.includes("@")) {
      setError("请输入一个可用于登录的邮箱。");
      return;
    }

    signIn(value);
    router.replace(returnTo.startsWith("/") ? returnTo : "/deep");
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
            <p className="mt-4 text-[14px] leading-6 text-ink/58">当前原型使用邮箱创建本地会话，方便预览项目创建、切换和保存。</p>

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

            <button
              type="submit"
              className="mt-7 h-12 w-full rounded-full bg-[#6E2638] px-5 text-[13px] uppercase tracking-[0.12em] text-[#FFF9F2] shadow-soft transition active:scale-[0.99]"
            >
              Continue
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
