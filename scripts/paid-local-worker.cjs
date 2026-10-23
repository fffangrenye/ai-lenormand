require("./typescript-register.cjs");
const { PaidLocalStore } = require("../lib/paid-local/store.ts");
const store = new PaidLocalStore(process.env.PAID_LOCAL_DB);
try {
  const result = store.reserveReading("local-new", process.argv[2]);
  process.stdout.write(result.runId ? "reserved" : "duplicate");
} catch (error) {
  if (error.code === "NO_CREDITS") process.stdout.write("denied");
  else { console.error(error); process.exitCode = 1; }
} finally { store.close(); }
