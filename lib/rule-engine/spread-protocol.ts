import { getCardLexiconEntry, getSemanticMode } from "./lexicon";
import { QuestionContext } from "./ontology";
import { resolveOrderedPair } from "./pair-engine";
import { PairInput, PairInterpretation, PairRelationType, ResolvedCardMeaning } from "./pair-types";
import { PreselectedCardMeaning, SemanticCandidate } from "./preselection-types";
import { assertValidSpreadInput, assertValidSpreadStructure } from "./spread-schema";
import {
  ClosingEffect,
  EndpointRelationHint,
  FiveCardSpreadStructure,
  FocusEvidence,
  ForwardChain,
  HingeEvidence,
  MainProcess,
  MirrorEvidence,
  MirrorFunction,
  SpreadConflict,
  SpreadInput,
  SpreadPosition,
  SpreadSemanticFrame,
  SpreadStructure,
  SpreadTransition,
  SpreadWarning,
  StructuralEvidence,
  TempoEvidence,
  ThreeCardSpreadStructure
} from "./spread-types";

const ENGINE_VERSION = "spread-protocol-1.0.0";

export function buildSpreadStructure(input: SpreadInput): SpreadStructure {
  const validInput = assertValidSpreadInput(input);
  return validInput.spreadSize === 3 ? buildThreeCardSpread(validInput) : buildFiveCardSpread(validInput);
}

function buildThreeCardSpread(input: SpreadInput): ThreeCardSpreadStructure {
  const [a, b, c] = input.cards as [number, number, number];
  const [ab, bc] = input.adjacentPairs as [PairInterpretation, PairInterpretation];
  const positions = buildPositions(input, ["opening", "hinge", "closing"]);
  const hingeEvidence = buildHingeEvidence(b, ab, bc);
  const forwardChain = buildForwardChain(input.cards, [ab, bc], input.question);
  const conflicts = detectConflicts(input, forwardChain, hingeEvidence);
  const warnings = detectWarnings(input, conflicts);
  const structuralEvidence = buildStructuralEvidence(input, [ab, bc], "hinge", b);
  const semanticFrame = buildSemanticFrame(input, forwardChain, b, conflicts);
  const structure: ThreeCardSpreadStructure = {
    type: "three_card",
    spreadSize: 3,
    positions,
    adjacentPairs: { ab, bc },
    hingeCardId: b,
    hingeEvidence,
    endpointHint: buildEndpointHint(a, c, forwardChain),
    forwardChain,
    semanticFrame,
    structuralEvidence,
    tempoEvidence: collectTempoEvidence(input, [ab, bc]),
    conflicts: conflicts.length ? conflicts : undefined,
    warnings: warnings.length ? warnings : undefined,
    debugTrace: buildDebugTrace(3, positions, ["AB", "BC"], forwardChain, structuralEvidence, conflicts, warnings, semanticFrame, b)
  };
  return assertValidSpreadStructure(structure);
}

function buildFiveCardSpread(input: SpreadInput): FiveCardSpreadStructure {
  const [a, b, c, d, e] = input.cards as [number, number, number, number, number];
  const [ab, bc, cd, de] = input.adjacentPairs as [PairInterpretation, PairInterpretation, PairInterpretation, PairInterpretation];
  const positions = buildPositions(input, ["opening", "development", "focus", "development", "closing"]);
  const focusEvidence = buildFocusEvidence(input, c, bc, cd);
  const forwardChain = buildForwardChain(input.cards, [ab, bc, cd, de], input.question);
  const mirrors = [buildMirrorEvidence(input, "AE", a, e, forwardChain), buildMirrorEvidence(input, "BD", b, d, forwardChain)];
  const conflicts = detectConflicts(input, forwardChain, focusEvidence, mirrors);
  const warnings = detectWarnings(input, conflicts, mirrors);
  const structuralEvidence = [
    ...buildStructuralEvidence(input, [ab, bc, cd, de], "focus", c),
    ...mirrors.map((mirror) => ({ source: "mirror" as const, code: `MIRROR_${mirror.key}_${mirror.function.toUpperCase()}`, cardIds: [mirror.leftCardId, mirror.rightCardId] }))
  ];
  const semanticFrame = buildSemanticFrame(input, forwardChain, c, conflicts, mirrors);
  const structure: FiveCardSpreadStructure = {
    type: "five_card",
    spreadSize: 5,
    positions,
    adjacentPairs: { ab, bc, cd, de },
    focusCardId: c,
    focusEvidence,
    forwardChain,
    mirrors,
    semanticFrame,
    structuralEvidence,
    tempoEvidence: collectTempoEvidence(input, [ab, bc, cd, de]),
    conflicts: conflicts.length ? conflicts : undefined,
    warnings: warnings.length ? warnings : undefined,
    debugTrace: buildDebugTrace(5, positions, ["AB", "BC", "CD", "DE"], forwardChain, structuralEvidence, conflicts, warnings, semanticFrame, undefined, c, ["AE", "BD"])
  };
  return assertValidSpreadStructure(structure);
}

function buildPositions(input: SpreadInput, roles: SpreadPosition["structuralRole"][]): SpreadPosition[] {
  const labels = ["A", "B", "C", "D", "E"] as const;
  return input.cards.map((cardId, index) => ({
    label: labels[index],
    index,
    cardId,
    structuralRole: roles[index],
    resolvedMeaning: requiredMeaning(input, cardId),
    importance: roles[index] === "hinge" || roles[index] === "focus" ? "primary" : "supporting"
  }));
}

function buildHingeEvidence(cardId: number, leftPair: PairInterpretation, rightPair: PairInterpretation): HingeEvidence {
  const leftSupport = supportedModesFor(cardId, leftPair);
  const rightSupport = supportedModesFor(cardId, rightPair);
  const reinforcedModes = intersection(leftSupport, rightSupport);
  const conflictingModes = reinforcedModes.length ? [] : unique([...leftSupport, ...rightSupport]);
  return {
    cardId,
    leftRelation: leftPair.primaryRelation.relation,
    rightRelation: rightPair.primaryRelation.relation,
    reinforcedModes: reinforcedModes.length ? reinforcedModes : undefined,
    conflictingModes: conflictingModes.length > 1 ? conflictingModes : undefined,
    confidence: reinforcedModes.length ? "high" : conflictingModes.length > 1 ? "medium" : "low"
  };
}

function buildFocusEvidence(input: SpreadInput, cardId: number, leftPair: PairInterpretation, rightPair: PairInterpretation): FocusEvidence {
  const leftSupport = supportedModesFor(cardId, leftPair);
  const rightSupport = supportedModesFor(cardId, rightPair);
  const reinforcedModes = intersection(leftSupport, rightSupport);
  const conflictingModes = reinforcedModes.length ? [] : unique([...leftSupport, ...rightSupport]);
  const meaning = requiredMeaning(input, cardId);
  return {
    cardId,
    leftSupport,
    rightSupport,
    reinforcedModes: reinforcedModes.length ? reinforcedModes : undefined,
    conflictingModes: conflictingModes.length > 1 ? conflictingModes : undefined,
    thematicRole: focusRole(meaning),
    confidence: reinforcedModes.length ? "high" : conflictingModes.length > 1 ? "medium" : "low"
  };
}

function buildForwardChain(cardIds: number[], pairs: PairInterpretation[], question: QuestionContext): ForwardChain {
  const transitions = pairs.map((pair) => ({
    fromCardId: pair.leftCardId,
    toCardId: pair.rightCardId,
    relation: pair.primaryRelation.relation,
    semanticEffect: pair.primaryRelation.semanticResult,
    narrativeFunction: narrativeFunction(pair.primaryRelation.relation, question)
  }));
  return {
    cardIds,
    pairRelations: pairs.map((pair) => pair.primaryRelation.relation),
    transitions,
    coherence: chainCoherence(pairs)
  };
}

function buildMirrorEvidence(input: SpreadInput, key: "AE" | "BD", leftCardId: number, rightCardId: number, chain: ForwardChain): MirrorEvidence {
  const forwardRelation = resolveMirrorPair(input, leftCardId, rightCardId);
  const reverseRelation = resolveMirrorPair(input, rightCardId, leftCardId);
  const relationSummary = chooseMirrorSummary(forwardRelation, reverseRelation);
  const conflictsWithMainChain = relationConflictsWithChain(relationSummary, chain.pairRelations);
  const mirrorFunction = mirrorFunctionFor(relationSummary, chain, conflictsWithMainChain);
  return {
    key,
    leftCardId,
    rightCardId,
    function: mirrorFunction,
    relevance: key === "BD" && mirrorFunction !== "irrelevant" ? "high" : mirrorFunction === "irrelevant" ? "low" : "medium",
    relationSummary,
    forwardRelation,
    reverseRelation,
    conflictsWithMainChain: conflictsWithMainChain || undefined
  };
}

function resolveMirrorPair(input: SpreadInput, leftCardId: number, rightCardId: number) {
  const leftCard = getCardLexiconEntry(leftCardId);
  const rightCard = getCardLexiconEntry(rightCardId);
  if (!leftCard || !rightCard) throw new Error(`Invalid mirror pair ${leftCardId}>${rightCardId}.`);
  return resolveOrderedPair({
    left: preselectionFor(input, leftCardId),
    right: preselectionFor(input, rightCardId),
    leftCard,
    rightCard,
    question: input.question,
    pairIndex: 0,
    spreadSize: input.spreadSize
  });
}

function preselectionFor(input: SpreadInput, cardId: number): PreselectedCardMeaning {
  const existing = input.preselectedCards?.find((item) => item.cardId === cardId);
  if (existing) return existing;
  const meaning = requiredMeaning(input, cardId);
  const candidates: SemanticCandidate[] = [meaning.primaryMode, meaning.secondaryMode]
    .filter((modeId): modeId is string => Boolean(modeId))
    .map((modeId, index) => {
      const mode = getSemanticMode(cardId, modeId);
      return {
        modeId,
        relevance: index === 0 ? "strong" : "possible",
        internalScore: index === 0 ? 4 : 2,
        roles: mode?.roles ?? [meaning.role],
        planes: mode?.planes ?? [meaning.plane],
        evidence: [{ source: "neighbor", code: "SPREAD_RESOLVED_MODE" }]
      };
    });
  return {
    cardId,
    preferredPlane: meaning.plane,
    candidates,
    unresolved: Boolean(meaning.unresolvedAlternatives?.length),
    ambiguity: "medium",
    evidence: [{ source: "neighbor", code: "SPREAD_MIRROR_FROM_RESOLVED" }]
  };
}

function buildStructuralEvidence(input: SpreadInput, pairs: PairInterpretation[], centerKind: "hinge" | "focus", centerCardId: number): StructuralEvidence[] {
  return [
    { source: "position", code: `SPREAD_${input.spreadSize}_LINEAR`, cardIds: input.cards },
    { source: centerKind, code: `${centerKind.toUpperCase()}_${centerCardId}`, cardIds: [centerCardId] },
    ...pairs.map((pair) => ({ source: "adjacent_pair" as const, code: `PAIR_${pair.leftCardId}>${pair.rightCardId}`, cardIds: [pair.leftCardId, pair.rightCardId], pairKey: `${pair.leftCardId}>${pair.rightCardId}` }))
  ];
}

function buildSemanticFrame(input: SpreadInput, chain: ForwardChain, centerCardId: number, conflicts: SpreadConflict[], mirrors: MirrorEvidence[] = []): SpreadSemanticFrame {
  const center = requiredMeaning(input, centerCardId);
  const conditions = mirrors.filter((mirror) => mirror.function === "qualify" || mirror.function === "subtext").map((mirror) => `${mirror.key}:${mirror.relationSummary}`);
  return {
    coreTheme: center.primaryMode,
    mainProcess: mainProcess(chain.pairRelations),
    keyTransitions: chain.transitions,
    closingEffect: closingEffect(chain.pairRelations),
    conditions: conditions.length ? conditions : undefined,
    unresolved: conflicts.length > 0 || chain.coherence === "unclear" || chain.coherence === "conflicted"
  };
}

function detectConflicts(input: SpreadInput, chain: ForwardChain, centerEvidence: HingeEvidence | FocusEvidence, mirrors: MirrorEvidence[] = []): SpreadConflict[] {
  const conflicts: SpreadConflict[] = [];
  if (centerEvidence.conflictingModes?.length) {
    conflicts.push({ type: "center_mode_conflict", cardId: centerEvidence.cardId, leftEvidence: centerEvidence.conflictingModes, severity: "medium" });
  }
  if (chain.coherence === "conflicted") conflicts.push({ type: "pair_direction_conflict", severity: "high" });
  for (const mirror of mirrors) {
    if (mirror.conflictsWithMainChain) conflicts.push({ type: "mirror_chain_conflict", leftEvidence: [mirror.key, mirror.relationSummary], severity: "low" });
  }
  const primaryPeople = input.resolvedCards.filter((meaning) => meaning.role === "person_anchor" && meaning.confidence !== "low");
  if (primaryPeople.length > 2) conflicts.push({ type: "person_mapping_conflict", severity: "medium", leftEvidence: primaryPeople.map((meaning) => String(meaning.cardId)) });
  return conflicts;
}

function detectWarnings(input: SpreadInput, conflicts: SpreadConflict[], mirrors: MirrorEvidence[] = []): SpreadWarning[] {
  const warnings: SpreadWarning[] = [];
  if (conflicts.some((conflict) => conflict.type === "center_mode_conflict")) warnings.push({ type: "center_mode_conflict" });
  if (mirrors.some((mirror) => mirror.conflictsWithMainChain)) warnings.push({ type: "mirror_conflict" });
  if (input.resolvedCards.filter((meaning) => meaning.role === "person_anchor" && meaning.confidence !== "low").length > 2) warnings.push({ type: "multiple_primary_people" });
  if (
    input.resolvedCards.some((meaning) => meaning.unresolvedAlternatives?.length || meaning.confidence === "low") ||
    input.cards.some((cardId) => getCardLexiconEntry(cardId)?.ambiguityLevel === "high")
  ) {
    warnings.push({ type: "high_ambiguity" });
  }
  if (input.spreadSize === 3 && input.question.timeframe.normalized?.horizonClass === "extended") warnings.push({ type: "horizon_too_long_for_small_spread" });
  return warnings;
}

function collectTempoEvidence(input: SpreadInput, pairs: PairInterpretation[]): TempoEvidence[] {
  const cardTempo: TempoEvidence[] = [];
  for (const cardId of input.cards) {
    const card = getCardLexiconEntry(cardId);
    if (card?.tempo === "fast" || card?.tempo === "very_fast") cardTempo.push({ cardId, signal: "fast" });
    if (card?.tempo === "slow" || card?.tempo === "very_slow") cardTempo.push({ cardId, signal: "slow" });
    if (card?.tempo === "sudden") cardTempo.push({ cardId, signal: "sudden" });
    if (card?.duration === "persistent") cardTempo.push({ cardId, signal: "persistent" });
  }
  const pairTempo: TempoEvidence[] = [];
  for (const pair of pairs) {
    const effect = pair.primaryRelation.semanticResult.temporalEffect;
    if (effect === "slower") pairTempo.push({ pair: [pair.leftCardId, pair.rightCardId], signal: "delayed" });
    if (effect === "sudden") pairTempo.push({ pair: [pair.leftCardId, pair.rightCardId], signal: "sudden" });
  }
  return [...cardTempo, ...pairTempo];
}

function supportedModesFor(cardId: number, pair: PairInterpretation) {
  return unique(pair.neighborEvidence.filter((evidence) => evidence.targetCardId === cardId).flatMap((evidence) => evidence.supportsModes ?? []));
}

function focusRole(meaning: ResolvedCardMeaning) {
  if (meaning.role === "person_anchor") return "person_anchor";
  if (meaning.role === "information" || meaning.plane === "information") return "information_hub";
  if (meaning.role === "obstacle" || meaning.role === "action" || ["block", "ending", "cut", "change", "erosion", "solution"].some((token) => meaning.primaryMode.includes(token))) return "operator";
  if (meaning.role === "state") return "state";
  if (meaning.role === "core_theme") return "topic";
  return "unclear";
}

function narrativeFunction(relation: PairRelationType, question: QuestionContext): SpreadTransition["narrativeFunction"] {
  if (relation === "block" || relation === "hide" || question.intent === "obstacle") return "block";
  if (relation === "end" || relation === "finalize") return "close";
  if (relation === "unlock" || relation === "confirm" || relation === "clarify") return "resolve";
  if (relation === "change" || relation === "cut") return "change";
  if (relation === "modify" || relation === "describe" || relation === "associate") return "qualify";
  return "develop";
}

function chainCoherence(pairs: PairInterpretation[]) {
  const relations = pairs.map((pair) => pair.primaryRelation.relation);
  if (hasConflict(relations)) return "conflicted";
  if (relations.every((relation) => relation === relations[0])) return "coherent";
  if (pairs.some((pair) => pair.unresolved)) return "mostly_coherent";
  if (relations.includes("block") || relations.includes("hide") || relations.includes("erode")) return "mostly_coherent";
  return "coherent";
}

function hasConflict(relations: PairRelationType[]) {
  return relations.some((relation) => ["block", "erode"].includes(relation)) && relations.some((relation) => ["unlock", "confirm", "clarify"].includes(relation));
}

function mainProcess(relations: PairRelationType[]): MainProcess {
  if (relations.includes("erode")) return "eroding";
  if (relations.includes("block")) return "blocked";
  if (relations.includes("sequence")) return relations.some((relation) => ["end", "cut", "change"].includes(relation)) ? "changing" : "developing";
  if (relations.includes("end") || relations.includes("finalize")) return relations.some((relation) => ["clarify", "confirm", "unlock"].includes(relation)) ? "clarifying" : "ending";
  if (relations.includes("unlock") || relations.includes("clarify") || relations.includes("confirm")) return "clarifying";
  if (relations.includes("repeat")) return "repeating";
  if (relations.includes("hide")) return relations.some((relation) => ["communicate"].includes(relation)) ? "clarifying" : "uncertain";
  if (relations.includes("change") || relations.includes("cut")) return "changing";
  if (relations.includes("stabilize") || relations.includes("bind")) return "stable";
  if (relations.includes("communicate") || relations.includes("sequence")) return "developing";
  return "mixed";
}

function closingEffect(relations: PairRelationType[]): ClosingEffect {
  const relation = relations[relations.length - 1];
  if (relations.includes("hide") && !relations.some((item) => ["clarify", "confirm", "unlock", "communicate"].includes(item))) return "open";
  if (relation === "block" || relation === "hide") return "blocked";
  if (relation === "end" || relation === "finalize" || relation === "cut") return "ended";
  if (relation === "unlock") return "resolved";
  if (relation === "confirm" || relation === "clarify") return "confirmed";
  if (relation === "stabilize" || relation === "bind") return "stabilized";
  if (relation === "sequence" || relation === "change") return "changed";
  if (relation === "burden") return "burdened";
  return relation ? "neutral" : "unclear";
}

function buildEndpointHint(openingCardId: number, closingCardId: number, chain: ForwardChain): EndpointRelationHint {
  const process = mainProcess(chain.pairRelations);
  return {
    openingCardId,
    closingCardId,
    relation: process === "clarifying" || process === "ending" ? "improving" : process === "eroding" || process === "blocked" ? "worsening" : process === "changing" ? "shifted" : chain.coherence === "conflicted" ? "contrasting" : "consistent"
  };
}

function chooseMirrorSummary(forward: PairInterpretation, reverse: PairInterpretation) {
  if (forward.primaryRelation.internalScore >= reverse.primaryRelation.internalScore) return forward.primaryRelation.relation;
  return reverse.primaryRelation.relation;
}

function mirrorFunctionFor(relation: PairRelationType, chain: ForwardChain, conflictsWithMainChain: boolean): MirrorFunction {
  if (conflictsWithMainChain) return chain.coherence === "coherent" || chain.coherence === "mostly_coherent" ? "qualify" : "contrast";
  if (chain.pairRelations.includes(relation)) return "confirm";
  if (["describe", "associate", "modify", "communicate"].includes(relation)) return "subtext";
  if (["block", "hide", "erode", "end", "unlock", "confirm", "clarify"].includes(relation)) return "qualify";
  return "irrelevant";
}

function relationConflictsWithChain(relation: PairRelationType, mainRelations: PairRelationType[]) {
  return ["block", "hide", "erode"].includes(relation)
    ? mainRelations.some((item) => ["unlock", "confirm", "clarify"].includes(item))
    : ["unlock", "confirm", "clarify"].includes(relation) && mainRelations.some((item) => ["block", "hide", "erode"].includes(item));
}

function requiredMeaning(input: SpreadInput, cardId: number) {
  const meaning = input.resolvedCards.find((item) => item.cardId === cardId);
  if (!meaning) throw new Error(`Missing resolved meaning for card ${cardId}.`);
  return meaning;
}

function intersection(left: string[], right: string[]) {
  return unique(left.filter((item) => right.includes(item)));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildDebugTrace(
  spreadSize: 3 | 5,
  positions: SpreadPosition[],
  adjacentPairs: string[],
  forwardChain: ForwardChain,
  structuralEvidence: StructuralEvidence[],
  conflicts: SpreadConflict[],
  warnings: SpreadWarning[],
  semanticFrame: SpreadSemanticFrame,
  hingeCardId?: number,
  focusCardId?: number,
  mirrorKeys?: Array<"AE" | "BD">
) {
  return {
    spreadSize,
    positions: positions.map((position) => ({ label: position.label, cardId: position.cardId, structuralRole: position.structuralRole })),
    adjacentPairs,
    hingeCardId,
    focusCardId,
    mirrorKeys,
    coherence: forwardChain.coherence,
    structuralEvidence: structuralEvidence.map((item) => item.code),
    conflicts: conflicts.map((item) => item.type),
    warnings: warnings.map((item) => item.type),
    semanticFrame
  };
}
