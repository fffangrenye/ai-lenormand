import { cards01To12 } from "./cards/01-12";
import { cards13To24 } from "./cards/13-24";
import { cards25To36 } from "./cards/25-36";
import { assertValidLexicon } from "./lexicon-schema";

export const lenormandLexicon = assertValidLexicon([...cards01To12, ...cards13To24, ...cards25To36]);

export function getCardLexiconEntry(cardId: number) {
  return lenormandLexicon.find((card) => card.id === cardId) ?? null;
}

export function getSemanticMode(cardId: number, modeId: string) {
  return getCardLexiconEntry(cardId)?.semanticModes.find((mode) => mode.id === modeId) ?? null;
}
