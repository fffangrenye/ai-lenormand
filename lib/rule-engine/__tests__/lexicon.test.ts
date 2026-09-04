import assert from "node:assert/strict";
import test from "node:test";
import { lenormandLexicon, getCardLexiconEntry, getSemanticMode } from "../lexicon";
import { validateLexicon } from "../lexicon-schema";
import { SpecialBehavior, specialBehaviors } from "../semantic-types";

function card(id: number) {
  const entry = getCardLexiconEntry(id);
  assert.ok(entry, `Missing card ${id}`);
  return entry;
}

function mode(cardId: number, modeId: string) {
  const entry = getSemanticMode(cardId, modeId);
  assert.ok(entry, `Missing mode ${cardId}.${modeId}`);
  return entry;
}

test("lexicon integrity validates exactly 36 cards with unique ids and names", () => {
  const result = validateLexicon(lenormandLexicon);
  assert.equal(result.success, true, result.issues.join("\n"));
  assert.equal(lenormandLexicon.length, 36);
  assert.deepEqual(
    lenormandLexicon.map((entry) => entry.id),
    Array.from({ length: 36 }, (_, index) => index + 1)
  );
  assert.equal(new Set(lenormandLexicon.map((entry) => entry.id)).size, 36);
  assert.equal(new Set(lenormandLexicon.map((entry) => entry.name)).size, 36);
});

test("person anchors and people rules stay context-safe", () => {
  assert.equal(card(28).semanticAgency, "passive_anchor");
  assert.equal(card(29).semanticAgency, "passive_anchor");
  for (const cardId of [8, 14, 21, 23, 24, 25, 26, 27, 33]) {
    assert.equal(card(cardId).semanticAgency, "mixed");
  }
  assert.ok(card(18).personMeanings?.includes("friend"));
  assert.ok(!card(18).coreModes.includes("romantic_partner"));
  assert.ok(!mode(28, "male_person_anchor").meanings.join(" ").includes("partner"));
  assert.ok(!mode(29, "female_person_anchor").meanings.join(" ").includes("partner"));
  assert.ok(mode(26, "educated_secretive_person").planes.includes("person"));
  assert.ok(!mode(26, "educated_secretive_person").roles.includes("person_anchor"));
});

test("hard context switches and safety-gated modes are represented", () => {
  const fox = card(14);
  assert.ok(fox.coreModes.includes("employment"));
  assert.ok(
    fox.contextOverrides?.some(
      (override) =>
        override.modeId === "employment" &&
        override.adjustment === "strong_boost" &&
        override.when.some((predicate) => predicate.field === "domain" && predicate.equals === "career")
    )
  );

  assert.ok(card(32).contextOverrides?.some((override) => override.modeId === "career_vocation"));
  assert.ok(card(32).contextOverrides?.some((override) => override.modeId === "emotion_attraction"));
  assert.ok(card(32).contextOverrides?.some((override) => override.modeId === "cycle_phase"));

  assert.equal(mode(7, "third_party_factor").activation?.neighborSupportRequired, true);
  assert.equal(mode(22, "third_party_or_multiple_interest").activation?.neighborSupportRequired, true);
  assert.equal(mode(11, "sexuality").requiresContext, true);
  assert.equal(mode(30, "sexuality").requiresContext, true);
  assert.equal(mode(17, "reproductive_change").safetyTag, "pregnancy");
  assert.equal(mode(5, "health_wellbeing").safetyTag, "health");
});

test("golden semantic distinctions are preserved", () => {
  assert.ok(card(1).coreModes.includes("incoming_news"));
  assert.ok(card(1).coreModes.includes("arrival_approach"));
  assert.ok(card(1).contrasts?.includes(3));
  assert.ok(card(3).coreModes.includes("distance_movement"));
  assert.ok(card(3).coreModes.includes("travel_journey"));

  assert.ok(card(2).coreModes.includes("small_luck"));
  assert.ok(card(2).coreModes.includes("brief_opportunity"));
  assert.ok(!mode(2, "small_luck").meanings.join(" ").includes("big success"));

  assert.ok(card(4).coreModes.includes("home_residence"));
  assert.ok(card(5).coreModes.includes("roots_foundation"));
  assert.ok(card(4).contrasts?.includes(5));

  assert.ok(card(6).coreModes.includes("uncertainty"));
  assert.ok(!JSON.stringify(card(6)).includes("dark"));
  assert.ok(!JSON.stringify(card(6)).includes("light side"));

  assert.ok(card(8).coreModes.includes("ending_closure"));
  assert.ok(!card(8).semanticModes.some((item) => item.id.includes("transformation")));

  assert.ok(card(10).coreModes.includes("cut_separation"));
  assert.ok(!JSON.stringify(card(10)).toLowerCase().includes("blade direction"));
  assert.ok(!JSON.stringify(card(10)).toLowerCase().includes("artwork"));

  assert.ok(card(17).coreModes.includes("change_transition"));
  assert.ok(card(17).semanticModes.some((item) => item.id === "improvement_upgrade" && item.defaultPriority === "secondary"));
});

test("relationship and commitment rules stay separated", () => {
  assert.ok(card(24).coreModes.includes("love_affection"));
  assert.ok(card(24).coreModes.includes("attraction_passion"));
  assert.ok(!card(24).coreModes.includes("commitment_bond"));
  assert.ok(card(25).coreModes.includes("commitment_bond"));
  assert.ok(card(25).coreModes.includes("cycle_repetition"));
  assert.ok(mode(25, "marriage_union").requiresContext);
});

test("information modes are distinct across Rider, Birds, Letter, and Book", () => {
  assert.ok(mode(1, "incoming_news").meanings.includes("incoming news"));
  assert.ok(mode(12, "oral_communication").meanings.includes("oral communication"));
  assert.ok(mode(27, "written_message").meanings.includes("written message"));
  assert.ok(mode(26, "unknown_information").meanings.includes("unknown information"));
  assert.ok(mode(26, "secret_hidden").meanings.includes("secret"));
  assert.notEqual(mode(26, "unknown_information").id, mode(26, "secret_hidden").id);
  assert.ok(card(12).contrasts?.includes(27));
  assert.ok(card(26).contrasts?.includes(27));
});

test("Moon, Key, Fish, Bear, Anchor, and Cross golden rules are explicit", () => {
  const moonText = JSON.stringify(card(32)).toLowerCase();
  assert.ok(card(32).coreModes.includes("career_vocation"));
  assert.ok(card(32).coreModes.includes("recognition_reputation"));
  assert.ok(mode(32, "emotion_attraction"));
  assert.ok(mode(32, "cycle_phase"));
  assert.ok(!moonText.includes("illusion"));
  assert.ok(!moonText.includes("fear"));
  assert.ok(!moonText.includes("confusion"));

  assert.ok(card(33).coreModes.includes("solution_unlock"));
  assert.ok(card(33).coreModes.includes("confirmation_certainty"));
  assert.ok(card(33).coreModes.includes("importance_significance"));
  assert.ok(mode(33, "confirmation_certainty").notes?.includes("does not mean improve"));

  assert.ok(card(34).coreModes.includes("money_finance"));
  assert.ok(card(34).coreModes.includes("cashflow_circulation"));
  assert.ok(card(15).coreModes.includes("power_strength"));
  assert.ok(card(15).semanticModes.some((item) => item.id === "financial_assets"));
  assert.ok(card(35).coreModes.includes("stability_security"));
  assert.ok(card(35).semanticModes.some((item) => item.id === "fixed_stagnation"));
  assert.ok(card(34).contrasts?.includes(15));
  assert.ok(card(35).contrasts?.includes(34));

  assert.ok(card(36).coreModes.includes("burden_hardship"));
  assert.ok(card(36).coreModes.includes("necessity_obligation"));
  assert.ok(mode(36, "burden_hardship").safetyTag === "fate_absolute");
});

test("normalized special behaviors cover frozen behavior vocabulary without duplicate synonyms", () => {
  const allBehaviors = new Set(lenormandLexicon.flatMap((entry) => entry.specialBehaviors ?? []));
  const expectedBehaviors: SpecialBehavior[] = [
    "reduce_scale",
    "amplify_scale",
    "mark_early_stage",
    "shorten_duration",
    "reduce_clarity",
    "clarify_adjacent_theme",
    "change_adjacent_theme",
    "end_adjacent_theme",
    "cut_adjacent_theme",
    "repeat_adjacent_theme",
    "improve_tone",
    "diminish_adjacent_theme",
    "prefer_known_person",
    "signal_loyalty",
    "spread_or_connect_adjacent_theme",
    "formalize_adjacent_theme",
    "create_boundary",
    "publicize_adjacent_theme",
    "pluralize_adjacent_theme",
    "block_adjacent_theme",
    "delay_adjacent_theme",
    "open_alternatives",
    "split_adjacent_theme",
    "erode_adjacent_theme",
    "drain_resource",
    "emotionally_charge_adjacent_theme",
    "bind_adjacent_theme",
    "cycle_adjacent_theme",
    "hide_adjacent_theme",
    "mark_unknown",
    "document_adjacent_theme",
    "communicate_adjacent_theme",
    "anchor_person",
    "receive_neighbor_description",
    "extend_duration",
    "mature_adjacent_theme",
    "calm_adjacent_theme",
    "illuminate_adjacent_theme",
    "energize_adjacent_theme",
    "relieve_difficulty",
    "increase_visibility",
    "confirm_adjacent_theme",
    "mark_importance",
    "unlock_adjacent_theme",
    "make_theme_flow",
    "increase_quantity",
    "stabilize_adjacent_theme",
    "fix_adjacent_theme",
    "burden_adjacent_theme",
    "emphasize_following_theme",
    "finalize_previous_theme",
    "increase_cost"
  ];

  for (const expected of expectedBehaviors) {
    assert.ok(specialBehaviors.includes(expected), `SpecialBehavior enum missing ${expected}`);
    assert.ok(allBehaviors.has(expected), `Missing behavior ${expected}`);
  }
});
