import notices from "@/lib/service-notices.json";
import Link from "@/components/SiteLink";

type NoticeKind = "daily" | "yesNo" | "deep";

export function AIGeneratedLabel({ simulated = false, followUp = false }: { simulated?: boolean; followUp?: boolean }) {
  return <span className="inline-flex rounded-full border border-sage/30 bg-sage/[0.06] px-3 py-1 text-xs leading-5 text-sage">
    {followUp ? "AI 生成回复" : "AI 生成"}{simulated ? " · 本地模拟预览" : ""}
  </span>;
}

export function ServiceNotice({ kind, expanded = false, simulated = false, compact = false }: { kind: NoticeKind; expanded?: boolean; simulated?: boolean; compact?: boolean }) {
  if (compact) return <aside aria-label="娱乐与自我探索说明" className="mt-6 text-[13px] leading-6 text-ink/55">
    <p>{kind === "deep" ? "AI 生成 · " : ""}{notices.short}</p>
    <details className="mt-1.5" open={expanded || undefined}>
      <summary className="w-fit cursor-pointer py-1 text-xs text-[#6E2638]/75">用途与内容说明</summary>
      <div className="mt-2 space-y-3 rounded-2xl bg-paper/65 p-4 text-sm leading-7"><p>{notices.purpose}</p><p>{notices[kind]}</p>
        {simulated && <p>本地预览使用模拟内容，不调用真实 AI，也不影响线上账户。</p>}
        <Link prefetch={false} href="/terms" className="inline-flex min-h-10 items-center text-[#6E2638] underline underline-offset-4">阅读服务条款</Link>
      </div>
    </details>
  </aside>;
  return <aside aria-label="娱乐与自我探索说明" className="mt-7 rounded-[22px] border border-sage/15 bg-[#F2F1E9]/45 px-5 py-5 text-sm leading-7 text-ink/65">
    <p className="text-[13px] font-medium text-sage">用途与内容说明</p>
    {kind === "deep" && <p className="mt-1 text-[13px] font-medium text-[#6E2638]">深度解读与追问由 AI 生成</p>}
    <p className="mt-1">{notices.short}</p>
    <details className="mt-2" open={expanded || undefined}>
      <summary className="w-fit cursor-pointer rounded-sm text-[13px] text-[#6E2638] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage">查看完整说明</summary>
      <div className="mt-3 space-y-3 border-t border-sage/15 pt-3"><p>{notices.purpose}</p><p>{notices[kind]}</p>
        {simulated && <p className="text-[13px] text-sage">本地预览使用模拟内容，不调用真实 AI，也不影响线上账户。</p>}
        <Link prefetch={false} href="/terms" className="inline-flex min-h-10 items-center text-[13px] text-[#6E2638] underline underline-offset-4">阅读服务条款与责任说明</Link>
      </div>
    </details>
  </aside>;
}
