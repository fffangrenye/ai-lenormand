export const guidedReadingTitle = "洋葱解牌";
export const guidedHomeDescription = "边抽边解，层层深入，像真人解牌";
export const guidedReadingDescription = "把一个主问题拆成九个小问题，边抽边解读";
export const guidedCardCount = 9;
export const guidedPlanVersion = 4;
export const guidedPetalPrice = { regular: 5, test: 3 } as const;

export type GuidedMessage = {
  id: string;
  role: "user" | "assistant";
  step: number;
  text: string;
};

export type GuidedPlan = {
  id: string;
  groups: string[][];
  topic: string;
  hint: string;
  version?: number;
};

export type GuidedRound = {
  question: string;
  interpretation: string | null;
};

export type GuidedSession = {
  id: string;
  question: string;
  focus: string;
  petalPrice: number;
  cards: number[];
  messages: GuidedMessage[];
  rounds: GuidedRound[];
  plan: GuidedPlan | null;
  final: string | null;
  updatedAt: string;
};
