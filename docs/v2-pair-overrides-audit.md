# V2 Phase 1 - High-value Pair Overrides Audit & Spec

Status: Audit & Spec only. No production rule behavior changed. No engine version bump. No deploy.

V2 Phase 1: PASS.
V2 Phase 1.1 review status: revised for implementation readiness.
Implementation readiness after this review: HOLD until characterization/failing fixtures prove each required resolution layer.

## 1. Scope

V1 already has deterministic pair infrastructure:

- ordered pair keys via `A>B`
- CMSE-first candidate selection
- card-level `semanticAgency`
- passive person anchors for Man/Woman
- mode-sensitive special behavior
- V1 pair overrides
- NeighborEvidence
- final semantic resolution
- optional one-pass pair refinement

V2 should not become a 36x36 phrase dictionary. A V2 override is justified only when an ordered semantic-mode pair adds deterministic semantic value that generic directional grammar plus current SpecialBehavior cannot express reliably.

Hard admission rule for V2 implementation: any P0/P1 candidate must show a concrete generic grammar or SpecialBehavior failure before it is approved as a Pair Override. If current behavior already produces the intended relation and mode support, the correct action is characterization/regression coverage, not another override.

## 2. Current V1 Override Inventory

Source: `lib/rule-engine/pair-overrides.ts`

| Override ID | A>B | Context | Left Mode | Right Mode | Relation | Priority | Current Tests | Keep? |
|---|---|---|---|---|---|---|---|
| OVERRIDE_FOX_LETTER_WARNING_DOCUMENT | Fox > Letter | global | deception_suspicion | written_message | modify | high | pair-engine high-value ordered overrides | keep_v1 |
| OVERRIDE_LETTER_FOX_DOCUMENT_REVEALS_WARNING | Letter > Fox | global | written_message | wrong_warning | communicate | high | pair-engine high-value ordered overrides | keep_v1 |
| OVERRIDE_FOX_LETTER_CAREER_DOCUMENT | Fox > Letter | domain=career | employment | any supported right document/message | associate | high | pair-engine high-value ordered overrides | keep_v1 |
| OVERRIDE_BOOK_MAN_UNKNOWN_PERSON | Book > Man | global | any supported Book info/learning/secret | male_person_anchor | describe | high | person anchors test | revise_v1 |
| OVERRIDE_MAN_BOOK_PRIVATE_PERSON | Man > Book | global | male_person_anchor | any supported Book info/learning/secret | describe | high | person anchors test | revise_v1 |
| OVERRIDE_BOOK_WOMAN_UNKNOWN_PERSON | Book > Woman | global | any supported Book info/learning/secret | female_person_anchor | describe | high | person anchors test | revise_v1 |
| OVERRIDE_WOMAN_BOOK_PRIVATE_PERSON | Woman > Book | global | female_person_anchor | any supported Book info/learning/secret | describe | high | person anchors test | revise_v1 |
| OVERRIDE_CROSSROADS_ANCHOR_FIXED_OPTIONS | Crossroads > Anchor | global | choice_options / multiple_alternatives | stability_security / fixed_stagnation | stabilize | high | direction smoke only | revise_v1 |
| OVERRIDE_ANCHOR_CROSSROADS_STABLE_OPTIONS | Anchor > Crossroads | global | stability_security / fixed_stagnation | choice_options / multiple_alternatives | stabilize | high | no direct semantic assertion | revise_v1 |
| OVERRIDE_HEART_RING_FEELING_BOND | Heart > Ring | global | love_affection / attraction_passion | commitment_bond | bind | high | Heart/Ring regression | keep_v1 |
| OVERRIDE_RING_HEART_BOND_FEELING | Ring > Heart | global | commitment_bond | love_affection / attraction_passion | bind | high | Heart/Ring regression | keep_v1 |
| OVERRIDE_WHIP_RING_REPEATING_BOND | Whip > Ring | global | repetition / conflict_argument | cycle_repetition / commitment_bond | repeat | high | no direct semantic assertion | revise_v1 |
| OVERRIDE_RING_WHIP_BOND_UNDER_REPETITION | Ring > Whip | global | cycle_repetition / commitment_bond | repetition / conflict_argument | repeat | high | no direct semantic assertion | revise_v1 |
| OVERRIDE_MICE_RING_ERODE_BOND | Mice > Ring | global | erosion_diminishment / loss_depletion | commitment_bond / cycle_repetition | erode | high | Mice/Ring regression | keep_v1 |
| OVERRIDE_RING_MICE_BOND_ERODES | Ring > Mice | global | commitment_bond / cycle_repetition | erosion_diminishment / loss_depletion | erode | high | Mice/Ring regression | keep_v1 |
| OVERRIDE_BOOK_WHIP_RESEARCH_REVISION | Book > Whip | global | project_case / research_investigation | editing_revision_research / practice_discipline | repeat | high | study project regression | revise_v1 |
| OVERRIDE_WHIP_BOOK_REVISION_RESEARCH | Whip > Book | global | editing_revision_research / practice_discipline | project_case / research_investigation | repeat | high | no reverse context assertion | revise_v1 |
| OVERRIDE_BOOK_SUN_REVEAL_UNKNOWN | Book > Sun | global | unknown_information / project_case | clarity_illumination / success_achievement | clarify | high | no direct semantic assertion | revise_v1 |
| OVERRIDE_SUN_BOOK_ILLUMINATE_BOOK | Sun > Book | global | clarity_illumination | unknown_information / knowledge_learning / project_case | clarify | high | no direct semantic assertion | revise_v1 |
| OVERRIDE_BOOK_KEY_UNKNOWN_CONFIRMED | Book > Key | global | unknown_information / knowledge_learning | confirmation_certainty | confirm | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_KEY_BOOK_UNLOCK_KNOWLEDGE | Key > Book | global | solution_unlock | unknown_information / knowledge_learning | unlock | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_MOUNTAIN_KEY_BLOCK_CONFIRMATION | Mountain > Key | global | blockage_obstacle / delay | confirmation_certainty | block | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_KEY_MOUNTAIN_UNLOCK_BLOCK | Key > Mountain | global | solution_unlock | blockage_obstacle / delay | unlock | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_LETTER_MOUNTAIN_DELAY_DOCUMENT | Letter > Mountain | global | written_message / document_paperwork | delay / blockage_obstacle | block | high | ordered smoke only | keep_v1 |
| OVERRIDE_MOUNTAIN_LETTER_OBSTACLE_MESSAGE | Mountain > Letter | global | blockage_obstacle / delay | written_message / document_paperwork | communicate | high | ordered smoke only | revise_v1 |
| OVERRIDE_KEY_LETTER_UNLOCK_DOCUMENT | Key > Letter | global | solution_unlock | written_message / document_paperwork | unlock | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_LETTER_KEY_DOCUMENT_CONFIRMED | Letter > Key | global | written_message / document_paperwork | confirmation_certainty | confirm | high | Key mode-sensitive regression | keep_v1 |
| OVERRIDE_FOX_FISH_JOB_MONEY | Fox > Fish | global | employment / wrong_warning | money_finance / cashflow_circulation | associate | high | none | revise_v1 |
| OVERRIDE_FISH_FOX_MONEY_JOB_WARNING | Fish > Fox | global | money_finance / cashflow_circulation | employment / wrong_warning | associate | high | none | revise_v1 |
| OVERRIDE_RIDER_LETTER_INCOMING_WRITTEN | Rider > Letter | global | incoming_news | written_message | communicate | high | Rider/Letter regression | keep_v1 |
| OVERRIDE_LETTER_RIDER_WRITTEN_UPDATE | Letter > Rider | global | written_message | incoming_news | sequence | high | direction smoke | keep_v1 |
| OVERRIDE_BIRDS_LETTER_SPOKEN_TO_WRITTEN | Birds > Letter | global | oral_communication / discussion_negotiation | written_message / document_paperwork | communicate | high | Birds/Letter regression | keep_v1 |
| OVERRIDE_LETTER_BIRDS_WRITTEN_DISCUSSION | Letter > Birds | global | written_message / document_paperwork | oral_communication / discussion_negotiation | communicate | high | Birds/Letter regression | keep_v1 |

Inventory count: 34 ordered overrides.

## 3. Current Behavior Audit

### Keep

These V1 overrides express high-value semantic relations and already align with the V2 admission rules:

- Fox > Letter / Letter > Fox: information-warning direction and career context switch.
- Heart > Ring / Ring > Heart: mode-level `bind`, not fixed "marriage" prose.
- Mice > Ring / Ring > Mice: erosion target changes by order.
- Book > Key / Key > Book, Key > Mountain / Mountain > Key, Key > Letter / Letter > Key: Key remains mode-sensitive.
- Letter > Mountain: written/documented item is delayed/blocked.
- Rider > Letter / Letter > Rider and Birds > Letter / Letter > Birds: information carrier distinctions.

### Revise

These are not necessarily wrong, but V2 should re-check whether they are too global or under-tested:

- Crossroads > Anchor / Anchor > Crossroads: both use `stabilize`; V2 should distinguish fixed options, stabilized choice field, and stuck indecision.
- Book/Man and Book/Woman ordered pairs: current direction is useful, but the Book side is too broad. Unknown Book may describe an unknown/unfamiliar person; knowledge/research Book should describe academic/knowledge traits; `project_case` should not automatically become an unknown/private person descriptor.
- Whip > Ring / Ring > Whip: may be valid for cycle/repetition, but global relationship reading can overstate repeated conflict.
- Book > Whip / Whip > Book: currently global, but study/project context is the high-value case. Other domains need generic fallback or narrower predicates.
- Book > Sun / Sun > Book: `Book > Sun` includes `project_case + success_achievement`, which can over-confirm project success. It should be mode-sensitive to `unknown_information` vs `project_case`.
- Mountain > Letter: current relation is `communicate` with obstacle as subject. V2 should consider whether `block` or `delay` is more precise when Mountain is left operator.
- Fox > Fish / Fish > Fox: global money/job/warning association can leak career/money semantics into unrelated contexts. Add context predicates or demote.

### Remove

No V1 override is an obvious delete yet. V2 should only remove after fixture proof that generic grammar is more stable.

## 4. Dangerous Hard-coded Combo Risks

These phrase-like outcomes must not be encoded directly:

- Heart + Ring = committed relationship
- Ring + Heart = love commitment
- Mountain + Coffin = obstacle solved
- Coffin + Sun = end success
- Snake + Ring = confirmed affair
- Stork + Child = confirmed pregnancy
- Scythe + Tree = medical diagnosis
- Key + any card = yes/confirmed
- Anchor + any card = positive stability
- Book + any card = secrecy

V2 override format must stay mode + mode + relation, leaving prose to synthesis/renderer.

## 5. New Candidate Matrix

| Candidate | Tier | Proposed Status | Relation Target | Context Predicate | Reverse Pair Policy | Evidence Basis |
|---|---|---|---|---|---|---|
| Rider > Mountain | P0 | proposed | incoming_news blocked/delayed by obstacle | communication/outcome/timing | separate_override | semantic_operator |
| Mountain > Rider | P0 | proposed | blocked state followed by incoming movement/news | communication/outcome/timing | separate_override | directional_grammar |
| Letter > Mountain | P0 | keep_v1 | written/document delayed/blocked | broad info contexts | separate_override | semantic_operator |
| Mountain > Letter | P0_REVISE | revise_v1 | obstacle/blockage state becomes expressed through message/document; not equivalent to Letter > Mountain | broad info contexts | separate_override | directional_grammar |
| Heart > Mice | P1 | special_behavior_sufficiency_check | feeling/affection erodes or is stressed if current Mice behavior is insufficient | relationship | generic_grammar unless fixture fails | semantic_operator |
| Mice > Heart | P1 | special_behavior_sufficiency_check | erosion/stress acts on feeling if current Mice behavior is insufficient | relationship | generic_grammar unless fixture fails | directional_grammar |
| Ring > Mice | P0 | keep_v1 | bond/cycle erodes | relationship/contract | separate_override | semantic_operator |
| Mice > Ring | P0 | keep_v1 | erosion targets bond/cycle | relationship/contract | separate_override | semantic_operator |
| Heart > Anchor | P1 | special_behavior_sufficiency_check | feeling persists or becomes fixed if current Anchor behavior is insufficient | relationship | generic_grammar unless fixture fails | context_disambiguation |
| Anchor > Heart | P1 | special_behavior_sufficiency_check | persistence/stagnation modifies affection if current Anchor behavior is insufficient | relationship | generic_grammar unless fixture fails | context_disambiguation |
| Ring > Anchor | P1 | special_behavior_sufficiency_check | bond/contract becomes persistent or stuck if current Anchor behavior is insufficient | relationship/career/money | generic_grammar unless fixture fails | semantic_operator |
| Anchor > Ring | P1 | special_behavior_sufficiency_check | stability/stagnation acts on bond/contract if current Anchor behavior is insufficient | relationship/career/money | generic_grammar unless fixture fails | semantic_operator |
| Book > Sun | P1 | revise_v1 | unknown information clarified; project success only if supported | information/study | separate_override | information_state |
| Sun > Book | P1 | revise_v1 | clarity illuminates unknown/book/project | information/study | separate_override | information_state |
| Book > Man | P0_REVISE | revise_v1 | mode-sensitive person descriptor; unknown Book != all Book modes | person object/people context | separate_override | person_anchor |
| Man > Book | P0_REVISE | revise_v1 | person associated with specific Book mode; project_case does not become unknown/private person | person object/people context | separate_override | person_anchor |
| Book > Woman | P0_REVISE | revise_v1 | mode-sensitive person descriptor; unknown Book != all Book modes | person object/people context | separate_override | person_anchor |
| Woman > Book | P0_REVISE | revise_v1 | person associated with specific Book mode; project_case does not become unknown/private person | person object/people context | separate_override | person_anchor |
| Fox > Letter | P0 | keep_v1 | warning/deception modifies written message; career employment+document switch | relationship trust / career | separate_override | context_disambiguation |
| Letter > Fox | P0 | keep_v1 | written item communicates/reveals warning or suspicious employment matter | relationship trust / career | separate_override | directional_grammar |
| Book > Whip | P1 | revise_v1 | research/project enters revision/repetition | study/project | separate_override | context_disambiguation |
| Whip > Book | P1 | revise_v1 | revision/practice acts on research/project | study/project | separate_override | context_disambiguation |
| Whip > Child | P1 | proposed | revision supports simplification/reduction | study/project only | generic_grammar outside context | context_disambiguation |
| Child > Whip | P2 | proposed | small/new item enters repetition/revision/conflict | study/project; otherwise generic | separate_override | directional_grammar |
| Key > Mountain | P0 | keep_v1 | solution_unlock unlocks obstacle | obstacle/outcome | separate_override | semantic_operator |
| Mountain > Key | P0 | keep_v1 | obstacle blocks confirmation/solution depending Key mode | obstacle/outcome | separate_override | semantic_operator |
| Key > Letter | P0 | keep_v1 | solution unlocks document/message | information/career | separate_override | semantic_operator |
| Letter > Key | P0 | keep_v1 | document/message confirms | information/career | separate_override | information_state |
| Coffin > Mountain | P1 | behavior_or_guard | ending-state followed by obstacle/stopped obstacle state | obstacle/outcome | generic_grammar unless fixture fails | directional_grammar |
| Mountain > Coffin | P0_GUARD | move_to_behavior_or_regression_guard | obstacle ends/stops through Coffin-right behavior | obstacle/outcome | no pair override unless fixture fails | semantic_operator |
| Coffin > Sun | P0_GUARD | directional_guard_behavior_contract | ending-state followed by clarity/relief; Coffin-left must not end(Sun) | outcome/development | no pair override unless fixture fails | directional_grammar |
| Sun > Coffin | P1 | proposed | clarity/success enters closure/end state | outcome/development | separate_override | semantic_operator |
| Scythe > Letter | P1 | proposed | abrupt cut/decision affects message/document | information/career | separate_override | semantic_operator |
| Letter > Scythe | P1 | proposed | message/document triggers cut/abrupt decision | information/career | separate_override | directional_grammar |
| Clouds > Sun | P1 | proposed | uncertainty moving into clarity or obscuring clarity depending order | general/relationship/information | separate_override | semantic_contradiction |
| Sun > Clouds | P1 | proposed | clarity is qualified by uncertainty | general/relationship/information | separate_override | semantic_contradiction |
| Stork > Anchor | P1 | proposed | change meets stability/stagnation | development/timing | separate_override | semantic_contradiction |
| Anchor > Stork | P1 | proposed | fixed/persistent state changes slowly | development/timing | separate_override | semantic_contradiction |
| Snake > Ring | P0_NEW_NEEDS_PROOF | proposed | complication/trust-risk affects bond/contract; third-party remains downstream-gated | relationship trust / contract risk | separate_override | semantic_operator + context_disambiguation |
| Ring > Snake | P0_NEW_NEEDS_PROOF | proposed | bond/contract is complicated; third-party remains downstream-gated | relationship trust / contract risk | separate_override | semantic_operator + context_disambiguation |
| Crossroads > Ring | P1 | proposed | choice/alternative affects commitment/contract | relationship/career | separate_override | semantic_operator |
| Ring > Crossroads | P1 | proposed | bond/contract enters decision point | relationship/career | separate_override | directional_grammar |
| Moon > Ring | P2 | proposed | emotion/recognition/cycle relates to bond/contract | relationship/career/timing | context-specific | context_disambiguation |
| Ring > Moon | P2 | proposed | bond/contract modifies emotion/recognition/cycle | relationship/career/timing | context-specific | context_disambiguation |
| Fish > Book | P1 | proposed | quantity/depth/finance modifies information/project/records | study/money | separate_override | context_disambiguation |
| Book > Fish | P1 | proposed | records/knowledge concern quantity/depth/finance | study/money | separate_override | context_disambiguation |
| Cross > Bouquet | P1 | proposed | burden qualifies gift/relief/opportunity | general/relationship | separate_override | semantic_contradiction |
| Bouquet > Cross | P1 | proposed | positive offer/opportunity becomes burdened/finalized | general/relationship | separate_override | directional_grammar |

## 6. P0 Taxonomy

P0 no longer means "write code immediately." It names high-risk semantic behavior that must be protected. Implementation must first prove which resolution layer should own the behavior.

### P0_KEEP

Existing V1 behavior appears directionally correct. Add or preserve characterization/regression fixtures before changing any implementation.

- Fox > Letter / Letter > Fox
- Ring > Mice / Mice > Ring
- Key > Mountain / Mountain > Key
- Key > Letter / Letter > Key

### P0_REVISE

Existing V1 override is valuable, but too broad or directionally underspecified.

- Book > Man / Man > Book
- Book > Woman / Woman > Book
- Mountain > Letter

Book/Person required mode split:

- `unknown_information`: may describe an unknown/unfamiliar person.
- `secret_hidden` or equivalent private-information mode: may describe privacy/hiddenness without turning the person into a confirmed secret partner.
- `knowledge_learning` / `research_investigation`: describes knowledge, academic, learned, investigative, or bookish traits.
- `project_case`: should not automatically become a person trait; prefer generic person-anchor description or association unless context supports a project-person link.

### P0_NEW / NEEDS PROOF

These may need new override behavior, but only after fixtures show generic grammar or SpecialBehavior fails.

- Rider > Mountain / Mountain > Rider
- Snake > Ring / Ring > Snake

Snake/Ring note: pair layer may express complication, trust-risk, temptation, or contract complication. It must not activate or factualize third-party claims. That remains downstream activation/safety gating, not the main evidence basis of the pair override.

### MOVE_TO_BEHAVIOR_OR_REGRESSION_GUARD

These should normally remain behavior/generic grammar contracts, not pair-specific overrides.

- Mountain > Coffin: Coffin-right may end/stop the left-side obstacle through behavior. Do not add a pair override unless fixtures show instability.
- Coffin > Sun: Coffin-left must not end `Sun.success_achievement`; it should express an ending state followed by clarity/relief/success state through `sequence` or transition grammar.

## 7. P1 High Value / Needs Fixture Proof

P1 candidates are not approved overrides yet. Each one first needs a sufficiency check: if generic grammar plus existing SpecialBehavior already produces the correct ordered relation, the pair should move to `NO_OVERRIDE_NEEDED` with regression fixtures only.

- Heart > Mice / Mice > Heart: check whether `erode_adjacent_theme` already covers the feeling target and ordered evidence.
- Heart > Anchor / Anchor > Heart: check whether Anchor persistence/stagnation behavior already covers the affective target without positivity leakage.
- Ring > Anchor / Anchor > Ring: check whether Anchor behavior already covers persistence/stagnation of bond/contract without forcing a happy stability reading.
- Book > Sun / Sun > Book
- Book > Whip / Whip > Book
- Whip > Child
- Coffin > Mountain / Sun > Coffin
- Scythe > Letter / Letter > Scythe
- Clouds > Sun / Sun > Clouds
- Stork > Anchor / Anchor > Stork
- Crossroads > Ring / Ring > Crossroads
- Fish > Book / Book > Fish
- Cross > Bouquet / Bouquet > Cross

## 8. P2 Useful

- Child > Whip
- Moon > Ring / Ring > Moon
- Whip > Ring / Ring > Whip after relationship/cycle context audit
- Crossroads > Anchor / Anchor > Crossroads after decision-context audit
- Fox > Fish / Fish > Fox after money/career context audit

## 9. No Override Needed Candidates

These may remain generic unless fixture audit proves instability:

- Heart > Ring / Ring > Heart outside relationship/commitment context: current V1 override is acceptable because it is mode-gated, but no additional phrase override is needed.
- Heart > Mice / Mice > Heart, Heart > Anchor / Anchor > Heart, and Ring > Anchor / Anchor > Ring if SpecialBehavior sufficiency fixtures pass.
- Rider > Letter / Letter > Rider: current V1 enough unless V2 adds Timing Resolver-specific nuance.
- Birds > Letter / Letter > Birds: current V1 enough unless Information State Resolver V2 needs more formal spoken/written distinction.
- Mountain > Coffin: should be handled by existing right-side Coffin behavior; add explicit override only if audit finds relation selection unstable.
- Coffin > Sun: should remain a Coffin-left directional guard/behavior contract unless fixture proof shows generic transition grammar fails.

## 10. Direction Notes

| Pair Family | Classification | Direction Difference |
|---|---|---|
| Rider/Mountain | DIRECTION_SENSITIVE | incoming movement/news can be blocked; obstacle can later meet movement/news |
| Letter/Mountain | DIRECTION_SENSITIVE | Letter > Mountain: Letter is target and Mountain is operator, producing blocked/delayed written information. Mountain > Letter: Mountain/blockage is subject and Letter is the manifestation or communication of that blockage, preferably sequence/describe/communicate-obstacle-state, not a second copy of `block(Letter)`. |
| Heart/Mice | DIRECTION_SENSITIVE | feeling erodes vs erosion acts on feeling |
| Ring/Mice | DIRECTION_SENSITIVE | bond erodes vs erosion targets bond; subject changes |
| Heart/Anchor | DIRECTION_WEAK | both persistence of feeling, but subject/operator should remain ordered |
| Ring/Anchor | DIRECTION_WEAK | stable bond vs bond becoming fixed/stuck |
| Book/Sun | DIRECTION_SENSITIVE | unknown clarified vs clarity illuminates unknown/project |
| Book/Person | DIRECTION_SENSITIVE | person anchor stays subject even when order changes |
| Fox/Letter | DIRECTION_SENSITIVE | warning modifies message vs message reveals warning |
| Book/Whip | DIRECTION_WEAK | research revision relation similar but operator side differs |
| Whip/Child | DIRECTION_SENSITIVE | revision simplifies vs small/new item faces repetition |
| Key/Mountain | DIRECTION_SENSITIVE | unlock obstacle vs obstacle blocks solution/confirmation |
| Coffin/Sun | DIRECTION_SENSITIVE | ending state followed by clarity vs clarity ends/closure of success |
| Scythe/Letter | DIRECTION_SENSITIVE | cut message/document vs message triggers cut |
| Clouds/Sun | DIRECTION_SENSITIVE | uncertainty-to-clarity vs clarity-clouded |
| Stork/Anchor | DIRECTION_SENSITIVE | change meets fixedness vs fixed state changes |
| Snake/Ring | DIRECTION_SENSITIVE | complication acts on bond vs bond/contract is complicated |

## 11. Context Notes

Every proposed V2 override should be checked in relationship, career, study, money, and general contexts. Context-specific candidates:

- Fox > Letter:
  - career: `employment + document_paperwork/contract_record`
  - relationship/trust: `deception_suspicion/wrong_warning + written_message`
- Book > Whip:
  - study/project: `project_case/research_investigation + editing_revision_research`
  - other contexts: avoid defaulting to research revision.
- Moon > Ring:
  - career: recognition/work cycle/contract
  - relationship: emotion + bond
  - timing: cycle semantics only with timing/cycle support.
- Fish > Book:
  - study/project: depth/abundance modifies research/project/knowledge
  - money: finance/business modifies records/information
- Whip > Child:
  - study/project: revision supports simplification
  - other contexts: no global simplification shortcut.

## 12. Safety Notes

Safety-sensitive pairs should emit semantic evidence only. They must not create factual conclusions.

- Snake + Ring: relationship complication/trust risk, not confirmed affair. The semantic relation belongs to pair/generic/operator logic; third-party activation remains downstream-gated.
- Crossroads + Ring: commitment/contract choice, not multiple lovers by default.
- Stork + Child: change/new beginning/child theme, not confirmed pregnancy.
- Scythe + Tree: abrupt health/life-force concern only when question context supports wellbeing; never diagnosis.
- Whip + Lily: tension around maturity/peace/sexuality only as semantic possibility; never sexual fact.
- Snake + Garden: public/social complication or trust concern; third-party only with relationship + trust_exclusivity + supporting context.

## 13. Source Evidence

This document does not claim that any source defines these machine relation enums. The sources support general reading principles only:

- card order matters
- adjacency matters
- first card can act as subject/theme and the following card can elaborate or modify it
- complementary/oppositional pairs can create strong structure

Specific V2 relation enums are engineering inferences from established card semantics plus the V1 rule-engine contract.

## 14. Proposed V2 Override Registry Spec

```ts
interface PairOverrideSpec {
  id: string;

  leftCardId: number;
  rightCardId: number;

  priority: "p0" | "p1" | "p2";

  when?: {
    domains?: Domain[];
    topics?: TopicType[];
    intents?: Intent[];
    objects?: ObjectType[];
  };

  leftModes?: string[];
  rightModes?: string[];

  effect: {
    relation: PairRelationType;

    supportsLeftModes?: string[];
    supportsRightModes?: string[];

    suppressesLeftModes?: string[];
    suppressesRightModes?: string[];

    subjectSide?: "left" | "right";
    operatorSide?: "left" | "right";
  };

  evidenceBasis: {
    type:
      | "source_supported"
      | "semantic_operator"
      | "directional_grammar"
      | "context_disambiguation"
      | "information_state"
      | "person_anchor"
      | "safety_requirement";

    notes: string[];
  };

  resolutionLayer:
    | "pair_override"
    | "special_behavior"
    | "generic_grammar"
    | "safety_gate";

  genericFailure?: {
    observedRelation?: PairRelationType;
    expectedRelation?: PairRelationType;
    fixtureId?: string;
    reason: string;
  };

  safetyRequirement?: {
    notes: string[];
  };

  reversePairPolicy:
    | "separate_override"
    | "generic_grammar"
    | "semantically_symmetric";

  status:
    | "proposed"
    | "keep_v1"
    | "revise_v1"
    | "remove_v1"
    | "move_to_behavior_or_regression_guard"
    | "no_override_needed";
}
```

`resolutionLayer` and `genericFailure` are engineering protocol fields, not traditional card-reading doctrine. They force each proposed override to explain why the pair-override layer is necessary instead of using existing generic grammar, SpecialBehavior, or downstream safety gating.

## 15. Fixture Plan

P0 fixture minimum:

- A>B default
- B>A default
- A>B context-specific
- B>A context-specific

Additional fixture needs:

- High ambiguity pair: add neighbor-supported and neighbor-not-supported cases.
- Person pair: add known person and unknown person cases.
- Safety pair: add unsafe factualization regression.
- Key pair: assert mode-sensitive relation source.
- Coffin pair: assert Coffin-left does not end the right-side card.
- Anchor pair: assert persistence/stagnation is not positivity.
- Snake/Crossroads relationship pairs: assert third-party remains gated and non-factual.

Specific first fixture batch:

| Fixture ID | Pair | Context | Must Assert |
|---|---|---|---|
| V2-P0-01 | Rider > Mountain | communication short horizon | incoming news/message is delayed or blocked |
| V2-P0-02 | Mountain > Rider | same | obstacle is followed by movement/news; not identical to reverse |
| V2-P0-03 | Letter > Mountain | career/document | document is delayed/blocked |
| V2-P0-04 | Mountain > Letter | same | obstacle affects/communicates through document; direction preserved |
| V2-P0-05 | Snake > Ring | relationship trust | complication evidence only; no confirmed third party |
| V2-P0-06 | Ring > Snake | relationship trust | bond/contract complication; no confirmed third party |
| V2-P0-07 | Coffin > Sun | outcome | sequence/transition; not end(success) |
| V2-P0-08 | Sun > Coffin | outcome | clarity enters closure/end; not same as reverse |
| V2-P0-09 | Key > Mountain | obstacle outcome | solution_unlock unlocks obstacle |
| V2-P0-10 | Mountain > Key | obstacle outcome | obstacle blocks solution/confirmation based on mode |
| V2-P1-01 | Whip > Child | study project | supports simplicity_reduction only in study/project |
| V2-P1-02 | Fish > Book | study project | depth/abundance modifies research/project; not hidden info |
| V2-P1-03 | Fish > Book | money | finance/records relation, not study project |
| V2-P1-04 | Book > Whip | non-study | no automatic thesis revision |
| V2-P1-05 | Anchor > Heart | relationship | persistence/stagnation is not automatic positive support |

## 16. Implementation Order

1. Freeze this audit taxonomy: P0_KEEP, P0_REVISE, P0_NEW/NEEDS_PROOF, MOVE_TO_BEHAVIOR_OR_REGRESSION_GUARD, P1_NEEDS_FIXTURE_PROOF, P2, and NO_OVERRIDE_NEEDED.
2. Add characterization fixtures for current V1 behavior without changing behavior.
3. Add failing specification fixtures for P0_REVISE and P0_NEW candidates.
4. Determine the correct resolution layer for each failure: generic grammar, SpecialBehavior, pair override, or safety gate.
5. Only then modify behavior/override logic.
6. Implement P0_REVISE and proven P0_NEW one family at a time.
7. Add P1 only after fixtures prove generic grammar and existing behavior are insufficient.
8. Do not start with a registry-shape refactor; that would mix pure structure migration with behavior changes.

## 17. V2 Phase 1.1 Freeze Summary

Counts after review:

- P0_KEEP: 8 ordered pairs.
- P0_REVISE: 5 ordered pairs.
- P0_NEW / NEEDS_PROOF: 4 ordered pairs.
- MOVE_TO_BEHAVIOR_OR_REGRESSION_GUARD: 2 ordered pairs.
- P1 remaining / needs fixture proof: 25 ordered pairs.
- P2 backlog: 8 ordered pairs.

P0_KEEP:

- Fox > Letter
- Letter > Fox
- Ring > Mice
- Mice > Ring
- Key > Mountain
- Mountain > Key
- Key > Letter
- Letter > Key

P0_REVISE:

- Book > Man
- Man > Book
- Book > Woman
- Woman > Book
- Mountain > Letter

P0_NEW / NEEDS_PROOF:

- Rider > Mountain
- Mountain > Rider
- Snake > Ring
- Ring > Snake

MOVE_TO_BEHAVIOR_OR_REGRESSION_GUARD:

- Mountain > Coffin
- Coffin > Sun

Needs fixture proof before any override implementation:

- Rider > Mountain / Mountain > Rider
- Snake > Ring / Ring > Snake
- Heart > Mice / Mice > Heart
- Heart > Anchor / Anchor > Heart
- Ring > Anchor / Anchor > Ring
- Book > Sun / Sun > Book
- Book > Whip / Whip > Book
- Whip > Child / Child > Whip
- Coffin > Mountain / Sun > Coffin
- Scythe > Letter / Letter > Scythe
- Clouds > Sun / Sun > Clouds
- Stork > Anchor / Anchor > Stork
- Crossroads > Ring / Ring > Crossroads
- Fish > Book / Book > Fish
- Cross > Bouquet / Bouquet > Cross

Highest-risk 10 before implementation:

1. Book > Man: broad Book modes can incorrectly create an unknown/private person.
2. Man > Book: person anchor can inherit "secret/private" too broadly.
3. Book > Woman: same broad Book-mode risk as Book > Man.
4. Woman > Book: same reverse person-anchor risk.
5. Mountain > Letter: direction may collapse into the same meaning as Letter > Mountain.
6. Coffin > Sun: must remain a Coffin-left transition guard, not `end(Sun)`.
7. Mountain > Coffin: should stay behavior/regression unless existing Coffin-right behavior fails.
8. Snake > Ring: semantic complication must not become confirmed third party.
9. Ring > Snake: bond/contract complication must not become confirmed third party.
10. Heart/Anchor and Ring/Anchor family: Anchor persistence/stagnation must not become automatic positive stability.

## 18. V2 Phase 1 Gate

- [x] current override inventory complete
- [x] every override is ordered
- [x] V1 redundant/revise candidates identified
- [x] dangerous hard-coded combos identified
- [x] P0 candidate list
- [x] P1 candidate list
- [x] P2 candidate list
- [x] no_override_needed list
- [x] context-specific overrides identified
- [x] reverse pair policy defined
- [x] person anchors audited
- [x] safety pairs audited
- [x] Book unknown != secrecy preserved
- [x] Key mode sensitivity preserved
- [x] Coffin directionality preserved
- [x] Anchor persistence != positivity preserved
- [x] third-party gating preserved
- [x] no phrase dictionary
- [x] no CMSE bypass
- [x] fixture plan complete
- [x] no production code behavior changed
- [x] no engine version bump
- [x] no deploy

## 19. V2 Phase 1.1 Review Gate

- [x] P0 split into P0_KEEP / P0_REVISE / P0_NEW
- [x] Mountain > Coffin moved out of default override implementation
- [x] Coffin > Sun marked as directional guard / behavior contract
- [x] Book > Man/Woman and Man/Woman > Book marked REVISE_V1 with mode split
- [x] Mice and Anchor candidates require SpecialBehavior sufficiency check
- [x] Snake/Ring semantic relation separated from downstream safety gating
- [x] Mountain > Letter direction difference made explicit
- [x] `resolutionLayer` added to proposed registry protocol
- [x] `genericFailure` added to proposed registry protocol
- [x] P0_REVISE / P0_NEW require concrete failure proof
- [x] implementation order starts with characterization/failing fixtures
- [x] registry-shape refactor deferred
- [x] no production code behavior changed
- [x] no engine version bump
- [x] no deploy
