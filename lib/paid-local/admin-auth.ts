import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertLocalEnvironment, LocalPaidError } from "./guard";

export function localAdminKey() {
  const filename = path.join(path.dirname(assertLocalEnvironment()), "admin-access.txt");
  if (!existsSync(filename)) { try { writeFileSync(filename, randomBytes(24).toString("hex") + "\n", { flag: "wx", mode: 0o600 }); } catch (error) { if (!existsSync(filename)) throw error; } }
  const key = readFileSync(filename, "utf8").trim();
  if (!/^[a-f0-9]{48}$/.test(key)) throw new LocalPaidError("ADMIN_CONFIG", "本地管理员口令文件格式不正确。", 503);
  return key;
}
const hash = (value: string) => createHash("sha256").update(value).digest();
export function validAdminKey(value: string) { return timingSafeEqual(hash(value), hash(localAdminKey())); }
export function signMockNotification(payload: string) {
  assertLocalEnvironment();
  return createHmac("sha256", localAdminKey()).update("local-simulation-v3:" + payload).digest("hex");
}
export function verifyMockNotification(payload: string, signature: string) {
  return /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signMockNotification(payload), "hex"));
}
