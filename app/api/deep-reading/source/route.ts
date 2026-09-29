import { NextResponse } from "next/server";
import { getRuleEngineFeatureFlags, InterpretationSource, resolveInterpretationSource, spreadSizeForSpreadType } from "@/lib/reading-source";
import { getRuleEngineOwnerTrialAccess } from "@/lib/rule-engine-owner-trial";
import { requireSupabaseUser } from "@/lib/supabase-server";

type SourceRequest = {
  spreadType?: string;
  explicitSource?: InterpretationSource;
};

export async function POST(request: Request) {
  try {
    const user = await requireSupabaseUser(request);
    const input = (await request.json().catch(() => ({}))) as SourceRequest;
    if (input.explicitSource === "rule_engine") {
      const access = getRuleEngineOwnerTrialAccess(user);
      if (!access.allowed) {
        return NextResponse.json({ code: "RULE_ENGINE_TRIAL_FORBIDDEN", error: access.reason }, { status: 403 });
      }
    }
    const resolution = resolveInterpretationSource({
      flags: getRuleEngineFeatureFlags(),
      spreadSize: spreadSizeForSpreadType(input.spreadType ?? ""),
      explicitSource: input.explicitSource,
      cohortKey: user.id
    });
    return NextResponse.json(resolution);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ code: "UNAUTHORIZED", error: "请重新登录后再生成解读。" }, { status: 401 });
    }
    return NextResponse.json({ code: "SOURCE_RESOLUTION_FAILED", error: "Reading source resolution failed." }, { status: 500 });
  }
}
