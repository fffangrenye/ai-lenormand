import { NextResponse } from "next/server";
import { FREE_DEEP_READING_LIMIT } from "@/lib/reading-quota";
import { checkDailyQuota, isAdminEmail, requireSupabaseUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSupabaseUser(request);
    const quota = isAdminEmail(user.email)
      ? { used: 0, remaining: 999, limit: 999, resetLabel: "管理员无限额度" }
      : { ...(await checkDailyQuota(user.id, "deep_reading", FREE_DEEP_READING_LIMIT)), limit: FREE_DEEP_READING_LIMIT };
    return NextResponse.json(quota, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return NextResponse.json({ error: unauthorized ? "Unauthorized" : "额度暂时无法读取" }, { status: unauthorized ? 401 : 503 });
  }
}
