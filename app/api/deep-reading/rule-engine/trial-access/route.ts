import { NextResponse } from "next/server";
import { getRuleEngineOwnerTrialAccess } from "@/lib/rule-engine-owner-trial";
import { requireSupabaseUser } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request);
    return NextResponse.json(getRuleEngineOwnerTrialAccess(user));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ code: "UNAUTHORIZED", error: "请重新登录后再试用 V2 规则解读。" }, { status: 401 });
    }
    return NextResponse.json({ code: "TRIAL_ACCESS_FAILED", error: "Rule engine trial access check failed." }, { status: 500 });
  }
}
