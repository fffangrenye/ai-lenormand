const cards = [
  ["三牌阵", "现状、阻碍、建议，适合快速整理一个具体问题。"],
  ["五牌阵", "过去、现在、隐藏影响、可能走向、行动建议，适合复杂关系或职业选择。"],
  ["解读原则", "牌面不是预测结论，而是帮助你观察模式、情绪和现实行动。"]
];

export default function KnowledgePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Knowledge</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, content]) => (
          <article key={title} className="min-h-48 rounded-lg border border-white/10 bg-panel p-5">
            <h2 className="text-xl font-semibold text-gold">{title}</h2>
            <p className="mt-4 leading-7 text-white/68">{content}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
