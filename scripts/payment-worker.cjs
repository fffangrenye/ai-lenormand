require("./typescript-register.cjs");
const { PaidLocalStore } = require("../lib/paid-local/store.ts");
const store = new PaidLocalStore();
try { process.stdout.write(store.payments.simulate(process.argv[2], process.argv[3], "duplicate").fulfillment); }
finally { store.close(); }
