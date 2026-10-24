import { randomUUID, randomInt } from "node:crypto";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { lenormandCards } from "../lenormand-cards";
import { getDeepSpread, isDeepSpread, positionLabels } from "../deep-spreads";
import { paidConfig } from "./config";
import { dailyDeck, readingForDailyCard } from "../daily-fortune";
import { beijingDateKey, checkInTimeZone, consecutiveCheckInProgress, nextBeijingMidnight, validCalendarMonth } from "../check-in-calendar";
import type { DailyCheckInResult, DailyCheckInState, DailyFortuneEntry } from "./types";
import { LocalPaidError } from "./guard";
import { LocalRedemptions } from "./redemption-store";
import {restoreLegacyHistory,type LegacySnapshot} from "./legacy-restore";
import type { PaidCard, PaidDrawSession, PaidOverview, PaidProject, PaidReading, PaidResult, PaidSpread, PaidLedgerPage } from "./types";

type Row = Record<string, string | number | null>;
type ReadingRelations = { follows: Row[]; projectId?: string; completedAt?: string };

export class PaidLedger {
  private initializedUsers = new Map<string, string>();
  private checkedProjectLinks = new Set<string>();
  readonly redemptions: LocalRedemptions;
  constructor(protected db: DatabaseSync, private transaction: <T>(work: () => T) => T, protected clock: () => number = Date.now, codeConfig?: { key: () => string; prefix: string }) {
    this.redemptions = new LocalRedemptions(this.port(), codeConfig);
  }
  protected port() { return { one:(sql: string,...params: SQLInputValue[])=>this.one(sql,...params), all:(sql: string,...params: SQLInputValue[])=>this.all(sql,...params), run:(sql: string,...params: SQLInputValue[])=>this.run(sql,...params), tx:<T>(action:()=>T)=>this.tx(action), clock:()=>this.clock(), grant:(user: string,count: number,source: string,event: string,reason?: string)=>this.grant(user,count,source,event,reason), ledger:(user: string,batch: string,event: string,kind: string,available: number,reserved: number,consumed: number,reason: string)=>this.ledger(user,batch,event,kind,available,reserved,consumed,reason) }; }
  ensureUser(id: string, email: string) {
    if (this.initializedUsers.get(id) === email) return;
    this.tx(() => {
      const previous = this.one("SELECT label FROM local_users WHERE id=?", id);
      if (!previous) this.run("INSERT INTO local_users VALUES (?,?,?,?)", id, email, "new", this.now());
      else if (previous.label !== email) this.run("UPDATE local_users SET label=? WHERE id=?", email, id);
      this.grant(id, paidConfig.welcomeCredits, "welcome", `${paidConfig.grantVersion}:onboarding:${id}`);
      this.adjustTrialCredits(id);
    });
    if (this.initializedUsers.size >= 2000) this.initializedUsers.clear();
    this.initializedUsers.set(id, email);
  }
  protected now() { return new Date(this.clock()).toISOString(); }
  restoreLegacy(snapshot:LegacySnapshot,jobId:string,dryRun:boolean){return restoreLegacyHistory(this.port(),snapshot,jobId,dryRun);}
  protected all(sql: string, ...params: SQLInputValue[]) { return this.db.prepare(sql).all(...params) as Row[]; }
  protected one(sql: string, ...params: SQLInputValue[]) { return this.db.prepare(sql).get(...params) as Row | undefined; }
  protected run(sql: string, ...params: SQLInputValue[]) { return this.db.prepare(sql).run(...params); }
  protected tx<T>(work: () => T): T { return this.transaction(work); }
  protected ledger(userId: string, batchId: string, event: string, kind: string, available: number, reserved: number, consumed: number, reason: string) {
    this.run("INSERT INTO credit_ledger VALUES (?,?,?,?,?,?,?,?,?,?)", randomUUID(), userId, batchId, event, kind, available, reserved, consumed, reason, this.now());
  }
  // Keep the original onboarding event key: reducing the allowance must never
  // issue another welcome gift. Completed/reserved readings remain valid.
  protected adjustTrialCredits(userId: string) {
    const batch = this.one("SELECT * FROM credit_batches WHERE user_id=? AND source IN ('welcome','legacy_launch') AND event_key=?", userId, `${paidConfig.grantVersion}:onboarding:${userId}`);
    if (!batch) return;
    const target = Math.max(paidConfig.welcomeCredits, Number(batch.consumed) + Number(batch.reserved) + Number(batch.revoked));
    const reduction = Number(batch.quantity) - target;
    if (reduction <= 0) return;
    this.run("UPDATE credit_batches SET quantity=? WHERE id=?", target, batch.id);
    this.ledger(userId, String(batch.id), `trial-limit:v3:${batch.id}:${target}`, "trial_adjustment", -reduction, 0, 0, `V3 免费试用调整为一次性 ${paidConfig.welcomeCredits} 次，仅调整未使用的试用额度`);
  }
  protected grant(userId: string, quantity: number, source: string, event: string, reason?: string) {
    const previous = this.one("SELECT id FROM credit_batches WHERE event_key=?", event);
    if (previous) return String(previous.id);
    const id = randomUUID();
    this.run("INSERT INTO credit_batches(id,user_id,source,event_key,quantity,created_at) VALUES (?,?,?,?,?,?)", id, userId, source, event, quantity, this.now());
    this.ledger(userId, id, `grant:${event}`, source, quantity, 0, 0, reason || (source === "local_test" ? "本地测试补充 5 花瓣（非充值）" : source === "legacy_launch" ? `老用户启用赠送 ${quantity} 次` : `首次体验赠送 ${quantity} 次`));
    return id;
  }
  protected dailyEntry(row: Row): DailyFortuneEntry {
    return { date: String(row.date_key), card: JSON.parse(String(row.card_json)), fortune: JSON.parse(String(row.fortune_json)), createdAt: String(row.created_at) };
  }
  dailyCalendar(userId: string, requestedMonth?: string, timestamp = this.clock()): DailyCheckInState {
    if (!this.one("SELECT id FROM local_users WHERE id=?", userId)) throw new LocalPaidError("UNAUTHORIZED", "请先登录，保存你的签到与今日牌。", 401);
    const today = beijingDateKey(timestamp); const month = requestedMonth || today.slice(0, 7);
    if (!validCalendarMonth(month)) throw new LocalPaidError("INVALID_MONTH", "请选择有效月份。");
    const todayRow = this.one("SELECT * FROM daily_check_ins WHERE user_id=? AND date_key=?", userId, today);
    const dates = this.all("SELECT date_key FROM daily_check_ins WHERE user_id=?", userId).map((row) => String(row.date_key));
    const totalDays = dates.length;
    const { currentStreak } = consecutiveCheckInProgress(dates, today);
    const totalRewards = Number(this.one("SELECT (SELECT count(*) FROM check_in_rewards WHERE user_id=?) + (SELECT count(*) FROM consecutive_check_in_rewards WHERE user_id=?) AS n", userId, userId)?.n || 0);
    const balance = this.one("SELECT coalesce(sum(quantity-reserved-consumed-revoked),0) AS available,coalesce(sum(reserved),0) AS reserved,coalesce(sum(consumed),0) AS consumed FROM credit_batches WHERE user_id=?", userId)!;
    const rewardEvery = paidConfig.checkInRewardDays;
    return { userId, today, timeZone: checkInTimeZone, serverNow: new Date(timestamp).toISOString(), nextResetAt: nextBeijingMidnight(timestamp), month,
      todayEntry: todayRow ? this.dailyEntry(todayRow) : null, entries: this.all("SELECT * FROM daily_check_ins WHERE user_id=? AND date_key LIKE ? ORDER BY date_key", userId, `${month}-%`).map((row) => this.dailyEntry(row)),
      totalDays, currentStreak, totalRewards, rewardEvery, cycleDays: currentStreak === 0 ? 0 : (currentStreak - 1) % rewardEvery + 1, nextRewardIn: rewardEvery - currentStreak % rewardEvery,
      balance: { available: Number(balance.available), reserved: Number(balance.reserved), consumed: Number(balance.consumed) } };
  }
  dailyStatus(userId: string) {
    const today = beijingDateKey(this.clock());
    return { today, signed: Boolean(this.one("SELECT date_key FROM daily_check_ins WHERE user_id=? AND date_key=?", userId, today)) };
  }
  checkIn(userId: string): DailyCheckInResult {
    const timestamp = this.clock(); const today = beijingDateKey(timestamp);
    const result = this.tx(() => {
      if (!this.one("SELECT id FROM local_users WHERE id=?", userId)) throw new LocalPaidError("UNAUTHORIZED", "请先登录，保存你的签到与今日牌。", 401);
      let row = this.one("SELECT * FROM daily_check_ins WHERE user_id=? AND date_key=?", userId, today);
      const newlyCheckedIn = !row;
      if (!row) {
        const card = dailyDeck[randomInt(dailyDeck.length)];
        this.run("INSERT INTO daily_check_ins VALUES (?,?,?,?,?,?)", userId, today, card.number, JSON.stringify(card), JSON.stringify(readingForDailyCard(card)), new Date(timestamp).toISOString());
        row = this.one("SELECT * FROM daily_check_ins WHERE user_id=? AND date_key=?", userId, today)!;
      }
      const grantedMilestones: number[] = [];
      if (newlyCheckedIn) {
        const dates = this.all("SELECT date_key FROM daily_check_ins WHERE user_id=?", userId).map((item) => String(item.date_key));
        const { currentStreak, streakStart } = consecutiveCheckInProgress(dates, today);
        if (currentStreak > 0 && currentStreak % paidConfig.checkInRewardDays === 0) {
          const batch = this.grant(userId, 1, "checkin_reward", `checkin:consecutive:${userId}:${streakStart}:${currentStreak}`, `连续签到 ${currentStreak} 天奖励 1 花瓣（可解锁完整解读及 2 次追问）`);
          this.run("INSERT INTO consecutive_check_in_rewards VALUES (?,?,?,?,?,?)", userId, streakStart, currentStreak, batch, today, new Date(timestamp).toISOString());
          grantedMilestones.push(currentStreak);
        }
      }
      return { entry: this.dailyEntry(row), newlyCheckedIn, grantedMilestones };
    });
    return { ...this.dailyCalendar(userId, undefined, timestamp), ...result };
  }
  protected ownedProject(userId: string, projectId: string) {
    const project = this.one("SELECT * FROM local_projects WHERE id=? AND user_id=? AND archived_at IS NULL", projectId, userId);
    if (!project) throw new LocalPaidError("NOT_FOUND", "找不到这个项目。", 404);
    return project;
  }
  protected serializeProject(row: Row, email?: string): PaidProject {
    return { id: String(row.id), userEmail: email || String(this.one("SELECT label FROM local_users WHERE id=?", row.user_id)?.label || row.user_id), title: String(row.title), background: String(row.background), memorySummary: String(row.memory_summary), createdAt: String(row.created_at), updatedAt: String(row.updated_at), lastOpenedAt: String(row.last_opened_at) };
  }
  projects(userId: string) {
    // Preserve records created in the earlier isolated prototype, without
    // touching any production history or changing their entitlements.
    if (!this.checkedProjectLinks.has(userId)) {
      this.tx(() => {
      const unlinked = this.one("SELECT id FROM paid_readings WHERE user_id=? AND id NOT IN (SELECT reading_id FROM local_reading_projects) LIMIT 1", userId);
      if (unlinked) {
        const id = `${userId}-previous-local`;
        this.run("INSERT OR IGNORE INTO local_projects(id,user_id,title,created_at,updated_at,last_opened_at) VALUES (?,?,?,?,?,?)", id, userId, "本地体验记录", this.now(), this.now(), this.now());
        this.run("INSERT INTO local_reading_projects SELECT id,? FROM paid_readings WHERE user_id=? AND id NOT IN (SELECT reading_id FROM local_reading_projects)", id, userId);
      }
      });
      if (this.checkedProjectLinks.size >= 2000) this.checkedProjectLinks.clear();
      this.checkedProjectLinks.add(userId);
    }
    const email = String(this.one("SELECT label FROM local_users WHERE id=?", userId)?.label || userId);
    return this.all("SELECT * FROM local_projects WHERE user_id=? AND archived_at IS NULL ORDER BY last_opened_at DESC,id", userId).map((row) => this.serializeProject(row, email));
  }
  project(userId: string, id: string) { return this.serializeProject(this.ownedProject(userId, id)); }
  ensureDefaultProject(userId: string) {
    return this.tx(() => {
      const existing = this.one("SELECT * FROM local_projects WHERE user_id=? AND archived_at IS NULL ORDER BY last_opened_at DESC,id LIMIT 1", userId);
      if (existing) return this.serializeProject(existing);
      const id = randomUUID();
      this.run("INSERT INTO local_projects(id,user_id,title,created_at,updated_at,last_opened_at) VALUES (?,?,?,?,?,?)", id, userId, "我的占卜", this.now(), this.now(), this.now());
      return this.project(userId, id);
    });
  }
  saveProject(userId: string, input: { title?: string; background?: string; memorySummary?: string }, id?: string) {
    return this.tx(() => {
      const previous = id ? this.ownedProject(userId, id) : null;
      const title = (input.title ?? String(previous?.title ?? "")).trim();
      const background = (input.background ?? String(previous?.background ?? "")).trim();
      const memory = (input.memorySummary ?? String(previous?.memory_summary ?? "")).trim();
      if (!title || title.length > 100 || background.length > 5000 || memory.length > 2000) throw new LocalPaidError("INVALID_PROJECT", "项目名称需要 1–100 字，背景最多 5000 字，记忆最多 2000 字。");
      const projectId = id || randomUUID();
      if (previous) this.run("UPDATE local_projects SET title=?,background=?,memory_summary=?,updated_at=? WHERE id=?", title, background, memory, this.now(), projectId);
      else this.run("INSERT INTO local_projects(id,user_id,title,background,memory_summary,created_at,updated_at,last_opened_at) VALUES (?,?,?,?,?,?,?,?)", projectId, userId, title, background, memory, this.now(), this.now(), this.now());
      return this.project(userId, projectId);
    });
  }
  touchProject(userId: string, id: string) { const row = this.ownedProject(userId, id); if(this.clock()-Date.parse(String(row.last_opened_at))>=300_000)this.run("UPDATE local_projects SET last_opened_at=? WHERE id=?", this.now(), id); }
  archiveProject(userId: string, id: string) { this.ownedProject(userId, id); this.run("UPDATE local_projects SET archived_at=? WHERE id=?", this.now(), id); }
  projectReadings(userId: string, projectId: string) {
    this.ownedProject(userId, projectId); this.recoverExpired(userId);
    return this.all("SELECT p.* FROM paid_readings p JOIN local_reading_projects l ON l.reading_id=p.id WHERE p.user_id=? AND l.project_id=? ORDER BY p.created_at DESC,p.id DESC", userId, projectId).map((row) => this.serialize(row));
  }
  projectReadingPage(userId: string, projectId: string, cursor = "") {
    this.ownedProject(userId, projectId); this.recoverExpired(userId);
    const before = this.readCursor(cursor);
    const rows = this.all("SELECT p.*,l.project_id FROM paid_readings p JOIN local_reading_projects l ON l.reading_id=p.id WHERE p.user_id=? AND l.project_id=?" + (before ? " AND (p.created_at,p.id)<(?,?)" : "") + " ORDER BY p.created_at DESC,p.id DESC LIMIT 21", userId, projectId, ...(before ? [before.time, before.id] : []));
    return this.readingPage(rows, false);
  }
  private readCursor(cursor: string) {
    if (!cursor) return null;
    const parts = cursor.split("|");
    if (parts.length !== 2 || parts[0].length > 40 || !Number.isFinite(Date.parse(parts[0])) || !/^[a-zA-Z0-9_-]{1,100}$/.test(parts[1])) throw new LocalPaidError("INVALID_CURSOR", "记录位置无效，请重新打开页面。");
    return { time: parts[0], id: parts[1] };
  }
  private readingPage(rows: Row[], compact: boolean) {
    const selected = rows.slice(0, 20);
    // Hydrate one bounded page together. Never run a global task-table scan for
    // each archived reading, and never fetch the next page's interpretation.
    const relations = new Map<string, ReadingRelations>();
    if (!compact && selected.length) {
      for (const row of selected) relations.set(String(row.id), { follows: [], projectId: row.project_id as string | undefined });
      const ids = selected.map(row => String(row.id)), placeholders = ids.map(() => "?").join(",");
      for (const follow of this.all(`SELECT * FROM paid_follow_ups WHERE reading_id IN (${placeholders}) AND state IN ('reserved','completed') ORDER BY created_at,id`, ...ids)) relations.get(String(follow.reading_id))!.follows.push(follow);
      const completed = selected.filter(row => row.state === "completed" && !JSON.parse(String(row.result_json)).legacy).map(row => String(row.id));
      if (completed.length) {
        // The existing owner index bounds this to this account's consumption
        // ledger; task IDs are then looked up by primary key. No new index or
        // mass rewrite of the imported 55,000 records is needed.
        for (const row of this.completionTimes(String(selected[0].user_id), completed)) relations.get(String(row.reading_id))!.completedAt = String(row.created_at);
      }
    }
    const items = selected.map(row => compact ? {
      id: String(row.id), projectId: String(row.project_id || ""), question: String(row.question), spread: row.spread as PaidSpread,
      state: row.state as PaidReading["state"], createdAt: String(row.created_at), completedAt: String(row.created_at),
      cards: [], result: null, followUps: [], legacyRestored: Boolean(row.is_legacy), followUpsRemaining: row.is_legacy ? 0 : Math.max(0, paidConfig.followUpsPerReading - Number(row.follow_count || 0))
    } : this.serialize(row, relations.get(String(row.id))));
    const last = selected.at(-1);
    return { items, nextCursor: rows.length > 20 && last ? `${last.created_at}|${last.id}` : null };
  }
  usagePage(userId: string, cursor = "", days = "all") {
    const before = this.readCursor(cursor);
    if (!["all", "7", "30"].includes(days)) throw new LocalPaidError("INVALID_PERIOD", "请选择有效时间范围。");
    const since = days === "all" ? "" : new Date(this.clock() - Number(days) * 86400000).toISOString();
    const rows = this.all("SELECT p.id,p.question,p.spread,p.state,p.created_at,l.project_id,json_type(p.result_json,'$.legacy')='object' is_legacy,(SELECT count(*) FROM paid_follow_ups f WHERE f.reading_id=p.id AND f.state IN ('reserved','completed')) follow_count FROM paid_readings p LEFT JOIN local_reading_projects l ON l.reading_id=p.id WHERE p.user_id=? AND p.state='completed'" + (since ? " AND p.created_at>=?" : "") + (before ? " AND (p.created_at,p.id)<(?,?)" : "") + " ORDER BY p.created_at DESC,p.id DESC LIMIT 21", userId, ...(since ? [since] : []), ...(before ? [before.time, before.id] : []));
    return this.readingPage(rows, true);
  }
  summary(userId: string) {
    this.recoverExpired(userId);
    const user = this.one("SELECT id,label,kind FROM local_users WHERE id=?", userId);
    if (!user) throw new LocalPaidError("UNAUTHORIZED", "账号不存在。", 401);
    const balance = this.one("SELECT coalesce(sum(quantity-reserved-consumed-revoked),0) available,coalesce(sum(reserved),0) reserved,coalesce(sum(consumed),0) consumed FROM credit_batches WHERE user_id=?", userId)!;
    return { user: { id: userId, label: String(user.label), kind: String(user.kind) }, balance: { available: Number(balance.available), reserved: Number(balance.reserved), consumed: Number(balance.consumed) } };
  }
  profileOverview(userId: string): PaidOverview {
    const summary = this.summary(userId), page = this.usagePage(userId);
    return { ...summary, readings: page.items, historyCursor: page.nextCursor, ledger: this.all("SELECT * FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200", userId).map(row => ({ id: String(row.id), kind: String(row.kind), availableDelta: Number(row.available_delta), reservedDelta: Number(row.reserved_delta), consumedDelta: Number(row.consumed_delta), reason: String(row.reason), createdAt: String(row.created_at) })) };
  }
  ledgerPage(userId: string, cursor = "", days = "all"): PaidLedgerPage {
    if (!["all", "7", "30"].includes(days)) throw new LocalPaidError("INVALID_PERIOD", "请选择有效时间范围。");
    const [time, row] = cursor.split("|");
    if (cursor && (!time || !Number.isFinite(Date.parse(time)) || !/^[1-9]\d*$/.test(row || "") || !Number.isSafeInteger(Number(row)) || cursor !== `${time}|${row}`)) throw new LocalPaidError("INVALID_CURSOR", "分页位置无效。");
    const since = days === "all" ? "" : new Date(this.clock() - Number(days) * 86400000).toISOString();
    const rows = this.all("SELECT rowid cursor_row,* FROM credit_ledger WHERE user_id=?" + (since ? " AND created_at>=?" : "") + (cursor ? " AND (created_at,rowid)<(?,?)" : "") + " ORDER BY created_at DESC,rowid DESC LIMIT 21", userId, ...(since ? [since] : []), ...(cursor ? [time, Number(row)] : []));
    const page = rows.slice(0, 20), last = page.at(-1);
    return { items: page.map(entry => ({id:String(entry.id),kind:String(entry.kind),availableDelta:Number(entry.available_delta),reservedDelta:Number(entry.reserved_delta),consumedDelta:Number(entry.consumed_delta),reason:String(entry.reason),createdAt:String(entry.created_at)})), nextCursor: rows.length > 20 && last ? `${last.created_at}|${last.cursor_row}` : null };
  }
  profileSection(userId: string, section: string, days = "all"): PaidOverview {
    if (!["usage", "ledger", "orders"].includes(section) || !["all", "7", "30"].includes(days)) throw new LocalPaidError("INVALID_SECTION", "请选择有效的记录栏目与时间范围。");
    const summary = this.summary(userId);
    const usage = section === "usage" ? this.usagePage(userId, "", days) : null;
    const ledger = section === "ledger" ? this.ledgerPage(userId, "", days) : null;
    return {...summary, readings:usage?.items || [],historyCursor:usage?.nextCursor || null,ledger:ledger?.items || [],ledgerCursor:ledger?.nextCursor || null};
  }
  protected owned(userId: string, readingId: string) {
    const row = this.one("SELECT * FROM paid_readings WHERE id=? AND user_id=?", readingId, userId);
    if (!row) throw new LocalPaidError("NOT_FOUND", "找不到这条解读。", 404);
    return row;
  }
  private completionTimes(userId: string, readingIds: string[]) {
    return this.all(`SELECT r.reading_id,l.created_at FROM credit_ledger l CROSS JOIN reading_runs r ON r.id=substr(l.event_key,9) WHERE l.user_id=? AND l.kind='consume' AND r.state='completed' AND r.reading_id IN (${readingIds.map(() => "?").join(",")})`, userId, ...readingIds);
  }
  protected serialize(row: Row, relations?: ReadingRelations): PaidReading {
    const follows = relations ? relations.follows : this.all("SELECT * FROM paid_follow_ups WHERE reading_id=? AND state IN ('reserved','completed') ORDER BY created_at,id", String(row.id));
    const result=row.state==="completed" ? JSON.parse(String(row.result_json)) as PaidResult : null;
    const legacy=result?.legacy;
    return {
      projectId: relations ? relations.projectId : this.one("SELECT project_id FROM local_reading_projects WHERE reading_id=?", row.id)?.project_id as string | undefined,
      id: String(row.id), question: String(row.question), choices: JSON.parse(String(row.choices_json || "[]")), spread: row.spread as PaidSpread,
      cards: JSON.parse(String(row.cards_json)) as PaidCard[], state: row.state as PaidReading["state"], createdAt: String(row.created_at),
      completedAt: row.state === "completed" ? String(legacy ? legacy.sourceRecord.completed_at || row.created_at : (relations ? relations.completedAt : this.completionTimes(String(row.user_id), [String(row.id)])[0]?.created_at) || row.created_at) : null,
      // Locked and generating records never contain a result or a prompt in their response.
      result,legacyRestored:Boolean(legacy),legacyMessages:legacy?.messages.map(m=>({id:m.id,role:m.role,content:m.content,createdAt:m.created_at})),
      followUpsRemaining: row.state === "completed" && !legacy ? Math.max(0, paidConfig.followUpsPerReading - follows.length) : 0,
      followUps: follows.filter((item) => item.state === "completed").map((item) => ({ id: String(item.id), question: String(item.question), answer: String(item.answer), createdAt: String(item.created_at) }))
    };
  }
  reading(userId: string, readingId: string) { return this.serialize(this.owned(userId, readingId)); }
  overview(userId: string): PaidOverview {
    this.recoverExpired(userId);
    const user = this.one("SELECT * FROM local_users WHERE id=?", userId);
    if (!user) throw new LocalPaidError("UNAUTHORIZED", "账号不存在。", 401);
    const balance = this.one("SELECT coalesce(sum(quantity-reserved-consumed-revoked),0) as available, coalesce(sum(reserved),0) as reserved, coalesce(sum(consumed),0) as consumed FROM credit_batches WHERE user_id=?", userId)!;
    return {
      user: { id: userId, label: String(user.label), kind: String(user.kind) },
      balance: { available: Number(balance.available), reserved: Number(balance.reserved), consumed: Number(balance.consumed) },
      readings: this.all("SELECT * FROM paid_readings WHERE user_id=? ORDER BY created_at DESC,id DESC", userId).map((row) => this.serialize(row)),
      ledger: this.all("SELECT * FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200", userId).map((row) => ({
        id: String(row.id), kind: String(row.kind), availableDelta: Number(row.available_delta), reservedDelta: Number(row.reserved_delta), consumedDelta: Number(row.consumed_delta), reason: String(row.reason), createdAt: String(row.created_at)
      }))
    };
  }
  draw(userId: string, input: { question: string; spread: PaidSpread; requestKey: string; projectId?: string; choices?: string[] }) {
    return this.tx(() => this.drawInTransaction(userId, input));
  }
  protected drawInTransaction(userId: string, input: { question: string; spread: PaidSpread; requestKey: string; projectId?: string; choices?: string[] }, selected?: PaidCard[]) {
    const question = input.question?.trim();
    if (!question || question.length > 300 || !isDeepSpread(input.spread)) throw new LocalPaidError("INVALID_QUESTION", "请填写 1–300 字的问题并选择牌阵。");
    this.validateKey(input.requestKey);
    const choices = this.validateChoices(input.spread, input.choices);
      if (input.projectId) this.ownedProject(userId, input.projectId);
      const previous = this.one("SELECT * FROM paid_readings WHERE user_id=? AND request_key=?", userId, input.requestKey);
      if (previous) {
        const previousProject = this.one("SELECT project_id FROM local_reading_projects WHERE reading_id=?", previous.id)?.project_id;
        if (previous.question !== question || previous.spread !== input.spread || String(previous.choices_json || "[]") !== JSON.stringify(choices) || (input.projectId && previousProject !== input.projectId)) throw new LocalPaidError("REQUEST_CONFLICT", "同一请求不能变更问题、牌阵或项目。", 409);
        return this.serialize(previous);
      }
      const count = this.one("SELECT count(*) as n FROM paid_readings WHERE user_id=? AND created_at>=?", userId, new Date(this.clock() - paidConfig.drawWindowMs).toISOString());
      if (Number(count?.n) >= paidConfig.maxDrawsPerWindow) throw new LocalPaidError("DRAW_RATE_LIMIT", "抽牌过于频繁，请稍后再开启新问题。", 429);
      const pool = [...lenormandCards];
      const cards: PaidCard[] = [];
      const spread = getDeepSpread(input.spread);
      const positions = positionLabels(spread, choices);
      for (let i = 0; i < positions.length; i++) cards.push(selected?.[i] || { ...pool.splice(randomInt(pool.length), 1)[0], position: positions[i] });
      const id = randomUUID();
      this.run("INSERT INTO paid_readings(id,user_id,request_key,question,spread,cards_json,created_at,choices_json) VALUES (?,?,?,?,?,?,?,?)", id, userId, input.requestKey, question, input.spread, JSON.stringify(cards), this.now(), JSON.stringify(choices));
      if (input.projectId) {
        this.run("INSERT INTO local_reading_projects VALUES (?,?)", id, input.projectId);
        this.run("UPDATE local_projects SET last_opened_at=? WHERE id=?", this.now(), input.projectId);
      } else this.checkedProjectLinks.delete(userId);
      return this.serialize(this.owned(userId, id));
  }
  protected validateChoices(spreadId: string, choices?: string[]) {
    const size = getDeepSpread(spreadId).choiceCount || 0;
    const values = Array.isArray(choices) ? choices.map((value) => typeof value === "string" ? value.trim() : "") : [];
    if (size && (values.length !== size || values.some((value) => !value || value.length > 80) || new Set(values.map((value) => value.toLowerCase())).size !== size)) throw new LocalPaidError("INVALID_CHOICES", `请填写 ${size} 个不同的具体选项，每项不超过 80 字。`);
    return size ? values : [];
  }
  protected drawSessionRow(userId: string, id: string) {
    const row = this.one("SELECT * FROM paid_draw_sessions WHERE id=? AND user_id=?", id, userId);
    if (!row) throw new LocalPaidError("NOT_FOUND", "找不到这次抽牌。", 404);
    this.ownedProject(userId, String(row.project_id));
    return row;
  }
  protected serializeDraw(row: Row): PaidDrawSession {
    const deck = JSON.parse(String(row.deck_json)) as { token: string; card: typeof lenormandCards[number] }[];
    const picked = JSON.parse(String(row.selected_json)) as string[];
    const choices = JSON.parse(String(row.choices_json)) as string[];
    const positions = positionLabels(getDeepSpread(String(row.spread)), choices);
    return {
      id: String(row.id), projectId: String(row.project_id), question: String(row.question), spread: row.spread as PaidSpread, choices,
      deck: deck.map(({ token }) => ({ token, picked: picked.includes(token) })),
      selectedTokens: picked,
      selected: picked.map((token, index) => ({ ...deck.find((entry) => entry.token === token)!.card, position: positions[index] })),
      state: row.state as PaidDrawSession["state"], readingId: row.reading_id as string | null
    };
  }
  drawSession(userId: string, id: string) { return this.serializeDraw(this.drawSessionRow(userId, id)); }
  pendingDrawSession(userId: string, projectId: string) {
    this.ownedProject(userId, projectId);
    const row = this.one("SELECT * FROM paid_draw_sessions WHERE user_id=? AND project_id=? AND state='picking' ORDER BY created_at DESC,rowid DESC LIMIT 1", userId, projectId);
    return row ? this.serializeDraw(row) : null;
  }
  startDrawSession(userId: string, input: { projectId: string; question: string; spread: PaidSpread; choices?: string[]; requestKey: string }) {
    const question = input.question?.trim();
    if (!question || question.length > 300 || !isDeepSpread(input.spread)) throw new LocalPaidError("INVALID_QUESTION", "请填写 1–300 字的问题并选择牌阵。");
    this.validateKey(input.requestKey);
    const choices = this.validateChoices(input.spread, input.choices);
    return this.tx(() => {
      this.ownedProject(userId, input.projectId);
      const previous = this.one("SELECT * FROM paid_draw_sessions WHERE user_id=? AND request_key=?", userId, input.requestKey);
      if (previous) {
        if (previous.question !== question || previous.spread !== input.spread || previous.project_id !== input.projectId || previous.choices_json !== JSON.stringify(choices)) throw new LocalPaidError("REQUEST_CONFLICT", "请勿改变同一次洗牌的问题或牌阵。", 409);
        return this.serializeDraw(previous);
      }
      const count = this.one("SELECT count(*) AS n FROM paid_draw_sessions WHERE user_id=? AND created_at>=?", userId, new Date(this.clock() - paidConfig.drawWindowMs).toISOString());
      if (Number(count?.n) >= paidConfig.maxDrawsPerWindow) throw new LocalPaidError("DRAW_RATE_LIMIT", "洗牌过于频繁，请稍后再试。", 429);
      const pool = [...lenormandCards];
      const deck = [];
      while (pool.length) deck.push({ token: randomUUID(), card: pool.splice(randomInt(pool.length), 1)[0] });
      // Starting again abandons an unfinished session, without consuming a petal.
      this.run("UPDATE paid_draw_sessions SET state='abandoned' WHERE user_id=? AND project_id=? AND state='picking'", userId, input.projectId);
      const id = randomUUID();
      this.run("INSERT INTO paid_draw_sessions(id,user_id,project_id,request_key,question,spread,choices_json,deck_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)", id, userId, input.projectId, input.requestKey, question, input.spread, JSON.stringify(choices), JSON.stringify(deck), this.now());
      return this.serializeDraw(this.drawSessionRow(userId, id));
    });
  }
  pickDrawCard(userId: string, id: string, token: string, expectedCount: number) {
    return this.tx(() => {
      const row = this.drawSessionRow(userId, id);
      const session = this.serializeDraw(row);
      if (!session.deck.some((entry) => entry.token === token)) throw new LocalPaidError("INVALID_CARD", "请选择当前牌扇中的一张牌。");
      if (session.deck.find((entry) => entry.token === token)?.picked) return session;
      if (session.state !== "picking") throw new LocalPaidError("DRAW_CLOSED", "本次抽牌已结束，请查看原牌面。", 409);
      if (expectedCount !== session.selected.length) throw new LocalPaidError("DRAW_CHANGED", "抽牌进度已变化，请刷新后继续。", 409);
      const picked = JSON.parse(String(row.selected_json)) as string[];
      picked.push(token);
      this.run("UPDATE paid_draw_sessions SET selected_json=? WHERE id=?", JSON.stringify(picked), id);
      const updated = this.serializeDraw(this.drawSessionRow(userId, id));
      if (updated.selected.length === getDeepSpread(updated.spread).positions.length) {
        const reading = this.drawInTransaction(userId, { ...updated, requestKey: `manual_${id}` }, updated.selected);
        this.run("UPDATE paid_draw_sessions SET state='completed',reading_id=? WHERE id=?", reading.id, id);
      }
      return this.serializeDraw(this.drawSessionRow(userId, id));
    });
  }
  abandonDrawSession(userId: string, id: string) {
    this.drawSessionRow(userId, id);
    this.run("UPDATE paid_draw_sessions SET state='abandoned' WHERE id=? AND state='picking'", id);
  }
  pickDrawCards(userId: string, id: string, tokens: unknown, expectedCount: number) {
    if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > 9 || tokens.some(token => typeof token !== "string" || token.length > 80) || new Set(tokens).size !== tokens.length || !Number.isSafeInteger(expectedCount) || expectedCount < 0 || expectedCount > 9) throw new LocalPaidError("INVALID_CARDS", "请选择有效且不重复的牌。");
    return this.tx(() => {
      const row = this.drawSessionRow(userId, id), session = this.serializeDraw(row);
      const selected = JSON.parse(String(row.selected_json)) as string[];
      const count = getDeepSpread(session.spread).positions.length;
      if (tokens.some(token => !session.deck.some(card => card.token === token)) || expectedCount + tokens.length > count) throw new LocalPaidError("INVALID_CARDS", "选牌与当前牌阵不匹配。");
      // Replaying a committed batch after a lost response is read-only, even
      // when another tab has since appended additional valid selections.
      if (selected.length >= expectedCount + tokens.length && tokens.every((token,index) => selected[expectedCount + index] === token)) return session;
      if (session.state !== "picking") throw new LocalPaidError("DRAW_CLOSED", "本次抽牌已结束，请查看原牌面。", 409);
      if (selected.length !== expectedCount || tokens.some(token => selected.includes(token))) throw new LocalPaidError("DRAW_CHANGED", "抽牌进度已变化，请恢复原进度后继续。", 409);
      selected.push(...tokens);
      this.run("UPDATE paid_draw_sessions SET selected_json=? WHERE id=?", JSON.stringify(selected), id);
      const updated = this.serializeDraw({...row,selected_json:JSON.stringify(selected)});
      if (selected.length === count) {
        const reading = this.drawInTransaction(userId, {...updated,requestKey:`manual_${id}`}, updated.selected);
        this.run("UPDATE paid_draw_sessions SET state='completed',reading_id=? WHERE id=?", reading.id, id);
        return {...updated,state:"completed" as const,readingId:reading.id};
      }
      return updated;
    });
  }
  protected validateKey(key: string) {
    if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new LocalPaidError("INVALID_REQUEST_KEY", "请求标识无效。");
  }
  reserveReading(userId: string, readingId: string) {
    this.recoverExpired(userId);
    return this.tx(() => {
      const reading = this.owned(userId, readingId);
      if (reading.state === "completed" || reading.state === "generating") return { runId: null, reading: this.serialize(reading) };
      const batch = this.one("SELECT * FROM credit_batches WHERE user_id=? AND quantity>reserved+consumed+revoked ORDER BY CASE WHEN source='purchase' THEN 1 ELSE 0 END,created_at,rowid LIMIT 1", userId);
      if (!batch) throw new LocalPaidError("NO_CREDITS", "主解读次数不足，原牌面已保存。获得次数后可回来解锁。", 402);
      const runId = randomUUID();
      this.run("UPDATE credit_batches SET reserved=reserved+1 WHERE id=?", batch.id);
      this.run("INSERT INTO reading_runs VALUES (?,?,?,?,?,?)", runId, readingId, batch.id, "reserved", this.clock() + paidConfig.reservationLeaseMs, this.now());
      this.run("UPDATE paid_readings SET state='generating',active_run=? WHERE id=?", runId, readingId);
      this.ledger(userId, String(batch.id), `reserve:${runId}`, "reserve", -1, 1, 0, "预留主解读 1 次");
      return { runId, reading: this.serialize(this.owned(userId, readingId)) };
    });
  }
  completeReading(userId: string, readingId: string, runId: string, result: PaidResult) {
    return this.tx(() => {
      const reading = this.owned(userId, readingId);
      const run = this.one("SELECT * FROM reading_runs WHERE id=? AND reading_id=?", runId, readingId);
      if (reading.state === "completed" && run?.state === "completed") return this.serialize(reading);
      if (!run || run.state !== "reserved" || reading.active_run !== runId || Number(run.lease_until) <= this.clock()) throw new LocalPaidError("STALE_RUN", "本次任务已到期，请刷新原记录后重试。", 409);
      if (!result.conclusion?.trim() || !result.interpretation?.trim()) throw new LocalPaidError("INVALID_RESULT", "解读结果不完整。", 503);
      this.run("UPDATE paid_readings SET state='completed',result_json=?,active_run=NULL WHERE id=?", JSON.stringify(result), readingId);
      this.run("UPDATE reading_runs SET state='completed' WHERE id=?", runId);
      this.run("UPDATE credit_batches SET reserved=reserved-1,consumed=consumed+1 WHERE id=?", run.batch_id);
      this.ledger(userId, String(run.batch_id), `consume:${runId}`, "consume", 0, -1, 1, "主解读已保存，使用 1 次");
      return this.serialize(this.owned(userId, readingId));
    });
  }
  releaseReading(userId: string, readingId: string, runId: string, reason = "生成失败，释放预留") {
    return this.tx(() => {
      const reading = this.owned(userId, readingId);
      const run = this.one("SELECT * FROM reading_runs WHERE id=? AND reading_id=?", runId, readingId);
      if (!run || run.state !== "reserved" || reading.active_run !== runId || reading.state === "completed") return;
      this.releaseRun(userId, readingId, run, reason);
    });
  }
  protected releaseRun(userId: string, readingId: string, run: Row, reason: string) {
    this.run("UPDATE reading_runs SET state='released' WHERE id=?", run.id);
    this.run("UPDATE paid_readings SET state='failed',active_run=NULL WHERE id=? AND active_run=?", readingId, run.id);
    this.run("UPDATE credit_batches SET reserved=reserved-1 WHERE id=?", run.batch_id);
    this.ledger(userId, String(run.batch_id), `release:${run.id}`, "release", 1, -1, 0, reason);
    this.adjustTrialCredits(userId);
  }
  recoverExpired(userId: string) {
    this.tx(() => {
      // CROSS JOIN keeps the tiny expired-task index first, instead of scanning
      // every historical reading belonging to the account just to show a balance.
      for (const run of this.all("SELECT r.* FROM reading_runs r CROSS JOIN paid_readings p ON p.id=r.reading_id WHERE p.user_id=? AND r.state='reserved' AND r.lease_until<=?", userId, this.clock())) {
        this.releaseRun(userId, String(run.reading_id), run, "任务超时，自动释放预留");
      }
      for (const follow of this.all("SELECT f.id FROM paid_follow_ups f CROSS JOIN paid_readings p ON p.id=f.reading_id WHERE f.state='reserved' AND f.lease_until<=? AND p.user_id=?", this.clock(), userId)) this.run("UPDATE paid_follow_ups SET state='released' WHERE id=? AND state='reserved'", follow.id);
      this.adjustTrialCredits(userId);
    });
  }
  reserveFollowUp(userId: string, readingId: string, question: string, requestKey: string) {
    this.validateKey(requestKey);
    if (!question?.trim() || question.trim().length > 300) throw new LocalPaidError("INVALID_QUESTION", "追问需要 1–300 字。");
    question = question.trim();
    this.recoverExpired(userId);
    return this.tx(() => {
      const reading = this.owned(userId, readingId);
      if (reading.state !== "completed") throw new LocalPaidError("READING_LOCKED", "请先解锁并完成主解读。", 403);
      if(JSON.parse(String(reading.result_json)).legacy)throw new LocalPaidError("LEGACY_READ_ONLY","旧站历史仅供回看，请开启新的占卜继续。",409);
      const previous = this.one("SELECT * FROM paid_follow_ups WHERE reading_id=? AND request_key=?", readingId, requestKey);
      if (previous && previous.question !== question) throw new LocalPaidError("REQUEST_CONFLICT", "同一请求不能更换追问内容。", 409);
      if (previous && previous.state !== "released") return { id: String(previous.id), attempt: null, reading: this.serialize(reading) };
      const count = this.one("SELECT count(*) as n FROM paid_follow_ups WHERE reading_id=? AND state IN ('reserved','completed')", readingId);
      if (Number(count?.n) >= paidConfig.followUpsPerReading) throw new LocalPaidError("FOLLOW_UP_LIMIT", "这份解读包含的 2 次追问已用完或正在生成。", 429);
      // Each retry gets a new lease token; late results from an old attempt cannot commit.
      const attempt = randomUUID();
      const id = previous ? String(previous.id) : randomUUID();
      if (previous) this.run("UPDATE paid_follow_ups SET state='reserved',lease_until=?,attempt=? WHERE id=?", this.clock() + paidConfig.reservationLeaseMs, attempt, id);
      else this.run("INSERT INTO paid_follow_ups(id,reading_id,request_key,question,state,lease_until,created_at,attempt) VALUES (?,?,?,?,?,?,?,?)", id, readingId, requestKey, question, "reserved", this.clock() + paidConfig.reservationLeaseMs, this.now(), attempt);
      return { id, attempt, reading: this.serialize(this.owned(userId, readingId)) };
    });
  }
  completeFollowUp(userId: string, readingId: string, followId: string, attempt: string, answer: string) {
    return this.tx(() => {
      this.owned(userId, readingId);
      const follow = this.one("SELECT * FROM paid_follow_ups WHERE id=? AND reading_id=?", followId, readingId);
      if (!follow || follow.attempt !== attempt) throw new LocalPaidError("STALE_RUN", "追问任务已过期。", 409);
      if (follow.state === "completed") return this.reading(userId, readingId);
      if (follow.state !== "reserved" || Number(follow.lease_until) <= this.clock()) throw new LocalPaidError("STALE_RUN", "追问任务已过期。", 409);
      if (!answer.trim()) throw new LocalPaidError("INVALID_RESULT", "追问回答为空。", 503);
      this.run("UPDATE paid_follow_ups SET state='completed',answer=? WHERE id=?", answer, followId);
      return this.reading(userId, readingId);
    });
  }
  releaseFollowUp(userId: string, readingId: string, followId: string, attempt: string) {
    this.owned(userId, readingId);
    this.run("UPDATE paid_follow_ups SET state='released' WHERE id=? AND reading_id=? AND attempt=? AND state='reserved'", followId, readingId, attempt);
  }
}
