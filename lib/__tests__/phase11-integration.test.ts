import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cardIdsFromReadingCards, generateRuleEngineReading } from "../rule-engine-production";
import { getRuleEngineFeatureFlags, resolveInterpretationSource, spreadSizeForSpreadType } from "../reading-source";

const root = process.cwd();

test("feature flag resolver keeps production default on AI", () => {
  assert.deepEqual(getRuleEngineFeatureFlags({}), {
    enabled: false,
    defaultSource: "ai",
    explicitOverrideAllowed: false,
    rolloutPercent: 0
  });
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "false", RULE_ENGINE_ALLOW_EXPLICIT: "true" }),
      spreadSize: 3,
      explicitSource: "rule_engine"
    }).source,
    "ai"
  );
});

test("feature flag resolver supports default AI, explicit internal rule, and default rule", () => {
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false" }),
      spreadSize: 3
    }).source,
    "ai"
  );
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ALLOW_EXPLICIT: "true" }),
      spreadSize: 3,
      explicitSource: "rule_engine"
    }).source,
    "rule_engine"
  );
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "true" }),
      spreadSize: 3
    }).source,
    "rule_engine"
  );
});

test("eligibility pre-routes unsupported spreads to AI before generation", () => {
  assert.equal(spreadSizeForSpreadType("three_card"), 3);
  assert.equal(spreadSizeForSpreadType("five_card_linear"), 5);
  const result = resolveInterpretationSource({
    flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "true" }),
    spreadSize: 4
  });
  assert.equal(result.source, "ai");
  assert.equal(result.reason, "unsupported_spread");
});

test("rule generation maps stored card slugs to ordered rule engine card ids", () => {
  const cards = [
    storedCard(1, "rider", "Rider", "骑士"),
    storedCard(2, "letter", "Letter", "信"),
    storedCard(3, "key", "Key", "钥匙")
  ];
  assert.deepEqual(cardIdsFromReadingCards(cards), [1, 27, 33]);
  const result = generateRuleEngineReading({ question: "三天内会收到消息吗？", cards, spreadType: "three_card" });
  assert.equal(result.ruleEngineVersion, "1.0.0-rc.2");
  assert.equal(result.ruleEngineSchemaVersion, "1");
  assert.equal(result.ruleEngineResult.versions.source, "rule_engine");
  assert.ok(result.deepReadingResult.core_conclusion);
  assert.ok(result.deepReadingResult.interpretation);
});

test("rendered rule output persists in current DeepReadingResult fields", () => {
  const result = generateRuleEngineReading({
    question: "他喜欢我吗？",
    spreadType: "three_card",
    cards: [storedCard(1, "heart", "Heart", "心"), storedCard(2, "clouds", "Clouds", "云"), storedCard(3, "ring", "Ring", "戒指")]
  });
  assert.equal(result.deepReadingResult.core_conclusion, result.ruleEngineResult.rendered.answerLead || result.ruleEngineResult.rendered.headline);
  assert.match(result.deepReadingResult.interpretation, /不确定|清楚|感觉|关系/);
  assert.equal("debugTrace" in result.ruleEngineResult.synthesis, false);
  assert.equal("debugTrace" in result.ruleEngineResult.tempo, false);
  assert.equal("debugTrace" in result.ruleEngineResult.answer, false);
});

test("Stage 1.1 production DeepReadingResult fields do not expose internal renderer labels", () => {
  const result = generateRuleEngineReading({
    question: "他对我是什么感觉？",
    spreadType: "three_card",
    cards: [storedCard(1, "heart", "Heart", "心"), storedCard(2, "clouds", "Clouds", "云"), storedCard(3, "ring", "Ring", "戒指")]
  });
  const visible = [
    result.deepReadingResult.core_conclusion,
    result.deepReadingResult.interpretation,
    result.deepReadingResult.time_window,
    result.deepReadingResult.uncertainty
  ].filter(Boolean).join("\n");

  assert.doesNotMatch(
    visible,
    /attraction_passion|attraction passion|uncertainty|commitment_bond|pair_unresolved|high_ambiguity|some pair modes remain close alternatives|OVERRIDE_|PAIR_|CARD_|TRANSITION_|internalScore/
  );
  assert.doesNotMatch(visible, /\b(?:[a-z]+_){1,}[a-z0-9]+\b/);
  assert.match(visible, /吸引|感情/);
  assert.match(visible, /不确定|不够清楚|不明确|未定/);
});

test("project-store routes rule readings without AI or quota fallback", () => {
  const source = read("lib/project-store.ts");
  assert.match(source, /existingReading\.interpretationSource === "rule_engine"/);
  assert.match(source, /\/api\/deep-reading\/rule-engine/);
  assert.match(source, /saveFailedReading\(readingId, payload\.reason, payload\.code\)/);
  assert.match(source, /await saveCompletedReading\(readingId, result\);\s+return;/);
});

test("AI route keeps quota while rule route uses only guarded verbalizer without AI initial quota", () => {
  const aiRoute = read("app/api/deep-reading/route.ts");
  const ruleRoute = read("app/api/deep-reading/rule-engine/route.ts");
  assert.match(aiRoute, /checkDailyQuota/);
  assert.match(aiRoute, /consumeDailyQuota/);
  assert.match(aiRoute, /callDeepSeek/);
  assert.match(aiRoute, /eventName: "ai_success"/);
  assert.match(aiRoute, /eventName: "reading_generation_success"/);
  assert.match(aiRoute, /source: "ai"/);
  assert.doesNotMatch(ruleRoute, /checkDailyQuota|consumeDailyQuota|callDeepSeek/);
  assert.match(ruleRoute, /verbalizeWithAiGuard/);
  assert.match(ruleRoute, /deterministicVerbalizerFallback/);
  assert.match(ruleRoute, /eventName: "reading_generation_success"/);
  assert.match(ruleRoute, /source: "rule_engine"/);
});

test("history and follow-up compatibility preserve source without rerunning rule engine", () => {
  const store = read("lib/project-store.ts");
  const followUp = read("app/api/deep-reading/follow-up/route.ts");
  assert.match(store, /interpretationSource: row\.interpretation_source \?\? "ai"/);
  assert.match(store, /interpretationSource: reading\.interpretationSource \?\? "ai"/);
  assert.match(store, /ruleEngineSummary: reading\.ruleEngineResult/);
  assert.match(followUp, /INITIAL READING SOURCE/);
  assert.match(followUp, /RULE ENGINE SUMMARY IF PRESENT/);
});

test("migration is additive and non-destructive", () => {
  const migration = read("supabase/migrations/202608280001_add_rule_engine_reading_metadata.sql");
  assert.match(migration, /alter table public\.deep_readings/i);
  assert.match(migration, /add column if not exists interpretation_source text/i);
  assert.match(migration, /add column if not exists rule_engine_result jsonb/i);
  assert.match(migration, /check \(interpretation_source is null or interpretation_source in \('ai', 'rule_engine'\)\)/i);
  assert.doesNotMatch(migration, /\b(drop|truncate|delete|rename)\b/i);
});

function storedCard(cardNumber: number, cardSlug: string, nameEn: string, nameZh: string) {
  return {
    id: `${cardNumber}`,
    readingId: "reading",
    cardNumber,
    cardSlug,
    position: String.fromCharCode(64 + cardNumber),
    nameEn,
    nameZh
  };
}

function read(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}
