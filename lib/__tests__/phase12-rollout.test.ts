import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getEffectiveInterpretationSource,
  getRuleEngineFeatureFlags,
  resolveInterpretationSource,
  stablePercentBucket,
  validateReadingSourceIntegrity
} from "../reading-source";

const root = process.cwd();

test("rollout=0 keeps eligible readings on AI when default is AI", () => {
  const result = resolveInterpretationSource({
    flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ROLLOUT_PERCENT: "0" }),
    spreadSize: 3,
    cohortKey: "user-a"
  });
  assert.equal(result.source, "ai");
  assert.equal(result.reason, "default_ai");
});

test("rollout=1 selects only deterministic 1 percent cohort", () => {
  const included = findCohortKeyBelow(1);
  const excluded = findCohortKeyAtLeast(1);
  assert.equal(stablePercentBucket(included), 0);
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ROLLOUT_PERCENT: "1" }),
      spreadSize: 3,
      cohortKey: included
    }).source,
    "rule_engine"
  );
  assert.equal(
    resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ROLLOUT_PERCENT: "1" }),
      spreadSize: 3,
      cohortKey: excluded
    }).source,
    "ai"
  );
});

test("rollout=10 uses stable bucket routing", () => {
  const included = findCohortKeyBelow(10);
  const excluded = findCohortKeyAtLeast(10);
  const flags = getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ROLLOUT_PERCENT: "10" });
  const first = resolveInterpretationSource({ flags, spreadSize: 5, cohortKey: included });
  const second = resolveInterpretationSource({ flags, spreadSize: 5, cohortKey: included });
  assert.equal(first.source, "rule_engine");
  assert.equal(first.reason, "rollout_rule_engine");
  assert.deepEqual(second, first);
  assert.equal(resolveInterpretationSource({ flags, spreadSize: 5, cohortKey: excluded }).source, "ai");
});

test("rollout=100 sends all eligible readings to rule engine", () => {
  for (const key of ["user-a", "user-b", "project-1", "reading-2"]) {
    assert.equal(
      resolveInterpretationSource({
        flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "false", RULE_ENGINE_ROLLOUT_PERCENT: "100" }),
        spreadSize: 3,
        cohortKey: key
      }).source,
      "rule_engine"
    );
  }
});

test("ineligible spreads and disabled flag always route to AI regardless rollout", () => {
  const rolloutAll = getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_DEFAULT: "true", RULE_ENGINE_ROLLOUT_PERCENT: "100" });
  assert.equal(resolveInterpretationSource({ flags: rolloutAll, spreadSize: 4, cohortKey: "user-a" }).source, "ai");
  assert.equal(resolveInterpretationSource({ flags: rolloutAll, spreadSize: 0, cohortKey: "user-a" }).source, "ai");

  const disabled = getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "false", RULE_ENGINE_DEFAULT: "true", RULE_ENGINE_ROLLOUT_PERCENT: "100" });
  assert.equal(resolveInterpretationSource({ flags: disabled, spreadSize: 3, cohortKey: "user-a" }).source, "ai");
  assert.equal(resolveInterpretationSource({ flags: disabled, spreadSize: 5, explicitSource: "rule_engine", cohortKey: "user-a" }).source, "ai");
});

test("kill switch changes new routing without changing historical source semantics", () => {
  const before = resolveInterpretationSource({
    flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "true", RULE_ENGINE_ROLLOUT_PERCENT: "100" }),
    spreadSize: 3,
    cohortKey: "user-a"
  });
  const after = resolveInterpretationSource({
    flags: getRuleEngineFeatureFlags({ RULE_ENGINE_ENABLED: "false", RULE_ENGINE_ROLLOUT_PERCENT: "100" }),
    spreadSize: 3,
    cohortKey: "user-a"
  });
  assert.equal(before.source, "rule_engine");
  assert.equal(after.source, "ai");
  assert.equal(getEffectiveInterpretationSource("rule_engine"), "rule_engine");
  assert.equal(getEffectiveInterpretationSource(null), "ai");
});

test("source integrity rules distinguish rule engine, AI, and legacy rows", () => {
  assert.deepEqual(validateReadingSourceIntegrity({ interpretationSource: "rule_engine", ruleEngineVersion: "1.0.0-rc.1", ruleEngineResult: { ok: true } }), {
    source: "rule_engine",
    valid: true,
    issues: []
  });
  assert.equal(validateReadingSourceIntegrity({ interpretationSource: "rule_engine", ruleEngineVersion: null, ruleEngineResult: null }).valid, false);
  assert.equal(validateReadingSourceIntegrity({ interpretationSource: "ai", ruleEngineVersion: null, ruleEngineResult: null }).valid, true);
  assert.equal(validateReadingSourceIntegrity({ interpretationSource: "ai", ruleEngineVersion: "1.0.0-rc.1", ruleEngineResult: null }).valid, false);
  assert.equal(validateReadingSourceIntegrity({ interpretationSource: null, ruleEngineVersion: null, ruleEngineResult: null }).valid, true);
});

test("rule route keeps quota isolation while hybrid verbalizer is explicit and guarded", () => {
  const ruleRoute = read("app/api/deep-reading/rule-engine/route.ts");
  const store = read("lib/project-store.ts");
  assert.doesNotMatch(ruleRoute, /checkDailyQuota|consumeDailyQuota/);
  assert.match(ruleRoute, /verbalizeWithAiGuard/);
  assert.match(ruleRoute, /verbalization_source/);
  assert.match(store, /existingReading\.interpretationSource === "rule_engine"/);
  assert.match(store, /await saveCompletedReading\(readingId, result\);\s+return;/);
  assert.match(store, /reading\.interpretationSource !== "rule_engine"/);
});

test("runbook documents preview checklist, metrics, rollback, and DB-first order", () => {
  const runbook = read("docs/rule-engine-rollout.md");
  assert.match(runbook, /RULE_ENGINE_ROLLOUT_PERCENT/);
  assert.match(runbook, /DB first/);
  assert.match(runbook, /kill switch/i);
  assert.match(runbook, /follow-up still AI/i);
  assert.match(runbook, /3\/5/);
});

function findCohortKeyBelow(percent: number) {
  for (let index = 0; index < 1000; index += 1) {
    const key = `cohort-${index}`;
    if (stablePercentBucket(key) < percent) return key;
  }
  throw new Error(`No test key found below ${percent}`);
}

function findCohortKeyAtLeast(percent: number) {
  for (let index = 0; index < 1000; index += 1) {
    const key = `cohort-${index}`;
    if (stablePercentBucket(key) >= percent) return key;
  }
  throw new Error(`No test key found at least ${percent}`);
}

function read(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}
