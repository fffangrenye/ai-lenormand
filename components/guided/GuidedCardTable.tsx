import { guidedCardCount, type GuidedSession } from "@/lib/guided-reading/details";
import { getLenormandCardImagePath, lenormandCards } from "@/lib/lenormand-cards";

export function GuidedCardTable({ session }: { session: GuidedSession }) {
  return (
    <ol aria-label="九轮抽牌进度" className="mx-auto grid w-full max-w-[285px] grid-cols-3 items-start gap-x-3 gap-y-2 sm:max-w-[360px]">
      {Array.from({ length: guidedCardCount }, (_, index) => {
        const number = session.cards[index];
        const card = number ? lenormandCards[number - 1] : null;
        const question = session.rounds[index]?.question;
        return (
          <li key={index} className="min-w-0 text-center">
            <div className={"relative mx-auto aspect-[2/3] w-full max-w-[80px] overflow-hidden rounded-md sm:max-w-[92px] " + (card
              ? "border border-ink/12 bg-[#FFFDF8] shadow-entry animate-[cardDraw_0.4s_ease-out] motion-reduce:animate-none"
              : "grid place-items-center border-2 border-dashed border-[#6E2638]/25 bg-[#6E2638]/[0.02] font-serif text-xl text-[#6E2638]/40")}>
              {card
                ? <img src={getLenormandCardImagePath(card.number, card.slug)} alt={card.nameZh} className="h-full w-full object-fill" />
                : <span aria-hidden="true">{index + 1}</span>}
            </div>
            <p title={question || undefined} className="mt-1 min-h-8 text-[10px] leading-4 text-ink/65 sm:text-xs">
              <span className="line-clamp-2 break-words">{index + 1} · {question || (card ? card.nameZh : "待抽取")}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
