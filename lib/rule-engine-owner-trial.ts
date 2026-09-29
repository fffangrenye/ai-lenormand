import { isAdminEmail, SupabaseUser } from "./supabase-server";

export type RuleEngineOwnerTrialAccess = {
  allowed: boolean;
  enabled: boolean;
  reason: "allowed" | "trial_disabled" | "not_admin";
};

export function isRuleEngineOwnerTrialEnabled(env: Record<string, string | undefined> = process.env) {
  return env.RULE_ENGINE_OWNER_TRIAL_ENABLED?.trim().toLowerCase() === "true";
}

export function getRuleEngineOwnerTrialAccess(user: SupabaseUser, env: Record<string, string | undefined> = process.env): RuleEngineOwnerTrialAccess {
  const enabled = isRuleEngineOwnerTrialEnabled(env);
  if (!enabled) {
    return { allowed: false, enabled, reason: "trial_disabled" };
  }

  if (!isAdminEmail(user.email)) {
    return { allowed: false, enabled, reason: "not_admin" };
  }

  return { allowed: true, enabled, reason: "allowed" };
}
