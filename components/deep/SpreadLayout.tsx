"use client";

import { getDeepSpread, positionLabels } from "@/lib/deep-spreads";
import { getLenormandCardImagePath } from "@/lib/lenormand-cards";
import { QuietCardBack } from "@/components/QuietCardBack";

type DisplayCard = { number?: number; cardNumber?: number; slug?: string; cardSlug?: string; nameZh: string; nameEn: string; position: string };
export function SpreadLayout({ spreadId, cards = [], choices = [], pendingCount = 0, miniature = false, compact = false }: { spreadId: string; cards?: DisplayCard[]; choices?: string[]; pendingCount?: number; miniature?: boolean; compact?: boolean }) {
  const spread = getDeepSpread(spreadId);
  const labels = positionLabels(spread, choices);
  return <div className={`mx-auto grid w-full ${miniature ? "max-w-[100px] gap-1" : spread.rows === 1 ? "max-w-[560px] gap-2 sm:gap-3" : compact ? "max-w-[220px] gap-x-3 gap-y-2 sm:max-w-[300px]" : "max-w-[340px] gap-x-3 gap-y-2"}`}
    style={{ gridTemplateColumns: `repeat(${spread.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${spread.rows}, auto)` }} aria-label={`${spread.name}牌位布局`}>
    {spread.positions.map((position, index) => {
      const card = cards[index];
      const pending = !card && index < cards.length + pendingCount;
      return <div key={index} style={{ gridColumn: position.col + 1, gridRow: position.row + 1 }} className="min-w-0 text-center" aria-label={miniature ? undefined : `牌位 ${index + 1}，${labels[index]}，${card ? card.nameZh : pending ? "已选，等待统一翻牌" : "待抽取"}`}>
        <div className={`relative mx-auto aspect-[2/3] w-full overflow-hidden rounded-md ${miniature ? "max-w-5 border border-clay/35 bg-clay/10" : card || pending ? "max-w-[108px] border border-ink/12 bg-[#FFFDF8] shadow-entry animate-[cardDraw_0.4s_ease-out]" : "max-w-[86px] border-2 border-dashed border-[#6E2638]/25 bg-[#6E2638]/[0.02]"}`}>
          {card && !miniature ? <img src={getLenormandCardImagePath(card.number || card.cardNumber || index + 1, card.slug || card.cardSlug)} alt={`${card.nameZh} / ${card.nameEn}`} className="h-full w-full object-fill" /> : pending && !miniature ? <QuietCardBack /> : !miniature && <span className="absolute inset-0 grid place-items-center font-serif text-xl text-[#6E2638]/30">{index + 1}</span>}
        </div>
        {!miniature && <p className="mt-1 break-words text-[10px] leading-4 text-ink/50 sm:text-xs">{index + 1} · {labels[index]}</p>}
      </div>;
    })}
  </div>;
}
