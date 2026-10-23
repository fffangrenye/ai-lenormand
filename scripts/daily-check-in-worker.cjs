// Test-only child process for cross-process SQLite contention.
if (process.env.NODE_ENV !== "test") throw new Error("Test helper only");
require("./typescript-register.cjs");
const { PaidLocalStore } = require("../lib/paid-local/store.ts");
const timestamp = Number(process.argv[3]);
if (!Number.isFinite(timestamp)) throw new Error("Invalid fixture timestamp");
const store = new PaidLocalStore(process.env.PAID_LOCAL_DB, () => timestamp);
try {
  const result = store.checkIn(process.argv[2]);
  process.stdout.write(JSON.stringify({ date: result.entry.date, card: result.entry.card.number, newlyCheckedIn: result.newlyCheckedIn, rewards: result.grantedMilestones }));
} finally { store.close(); }
