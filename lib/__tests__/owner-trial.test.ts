import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getRuleEngineOwnerTrialAccess } from "../rule-engine-owner-trial";

const root = process.cwd();
const owner = { id: "owner-user", email: "owner@example.com" };
const nonAdmin = { id: "regular-user", email: "regular@example.com" };

test("owner trial gate denies when flag is false even for admin", () => {
  withAdminEmails(owner.email, () => {
    assert.deepEqual(getRuleEngineOwnerTrialAccess(owner, { RULE_ENGINE_OWNER_TRIAL_ENABLED: "false" }), {
      allowed: false,
      enabled: false,
      reason: "trial_disabled"
    });
  });
});

test("owner trial gate denies when flag is missing", () => {
  withAdminEmails(owner.email, () => {
    assert.deepEqual(getRuleEngineOwnerTrialAccess(owner, {}), {
      allowed: false,
      enabled: false,
      reason: "trial_disabled"
    });
  });
});

test("owner trial gate denies non-admin even when flag is true", () => {
  withAdminEmails(owner.email, () => {
    assert.deepEqual(getRuleEngineOwnerTrialAccess(nonAdmin, { RULE_ENGINE_OWNER_TRIAL_ENABLED: "true" }), {
      allowed: false,
      enabled: true,
      reason: "not_admin"
    });
  });
});

test("owner trial gate allows admin only when flag is exactly true", () => {
  withAdminEmails(owner.email, () => {
    assert.deepEqual(getRuleEngineOwnerTrialAccess(owner, { RULE_ENGINE_OWNER_TRIAL_ENABLED: "true" }), {
      allowed: true,
      enabled: true,
      reason: "allowed"
    });
    assert.equal(getRuleEngineOwnerTrialAccess(owner, { RULE_ENGINE_OWNER_TRIAL_ENABLED: "yes" }).allowed, false);
  });
});

test("direct rule engine APIs are protected by the same owner trial gate", () => {
  const sourceRoute = read("app/api/deep-reading/source/route.ts");
  const ruleRoute = read("app/api/deep-reading/rule-engine/route.ts");
  const trialRoute = read("app/api/deep-reading/rule-engine/trial-access/route.ts");

  assert.match(sourceRoute, /getRuleEngineOwnerTrialAccess\(user\)/);
  assert.match(sourceRoute, /input\.explicitSource === "rule_engine"/);
  assert.match(sourceRoute, /RULE_ENGINE_TRIAL_FORBIDDEN/);
  assert.match(ruleRoute, /getRuleEngineOwnerTrialAccess\(user\)/);
  assert.match(ruleRoute, /RULE_ENGINE_TRIAL_FORBIDDEN/);
  assert.ok(ruleRoute.indexOf("const access = getRuleEngineOwnerTrialAccess(user)") < ruleRoute.indexOf("const result = generateRuleEngineReading"));
  assert.match(trialRoute, /requireSupabaseUser\(request\)/);
});

test("owner trial UI uses server access and records explicit rule source", () => {
  const client = read("app/deep/DeepProjectClient.tsx");
  const store = read("lib/project-store.ts");

  assert.match(client, /getRuleEngineOwnerTrialAccess\(\)/);
  assert.match(client, /试用 V2 规则解读/);
  assert.match(client, /explicitSource: ruleEngineTrialAllowed && useRuleEngineTrial \? "rule_engine" : undefined/);
  assert.match(store, /\/api\/deep-reading\/rule-engine\/trial-access/);
  assert.match(store, /JSON\.stringify\(\{ spreadType, explicitSource \}\)/);
});

test("result badge shows rule version only from stored rule metadata", () => {
  const client = read("app/deep/DeepProjectClient.tsx");

  assert.match(client, /reading\.interpretationSource === "rule_engine" && Boolean\(reading\.ruleEngineVersion\) && Boolean\(reading\.ruleEngineResult\)/);
  assert.match(client, /Rule-based \/ \$\{reading\.ruleEngineVersion\}/);
});

function withAdminEmails(value: string, callback: () => void) {
  const previous = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = value;
  try {
    callback();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "ADMIN_EMAILS");
    } else {
      process.env.ADMIN_EMAILS = previous;
    }
  }
}

function read(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}
