"use client";

import { ChevronDown, Play } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  lenormandLexicon,
  RuleEngineError,
  runRuleEngineReading
} from "@/lib/rule-engine";
import type { RendererStyle, RuleEngineReadingResult } from "@/lib/rule-engine";

type PanelProps = {
  title: string;
  children: ReactNode;
};

const defaultThreeCards = [1, 27, 33];
const defaultFiveCards = [24, 25, 6, 27, 33];

export function RuleEnginePlayground() {
  const [question, setQuestion] = useState("三天内会收到消息吗？");
  const [spreadSize, setSpreadSize] = useState<3 | 5>(3);
  const [cardIds, setCardIds] = useState(defaultThreeCards);
  const [rendererStyle, setRendererStyle] = useState<RendererStyle>("standard");
  const [result, setResult] = useState<RuleEngineReadingResult | null>(null);
  const [error, setError] = useState<RuleEngineError | Error | null>(null);

  const orderedCards = useMemo(
    () =>
      cardIds.map((cardId, index) => ({
        label: String.fromCharCode(65 + index),
        card: lenormandLexicon.find((item) => item.id === cardId)
      })),
    [cardIds]
  );

  function updateSpreadSize(nextSize: 3 | 5) {
    setSpreadSize(nextSize);
    setCardIds(nextSize === 3 ? defaultThreeCards : defaultFiveCards);
    setResult(null);
    setError(null);
  }

  function updateCard(index: number, nextCardId: number) {
    setCardIds((current) => current.map((cardId, currentIndex) => (currentIndex === index ? nextCardId : cardId)));
  }

  function runReading() {
    try {
      setError(null);
      setResult(runRuleEngineReading({ question, cardIds, spreadSize, rendererStyle }));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught : new Error("Rule engine failed."));
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2e8] px-5 py-6 text-[#23211d] md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-[#d8ccba] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a4f36]">Rule Engine Developer Playground</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">V1 Full Pipeline</h1>
          </div>
          <button
            type="button"
            onClick={runReading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-[#2c6b59] bg-[#2c6b59] px-4 text-sm font-semibold text-white shadow-sm"
          >
            <Play size={16} />
            Run
          </button>
        </header>

        <section className="grid gap-4 border-b border-[#d8ccba] pb-5 lg:grid-cols-[1.2fr_1fr]">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-24 rounded border border-[#c9baa4] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#2c6b59]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Spread
              <span className="relative">
                <select
                  value={spreadSize}
                  onChange={(event) => updateSpreadSize(Number(event.target.value) as 3 | 5)}
                  className="h-10 w-full appearance-none rounded border border-[#c9baa4] bg-white px-3 pr-9 text-sm font-normal"
                >
                  <option value={3}>3 cards</option>
                  <option value={5}>5 cards</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-[#766b5f]" size={16} />
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold">
              Renderer
              <span className="relative">
                <select
                  value={rendererStyle}
                  onChange={(event) => setRendererStyle(event.target.value as RendererStyle)}
                  className="h-10 w-full appearance-none rounded border border-[#c9baa4] bg-white px-3 pr-9 text-sm font-normal"
                >
                  <option value="concise">concise</option>
                  <option value="standard">standard</option>
                  <option value="learning">learning</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-[#766b5f]" size={16} />
              </span>
            </label>

            {cardIds.map((cardId, index) => (
              <label key={index} className="flex flex-col gap-2 text-sm font-semibold">
                Card {String.fromCharCode(65 + index)}
                <span className="relative">
                  <select
                    value={cardId}
                    onChange={(event) => updateCard(index, Number(event.target.value))}
                    className="h-10 w-full appearance-none rounded border border-[#c9baa4] bg-white px-3 pr-9 text-sm font-normal"
                  >
                    {lenormandLexicon.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.id}. {card.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-[#766b5f]" size={16} />
                </span>
              </label>
            ))}
          </div>
        </section>

        {error ? (
          <section className="rounded border border-[#b84a4a] bg-[#fff8f6] p-4 text-sm">
            <h2 className="font-semibold text-[#8f2727]">{error.name}</h2>
            <p className="mt-1">{error.message}</p>
            {"code" in error ? <JsonBlock value={{ code: error.code, detail: (error as RuleEngineError).detail }} /> : null}
          </section>
        ) : null}

        {result ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Question Context">
              <KeyValue value={result.questionContext} />
            </Panel>
            <Panel title="Cards / Lexicon Selection">
              <JsonBlock value={orderedCards} />
            </Panel>
            <Panel title="CMSE Preselection">
              <JsonBlock value={result.preselection} />
            </Panel>
            <Panel title="Initial Ordered Pairs">
              <JsonBlock value={result.initialPairs} />
            </Panel>
            <Panel title="Neighbor Evidence">
              <JsonBlock value={result.refinedPairs.flatMap((pair) => pair.neighborEvidence)} />
            </Panel>
            <Panel title="Final Resolved Cards">
              <JsonBlock value={result.resolvedCards} />
            </Panel>
            <Panel title="Pair Refinement">
              <JsonBlock value={{ refinementPasses: result.refinementPasses, executed: result.refinementPasses === 1, pairs: result.refinedPairs }} />
            </Panel>
            <Panel title="Spread Structure">
              <JsonBlock value={result.spread} />
            </Panel>
            <Panel title="Whole-line Synthesis">
              <JsonBlock value={result.synthesis} />
            </Panel>
            <Panel title="Tempo Compatibility">
              <JsonBlock value={result.tempo} />
            </Panel>
            <Panel title="Answer Proposition">
              <JsonBlock value={result.answer.proposition} />
            </Panel>
            <Panel title="Basic Answer Resolution">
              <JsonBlock value={result.answer} />
            </Panel>
            <Panel title="Final Renderer Preview">
              <div className="space-y-3 text-sm leading-6">
                {result.rendered.headline ? <p className="font-semibold">{result.rendered.headline}</p> : null}
                {result.rendered.answerLead ? <p>{result.rendered.answerLead}</p> : null}
                <p>{result.rendered.body}</p>
                {result.rendered.conclusion ? <p>{result.rendered.conclusion}</p> : null}
                {result.rendered.timingNote ? <p>{result.rendered.timingNote}</p> : null}
                {result.rendered.safetyNote ? <p>{result.rendered.safetyNote}</p> : null}
              </div>
            </Panel>
            <Panel title="Engine / Schema Versions">
              <JsonBlock value={{ engineVersion: result.engineVersion, metadata: result.metadata }} />
            </Panel>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Panel({ title, children }: PanelProps) {
  return (
    <section className="rounded border border-[#d8ccba] bg-white/86 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#72513c]">{title}</h2>
      {children}
    </section>
  );
}

function KeyValue({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <JsonBlock value={value} />;
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {Object.entries(value).map(([key, entry]) => (
        <div key={key} className="rounded border border-[#eee5d8] bg-[#fbf8f2] px-3 py-2">
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a6f63]">{key}</dt>
          <dd className="mt-1 break-words text-[#24211d]">{typeof entry === "object" ? JSON.stringify(entry, null, 2) : String(entry)}</dd>
        </div>
      ))}
    </dl>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[440px] overflow-auto rounded bg-[#24211d] p-3 text-xs leading-5 text-[#f7f2e8]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
