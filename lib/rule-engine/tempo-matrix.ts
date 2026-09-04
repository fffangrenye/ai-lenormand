import { HorizonClass } from "./ontology";
import { DominantTempo, TempoCompatibility } from "./tempo-types";

export function lookupTempoCompatibility(horizon: HorizonClass, tempo: DominantTempo): TempoCompatibility {
  if (horizon === "open") return "unknown";
  if (tempo === "mixed" || tempo === "unknown" || tempo === "variable") return horizon === "immediate" ? "strained" : "possible";

  if (horizon === "immediate") {
    if (tempo === "sudden" || tempo === "immediate" || tempo === "fast") return "well_matched";
    if (tempo === "soon" || tempo === "moderate") return "possible";
    if (tempo === "slow") return "strained";
    return "mismatched";
  }

  if (horizon === "short") {
    if (tempo === "immediate" || tempo === "fast" || tempo === "soon") return "well_matched";
    if (tempo === "sudden" || tempo === "moderate") return "possible";
    return "strained";
  }

  if (horizon === "near_term") {
    if (tempo === "soon" || tempo === "moderate") return "well_matched";
    if (tempo === "fast" || tempo === "slow" || tempo === "stationary") return "possible";
    return "strained";
  }

  if (horizon === "medium_term") {
    if (tempo === "moderate" || tempo === "slow") return "well_matched";
    if (tempo === "soon" || tempo === "very_slow" || tempo === "stationary") return "possible";
    return "strained";
  }

  if (tempo === "slow" || tempo === "very_slow" || tempo === "stationary") return "well_matched";
  if (tempo === "moderate" || tempo === "soon") return "possible";
  return "strained";
}
