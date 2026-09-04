import { CardLexiconEntry, SemanticMode } from "../semantic-types";

function mode(input: SemanticMode): SemanticMode {
  return input;
}

export const cards13To24: CardLexiconEntry[] = [
  {
    id: 13,
    name: "Child",
    primaryMeanings: ["small", "new", "beginning", "early stage"],
    secondaryMeanings: ["simplicity", "inexperience", "young person", "literal child"],
    coreModes: ["small_scale", "new_beginning", "early_stage"],
    semanticModes: [
      mode({ id: "small_scale", meanings: ["small scale", "minor version", "reduced size"], defaultPriority: "primary", roles: ["modifier", "quantity"], planes: ["abstract"] }),
      mode({ id: "new_beginning", meanings: ["new beginning", "fresh start", "new matter"], defaultPriority: "primary", roles: ["core_theme", "state"], planes: ["abstract"] }),
      mode({ id: "early_stage", meanings: ["early stage", "immature phase", "not yet developed"], defaultPriority: "primary", roles: ["duration", "state"], planes: ["abstract"] }),
      mode({ id: "simplicity_reduction", meanings: ["simplicity", "simplified form", "less complexity"], defaultPriority: "secondary", roles: ["modifier"], planes: ["abstract"] }),
      mode({ id: "inexperience_naivety", meanings: ["inexperience", "naivety", "lack of maturity"], defaultPriority: "secondary", roles: ["state", "person_anchor"], planes: ["abstract", "person"] }),
      mode({ id: "literal_child", meanings: ["literal child", "child-related matter"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person", "literal"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "children" }, { field: "personRelation", equals: "child" }] } }),
      mode({ id: "young_person", meanings: ["young person", "junior", "younger role"], defaultPriority: "secondary", roles: ["person_anchor"], planes: ["person"] })
    ],
    roles: ["modifier", "duration", "quantity"],
    orientation: "neutral",
    duration: "short",
    ambiguityLevel: "medium",
    specialBehaviors: ["reduce_scale", "mark_early_stage"],
    personMeanings: ["child", "young person"],
    semanticAgency: "mixed"
  },
  {
    id: 14,
    name: "Fox",
    primaryMeanings: ["warning", "wrongness", "deception", "employment"],
    secondaryMeanings: ["strategy", "circumspection", "self-interest", "survival", "specialist"],
    coreModes: ["wrong_warning", "deception_suspicion", "employment"],
    semanticModes: [
      mode({ id: "wrong_warning", meanings: ["warning", "something wrong", "need for caution"], defaultPriority: "primary", roles: ["obstacle", "information"], planes: ["abstract", "information"] }),
      mode({ id: "deception_suspicion", meanings: ["deception", "suspicion", "untrustworthy signal"], defaultPriority: "primary", roles: ["obstacle", "information"], planes: ["abstract", "information"], affinities: { topics: ["trust_exclusivity", "conflict_obstacle"] } }),
      mode({ id: "employment", meanings: ["employment", "job role", "work arrangement"], defaultPriority: "primary", roles: ["core_theme"], planes: ["abstract"], affinities: { domains: ["career"], topics: ["current_job", "job_search", "contract_employment"] } }),
      mode({ id: "strategy_circumspection", meanings: ["strategy", "careful maneuvering", "circumspection"], defaultPriority: "secondary", roles: ["action"], planes: ["action", "abstract"] }),
      mode({ id: "self_interest_survival", meanings: ["self-interest", "survival instinct", "protecting oneself"], defaultPriority: "secondary", roles: ["action", "state"], planes: ["abstract"] }),
      mode({ id: "specialist_investigator", meanings: ["specialist", "investigator", "skilled worker"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person"], affinities: { domains: ["career"] } })
    ],
    roles: ["obstacle", "information", "core_theme"],
    orientation: "contextual",
    ambiguityLevel: "high",
    contextOverrides: [
      { modeId: "employment", adjustment: "strong_boost", when: [{ field: "domain", equals: "career" }, { field: "topic", equals: "current_job" }], notes: "Hard context switch: career/current_job prefers employment over deception." },
      { modeId: "employment", adjustment: "strong_boost", when: [{ field: "domain", equals: "career" }, { field: "topic", equals: "job_search" }] },
      { modeId: "employment", adjustment: "strong_boost", when: [{ field: "domain", equals: "career" }, { field: "topic", equals: "contract_employment" }] },
      { modeId: "deception_suspicion", adjustment: "boost", when: [{ field: "topic", equals: "trust_exclusivity" }] },
      { modeId: "wrong_warning", adjustment: "boost", when: [{ field: "topic", equals: "conflict_obstacle" }] }
    ],
    specialBehaviors: ["reduce_clarity"],
    personMeanings: ["specialist", "investigator"],
    contrasts: [32],
    semanticAgency: "mixed"
  },
  {
    id: 15,
    name: "Bear",
    primaryMeanings: ["power", "strength", "protection", "resource"],
    secondaryMeanings: ["control", "financial assets", "authority", "leader", "mother", "large scale"],
    coreModes: ["power_strength", "protection_support"],
    semanticModes: [
      mode({ id: "power_strength", meanings: ["power", "strength", "capacity"], defaultPriority: "primary", roles: ["resource", "core_theme"], planes: ["abstract"] }),
      mode({ id: "protection_support", meanings: ["protection", "support", "strong backing"], defaultPriority: "primary", roles: ["resource", "state"], planes: ["abstract"] }),
      mode({ id: "control_domination", meanings: ["control", "domination", "overpowering force"], defaultPriority: "secondary", roles: ["obstacle", "action"], planes: ["abstract", "action"], affinities: { topics: ["conflict_obstacle"] } }),
      mode({ id: "financial_assets", meanings: ["financial assets", "stored resources", "capital"], defaultPriority: "secondary", roles: ["resource"], planes: ["abstract"], affinities: { domains: ["money"] } }),
      mode({ id: "authority_leader", meanings: ["authority", "leader", "powerful person"], defaultPriority: "secondary", roles: ["person_anchor", "resource"], planes: ["person"] }),
      mode({ id: "mother_maternal", meanings: ["mother", "maternal figure", "protective parent"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person"], requiresContext: true, activation: { anyOf: [{ field: "personRelation", equals: "parent" }, { field: "domain", equals: "family" }] } }),
      mode({ id: "large_scale", meanings: ["large scale", "big amount", "amplified size"], defaultPriority: "secondary", roles: ["quantity", "modifier"], planes: ["abstract"] })
    ],
    roles: ["resource", "person_anchor", "quantity"],
    orientation: "contextual",
    ambiguityLevel: "medium",
    specialBehaviors: ["amplify_scale", "drain_resource"],
    personMeanings: ["leader", "authority", "mother"],
    contrasts: [34, 35],
    semanticAgency: "mixed"
  },
  {
    id: 16,
    name: "Stars",
    primaryMeanings: ["clarity", "direction", "guidance", "future outlook"],
    secondaryMeanings: ["hope", "network", "internet", "spread", "multiplicity", "electricity"],
    coreModes: ["clarity_precision", "direction_guidance"],
    semanticModes: [
      mode({ id: "clarity_precision", meanings: ["clarity", "precision", "clear signal"], defaultPriority: "primary", roles: ["information", "state"], planes: ["information", "abstract"] }),
      mode({ id: "direction_guidance", meanings: ["direction", "guidance", "orientation toward a goal"], defaultPriority: "primary", roles: ["information", "action"], planes: ["abstract", "information"] }),
      mode({ id: "future_outlook", meanings: ["future outlook", "longer view", "possibility field"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"] }),
      mode({ id: "hope_positive_outlook", meanings: ["hope", "positive outlook", "aspiration"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "network_internet", meanings: ["network", "internet", "connected system"], defaultPriority: "secondary", roles: ["information"], planes: ["information"], affinities: { domains: ["social", "career"] } }),
      mode({ id: "spread_multiplicity", meanings: ["spread", "multiplicity", "many points"], defaultPriority: "secondary", roles: ["quantity", "information"], planes: ["abstract", "information"] }),
      mode({ id: "literal_stars_electricity", meanings: ["literal stars", "electricity", "sparkle"], defaultPriority: "rare", roles: ["location"], planes: ["literal"] })
    ],
    roles: ["information", "state"],
    orientation: "favorable",
    ambiguityLevel: "medium",
    specialBehaviors: ["clarify_adjacent_theme", "spread_or_connect_adjacent_theme"],
    semanticAgency: "mixed"
  },
  {
    id: 17,
    name: "Stork",
    primaryMeanings: ["change", "transition", "status shift"],
    secondaryMeanings: ["improvement", "upgrade", "relocation", "promotion", "renewal", "reproductive change"],
    coreModes: ["change_transition"],
    semanticModes: [
      mode({ id: "change_transition", meanings: ["change", "transition", "state shift"], defaultPriority: "primary", roles: ["action", "core_theme"], planes: ["abstract", "action"] }),
      mode({ id: "improvement_upgrade", meanings: ["improvement", "upgrade", "better condition"], defaultPriority: "secondary", roles: ["result"], planes: ["abstract"], notes: "Not guaranteed by Stork alone; separate from change core." }),
      mode({ id: "relocation_move", meanings: ["relocation", "move", "change of place"], defaultPriority: "secondary", roles: ["location", "action"], planes: ["location", "action"], affinities: { domains: ["travel", "home_property"] } }),
      mode({ id: "promotion_advancement", meanings: ["promotion", "advancement", "moving up"], defaultPriority: "secondary", roles: ["result", "action"], planes: ["abstract"], affinities: { domains: ["career"] } }),
      mode({ id: "renewal_adjustment", meanings: ["renewal", "adjustment", "change to a new arrangement"], defaultPriority: "secondary", roles: ["action"], planes: ["action", "abstract"] }),
      mode({ id: "reproductive_change", meanings: ["reproductive change", "pregnancy-related change"], defaultPriority: "rare", roles: ["safety", "core_theme"], planes: ["abstract"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "children" }, { field: "objectType", equals: "pregnancy" }] }, safetyTag: "pregnancy" })
    ],
    roles: ["action", "core_theme"],
    orientation: "contextual",
    ambiguityLevel: "medium",
    specialBehaviors: ["change_adjacent_theme"],
    semanticAgency: "mixed"
  },
  {
    id: 18,
    name: "Dog",
    primaryMeanings: ["friend", "known person", "loyalty", "trust", "support"],
    secondaryMeanings: ["familiarity", "dependability", "advisor", "helper", "companion", "pet"],
    coreModes: ["friend_known_person", "loyalty_trust", "support_help"],
    semanticModes: [
      mode({ id: "friend_known_person", meanings: ["friend", "known person", "familiar person"], defaultPriority: "primary", roles: ["person_anchor"], planes: ["person"] }),
      mode({ id: "loyalty_trust", meanings: ["loyalty", "trust", "reliability"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "support_help", meanings: ["support", "help", "being there"], defaultPriority: "primary", roles: ["resource"], planes: ["abstract"] }),
      mode({ id: "familiarity", meanings: ["familiarity", "known quality", "not a stranger"], defaultPriority: "secondary", roles: ["state", "person_anchor"], planes: ["abstract", "person"] }),
      mode({ id: "dependability_patience", meanings: ["dependability", "patience", "steady support"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "advisor_helper_person", meanings: ["advisor", "helper person", "supportive guide"], defaultPriority: "secondary", roles: ["person_anchor", "resource"], planes: ["person"] }),
      mode({ id: "partner_companion", meanings: ["companion", "partner in a broad sense"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person"], notes: "Not automatic romantic partner." }),
      mode({ id: "pet", meanings: ["pet", "dog", "animal companion"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["literal"], requiresContext: true })
    ],
    roles: ["person_anchor", "resource", "state"],
    orientation: "favorable",
    duration: "persistent",
    ambiguityLevel: "medium",
    specialBehaviors: ["prefer_known_person", "signal_loyalty"],
    personMeanings: ["friend", "known person", "advisor", "helper"],
    semanticAgency: "mixed"
  },
  {
    id: 19,
    name: "Tower",
    primaryMeanings: ["institution", "official structure", "authority", "hierarchy"],
    secondaryMeanings: ["boundary", "separation", "isolation", "formalization", "official person", "official building"],
    coreModes: ["institution_official", "authority_hierarchy"],
    semanticModes: [
      mode({ id: "institution_official", meanings: ["institution", "official body", "formal system"], defaultPriority: "primary", roles: ["core_theme", "location"], planes: ["abstract", "location"] }),
      mode({ id: "authority_hierarchy", meanings: ["authority", "hierarchy", "ranked structure"], defaultPriority: "primary", roles: ["person_anchor", "core_theme"], planes: ["abstract", "person"] }),
      mode({ id: "boundary_separation", meanings: ["boundary", "separation", "formal distance"], defaultPriority: "secondary", roles: ["obstacle", "state"], planes: ["abstract"] }),
      mode({ id: "isolation_loneliness", meanings: ["isolation", "loneliness", "standing apart"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "formalization", meanings: ["formalization", "official handling", "structured process"], defaultPriority: "secondary", roles: ["action"], planes: ["action", "abstract"] }),
      mode({ id: "official_person", meanings: ["official person", "administrator", "authority figure"], defaultPriority: "secondary", roles: ["person_anchor"], planes: ["person"] }),
      mode({ id: "official_building", meanings: ["official building", "office", "institutional location"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["core_theme", "location", "person_anchor"],
    orientation: "neutral",
    duration: "persistent",
    ambiguityLevel: "medium",
    specialBehaviors: ["formalize_adjacent_theme", "create_boundary"],
    personMeanings: ["official", "administrator"],
    contrasts: [21],
    semanticAgency: "mixed"
  },
  {
    id: 20,
    name: "Garden",
    primaryMeanings: ["public", "open", "social group", "social event"],
    secondaryMeanings: ["network", "audience", "publicity", "visibility", "outdoor public place", "many people"],
    coreModes: ["public_open", "social_group", "social_event"],
    semanticModes: [
      mode({ id: "public_open", meanings: ["public", "open", "visible to others"], defaultPriority: "primary", roles: ["location", "information"], planes: ["location", "abstract"] }),
      mode({ id: "social_group", meanings: ["social group", "community", "many people"], defaultPriority: "primary", roles: ["person_anchor", "quantity"], planes: ["person", "abstract"] }),
      mode({ id: "social_event", meanings: ["social event", "gathering", "public occasion"], defaultPriority: "primary", roles: ["core_theme"], planes: ["abstract", "location"] }),
      mode({ id: "network_audience", meanings: ["network", "audience", "social reach"], defaultPriority: "secondary", roles: ["information", "quantity"], planes: ["information", "abstract"] }),
      mode({ id: "publicity_visibility", meanings: ["publicity", "visibility", "being seen"], defaultPriority: "secondary", roles: ["information"], planes: ["information", "abstract"] }),
      mode({ id: "outdoor_public_place", meanings: ["outdoor public place", "park", "venue"], defaultPriority: "secondary", roles: ["location"], planes: ["literal", "location"] }),
      mode({ id: "pluralize_people", meanings: ["many people", "plural actors", "more than one participant"], defaultPriority: "secondary", roles: ["quantity", "person_anchor"], planes: ["person", "abstract"] })
    ],
    roles: ["location", "information", "quantity"],
    orientation: "neutral",
    ambiguityLevel: "low",
    specialBehaviors: ["publicize_adjacent_theme", "pluralize_adjacent_theme", "spread_or_connect_adjacent_theme"],
    literalMeanings: ["garden", "park", "venue"],
    semanticAgency: "mixed"
  },
  {
    id: 21,
    name: "Mountain",
    primaryMeanings: ["blockage", "obstacle", "delay"],
    secondaryMeanings: ["resistance", "distance", "coldness", "boundary", "limit", "opposition", "literal mountain"],
    coreModes: ["blockage_obstacle", "delay"],
    semanticModes: [
      mode({ id: "blockage_obstacle", meanings: ["blockage", "obstacle", "barrier to progress"], defaultPriority: "primary", roles: ["obstacle"], planes: ["abstract"] }),
      mode({ id: "delay", meanings: ["delay", "slowdown", "waiting because blocked"], defaultPriority: "primary", roles: ["obstacle", "duration"], planes: ["abstract"], tempoOverride: "very_slow" }),
      mode({ id: "resistance", meanings: ["resistance", "pushback", "hard to move"], defaultPriority: "secondary", roles: ["obstacle"], planes: ["abstract"] }),
      mode({ id: "distance_coldness", meanings: ["distance", "coldness", "emotional or spatial separation"], defaultPriority: "secondary", roles: ["state", "location"], planes: ["abstract", "location"] }),
      mode({ id: "boundary_limit", meanings: ["boundary", "limit", "hard edge"], defaultPriority: "secondary", roles: ["obstacle"], planes: ["abstract"] }),
      mode({ id: "enemy_opposition", meanings: ["enemy", "opposition", "opposing force"], defaultPriority: "rare", roles: ["person_anchor", "obstacle"], planes: ["person"], requiresContext: true }),
      mode({ id: "literal_mountain", meanings: ["literal mountain", "high place", "hill"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["obstacle", "duration"],
    orientation: "challenging",
    tempo: "very_slow",
    duration: "long",
    ambiguityLevel: "low",
    specialBehaviors: ["block_adjacent_theme", "delay_adjacent_theme"],
    literalMeanings: ["mountain", "barrier"],
    contrasts: [19, 36],
    semanticAgency: "mixed"
  },
  {
    id: 22,
    name: "Crossroads",
    primaryMeanings: ["choice", "options", "multiple alternatives"],
    secondaryMeanings: ["indecision", "split", "division", "turning point", "route", "third-party or multiple interest"],
    coreModes: ["choice_options", "multiple_alternatives"],
    semanticModes: [
      mode({ id: "choice_options", meanings: ["choice", "options", "decision paths"], defaultPriority: "primary", roles: ["core_theme", "action"], planes: ["abstract", "action"] }),
      mode({ id: "multiple_alternatives", meanings: ["multiple alternatives", "more than one route", "options still open"], defaultPriority: "primary", roles: ["quantity", "core_theme"], planes: ["abstract"] }),
      mode({ id: "indecision_hesitation", meanings: ["indecision", "hesitation", "uncertain selection"], defaultPriority: "secondary", roles: ["state", "obstacle"], planes: ["abstract"] }),
      mode({ id: "split_division", meanings: ["split", "division", "branching apart"], defaultPriority: "secondary", roles: ["action", "state"], planes: ["abstract", "action"] }),
      mode({ id: "turning_point", meanings: ["turning point", "fork in process"], defaultPriority: "secondary", roles: ["action"], planes: ["abstract", "action"] }),
      mode({ id: "route_path", meanings: ["route", "path", "road"], defaultPriority: "secondary", roles: ["location"], planes: ["location", "literal"] }),
      mode({ id: "third_party_or_multiple_interest", meanings: ["third-party or multiple interest", "another option in relationship field"], defaultPriority: "rare", roles: ["person_anchor", "quantity"], planes: ["person", "abstract"], requiresContext: true, activation: { allOf: [{ field: "domain", equals: "relationship" }, { field: "topic", equals: "trust_exclusivity" }], neighborSupportRequired: true } })
    ],
    roles: ["core_theme", "quantity", "action"],
    orientation: "neutral",
    ambiguityLevel: "medium",
    specialBehaviors: ["open_alternatives", "split_adjacent_theme", "pluralize_adjacent_theme"],
    literalMeanings: ["crossroads", "path"],
    contrasts: [10],
    semanticAgency: "mixed"
  },
  {
    id: 23,
    name: "Mice",
    primaryMeanings: ["erosion", "diminishment", "loss", "depletion", "stress"],
    secondaryMeanings: ["small recurring problems", "financial drain", "theft", "missing", "decay", "damage"],
    coreModes: ["erosion_diminishment", "loss_depletion", "stress_worry"],
    semanticModes: [
      mode({ id: "erosion_diminishment", meanings: ["erosion", "diminishment", "gradual reduction"], defaultPriority: "primary", roles: ["obstacle", "duration"], planes: ["abstract"] }),
      mode({ id: "loss_depletion", meanings: ["loss", "depletion", "resources running down"], defaultPriority: "primary", roles: ["result", "resource"], planes: ["abstract"] }),
      mode({ id: "stress_worry", meanings: ["stress", "worry", "gnawing anxiety"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "small_recurring_problems", meanings: ["small recurring problems", "many little issues"], defaultPriority: "secondary", roles: ["obstacle", "quantity"], planes: ["abstract"] }),
      mode({ id: "financial_drain", meanings: ["financial drain", "money leaking away"], defaultPriority: "secondary", roles: ["resource", "obstacle"], planes: ["abstract"], affinities: { domains: ["money"] } }),
      mode({ id: "theft_missing", meanings: ["theft", "missing item", "something taken or lost"], defaultPriority: "rare", roles: ["result"], planes: ["abstract"], affinities: { domains: ["lost_item"] } }),
      mode({ id: "decay_damage", meanings: ["decay", "damage", "wearing down"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract", "literal"] })
    ],
    roles: ["obstacle", "resource", "duration"],
    orientation: "challenging",
    duration: "persistent",
    ambiguityLevel: "medium",
    specialBehaviors: ["diminish_adjacent_theme", "erode_adjacent_theme", "drain_resource"],
    contrasts: [8, 6],
    semanticAgency: "mixed"
  },
  {
    id: 24,
    name: "Heart",
    primaryMeanings: ["love", "affection", "attraction", "passion"],
    secondaryMeanings: ["emotional investment", "joy", "satisfaction", "preference", "desire", "care", "literal heart"],
    coreModes: ["love_affection", "attraction_passion"],
    semanticModes: [
      mode({ id: "love_affection", meanings: ["love", "affection", "warm feeling"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"], affinities: { domains: ["relationship"] } }),
      mode({ id: "attraction_passion", meanings: ["attraction", "passion", "emotional pull"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"], affinities: { topics: ["feelings_attraction"] } }),
      mode({ id: "emotional_investment", meanings: ["emotional investment", "heart involved", "caring about outcome"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "joy_satisfaction", meanings: ["joy", "satisfaction", "pleased state"], defaultPriority: "secondary", roles: ["state", "result"], planes: ["abstract"] }),
      mode({ id: "preference_desire", meanings: ["preference", "desire", "what someone wants"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "care_compassion", meanings: ["care", "compassion", "kind feeling"], defaultPriority: "secondary", roles: ["state", "resource"], planes: ["abstract"] }),
      mode({ id: "literal_heart", meanings: ["literal heart", "heart-shaped object"], defaultPriority: "rare", roles: ["location"], planes: ["literal"], requiresContext: true })
    ],
    roles: ["state"],
    orientation: "favorable",
    ambiguityLevel: "low",
    specialBehaviors: ["emotionally_charge_adjacent_theme"],
    literalMeanings: ["heart"],
    contrasts: [25],
    semanticAgency: "mixed"
  }
];
