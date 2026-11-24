import notices from "@/lib/service-notices.json";
import Link from "@/components/SiteLink";

export const metadata = { title: "服务条款与责任说明" };

export default function TermsPreviewPage() {
  return <main className="flora-page px-5 py-8"><article className="flora-panel mx-auto max-w-[760px] text-base leading-8 text-ink/75 sm:my-8 sm:p-10">
    <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center text-sage">Flora Lenormand · 返回首页</Link>
    <p className="flora-eyebrow mt-8">服务说明</p><h1 className="flora-title mt-3">服务条款与责任说明</h1>
    <section className="mt-10 space-y-5"><h2 className="font-serif text-xl text-ink">内容用途与服务边界</h2>{notices.terms.map(text => <p key={text}>{text}</p>)}</section>
    <section className="mt-10 space-y-5"><h2 className="font-serif text-xl text-ink">娱乐与自我探索</h2><p>{notices.purpose}</p></section>
    <section className="mt-10 space-y-5"><h2 className="font-serif text-xl text-ink">AI 内容说明</h2><p>{notices.deep}</p><p>AI 解读和追问回复会在相邻位置标注“AI 生成”。提供相关内容复制或导出功能时，保留相应标识；请勿将其作为真人专业意见传播。</p></section>
    <p className="mt-10 border-t border-ink/10 pt-5 text-sm text-sage">本地预览中的补充条款，正式站条款尚未更新。反馈邮箱：<a href="mailto:FFFangrenye@outlook.com" className="underline">FFFangrenye@outlook.com</a></p>
  </article></main>;
}
