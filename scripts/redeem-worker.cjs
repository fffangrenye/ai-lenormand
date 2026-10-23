require('./typescript-register.cjs');
const { PaidLocalStore } = require('../lib/paid-local/store.ts');
const store = new PaidLocalStore();
try { const result=store.redemptions.redeem(process.argv[2],process.argv[3]);process.stdout.write(result.alreadyRedeemed ? 'duplicate' : 'granted'); }
catch(error){ if(error.code==='INVALID_RECHARGE_CODE')process.stdout.write('unavailable');else process.exitCode=1; }
finally{store.close();}
