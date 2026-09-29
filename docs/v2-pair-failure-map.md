# V2 Phase 2.1 - Pair Failure Map

Status: failure localization and spec closure only.

No production behavior changed. No engine version bump. No deploy.

## Scope

This document closes the V2 Phase 2 open findings by assigning each finding to one implementation layer:

- `PAIR_OVERRIDE_FIX`
- `SPECIAL_BEHAVIOR_FIX`
- `GENERIC_GRAMMAR_FIX`
- `NO_FIX_NEEDED`
- `SAFETY_ONLY`

The goal is not to add more pair candidates. The goal is to decide the minimal Phase 3 work.

## Failure Map

| Finding | Current Behavior | Expected V2 Contract | Root Cause | Layer | Phase 3 Action |
|---|---|---|---|---|---|
| Book/Person mode overreach | Book > Man/Woman and Man/Woman > Book describe person anchors for broad Book modes including `knowledge_learning`, `research_investigation`, and `project_case`. | `unknown_information` may describe unknown/unfamiliar person. `knowledge_learning` / `research_investigation` describe academic/knowledge traits. `project_case` must not automatically become a private/secret person descriptor. | Current Book/Person overrides match any supported Book information/learning/secret mode through broad supports lists. | `PAIR_OVERRIDE_FIX` | Narrow Book/Person overrides by explicit Book semantic mode. |
| Mice-left reverse behavior | `Heart > Mice` erodes Heart, but `Mice > Heart` resolves through Heart emotional behavior as `modify` with Mice as subject. | Mice-left should be able to act as erosion operator on the right-side feeling target when selected mode is erosion/loss/stress. | SpecialBehavior precedence lets right-side Heart behavior win before left-side Mice contextual erosion. | `SPECIAL_BEHAVIOR_FIX` | Adjust behavior precedence or Mice contextual behavior so Mice-left can erode eligible right-side targets. |
| Anchor-left reverse behavior | `Heart > Anchor` and `Ring > Anchor` stabilize the left subject, but `Anchor > Heart` resolves as Heart emotional modify and `Anchor > Ring` resolves as Ring bind. | Anchor-left should express persistence/stagnation/stabilization acting on the right-side target without implying positive stability. | SpecialBehavior precedence lets right-side Heart/Ring behavior win before left-side Anchor persistence/stagnation. | `SPECIAL_BEHAVIOR_FIX` | Adjust behavior precedence or Anchor contextual behavior for Anchor-left reverse cases. |
| Rider/Mountain direction compression | `Rider > Mountain` and `Mountain > Rider` both resolve to Mountain blocking Rider; card order evidence differs, but semantic proposition collapses. | `Rider > Mountain` means incoming movement/news is blocked or delayed. `Mountain > Rider` means blockage state is followed by or expressed through incoming movement/news; it must not be identical to reverse. | Generic grammar treats Mountain as obstacle operator even when it is left-side subject/state. | `GENERIC_GRAMMAR_FIX` | Add direction-aware generic handling for left-side obstacle/operator cards before adding pair-specific override. |
| Mountain > Letter semantic equivalence risk | `Letter > Mountain` blocks Letter; `Mountain > Letter` currently communicates Mountain through Letter, but final wording can still collapse into "message delayed" if relation/state is underspecified. | `Mountain > Letter` should preserve Mountain/blockage as preceding state or subject manifested through Letter, not a duplicate of `Letter > Mountain`. | Existing V1 override relation is directionally distinct but lacks an explicit semantic contract strong enough for downstream renderer/synthesis. | `PAIR_OVERRIDE_FIX` | Revise `OVERRIDE_MOUNTAIN_LETTER_OBSTACLE_MESSAGE` semantic patch to encode obstacle-state manifestation/communication without delay-target equivalence. |
| Snake/Ring safety-only regression | Snake/Ring pairs do not currently output confirmed affair strings. | Pair layer may emit complication/trust-risk semantic evidence only. Third-party factualization remains downstream-gated. | No production failure requiring pair override. Risk belongs to factualization/safety boundary. | `SAFETY_ONLY` | Keep regression tests. Do not implement Pair Override solely as safety guard. |

## Failures By Layer

`PAIR_OVERRIDE_FIX`:

- Book > Man
- Man > Book
- Book > Woman
- Woman > Book
- Mountain > Letter

`SPECIAL_BEHAVIOR_FIX`:

- Mice > Heart
- Anchor > Heart
- Anchor > Ring

`GENERIC_GRAMMAR_FIX`:

- Rider > Mountain
- Mountain > Rider

`SAFETY_ONLY`:

- Snake > Ring
- Ring > Snake

`NO_FIX_NEEDED`:

- Mountain > Coffin: current Coffin-right behavior ends/stops previous obstacle theme.
- Coffin > Sun: current Coffin-left behavior resolves as sequence/transition and does not end Sun.
- Fox > Letter / Letter > Fox: current P0_KEEP characterization is stable.
- Ring > Mice / Mice > Ring: current P0_KEEP characterization is stable.
- Key > Mountain / Mountain > Key: current P0_KEEP characterization is stable.
- Key > Letter / Letter > Key: current P0_KEEP characterization is stable.
- Heart > Mice: current behavior is sufficient.
- Heart > Anchor: current behavior is sufficient.
- Ring > Anchor: current behavior is sufficient.

## Exact Phase 3 Scope

Phase 3 should be minimal implementation only:

1. Revise Book/Person pair overrides to be Book-mode-sensitive.
2. Revise `Mountain > Letter` override semantic patch to preserve obstacle-state/message direction.
3. Fix left-side Mice behavior so `Mice > Heart` can erode the right-side feeling target.
4. Fix left-side Anchor behavior so `Anchor > Heart` and `Anchor > Ring` can stabilize/persist/stagnate the right-side target without positivity.
5. Fix generic direction handling for `Rider > Mountain` versus `Mountain > Rider`.
6. Keep Snake/Ring as safety-only regression; do not add a safety-guard pair override.

Out of scope for Phase 3:

- New broad pair candidate families.
- Registry-shape refactor.
- Renderer changes.
- Synthesis changes.
- Answer resolver changes.
- Rule engine version bump.
- Deployment or rollout changes.
- Supabase schema changes.

## Spec Closure

The previous V2 Phase 2 `todo` tests are closed. V2 desired behavior is now represented as active failing spec tests where current V1 does not satisfy the contract.

Active failures are expected until Phase 3 implementation.

