# Rule Engine Rollout Runbook

## Flags

- `RULE_ENGINE_ENABLED`: kill switch. `false` sends all new readings to AI.
- `RULE_ENGINE_DEFAULT`: fallback default after eligibility and cohort checks.
- `RULE_ENGINE_ALLOW_EXPLICIT`: allows internal explicit rule-engine routing.
- `RULE_ENGINE_ROLLOUT_PERCENT`: deterministic cohort percent, `0` to `100`. Default is `0`.

## Rollout Stages

- Stage 0 Disabled: `RULE_ENGINE_ENABLED=false`.
- Stage 1 Internal: `RULE_ENGINE_ENABLED=true`, `RULE_ENGINE_DEFAULT=false`, `RULE_ENGINE_ALLOW_EXPLICIT=true`, `RULE_ENGINE_ROLLOUT_PERCENT=0`.
- Stage 2 Production 1%: `RULE_ENGINE_ENABLED=true`, `RULE_ENGINE_DEFAULT=false`, `RULE_ENGINE_ALLOW_EXPLICIT=true`, `RULE_ENGINE_ROLLOUT_PERCENT=1`.
- Stage 3 Small Production Cohort: manually consider 5, 10, 25, 50, 100 only after Stage 2 observation passes.
- Stage 4 Default: set eligible readings to rule engine default only after gates pass. AI path stays available.

## Stage 2: 1% Production Rollout

Keep Stage 2 at 1% until manually approved for the next step. Do not automatically promote to 5%.

Observe:

- Rule volume.
- Rule success and failure.
- AI initial volume.
- Follow-up AI volume.
- Quota usage and leakage.
- Source integrity.
- Renderer internal-token leakage.
- RLS and auth errors.
- History reopen behavior.
- Safety-sensitive outputs.

## Deployment Order

DB first:

1. Deploy the additive migration.
2. Confirm new `deep_readings` columns exist.
3. Deploy code that understands the new nullable columns.
4. Keep `RULE_ENGINE_ENABLED=false`.
5. Verify AI path still works.
6. Enable internal rule-engine routing.
7. Move through preview and cohort rollout manually.

## Preview Checklist

- 3-card relationship.
- 3-card career or study.
- 5-card relationship.
- 5-card study.
- Explicit timeframe.
- Open timeframe.
- Yes/no.
- Open development.
- Safety question.
- History reopen.
- Rule reading follow-up.

## Metrics

Use `analytics_events` grouped by date, `properties->>'source'`, and event name:

```sql
select
  (created_at at time zone 'Asia/Shanghai')::date as date_key,
  properties ->> 'source' as source,
  event_name,
  count(*) as count
from public.analytics_events
where event_name in (
  'reading_generation_started',
  'reading_generation_success',
  'reading_generation_failed',
  'ai_success',
  'ai_failed'
)
group by 1, 2, 3
order by 1 desc, 2, 3;
```

Monitor rule-engine success/failure rate, AI success/failure rate, rule reading volume, AI initial reading volume, AI follow-up usage, and quota leakage.

## Cost And Quota Monitoring

Initial readings routed to `rule_engine` must not call DeepSeek and must not enter `daily_ai_usage`. AI initial readings still use AI quota. Follow-up still AI and remains independently counted.

## Rollback

Hard rollback is the kill switch:

```text
RULE_ENGINE_ENABLED=false
```

Alternatively set:

```text
RULE_ENGINE_ROLLOUT_PERCENT=0
RULE_ENGINE_DEFAULT=false
```

Rollback affects only new readings. Historical `rule_engine` readings still open from persisted rendered text and structured result.

## Hard Rollback Conditions

- Rule generation crash spike.
- Persistence failures.
- RLS or auth errors.
- Incorrect user history.
- Source metadata mismatch.
- AI unexpectedly called on rule path.
- Quota incorrectly consumed.
- Safety regression.
- Cross-user or cross-reading leakage.
- Renderer raw internal token leak.
- Safety-sensitive factualization.
- Widespread malformed output.

## Soft Hold Conditions

- Awkward renderer wording.
- Medium confidence or unresolved rate is high.
- Follow-up rate rises.
- Retry rate rises.
- User feedback drifts negative.

## Known Limitations

- V1 supports only 3/5 card spreads.
- Follow-up still AI.
- No exact timing.
- Rule interpretation is deterministic.
- History is not rerendered.
- Unsupported spread routes to AI before generation.
- No hidden fallback from rule engine to AI.
- No Grand Tableau, new spread types, online learning, LLM polishing, or renderer personalization in Phase 12.
