"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getSession } from "@/lib/project-store";

type AdminOverview = {
  today: string;
  summary: {
    totalUsers: number;
    todayActiveUsers: number;
    todayDeepReading: number;
    todayFollowUp: number;
    totalDeepReading: number;
    totalFollowUp: number;
    projectCount: number;
    readingCount: number;
    completedReadingCount: number;
    followUpQuestionCount: number;
    todayPageViews: number;
    todayVisitors: number;
    todayDeepStarts: number;
    todayDeepSubmits: number;
    todayAiSuccess: number;
    todayAiFailed: number;
    todayQuotaExceeded: number;
    todayBalanceInsufficient: number;
    todayProviderRateLimited: number;
    todayInvalidResponse: number;
    totalPageViews: number;
    todayApiRequests: number;
    todayApiSuccess: number;
    todayApiFailed: number;
    todayApiSuccessRate: number;
    todayPromptTokens: number;
    todayCompletionTokens: number;
    todayTotalTokens: number;
    todayAvgTokensPerRequest: number;
    todayCacheHitTokens: number;
    todayCacheMissTokens: number;
  };
  recentUsers: Array<{
    userId: string;
    email: string;
    createdAt: string;
    lastSignInAt: string | null;
    todayDeepReading: number;
    todayFollowUp: number;
    totalDeepReading: number;
    totalFollowUp: number;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-4 shadow-entry">
      <p className="text-[12px] uppercase tracking-[0.14em] text-ink/38">{label}</p>
      <p className="mt-3 font-serif text-[30px] leading-none text-ink">{value}</p>
      {hint ? <p className="mt-2 text-[12px] leading-5 text-ink/42">{hint}</p> : null}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOverview() {
    const session = getSession();
    if (!session?.accessToken) {
      router.replace("/login?returnTo=/admin");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      const payload = (await response.json().catch(() => ({}))) as AdminOverview & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "管理员数据读取失败。");
      }

      setOverview(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "管理员数据读取失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <main className="min-h-dvh bg-paper px-5 py-5 text-ink">
      <section className="mx-auto flex min-h-[calc(100dvh-40px)] w-full max-w-[430px] flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/70 shadow-sm">
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="sr-only">返回首页</span>
          </Link>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-ivory/70 text-ink/56 shadow-sm"
            aria-label="刷新数据"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="mt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-clay/70">Admin</p>
          <h1 className="mt-3 font-serif text-[34px] leading-none text-ink">运营概览</h1>
          <p className="mt-4 text-[14px] leading-6 text-ink/52">注册、使用、AI 成功率与 API Token 消耗监控。</p>
        </div>

        {loading ? <p className="mt-10 text-[14px] text-ink/46">正在读取数据...</p> : null}
        {error ? (
          <div className="mt-8 rounded-[6px] border border-[#CFA8A0] bg-[#FFF7F5] p-4 text-[14px] leading-6 text-[#8E4D4A]">
            {error}
          </div>
        ) : null}

        {overview ? (
          <>
            <div className="mt-7 rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 p-4 shadow-entry">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.16em] text-clay/70">API Monitor</p>
                  <h2 className="mt-2 font-serif text-[24px] leading-none text-ink">DeepSeek 今日用量</h2>
                </div>
                <p className="text-[12px] text-ink/38">{overview.today}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatCard label="API 请求" value={formatNumber(overview.summary.todayApiRequests)} hint="真正发往 DeepSeek" />
                <StatCard label="API 成功" value={formatNumber(overview.summary.todayApiSuccess)} hint={`成功率 ${overview.summary.todayApiSuccessRate}%`} />
                <StatCard label="API 失败" value={formatNumber(overview.summary.todayApiFailed)} hint="包含余额/格式/限流等" />
                <StatCard label="平均 Token/次" value={formatNumber(Math.round(overview.summary.todayAvgTokensPerRequest))} hint="总 Token ÷ API 请求" />
                <StatCard label="总 Token" value={formatNumber(overview.summary.todayTotalTokens)} hint="输入 + 输出" />
                <StatCard label="输入 Token" value={formatNumber(overview.summary.todayPromptTokens)} hint="Prompt tokens" />
                <StatCard label="输出 Token" value={formatNumber(overview.summary.todayCompletionTokens)} hint="Completion tokens" />
                <StatCard label="缓存命中 Token" value={formatNumber(overview.summary.todayCacheHitTokens)} hint={`未命中 ${formatNumber(overview.summary.todayCacheMissTokens)}`} />
              </div>
              <p className="mt-4 text-[12px] leading-5 text-ink/42">站内额度拦截不会计入 API 请求；Token 从本次上线监控后开始累计，历史请求没有 usage 数据时不会补算。</p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <StatCard label="注册用户" value={overview.summary.totalUsers} />
              <StatCard label="今日活跃" value={overview.summary.todayActiveUsers} hint={overview.today} />
              <StatCard label="今日访问" value={overview.summary.todayPageViews} hint="Page views" />
              <StatCard label="今日访客" value={overview.summary.todayVisitors} hint="Visitors" />
              <StatCard label="今日解读" value={overview.summary.todayDeepReading} hint="Deep Reading" />
              <StatCard label="今日追问" value={overview.summary.todayFollowUp} hint="Follow-up" />
              <StatCard label="开始深占" value={overview.summary.todayDeepStarts} hint="今日点击" />
              <StatCard label="提交深占" value={overview.summary.todayDeepSubmits} hint="今日抽牌" />
              <StatCard label="AI 成功" value={overview.summary.todayAiSuccess} hint="模型返回成功" />
              <StatCard label="AI 失败" value={overview.summary.todayAiFailed} hint="已调用模型但失败" />
              <StatCard label="额度触达" value={overview.summary.todayQuotaExceeded} hint="未调用模型" />
              <StatCard label="余额不足" value={overview.summary.todayBalanceInsufficient} hint="DeepSeek / 402" />
              <StatCard label="模型限流" value={overview.summary.todayProviderRateLimited} hint="Provider 429" />
              <StatCard label="格式失败" value={overview.summary.todayInvalidResponse} hint="JSON / Schema" />
              <StatCard label="总项目" value={overview.summary.projectCount} />
              <StatCard label="总解读" value={overview.summary.readingCount} hint={`${overview.summary.completedReadingCount} 已完成`} />
              <StatCard label="累计解读" value={overview.summary.totalDeepReading} hint="AI 次数" />
              <StatCard label="累计追问" value={overview.summary.totalFollowUp} hint="AI 次数" />
              <StatCard label="累计访问" value={overview.summary.totalPageViews} hint="最近 5000 条内" />
            </div>

            <div className="mt-8 rounded-[6px] border border-ink/10 bg-[#FFFDF8]/82 shadow-entry">
              <div className="border-b border-ink/8 px-4 py-4">
                <h2 className="font-serif text-[23px] leading-none text-ink">最近用户</h2>
                <p className="mt-2 text-[12px] leading-5 text-ink/42">最多显示最近 50 个账号。</p>
              </div>
              <div className="divide-y divide-ink/8">
                {overview.recentUsers.map((user) => (
                  <div key={user.userId} className="px-4 py-4">
                    <p className="truncate text-[14px] text-ink">{user.email}</p>
                    <p className="mt-1 text-[12px] text-ink/38">注册：{formatDate(user.createdAt)} · 登录：{formatDate(user.lastSignInAt)}</p>
                    <p className="mt-2 text-[12px] leading-5 text-ink/48">
                      今日解读 {user.todayDeepReading} · 今日追问 {user.todayFollowUp} · 累计解读 {user.totalDeepReading} · 累计追问 {user.totalFollowUp}
                    </p>
                  </div>
                ))}
                {overview.recentUsers.length === 0 ? <p className="px-4 py-6 text-[14px] text-ink/42">暂时没有注册用户。</p> : null}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
