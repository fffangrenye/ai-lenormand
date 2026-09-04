import { CardLexiconEntry, SemanticMode } from "../semantic-types";

function mode(input: SemanticMode): SemanticMode {
  return input;
}

export const cards01To12: CardLexiconEntry[] = [
  {
    id: 1,
    name: "Rider",
    primaryMeanings: ["incoming", "approach", "message", "new development", "movement"],
    secondaryMeanings: ["visitor", "messenger", "delivery", "transport"],
    coreModes: ["incoming_news", "arrival_approach"],
    semanticModes: [
      mode({ id: "incoming_news", meanings: ["incoming news", "update", "message arriving"], defaultPriority: "primary", roles: ["information", "action"], planes: ["information", "action"], tempoOverride: "fast" }),
      mode({ id: "arrival_approach", meanings: ["arrival", "approach", "someone or something coming closer"], defaultPriority: "primary", roles: ["action", "tempo"], planes: ["action"], tempoOverride: "fast" }),
      mode({ id: "new_dynamic", meanings: ["new development", "fresh momentum", "started motion"], defaultPriority: "secondary", roles: ["action", "core_theme"], planes: ["abstract", "action"] }),
      mode({ id: "movement_motion", meanings: ["movement", "motion", "short movement"], defaultPriority: "secondary", roles: ["action"], planes: ["action"] }),
      mode({ id: "visitor_messenger_person", meanings: ["visitor", "messenger person", "courier"], defaultPriority: "secondary", roles: ["person_anchor", "information"], planes: ["person"] }),
      mode({ id: "transport_delivery", meanings: ["delivery", "transport", "vehicle bringing something"], defaultPriority: "secondary", roles: ["action", "information"], planes: ["literal", "action"] }),
      mode({ id: "lost_item_in_transit", meanings: ["item in transit", "moving object", "delivery path"], defaultPriority: "rare", roles: ["location", "action"], planes: ["location", "literal"], requiresContext: true, activation: { anyOf: [{ field: "domain", equals: "lost_item" }] } })
    ],
    roles: ["information", "action", "tempo"],
    orientation: "neutral",
    tempo: "fast",
    ambiguityLevel: "medium",
    literalMeanings: ["rider", "courier", "transport"],
    contrasts: [3],
    semanticAgency: "mixed"
  },
  {
    id: 2,
    name: "Clover",
    primaryMeanings: ["small luck", "brief opportunity", "light improvement"],
    secondaryMeanings: ["fun", "chance", "small money", "briefness"],
    coreModes: ["small_luck", "brief_opportunity"],
    semanticModes: [
      mode({ id: "small_luck", meanings: ["small luck", "minor favorable opening"], defaultPriority: "primary", roles: ["modifier", "result"], planes: ["abstract"], durationOverride: "brief" }),
      mode({ id: "brief_opportunity", meanings: ["brief opportunity", "short-lived chance"], defaultPriority: "primary", roles: ["modifier", "duration"], planes: ["abstract"], durationOverride: "short" }),
      mode({ id: "lightness_fun", meanings: ["lightness", "fun", "ease"], defaultPriority: "secondary", roles: ["modifier", "state"], planes: ["abstract"] }),
      mode({ id: "small_scale", meanings: ["small scale", "minor amount", "reduced magnitude"], defaultPriority: "secondary", roles: ["modifier", "quantity"], planes: ["abstract"] }),
      mode({ id: "chance_risk", meanings: ["chance", "gamble", "small risk"], defaultPriority: "secondary", roles: ["result"], planes: ["abstract"] }),
      mode({ id: "small_money", meanings: ["small money", "minor financial gain"], defaultPriority: "rare", roles: ["resource", "quantity"], planes: ["abstract"], affinities: { domains: ["money"] } })
    ],
    roles: ["modifier", "duration"],
    orientation: "favorable",
    tempo: "very_fast",
    duration: "short",
    ambiguityLevel: "low",
    specialBehaviors: ["shorten_duration", "reduce_scale", "improve_tone"],
    semanticAgency: "mixed"
  },
  {
    id: 3,
    name: "Ship",
    primaryMeanings: ["distance", "travel", "relocation", "movement away"],
    secondaryMeanings: ["foreign", "overseas", "trade", "transport vehicle", "longing"],
    coreModes: ["distance_movement", "travel_journey"],
    semanticModes: [
      mode({ id: "distance_movement", meanings: ["distance movement", "movement across distance", "departure or separation by space"], defaultPriority: "primary", roles: ["action", "location"], planes: ["action", "location"], tempoOverride: "slow" }),
      mode({ id: "travel_journey", meanings: ["travel", "journey", "trip"], defaultPriority: "primary", roles: ["action", "location"], planes: ["action", "literal"] }),
      mode({ id: "foreign_overseas", meanings: ["foreign place", "overseas", "far away"], defaultPriority: "secondary", roles: ["location"], planes: ["location"] }),
      mode({ id: "relocation_transfer", meanings: ["relocation", "transfer", "moving base"], defaultPriority: "secondary", roles: ["action"], planes: ["action"], affinities: { domains: ["travel", "home_property", "career"] } }),
      mode({ id: "transport_vehicle", meanings: ["vehicle", "ship", "transport"], defaultPriority: "secondary", roles: ["location"], planes: ["literal"] }),
      mode({ id: "trade_commerce", meanings: ["trade", "commerce", "shipping business"], defaultPriority: "secondary", roles: ["resource", "action"], planes: ["abstract"], affinities: { domains: ["money", "career"] } }),
      mode({ id: "longing_yearning", meanings: ["longing", "yearning", "desire for something far away"], defaultPriority: "rare", roles: ["state"], planes: ["abstract"], affinities: { domains: ["relationship"] } })
    ],
    roles: ["action", "location"],
    orientation: "neutral",
    tempo: "slow",
    ambiguityLevel: "medium",
    literalMeanings: ["ship", "vehicle"],
    contrasts: [1],
    semanticAgency: "mixed"
  },
  {
    id: 4,
    name: "House",
    primaryMeanings: ["home", "residence", "household", "base"],
    secondaryMeanings: ["private environment", "real estate", "family unit", "headquarters"],
    coreModes: ["home_residence", "household"],
    semanticModes: [
      mode({ id: "home_residence", meanings: ["home", "residence", "current place of living"], defaultPriority: "primary", roles: ["location", "core_theme"], planes: ["location", "literal"] }),
      mode({ id: "household", meanings: ["household", "family unit", "domestic environment"], defaultPriority: "primary", roles: ["core_theme"], planes: ["abstract", "location"] }),
      mode({ id: "base_foundation", meanings: ["base", "foundation", "familiar stable place"], defaultPriority: "secondary", roles: ["state", "location"], planes: ["abstract", "location"] }),
      mode({ id: "private_internal", meanings: ["private", "internal", "behind closed doors"], defaultPriority: "secondary", roles: ["location", "modifier"], planes: ["abstract", "location"] }),
      mode({ id: "property_real_estate", meanings: ["property", "real estate", "house asset"], defaultPriority: "secondary", roles: ["resource", "location"], planes: ["literal"], affinities: { domains: ["home_property", "money"] } }),
      mode({ id: "organization_base", meanings: ["organization base", "headquarters", "institutional home"], defaultPriority: "rare", roles: ["location"], planes: ["location"], affinities: { domains: ["career"] } })
    ],
    roles: ["location", "state"],
    orientation: "neutral",
    duration: "persistent",
    ambiguityLevel: "low",
    literalMeanings: ["house", "residence"],
    contrasts: [5],
    semanticAgency: "mixed"
  },
  {
    id: 5,
    name: "Tree",
    primaryMeanings: ["long-term", "roots", "system", "growth"],
    secondaryMeanings: ["health", "family roots", "network system", "duration", "inertia"],
    coreModes: ["long_term_growth", "roots_foundation", "health_wellbeing"],
    semanticModes: [
      mode({ id: "long_term_growth", meanings: ["long-term growth", "slow development", "organic process"], defaultPriority: "primary", roles: ["duration", "state"], planes: ["abstract"], timeframeBehavior: { longHorizonBoost: ["long_term_growth", "roots_foundation"] }, durationOverride: "long" }),
      mode({ id: "roots_foundation", meanings: ["roots", "foundation", "deep base"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "health_wellbeing", meanings: ["health", "wellbeing", "life force"], defaultPriority: "primary", roles: ["safety", "state"], planes: ["abstract"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "wellbeing" }] }, safetyTag: "health" }),
      mode({ id: "family_roots", meanings: ["family roots", "ancestry", "lineage"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"], affinities: { domains: ["family"] } }),
      mode({ id: "network_system", meanings: ["system", "network", "organic structure"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"] }),
      mode({ id: "inertia_duration", meanings: ["inertia", "long duration", "slow persistence"], defaultPriority: "secondary", roles: ["duration", "obstacle"], planes: ["abstract"], timeframeBehavior: { shortHorizonBoost: ["inertia_duration"] }, durationOverride: "persistent" })
    ],
    roles: ["duration", "state"],
    orientation: "contextual",
    tempo: "very_slow",
    duration: "long",
    ambiguityLevel: "medium",
    specialBehaviors: ["extend_duration", "stabilize_adjacent_theme"],
    literalMeanings: ["tree", "roots"],
    contrasts: [4],
    semanticAgency: "mixed"
  },
  {
    id: 6,
    name: "Clouds",
    primaryMeanings: ["uncertainty", "confusion", "reduced clarity"],
    secondaryMeanings: ["unclear information", "ambiguity", "weather", "difficult mood"],
    coreModes: ["uncertainty", "confusion"],
    semanticModes: [
      mode({ id: "uncertainty", meanings: ["uncertainty", "unclear situation", "lack of confidence"], defaultPriority: "primary", roles: ["state", "obstacle"], planes: ["abstract", "information"] }),
      mode({ id: "confusion", meanings: ["confusion", "mixed signals", "mental fog"], defaultPriority: "primary", roles: ["state", "information"], planes: ["abstract", "information"] }),
      mode({ id: "unclear_information", meanings: ["unclear information", "ambiguous message", "not enough facts"], defaultPriority: "secondary", roles: ["information"], planes: ["information"] }),
      mode({ id: "instability_ambiguity", meanings: ["instability", "ambiguity", "changeable quality"], defaultPriority: "secondary", roles: ["modifier", "state"], planes: ["abstract"] }),
      mode({ id: "weather_visibility", meanings: ["cloudy weather", "reduced visibility"], defaultPriority: "rare", roles: ["location"], planes: ["literal"] }),
      mode({ id: "difficult_mood", meanings: ["heavy mood", "doubt", "worrying atmosphere"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] })
    ],
    roles: ["state", "information", "obstacle"],
    orientation: "challenging",
    ambiguityLevel: "high",
    specialBehaviors: ["reduce_clarity"],
    literalMeanings: ["clouds", "fog", "weather"],
    contrasts: [23],
    semanticAgency: "mixed"
  },
  {
    id: 7,
    name: "Snake",
    primaryMeanings: ["complication", "deception", "complex path"],
    secondaryMeanings: ["rivalry", "jealousy", "manipulation", "strategy", "third-party factor", "winding route"],
    coreModes: ["complication", "deception_betrayal"],
    semanticModes: [
      mode({ id: "complication", meanings: ["complication", "difficult twist", "nonlinear problem"], defaultPriority: "primary", roles: ["obstacle"], planes: ["abstract"] }),
      mode({ id: "deception_betrayal", meanings: ["deception", "betrayal", "something suspicious"], defaultPriority: "primary", roles: ["obstacle", "information"], planes: ["abstract", "information"] }),
      mode({ id: "rivalry_jealousy", meanings: ["rivalry", "jealousy", "competitive tension"], defaultPriority: "secondary", roles: ["obstacle"], planes: ["abstract"], affinities: { domains: ["relationship", "career"] } }),
      mode({ id: "manipulation_strategy", meanings: ["manipulation", "strategy", "careful maneuvering"], defaultPriority: "secondary", roles: ["action"], planes: ["action", "abstract"] }),
      mode({ id: "difficult_clever_person", meanings: ["difficult clever person", "complicated person"], defaultPriority: "secondary", roles: ["person_anchor", "obstacle"], planes: ["person"] }),
      mode({ id: "third_party_factor", meanings: ["third-party factor", "another interested party", "triangular complication"], defaultPriority: "rare", roles: ["person_anchor", "obstacle"], planes: ["person", "abstract"], requiresContext: true, activation: { allOf: [{ field: "domain", equals: "relationship" }, { field: "topic", equals: "trust_exclusivity" }], neighborSupportRequired: true } }),
      mode({ id: "winding_route", meanings: ["winding route", "indirect path", "detour"], defaultPriority: "secondary", roles: ["action", "location"], planes: ["action", "location"] })
    ],
    roles: ["obstacle", "action"],
    orientation: "challenging",
    ambiguityLevel: "high",
    specialBehaviors: ["change_adjacent_theme", "reduce_clarity"],
    personMeanings: ["difficult clever person", "rival"],
    semanticAgency: "mixed"
  },
  {
    id: 8,
    name: "Coffin",
    primaryMeanings: ["ending", "closure", "stop", "stagnation"],
    secondaryMeanings: ["loss", "absence", "exhaustion", "withdrawal", "rest", "closed container"],
    coreModes: ["ending_closure", "stop_stagnation"],
    semanticModes: [
      mode({ id: "ending_closure", meanings: ["ending", "closure", "something concluded"], defaultPriority: "primary", roles: ["result", "state"], planes: ["abstract"] }),
      mode({ id: "stop_stagnation", meanings: ["stop", "stagnation", "no further movement"], defaultPriority: "primary", roles: ["state", "obstacle"], planes: ["abstract"] }),
      mode({ id: "loss_absence", meanings: ["loss", "absence", "empty place"], defaultPriority: "secondary", roles: ["result"], planes: ["abstract"] }),
      mode({ id: "exhaustion_withdrawal", meanings: ["exhaustion", "withdrawal", "depletion leading to stop"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "rest_inactivity", meanings: ["rest", "inactivity", "pause"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "closed_container", meanings: ["closed container", "box", "enclosed object"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["state", "result"],
    orientation: "challenging",
    duration: "persistent",
    ambiguityLevel: "medium",
    specialBehaviors: ["end_adjacent_theme", "diminish_adjacent_theme"],
    literalMeanings: ["coffin", "box", "closed container"],
    contrasts: [23, 36],
    semanticAgency: "mixed"
  },
  {
    id: 9,
    name: "Bouquet",
    primaryMeanings: ["gift", "reward", "joy", "appreciation"],
    secondaryMeanings: ["help", "support", "invitation", "celebration", "beauty", "pleasant person"],
    coreModes: ["gift_reward", "joy_pleasure"],
    semanticModes: [
      mode({ id: "gift_reward", meanings: ["gift", "reward", "offered benefit"], defaultPriority: "primary", roles: ["result", "resource"], planes: ["abstract", "literal"] }),
      mode({ id: "joy_pleasure", meanings: ["joy", "pleasure", "pleasant feeling"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "appreciation_admiration", meanings: ["appreciation", "admiration", "being valued"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"], affinities: { domains: ["relationship", "career"] } }),
      mode({ id: "help_support", meanings: ["help", "support", "kind gesture"], defaultPriority: "secondary", roles: ["resource"], planes: ["abstract"] }),
      mode({ id: "invitation_celebration", meanings: ["invitation", "celebration", "social occasion"], defaultPriority: "secondary", roles: ["action"], planes: ["action"], affinities: { domains: ["social"] } }),
      mode({ id: "beauty_art_design", meanings: ["beauty", "art", "design"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"] }),
      mode({ id: "pleasant_person", meanings: ["pleasant person", "charming helper"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person"] })
    ],
    roles: ["result", "resource", "state"],
    orientation: "favorable",
    ambiguityLevel: "low",
    specialBehaviors: ["improve_tone", "relieve_difficulty"],
    literalMeanings: ["flowers", "gift"],
    personMeanings: ["pleasant person"],
    semanticAgency: "mixed"
  },
  {
    id: 10,
    name: "Scythe",
    primaryMeanings: ["cut", "separation", "decision", "sudden change"],
    secondaryMeanings: ["risk", "danger", "harvest", "sharp tool"],
    coreModes: ["cut_separation", "decisive_decision", "sudden_change"],
    semanticModes: [
      mode({ id: "cut_separation", meanings: ["cut", "separation", "removal"], defaultPriority: "primary", roles: ["action", "result"], planes: ["action"] }),
      mode({ id: "decisive_decision", meanings: ["decisive decision", "sharp choice", "necessary cut"], defaultPriority: "primary", roles: ["action"], planes: ["action"] }),
      mode({ id: "sudden_change", meanings: ["sudden change", "abrupt transition"], defaultPriority: "primary", roles: ["action", "tempo"], planes: ["action"], tempoOverride: "sudden" }),
      mode({ id: "risk_danger", meanings: ["risk", "danger", "hazard"], defaultPriority: "secondary", roles: ["obstacle", "safety"], planes: ["abstract"] }),
      mode({ id: "harvest_collect", meanings: ["harvest", "collect", "cutting what is ready"], defaultPriority: "secondary", roles: ["result", "resource"], planes: ["abstract"] }),
      mode({ id: "sharp_tool", meanings: ["sharp tool", "blade", "cutting implement"], defaultPriority: "rare", roles: ["action"], planes: ["literal"] })
    ],
    roles: ["action", "result", "tempo"],
    orientation: "challenging",
    tempo: "sudden",
    ambiguityLevel: "medium",
    specialBehaviors: ["cut_adjacent_theme", "finalize_previous_theme"],
    literalMeanings: ["scythe", "sharp tool"],
    contrasts: [22],
    semanticAgency: "mixed"
  },
  {
    id: 11,
    name: "Whip",
    primaryMeanings: ["conflict", "argument", "repetition", "intensity"],
    secondaryMeanings: ["practice", "discipline", "editing", "research", "physical activity", "sexuality"],
    coreModes: ["conflict_argument", "repetition"],
    semanticModes: [
      mode({ id: "conflict_argument", meanings: ["conflict", "argument", "heated exchange"], defaultPriority: "primary", roles: ["obstacle", "action"], planes: ["abstract", "action"] }),
      mode({ id: "repetition", meanings: ["repetition", "recurring pattern", "doing again"], defaultPriority: "primary", roles: ["duration", "action"], planes: ["abstract", "action"] }),
      mode({ id: "intensity_pressure", meanings: ["intensity", "pressure", "forceful rhythm"], defaultPriority: "secondary", roles: ["modifier"], planes: ["abstract"] }),
      mode({ id: "practice_discipline", meanings: ["practice", "discipline", "training"], defaultPriority: "secondary", roles: ["action"], planes: ["action"], affinities: { domains: ["study", "career"] } }),
      mode({ id: "editing_revision_research", meanings: ["editing", "revision", "research through repeated work"], defaultPriority: "secondary", roles: ["action", "information"], planes: ["action", "information"], affinities: { domains: ["study", "career"] } }),
      mode({ id: "physical_activity", meanings: ["physical activity", "exercise", "repeated motion"], defaultPriority: "rare", roles: ["action"], planes: ["literal", "action"] }),
      mode({ id: "sexuality", meanings: ["sexuality", "sexual tension", "physical intimacy"], defaultPriority: "rare", roles: ["core_theme", "safety"], planes: ["abstract"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "intimacy" }] }, safetyTag: "sexuality" })
    ],
    roles: ["obstacle", "action", "duration"],
    orientation: "contextual",
    ambiguityLevel: "high",
    specialBehaviors: ["repeat_adjacent_theme", "amplify_scale"],
    semanticAgency: "mixed"
  },
  {
    id: 12,
    name: "Birds",
    primaryMeanings: ["oral communication", "discussion", "live contact"],
    secondaryMeanings: ["phone call", "negotiation", "chatter", "gossip", "anxiety", "pair"],
    coreModes: ["oral_communication", "discussion_negotiation"],
    semanticModes: [
      mode({ id: "oral_communication", meanings: ["oral communication", "spoken exchange", "live conversation"], defaultPriority: "primary", roles: ["information", "action"], planes: ["information", "action"], timeframeBehavior: { shortHorizonBoost: ["oral_communication", "busyness_chatter"] } }),
      mode({ id: "discussion_negotiation", meanings: ["discussion", "negotiation", "back-and-forth talk"], defaultPriority: "primary", roles: ["information", "action"], planes: ["information", "action"] }),
      mode({ id: "call_live_contact", meanings: ["phone call", "live contact", "voice message"], defaultPriority: "secondary", roles: ["information", "action"], planes: ["information"], affinities: { topics: ["communication"] } }),
      mode({ id: "nervousness_anxiety", meanings: ["nervousness", "anxiety", "agitated thoughts"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"], timeframeBehavior: { longHorizonBoost: ["nervousness_anxiety"] } }),
      mode({ id: "busyness_chatter", meanings: ["busyness", "chatter", "many small exchanges"], defaultPriority: "secondary", roles: ["modifier", "information"], planes: ["information", "abstract"] }),
      mode({ id: "gossip", meanings: ["gossip", "rumor", "side conversation"], defaultPriority: "secondary", roles: ["information"], planes: ["information"], requiresContext: true, activation: { anyOf: [{ field: "domain", equals: "social" }, { field: "topic", equals: "trust_exclusivity" }] } }),
      mode({ id: "pair_two", meanings: ["pair", "two", "two people or items"], defaultPriority: "rare", roles: ["quantity"], planes: ["abstract", "literal"] })
    ],
    roles: ["information", "action"],
    orientation: "neutral",
    tempo: "fast",
    ambiguityLevel: "medium",
    specialBehaviors: ["communicate_adjacent_theme", "pluralize_adjacent_theme"],
    literalMeanings: ["birds", "pair"],
    contrasts: [27],
    semanticAgency: "mixed"
  }
];
