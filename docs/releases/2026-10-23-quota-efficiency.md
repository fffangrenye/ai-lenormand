# Quota efficiency recovery — 2026-10-23

Based on the deployed incident recovery source (`985cb33b` frontend and `6a576f92` backend), with the same authentication, ledger, redemption inventory and legacy archives.

Changes:

- `/summary` returns account identity and balance only. The balance pill and redemption form never fetch historical interpretation bodies.
- `/daily-status` performs a single owner/date lookup; the homepage no longer polls the full calendar every minute. Focus refreshes share a short cache and midnight changes use the Beijing date.
- Project history and profile usage load 20 records per page using timestamp/ID cursors. Earlier records remain available through explicit load-more controls. The legacy project-history endpoint is also bounded for older clients.
- Profile usage returns metadata instead of interpretation bodies. Migrated records are labelled as old archives, rather than new paid debits.
- Project-page responses seed account-scoped reading caches, including follow-ups. Concurrent GETs are coalesced. Successful mutations invalidate the cache; old in-flight responses cannot repopulate it after a mutation or account switch. Caches are bounded and expire.
- Reading generation status uses bounded, progressively slower polling; it refreshes the reading page without reloading the project list. Failures show a retry action rather than an auth redirect.
- Existing account initialization no longer updates unchanged emails. Cache initialization is bounded and changes are remembered only after the transaction succeeds. Viewing a normal account produces no row writes. Expired reservations still recover exactly once, using expired-task indexes rather than walking user history.
- Project lists fetch the account label once. Last-opened timestamps update at most once per five minutes for the same project.
- General account limit: 60 requests/minute; heavier history requests: 12/minute. These are additional safeguards, not a guarantee that aggregate daily free quotas cannot be exceeded.
- One-time, transactional SQLite indexes cover report date filters, account ledger lookup and expired tasks. No customer record, historical body or balance is rewritten. Index creation itself consumes database quota; it is deferred naturally while the public quota gate blocks business requests.
- Reports are cached for five minutes, bounded to seven dates per live object. Telemetry is disabled at both frontend and backend unless deliberately enabled server-side.
- Artifact private-path checks use paths relative to the build root, so an isolated checkout under an ignored parent is checked correctly without hiding any nested private artifacts.

Verification:

- TypeScript check.
- Six focused tests cover a 1,050-record account, tied cursor timestamps without duplication or omission, ownership, zero-write normal reads, preserved balances, timeout recovery, report query plans, admin authorization, disabled telemetry, concurrent request coalescing, mutation invalidation and account isolation.
- Existing paid flow, consecutive check-in, redemption/refund and legacy restoration regressions: combined 47 passing tests with the focused suite.
- Builds and sensitive artifact scans must pass before deployment. Exact source commits and Worker version IDs are recorded separately in the deployment receipt.

The existing temporary quota gate remains until **2026-10-24 00:00 UTC / Beijing 08:00**. No live customer payment, credit consumption, migration or load test is run while quota is exhausted. End-to-end authenticated business verification remains pending until the database quota resets; this change does not buy or upgrade Cloudflare services.
