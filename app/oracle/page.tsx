"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { AIResponse, askOracle } from "@/lib/api";

export default function OraclePage() {
  const [domain, setDomain] = useState("love");
  const [spread, setSpread] = useState("three-card");
  const [question, setQuestion] = useState("我和 A 未来关系如何？");
  const [result, setResult] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      setResult(await askOracle(question, spread, domain));
    } catch {
      setError("暂时无法连接后端服务，请确认 FastAPI 已启动。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg border border-white/10 bg-panel p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-gold" size={20} />
          <h1 className="text-xl font-semibold">AI Oracle</h1>
        </div>
        <div className="mt-6 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm text-white/68">咨询方向</span>
            <select value={domain} onChange={(event) => setDomain(event.target.value)} className="rounded-md border border-white/10 bg-ink p-3 text-white">
              <option value="love">Love 关系</option>
              <option value="career">Career 职业</option>
              <option value="psychology">Life 人生</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/68">牌阵</span>
            <select value={spread} onChange={(event) => setSpread(event.target.value)} className="rounded-md border border-white/10 bg-ink p-3 text-white">
              <option value="three-card">三牌阵</option>
              <option value="five-card">五牌阵</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/68">你的问题</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={6}
              className="resize-none rounded-md border border-white/10 bg-ink p-3 leading-7 text-white outline-none focus:border-violet"
            />
          </label>
          <button
            onClick={submit}
            disabled={loading || question.length < 2}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-violet px-4 font-medium text-white transition hover:bg-violet/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            开始抽牌
          </button>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
        </div>
      </section>

      <section className="min-h-[680px] rounded-lg border border-white/10 bg-white/[0.055] p-5">
        {result ? (
          <div className="grid gap-6">
            <div className="grid gap-3 md:grid-cols-3">
              {result.cards.map((card) => (
                <article key={`${card.position}-${card.name_en}`} className="min-h-56 rounded-lg border border-gold/25 bg-ink p-4">
                  <p className="text-sm text-gold">{card.position}</p>
                  <h2 className="mt-5 text-2xl font-semibold">{card.name_cn}</h2>
                  <p className="mt-1 text-sm text-white/54">{card.name_en}</p>
                  <p className="mt-5 text-sm text-white/70">{card.orientation_cn}</p>
                </article>
              ))}
            </div>
            <div className="whitespace-pre-wrap rounded-lg border border-white/10 bg-ink/70 p-5 leading-8 text-white/82">{result.answer}</div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center text-white/58">
            <div>
              <Sparkles className="mx-auto mb-4 text-gold" size={34} />
              <p>选择方向和牌阵后，Soul AI 会生成一份可继续追问的咨询解读。</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
