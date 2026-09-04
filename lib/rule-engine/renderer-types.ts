import { BasicAnswerResolution } from "./answer-types";
import { QuestionContext } from "./ontology";
import { SynthesisResult } from "./synthesis-types";
import { TempoCompatibilityResult } from "./tempo-types";

export const rendererStyles = ["concise", "standard", "learning"] as const;
export type RendererStyle = (typeof rendererStyles)[number];

export type LearningRenderDetails = {
  focus?: {
    cardName: string;
    modeLabel: string;
  };
  hinge?: {
    cardName: string;
    modeLabel: string;
  };
  pairExplanations?: {
    cards: [string, string];
    explanation: string;
  }[];
  mirrorExplanations?: {
    cards: [string, string];
    function: "confirm" | "qualify" | "subtext";
    explanation: string;
  }[];
  synthesisReasoning?: string;
};

export type RenderedReading = {
  style: RendererStyle;
  headline?: string;
  answerLead?: string;
  body: string;
  conclusion?: string;
  timingNote?: string;
  safetyNote?: string;
  learningDetails?: LearningRenderDetails;
  engineVersion: string;
  metadata: {
    engineVersion: string;
    source: "rule_engine";
  };
};

export type FinalRendererInput = {
  question: QuestionContext;
  synthesis: SynthesisResult;
  tempo?: TempoCompatibilityResult;
  answer: BasicAnswerResolution;
  style?: RendererStyle;
};
