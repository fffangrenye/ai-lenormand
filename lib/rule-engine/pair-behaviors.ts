import { PairRelationType, PairSemanticResult } from "./pair-types";
import { SpecialBehavior } from "./semantic-types";

export type BehaviorRelation = {
  behavior: SpecialBehavior;
  relation: PairRelationType;
  stateChange?: PairSemanticResult["stateChange"];
  informationState?: PairSemanticResult["informationState"];
  quantityEffect?: PairSemanticResult["quantityEffect"];
  temporalEffect?: PairSemanticResult["temporalEffect"];
  direction: "forward" | "backward" | "bidirectional" | "contextual";
};

export const behaviorRelations: Partial<Record<SpecialBehavior, BehaviorRelation>> = {
  reduce_clarity: { behavior: "reduce_clarity", relation: "hide", informationState: "unclear", direction: "bidirectional" },
  clarify_adjacent_theme: { behavior: "clarify_adjacent_theme", relation: "clarify", informationState: "confirmed", direction: "bidirectional" },
  end_adjacent_theme: { behavior: "end_adjacent_theme", relation: "end", stateChange: "end", direction: "bidirectional" },
  cut_adjacent_theme: { behavior: "cut_adjacent_theme", relation: "cut", stateChange: "end", temporalEffect: "sudden", direction: "bidirectional" },
  change_adjacent_theme: { behavior: "change_adjacent_theme", relation: "change", stateChange: "change", direction: "bidirectional" },
  repeat_adjacent_theme: { behavior: "repeat_adjacent_theme", relation: "repeat", stateChange: "continue", direction: "bidirectional" },
  block_adjacent_theme: { behavior: "block_adjacent_theme", relation: "block", stateChange: "block", temporalEffect: "slower", direction: "bidirectional" },
  delay_adjacent_theme: { behavior: "delay_adjacent_theme", relation: "block", stateChange: "delay", temporalEffect: "slower", direction: "bidirectional" },
  erode_adjacent_theme: { behavior: "erode_adjacent_theme", relation: "erode", stateChange: "decrease", direction: "contextual" },
  diminish_adjacent_theme: { behavior: "diminish_adjacent_theme", relation: "erode", stateChange: "decrease", quantityEffect: "reduced", direction: "bidirectional" },
  drain_resource: { behavior: "drain_resource", relation: "erode", stateChange: "decrease", quantityEffect: "reduced", direction: "bidirectional" },
  bind_adjacent_theme: { behavior: "bind_adjacent_theme", relation: "bind", stateChange: "continue", direction: "bidirectional" },
  cycle_adjacent_theme: { behavior: "cycle_adjacent_theme", relation: "repeat", stateChange: "continue", direction: "bidirectional" },
  hide_adjacent_theme: { behavior: "hide_adjacent_theme", relation: "hide", informationState: "hidden", direction: "bidirectional" },
  mark_unknown: { behavior: "mark_unknown", relation: "hide", informationState: "unknown", direction: "bidirectional" },
  document_adjacent_theme: { behavior: "document_adjacent_theme", relation: "communicate", informationState: "written", direction: "bidirectional" },
  communicate_adjacent_theme: { behavior: "communicate_adjacent_theme", relation: "communicate", direction: "bidirectional" },
  stabilize_adjacent_theme: { behavior: "stabilize_adjacent_theme", relation: "stabilize", stateChange: "stabilize", direction: "bidirectional" },
  fix_adjacent_theme: { behavior: "fix_adjacent_theme", relation: "stabilize", stateChange: "stabilize", direction: "bidirectional" },
  burden_adjacent_theme: { behavior: "burden_adjacent_theme", relation: "burden", direction: "bidirectional" },
  emphasize_following_theme: { behavior: "emphasize_following_theme", relation: "burden", direction: "forward" },
  finalize_previous_theme: { behavior: "finalize_previous_theme", relation: "finalize", stateChange: "end", direction: "backward" },
  publicize_adjacent_theme: { behavior: "publicize_adjacent_theme", relation: "publicize", informationState: "public", direction: "bidirectional" },
  pluralize_adjacent_theme: { behavior: "pluralize_adjacent_theme", relation: "pluralize", quantityEffect: "multiple", direction: "bidirectional" },
  reduce_scale: { behavior: "reduce_scale", relation: "modify", quantityEffect: "smaller", direction: "bidirectional" },
  amplify_scale: { behavior: "amplify_scale", relation: "intensify", quantityEffect: "larger", direction: "bidirectional" },
  emotionally_charge_adjacent_theme: { behavior: "emotionally_charge_adjacent_theme", relation: "modify", direction: "bidirectional" },
  mark_importance: { behavior: "mark_importance", relation: "describe", direction: "bidirectional" },
  confirm_adjacent_theme: { behavior: "confirm_adjacent_theme", relation: "confirm", stateChange: "confirm", informationState: "confirmed", direction: "bidirectional" },
  unlock_adjacent_theme: { behavior: "unlock_adjacent_theme", relation: "unlock", stateChange: "unlock", direction: "bidirectional" }
};

export function getBehaviorRelation(behavior: SpecialBehavior) {
  return behaviorRelations[behavior] ?? null;
}
