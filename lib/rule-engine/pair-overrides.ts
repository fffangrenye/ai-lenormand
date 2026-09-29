import { PairOverride, orderedPairKey } from "./pair-types";

function override(left: number, right: number, code: string, relation: PairOverride["preferredRelations"][number], priority: PairOverride["priority"] = "high", when?: PairOverride["when"]): PairOverride {
  return { key: orderedPairKey(left, right), code, preferredRelations: [relation], priority, when };
}

export const pairOverrides: PairOverride[] = [
  override(14, 27, "OVERRIDE_FOX_LETTER_WARNING_DOCUMENT", { leftModeId: "deception_suspicion", rightModeId: "written_message", relation: "modify", supportsLeft: ["deception_suspicion", "wrong_warning"], supportsRight: ["written_message", "document_paperwork"], semanticPatch: { informationState: "unclear" } }),
  override(27, 14, "OVERRIDE_LETTER_FOX_DOCUMENT_REVEALS_WARNING", { leftModeId: "written_message", rightModeId: "wrong_warning", relation: "communicate", supportsLeft: ["written_message", "document_paperwork"], supportsRight: ["wrong_warning", "deception_suspicion"] }),
  override(14, 27, "OVERRIDE_FOX_LETTER_CAREER_DOCUMENT", { leftModeId: "employment", relation: "associate", supportsLeft: ["employment"], supportsRight: ["contract_record", "document_paperwork", "written_message"] }, "high", [{ field: "domain", equals: "career" }]),
  override(26, 28, "OVERRIDE_BOOK_MAN_UNKNOWN_PERSON", { leftModeId: "unknown_information", rightModeId: "male_person_anchor", relation: "describe", semanticPatch: { informationState: "unknown", personEffect: { personCardId: 28, descriptors: ["unknown_or_unfamiliar"] } } }),
  override(26, 28, "OVERRIDE_BOOK_MAN_KNOWLEDGE_PERSON", { leftModeId: "knowledge_learning", rightModeId: "male_person_anchor", relation: "describe", semanticPatch: { personEffect: { personCardId: 28, descriptors: ["knowledge_related"] } } }),
  override(26, 28, "OVERRIDE_BOOK_MAN_RESEARCH_PERSON", { leftModeId: "research_investigation", rightModeId: "male_person_anchor", relation: "associate" }),
  override(26, 28, "OVERRIDE_BOOK_MAN_PRIVATE_PERSON", { leftModeId: "secret_hidden", rightModeId: "male_person_anchor", relation: "describe", semanticPatch: { informationState: "hidden", personEffect: { personCardId: 28, descriptors: ["private_or_hidden_information"] } } }),
  override(28, 26, "OVERRIDE_MAN_BOOK_UNKNOWN_PERSON", { leftModeId: "male_person_anchor", rightModeId: "unknown_information", relation: "describe", semanticPatch: { informationState: "unknown", personEffect: { personCardId: 28, descriptors: ["unknown_or_unfamiliar"] } } }),
  override(28, 26, "OVERRIDE_MAN_BOOK_KNOWLEDGE_PERSON", { leftModeId: "male_person_anchor", rightModeId: "knowledge_learning", relation: "describe", semanticPatch: { personEffect: { personCardId: 28, descriptors: ["knowledge_related"] } } }),
  override(28, 26, "OVERRIDE_MAN_BOOK_RESEARCH_PERSON", { leftModeId: "male_person_anchor", rightModeId: "research_investigation", relation: "associate" }),
  override(28, 26, "OVERRIDE_MAN_BOOK_PRIVATE_PERSON", { leftModeId: "male_person_anchor", rightModeId: "secret_hidden", relation: "describe", semanticPatch: { informationState: "hidden", personEffect: { personCardId: 28, descriptors: ["private_or_hidden_information"] } } }),
  override(26, 29, "OVERRIDE_BOOK_WOMAN_UNKNOWN_PERSON", { leftModeId: "unknown_information", rightModeId: "female_person_anchor", relation: "describe", semanticPatch: { informationState: "unknown", personEffect: { personCardId: 29, descriptors: ["unknown_or_unfamiliar"] } } }),
  override(26, 29, "OVERRIDE_BOOK_WOMAN_KNOWLEDGE_PERSON", { leftModeId: "knowledge_learning", rightModeId: "female_person_anchor", relation: "describe", semanticPatch: { personEffect: { personCardId: 29, descriptors: ["knowledge_related"] } } }),
  override(26, 29, "OVERRIDE_BOOK_WOMAN_RESEARCH_PERSON", { leftModeId: "research_investigation", rightModeId: "female_person_anchor", relation: "associate" }),
  override(26, 29, "OVERRIDE_BOOK_WOMAN_PRIVATE_PERSON", { leftModeId: "secret_hidden", rightModeId: "female_person_anchor", relation: "describe", semanticPatch: { informationState: "hidden", personEffect: { personCardId: 29, descriptors: ["private_or_hidden_information"] } } }),
  override(29, 26, "OVERRIDE_WOMAN_BOOK_UNKNOWN_PERSON", { leftModeId: "female_person_anchor", rightModeId: "unknown_information", relation: "describe", semanticPatch: { informationState: "unknown", personEffect: { personCardId: 29, descriptors: ["unknown_or_unfamiliar"] } } }),
  override(29, 26, "OVERRIDE_WOMAN_BOOK_KNOWLEDGE_PERSON", { leftModeId: "female_person_anchor", rightModeId: "knowledge_learning", relation: "describe", semanticPatch: { personEffect: { personCardId: 29, descriptors: ["knowledge_related"] } } }),
  override(29, 26, "OVERRIDE_WOMAN_BOOK_RESEARCH_PERSON", { leftModeId: "female_person_anchor", rightModeId: "research_investigation", relation: "associate" }),
  override(29, 26, "OVERRIDE_WOMAN_BOOK_PRIVATE_PERSON", { leftModeId: "female_person_anchor", rightModeId: "secret_hidden", relation: "describe", semanticPatch: { informationState: "hidden", personEffect: { personCardId: 29, descriptors: ["private_or_hidden_information"] } } }),
  override(22, 35, "OVERRIDE_CROSSROADS_ANCHOR_FIXED_OPTIONS", { relation: "stabilize", supportsLeft: ["choice_options", "multiple_alternatives"], supportsRight: ["stability_security", "fixed_stagnation"] }),
  override(35, 22, "OVERRIDE_ANCHOR_CROSSROADS_STABLE_OPTIONS", { relation: "stabilize", supportsLeft: ["stability_security", "fixed_stagnation"], supportsRight: ["choice_options", "multiple_alternatives"] }),
  override(24, 25, "OVERRIDE_HEART_RING_FEELING_BOND", { relation: "bind", supportsLeft: ["love_affection", "attraction_passion"], supportsRight: ["commitment_bond"] }),
  override(25, 24, "OVERRIDE_RING_HEART_BOND_FEELING", { relation: "bind", supportsLeft: ["commitment_bond"], supportsRight: ["love_affection", "attraction_passion"] }),
  override(11, 25, "OVERRIDE_WHIP_RING_REPEATING_BOND", { relation: "repeat", supportsLeft: ["repetition", "conflict_argument"], supportsRight: ["cycle_repetition", "commitment_bond"] }),
  override(25, 11, "OVERRIDE_RING_WHIP_BOND_UNDER_REPETITION", { relation: "repeat", supportsLeft: ["cycle_repetition", "commitment_bond"], supportsRight: ["repetition", "conflict_argument"] }),
  override(23, 25, "OVERRIDE_MICE_RING_ERODE_BOND", { relation: "erode", supportsLeft: ["erosion_diminishment", "loss_depletion"], supportsRight: ["commitment_bond", "cycle_repetition"] }),
  override(25, 23, "OVERRIDE_RING_MICE_BOND_ERODES", { relation: "erode", supportsLeft: ["commitment_bond", "cycle_repetition"], supportsRight: ["erosion_diminishment", "loss_depletion"] }),
  override(26, 11, "OVERRIDE_BOOK_WHIP_RESEARCH_REVISION", { relation: "repeat", supportsLeft: ["project_case", "research_investigation"], supportsRight: ["editing_revision_research", "practice_discipline"] }),
  override(11, 26, "OVERRIDE_WHIP_BOOK_REVISION_RESEARCH", { relation: "repeat", supportsLeft: ["editing_revision_research", "practice_discipline"], supportsRight: ["project_case", "research_investigation"] }),
  override(26, 31, "OVERRIDE_BOOK_SUN_REVEAL_UNKNOWN", { relation: "clarify", supportsLeft: ["unknown_information", "project_case"], supportsRight: ["clarity_illumination", "success_achievement"], semanticPatch: { informationState: "confirmed" } }),
  override(31, 26, "OVERRIDE_SUN_BOOK_ILLUMINATE_BOOK", { relation: "clarify", supportsLeft: ["clarity_illumination"], supportsRight: ["unknown_information", "knowledge_learning", "project_case"] }),
  override(26, 33, "OVERRIDE_BOOK_KEY_UNKNOWN_CONFIRMED", { relation: "confirm", supportsLeft: ["unknown_information", "knowledge_learning"], supportsRight: ["confirmation_certainty"], semanticPatch: { informationState: "confirmed" } }),
  override(33, 26, "OVERRIDE_KEY_BOOK_UNLOCK_KNOWLEDGE", { relation: "unlock", supportsLeft: ["solution_unlock"], supportsRight: ["unknown_information", "knowledge_learning"], semanticPatch: { stateChange: "unlock" } }),
  override(21, 33, "OVERRIDE_MOUNTAIN_KEY_BLOCK_CONFIRMATION", { relation: "block", supportsLeft: ["blockage_obstacle", "delay"], supportsRight: ["confirmation_certainty"], semanticPatch: { stateChange: "block" } }),
  override(33, 21, "OVERRIDE_KEY_MOUNTAIN_UNLOCK_BLOCK", { relation: "unlock", supportsLeft: ["solution_unlock"], supportsRight: ["blockage_obstacle", "delay"], semanticPatch: { stateChange: "unlock" } }),
  override(27, 21, "OVERRIDE_LETTER_MOUNTAIN_DELAY_DOCUMENT", { relation: "block", supportsLeft: ["written_message", "document_paperwork"], supportsRight: ["delay", "blockage_obstacle"], semanticPatch: { stateChange: "delay" } }),
  override(21, 27, "OVERRIDE_MOUNTAIN_LETTER_OBSTACLE_MESSAGE", { relation: "communicate", supportsLeft: ["blockage_obstacle", "delay"], supportsRight: ["written_message", "document_paperwork"], semanticPatch: { stateChange: "block", informationState: "written" } }),
  override(33, 27, "OVERRIDE_KEY_LETTER_UNLOCK_DOCUMENT", { relation: "unlock", supportsLeft: ["solution_unlock"], supportsRight: ["written_message", "document_paperwork"], semanticPatch: { stateChange: "unlock" } }),
  override(27, 33, "OVERRIDE_LETTER_KEY_DOCUMENT_CONFIRMED", { relation: "confirm", supportsLeft: ["written_message", "document_paperwork"], supportsRight: ["confirmation_certainty"], semanticPatch: { informationState: "confirmed" } }),
  override(14, 34, "OVERRIDE_FOX_FISH_JOB_MONEY", { relation: "associate", supportsLeft: ["employment", "wrong_warning"], supportsRight: ["money_finance", "cashflow_circulation"] }),
  override(34, 14, "OVERRIDE_FISH_FOX_MONEY_JOB_WARNING", { relation: "associate", supportsLeft: ["money_finance", "cashflow_circulation"], supportsRight: ["employment", "wrong_warning"] }),
  override(1, 27, "OVERRIDE_RIDER_LETTER_INCOMING_WRITTEN", { relation: "communicate", supportsLeft: ["incoming_news"], supportsRight: ["written_message"], semanticPatch: { informationState: "incoming" } }),
  override(27, 1, "OVERRIDE_LETTER_RIDER_WRITTEN_UPDATE", { relation: "sequence", supportsLeft: ["written_message"], supportsRight: ["incoming_news"] }),
  override(12, 27, "OVERRIDE_BIRDS_LETTER_SPOKEN_TO_WRITTEN", { relation: "communicate", supportsLeft: ["oral_communication", "discussion_negotiation"], supportsRight: ["written_message", "document_paperwork"] }),
  override(27, 12, "OVERRIDE_LETTER_BIRDS_WRITTEN_DISCUSSION", { relation: "communicate", supportsLeft: ["written_message", "document_paperwork"], supportsRight: ["oral_communication", "discussion_negotiation"] })
];

export function findPairOverrides(key: string, question: { domain: string; primaryTopic: string; intent: string; object: { type: string } }) {
  return pairOverrides.filter((item) => {
    if (item.key !== key) return false;
    return (item.when ?? []).every((predicate) => {
      if (predicate.field === "domain") return question.domain === predicate.equals;
      if (predicate.field === "topic") return question.primaryTopic === predicate.equals;
      if (predicate.field === "intent") return question.intent === predicate.equals;
      if (predicate.field === "objectType") return question.object.type === predicate.equals;
      return false;
    });
  });
}
