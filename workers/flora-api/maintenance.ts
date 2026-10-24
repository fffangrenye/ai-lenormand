import { createHmac, timingSafeEqual } from "node:crypto";
import { LocalPaidError } from "../../lib/paid-local/guard";
export type MaintenanceJob = {purpose: "flora-private-maintenance-v1"; expiresAt: number; action: "inspect" | "backup-begin" | "backup-page" | "backup-end" | "stock-generate" | "stock-export"; actor: string; backupId?: string; table?: string; after?: number; packageId?: string; quantity?: number; requestKey?: string; reason?: string; batchId?: string};
const actions = new Set(["inspect", "backup-begin", "backup-page", "backup-end", "stock-generate", "stock-export"]);
export async function verifyMaintenance(request: Pick<Request,"method"|"headers"|"text">, key: string, admins: string): Promise<MaintenanceJob> {
  const denied = () => { throw new LocalPaidError("FORBIDDEN", "私有维护请求无效或已过期。", 403); };
  if (request.method !== "POST" || Number(request.headers.get("content-length") || 0) > 8000) denied();
  const body = await request.text(), signature = request.headers.get("x-flora-maintenance-signature") || "";
  if (body.length > 8000 || !/^[a-f0-9]{64}$/.test(signature) || key.length < 48) denied();
  const expected = createHmac("sha256", key).update("flora-private-maintenance:v1\n" + body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature,"hex"))) denied();
  let job: MaintenanceJob; try { job = JSON.parse(body); } catch { return denied(); }
  if (!job || typeof job !== "object" || Array.isArray(job) || job.purpose !== "flora-private-maintenance-v1" || !actions.has(job.action) || !Number.isSafeInteger(job.expiresAt) || job.expiresAt < Date.now() || job.expiresAt > Date.now() + 5*60_000 || typeof job.actor !== "string" || !admins.split(",").map(v=>v.trim().toLowerCase()).includes(job.actor.toLowerCase())) denied();
  return job;
}
