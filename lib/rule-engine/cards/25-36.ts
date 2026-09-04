import { CardLexiconEntry, SemanticMode } from "../semantic-types";

function mode(input: SemanticMode): SemanticMode {
  return input;
}

export const cards25To36: CardLexiconEntry[] = [
  {
    id: 25,
    name: "Ring",
    primaryMeanings: ["commitment", "bond", "agreement", "contract", "cycle"],
    secondaryMeanings: ["romantic commitment", "marriage", "union", "reconnection", "literal ring"],
    coreModes: ["commitment_bond", "agreement_contract", "cycle_repetition"],
    semanticModes: [
      mode({ id: "commitment_bond", meanings: ["commitment", "bond", "binding connection"], defaultPriority: "primary", roles: ["core_theme", "state"], planes: ["abstract"] }),
      mode({ id: "agreement_contract", meanings: ["agreement", "contract", "formal or informal deal"], defaultPriority: "primary", roles: ["information", "core_theme"], planes: ["information", "abstract"], affinities: { domains: ["career", "money"] } }),
      mode({ id: "cycle_repetition", meanings: ["cycle", "repetition", "recurring loop"], defaultPriority: "primary", roles: ["duration", "action"], planes: ["abstract"] }),
      mode({ id: "romantic_commitment", meanings: ["romantic commitment", "relationship bond"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"], affinities: { domains: ["relationship"], topics: ["commitment"] } }),
      mode({ id: "marriage_union", meanings: ["marriage", "union"], defaultPriority: "rare", roles: ["core_theme"], planes: ["abstract"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "commitment" }, { field: "objectType", equals: "marriage" }] } }),
      mode({ id: "reconnection", meanings: ["reconnection", "link restored", "returning bond"], defaultPriority: "secondary", roles: ["action"], planes: ["action"], affinities: { topics: ["reconciliation"] } }),
      mode({ id: "literal_ring", meanings: ["literal ring", "circular object"], defaultPriority: "rare", roles: ["location"], planes: ["literal"], requiresContext: true })
    ],
    roles: ["core_theme", "duration", "information"],
    orientation: "contextual",
    duration: "persistent",
    ambiguityLevel: "high",
    specialBehaviors: ["bind_adjacent_theme", "cycle_adjacent_theme", "formalize_adjacent_theme"],
    literalMeanings: ["ring", "circle"],
    contrasts: [24, 35],
    semanticAgency: "mixed"
  },
  {
    id: 26,
    name: "Book",
    primaryMeanings: ["unknown information", "hidden", "knowledge", "learning"],
    secondaryMeanings: ["secret", "research", "project", "case", "exam", "record", "educated person"],
    coreModes: ["unknown_information", "secret_hidden", "knowledge_learning"],
    semanticModes: [
      mode({ id: "unknown_information", meanings: ["unknown information", "not yet known", "unrevealed data"], defaultPriority: "primary", roles: ["information"], planes: ["information"] }),
      mode({ id: "secret_hidden", meanings: ["secret", "hidden information", "intentionally or functionally concealed matter"], defaultPriority: "primary", roles: ["information"], planes: ["information"], notes: "Separate from unknown; not all unknown is intentional secrecy." }),
      mode({ id: "knowledge_learning", meanings: ["knowledge", "learning", "study material"], defaultPriority: "primary", roles: ["information"], planes: ["information"], affinities: { domains: ["study"] } }),
      mode({ id: "research_investigation", meanings: ["research", "investigation", "looking deeper"], defaultPriority: "secondary", roles: ["information", "action"], planes: ["information", "action"] }),
      mode({ id: "project_case", meanings: ["project", "case file", "contained subject"], defaultPriority: "secondary", roles: ["core_theme", "information"], planes: ["abstract", "information"] }),
      mode({ id: "exam_assessment", meanings: ["exam", "assessment", "knowledge test"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"], affinities: { domains: ["study"], topics: ["exam"] } }),
      mode({ id: "educated_secretive_person", meanings: ["educated person", "secretive person", "specialist with knowledge"], defaultPriority: "rare", roles: ["modifier", "information"], planes: ["person"], requiresContext: true }),
      mode({ id: "physical_book_record", meanings: ["physical book", "record", "notebook"], defaultPriority: "secondary", roles: ["information"], planes: ["literal", "information"] })
    ],
    roles: ["information"],
    orientation: "neutral",
    ambiguityLevel: "high",
    specialBehaviors: ["hide_adjacent_theme", "mark_unknown", "document_adjacent_theme"],
    literalMeanings: ["book", "record"],
    personMeanings: ["educated person", "secretive person"],
    contrasts: [27],
    semanticAgency: "mixed"
  },
  {
    id: 27,
    name: "Letter",
    primaryMeanings: ["written message", "document", "paperwork"],
    secondaryMeanings: ["notification", "certificate", "credential", "contract record", "mail item", "text message"],
    coreModes: ["written_message", "document_paperwork"],
    semanticModes: [
      mode({ id: "written_message", meanings: ["written message", "text", "email or note"], defaultPriority: "primary", roles: ["information"], planes: ["information"] }),
      mode({ id: "document_paperwork", meanings: ["document", "paperwork", "written record"], defaultPriority: "primary", roles: ["information"], planes: ["information", "literal"] }),
      mode({ id: "result_notification", meanings: ["result notification", "official update", "written result"], defaultPriority: "secondary", roles: ["information", "result"], planes: ["information"], affinities: { domains: ["study", "career"] } }),
      mode({ id: "certificate_credential", meanings: ["certificate", "credential", "proof document"], defaultPriority: "secondary", roles: ["information"], planes: ["information", "literal"] }),
      mode({ id: "contract_record", meanings: ["contract record", "documented agreement"], defaultPriority: "secondary", roles: ["information"], planes: ["information"], affinities: { topics: ["contract_employment", "financial_agreement"] } }),
      mode({ id: "literal_mail_item", meanings: ["literal mail item", "paper letter", "package note"], defaultPriority: "rare", roles: ["information"], planes: ["literal"] })
    ],
    roles: ["information"],
    orientation: "neutral",
    tempo: "fast",
    ambiguityLevel: "low",
    specialBehaviors: ["document_adjacent_theme", "communicate_adjacent_theme"],
    literalMeanings: ["letter", "email", "document"],
    contrasts: [12, 26],
    semanticAgency: "mixed"
  },
  {
    id: 28,
    name: "Man",
    primaryMeanings: ["male person anchor"],
    secondaryMeanings: ["male role", "person described by neighbors"],
    coreModes: ["male_person_anchor"],
    semanticModes: [
      mode({ id: "male_person_anchor", meanings: ["male person anchor", "male-signified person in context"], defaultPriority: "primary", roles: ["person_anchor"], planes: ["person"], notes: "Receives description from neighbor evidence; does not automatically mean partner." })
    ],
    roles: ["person_anchor"],
    orientation: "neutral",
    ambiguityLevel: "high",
    specialBehaviors: ["anchor_person", "receive_neighbor_description"],
    personMeanings: ["male person", "male role"],
    semanticAgency: "passive_anchor"
  },
  {
    id: 29,
    name: "Woman",
    primaryMeanings: ["female person anchor"],
    secondaryMeanings: ["female role", "person described by neighbors"],
    coreModes: ["female_person_anchor"],
    semanticModes: [
      mode({ id: "female_person_anchor", meanings: ["female person anchor", "female-signified person in context"], defaultPriority: "primary", roles: ["person_anchor"], planes: ["person"], notes: "Receives description from neighbor evidence; does not automatically mean partner." })
    ],
    roles: ["person_anchor"],
    orientation: "neutral",
    ambiguityLevel: "high",
    specialBehaviors: ["anchor_person", "receive_neighbor_description"],
    personMeanings: ["female person", "female role"],
    semanticAgency: "passive_anchor"
  },
  {
    id: 30,
    name: "Lily",
    primaryMeanings: ["maturity", "experience", "peace", "long duration"],
    secondaryMeanings: ["elder", "seniority", "father", "family protection", "discretion", "sexuality", "retirement"],
    coreModes: ["maturity_experience", "peace_calm", "long_duration"],
    semanticModes: [
      mode({ id: "maturity_experience", meanings: ["maturity", "experience", "seasoned quality"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "peace_calm", meanings: ["peace", "calm", "quietness"], defaultPriority: "primary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "long_duration", meanings: ["long duration", "mature time scale", "long-standing matter"], defaultPriority: "primary", roles: ["duration"], planes: ["abstract"], durationOverride: "long" }),
      mode({ id: "elder_seniority", meanings: ["elder", "seniority", "older person"], defaultPriority: "secondary", roles: ["person_anchor"], planes: ["person"] }),
      mode({ id: "father_older_man", meanings: ["father", "older man"], defaultPriority: "rare", roles: ["person_anchor"], planes: ["person"], requiresContext: true, activation: { anyOf: [{ field: "personRelation", equals: "parent" }, { field: "domain", equals: "family" }] } }),
      mode({ id: "family_protection", meanings: ["family protection", "ancestral or elder support"], defaultPriority: "secondary", roles: ["resource"], planes: ["abstract"], affinities: { domains: ["family"] } }),
      mode({ id: "discretion_restraint", meanings: ["discretion", "restraint", "held-back maturity"], defaultPriority: "secondary", roles: ["state", "modifier"], planes: ["abstract"] }),
      mode({ id: "sexuality", meanings: ["sexuality", "sensual maturity", "intimate physical theme"], defaultPriority: "rare", roles: ["safety", "core_theme"], planes: ["abstract"], requiresContext: true, activation: { anyOf: [{ field: "topic", equals: "intimacy" }] }, safetyTag: "sexuality" }),
      mode({ id: "retirement_old_stage", meanings: ["retirement", "old stage", "late phase"], defaultPriority: "rare", roles: ["duration", "state"], planes: ["abstract"] })
    ],
    roles: ["state", "duration", "person_anchor"],
    orientation: "contextual",
    tempo: "very_slow",
    duration: "long",
    ambiguityLevel: "high",
    specialBehaviors: ["extend_duration", "mature_adjacent_theme", "calm_adjacent_theme"],
    personMeanings: ["elder", "older man", "father"],
    semanticAgency: "mixed"
  },
  {
    id: 31,
    name: "Sun",
    primaryMeanings: ["success", "clarity", "vitality", "visibility"],
    secondaryMeanings: ["confidence", "optimism", "exposure", "relief", "recovery", "day", "heat"],
    coreModes: ["success_achievement", "clarity_illumination", "vitality_energy"],
    semanticModes: [
      mode({ id: "success_achievement", meanings: ["success", "achievement", "realization"], defaultPriority: "primary", roles: ["result"], planes: ["abstract"], notes: "Not automatic yes without resolver." }),
      mode({ id: "clarity_illumination", meanings: ["clarity", "illumination", "making visible"], defaultPriority: "primary", roles: ["information"], planes: ["information", "abstract"] }),
      mode({ id: "vitality_energy", meanings: ["vitality", "energy", "strengthened life force"], defaultPriority: "primary", roles: ["resource", "state"], planes: ["abstract"] }),
      mode({ id: "confidence_optimism", meanings: ["confidence", "optimism", "positive assurance"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "visibility_exposure", meanings: ["visibility", "exposure", "publicly seen"], defaultPriority: "secondary", roles: ["information"], planes: ["information", "abstract"] }),
      mode({ id: "relief_recovery", meanings: ["relief", "recovery", "difficulty easing"], defaultPriority: "secondary", roles: ["result"], planes: ["abstract"] }),
      mode({ id: "literal_sun_heat_day", meanings: ["sun", "heat", "daytime"], defaultPriority: "rare", roles: ["location"], planes: ["literal"] })
    ],
    roles: ["result", "information", "resource"],
    orientation: "favorable",
    tempo: "fast",
    ambiguityLevel: "low",
    specialBehaviors: ["illuminate_adjacent_theme", "energize_adjacent_theme", "relieve_difficulty", "increase_visibility"],
    literalMeanings: ["sun", "heat", "day"],
    semanticAgency: "mixed"
  },
  {
    id: 32,
    name: "Moon",
    primaryMeanings: ["career vocation", "recognition", "reputation"],
    secondaryMeanings: ["creativity", "emotion", "attraction", "self-image", "intuition", "cycle", "night", "month"],
    coreModes: ["career_vocation", "recognition_reputation"],
    semanticModes: [
      mode({ id: "career_vocation", meanings: ["career", "vocation", "calling"], defaultPriority: "primary", roles: ["core_theme"], planes: ["abstract"], affinities: { domains: ["career"] } }),
      mode({ id: "recognition_reputation", meanings: ["recognition", "reputation", "being known for something"], defaultPriority: "primary", roles: ["result", "information"], planes: ["abstract", "information"], affinities: { domains: ["career"], topics: ["promotion_recognition", "professional_reputation"] } }),
      mode({ id: "creativity_inspiration", meanings: ["creativity", "inspiration", "imaginative work"], defaultPriority: "secondary", roles: ["resource"], planes: ["abstract"] }),
      mode({ id: "emotion_attraction", meanings: ["emotion", "attraction", "felt pull"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"], affinities: { domains: ["relationship"], topics: ["feelings_attraction"] } }),
      mode({ id: "self_image_awareness", meanings: ["self-image", "awareness of how one is perceived"], defaultPriority: "secondary", roles: ["information", "state"], planes: ["abstract", "information"] }),
      mode({ id: "intuition_dreams", meanings: ["intuition", "dreams", "inner imagery"], defaultPriority: "secondary", roles: ["information"], planes: ["abstract"] }),
      mode({ id: "cycle_phase", meanings: ["cycle", "phase", "monthly rhythm"], defaultPriority: "secondary", roles: ["duration"], planes: ["abstract"], affinities: { intents: ["timing"] } }),
      mode({ id: "night_month", meanings: ["night", "month", "calendar rhythm"], defaultPriority: "secondary", roles: ["duration"], planes: ["literal", "abstract"], affinities: { intents: ["timing"] } })
    ],
    roles: ["core_theme", "result", "state"],
    orientation: "contextual",
    ambiguityLevel: "high",
    contextOverrides: [
      { modeId: "career_vocation", adjustment: "strong_boost", when: [{ field: "domain", equals: "career" }] },
      { modeId: "recognition_reputation", adjustment: "strong_boost", when: [{ field: "domain", equals: "career" }] },
      { modeId: "emotion_attraction", adjustment: "strong_boost", when: [{ field: "domain", equals: "relationship" }, { field: "topic", equals: "feelings_attraction" }] },
      { modeId: "cycle_phase", adjustment: "boost", when: [{ field: "intent", equals: "timing" }] },
      { modeId: "night_month", adjustment: "boost", when: [{ field: "intent", equals: "timing" }] }
    ],
    specialBehaviors: ["cycle_adjacent_theme", "increase_visibility"],
    literalMeanings: ["moon", "night", "month"],
    contrasts: [14],
    semanticAgency: "mixed"
  },
  {
    id: 33,
    name: "Key",
    primaryMeanings: ["solution", "confirmation", "importance", "unlocking"],
    secondaryMeanings: ["breakthrough", "cause", "reason", "discovery", "revelation", "literal key"],
    coreModes: ["solution_unlock", "confirmation_certainty", "importance_significance"],
    semanticModes: [
      mode({ id: "solution_unlock", meanings: ["solution", "unlocking", "way through"], defaultPriority: "primary", roles: ["result", "action"], planes: ["abstract", "action"] }),
      mode({ id: "confirmation_certainty", meanings: ["confirmation", "certainty", "clear yes from evidence"], defaultPriority: "primary", roles: ["information", "result"], planes: ["information", "abstract"], notes: "Confirm does not mean improve." }),
      mode({ id: "importance_significance", meanings: ["importance", "key significance", "central point"], defaultPriority: "primary", roles: ["core_theme", "modifier"], planes: ["abstract"] }),
      mode({ id: "breakthrough", meanings: ["breakthrough", "opening", "access gained"], defaultPriority: "secondary", roles: ["result", "action"], planes: ["abstract", "action"] }),
      mode({ id: "cause_reason", meanings: ["cause", "reason", "key factor"], defaultPriority: "secondary", roles: ["information"], planes: ["information"], affinities: { intents: ["reason"] } }),
      mode({ id: "discovery_revelation", meanings: ["discovery", "revelation", "finding the answer"], defaultPriority: "secondary", roles: ["information"], planes: ["information"] }),
      mode({ id: "literal_key", meanings: ["literal key", "access object"], defaultPriority: "rare", roles: ["location"], planes: ["literal"] })
    ],
    roles: ["result", "information", "core_theme"],
    orientation: "favorable",
    ambiguityLevel: "low",
    specialBehaviors: ["confirm_adjacent_theme", "mark_importance", "unlock_adjacent_theme"],
    literalMeanings: ["key"],
    semanticAgency: "mixed"
  },
  {
    id: 34,
    name: "Fish",
    primaryMeanings: ["money", "cashflow", "business transaction", "resource flow"],
    secondaryMeanings: ["abundance", "quantity", "freedom", "independence", "depth", "water", "liquid"],
    coreModes: ["money_finance", "cashflow_circulation", "business_transaction"],
    semanticModes: [
      mode({ id: "money_finance", meanings: ["money", "finance", "financial matter"], defaultPriority: "primary", roles: ["resource"], planes: ["abstract"], affinities: { domains: ["money"] } }),
      mode({ id: "cashflow_circulation", meanings: ["cashflow", "circulation", "money moving"], defaultPriority: "primary", roles: ["resource", "action"], planes: ["abstract", "action"] }),
      mode({ id: "business_transaction", meanings: ["business", "transaction", "commercial exchange"], defaultPriority: "primary", roles: ["resource", "action"], planes: ["abstract"], affinities: { domains: ["money", "career"] } }),
      mode({ id: "abundance_quantity", meanings: ["abundance", "quantity", "many resources"], defaultPriority: "secondary", roles: ["quantity", "resource"], planes: ["abstract"] }),
      mode({ id: "freedom_independence", meanings: ["freedom", "independence", "fluid autonomy"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "depth", meanings: ["depth", "deep field", "submerged layer"], defaultPriority: "secondary", roles: ["location", "state"], planes: ["abstract", "location"] }),
      mode({ id: "water_liquid", meanings: ["water", "liquid", "fluid place or substance"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["resource", "action", "quantity"],
    orientation: "contextual",
    ambiguityLevel: "high",
    specialBehaviors: ["make_theme_flow", "increase_quantity"],
    literalMeanings: ["fish", "water", "liquid"],
    contrasts: [15, 35],
    semanticAgency: "mixed"
  },
  {
    id: 35,
    name: "Anchor",
    primaryMeanings: ["stability", "security", "persistence", "duration"],
    secondaryMeanings: ["stagnation", "livelihood", "job security", "long-term foundation", "attachment", "port"],
    coreModes: ["stability_security", "persistence_duration"],
    semanticModes: [
      mode({ id: "stability_security", meanings: ["stability", "security", "fixed support"], defaultPriority: "primary", roles: ["state", "duration"], planes: ["abstract"] }),
      mode({ id: "persistence_duration", meanings: ["persistence", "duration", "lasting condition"], defaultPriority: "primary", roles: ["duration"], planes: ["abstract"], durationOverride: "persistent" }),
      mode({ id: "fixed_stagnation", meanings: ["fixed stagnation", "stuck persistence", "hard to move"], defaultPriority: "secondary", roles: ["obstacle", "duration"], planes: ["abstract"] }),
      mode({ id: "livelihood_job_security", meanings: ["livelihood", "job security", "stable work base"], defaultPriority: "secondary", roles: ["resource", "state"], planes: ["abstract"], affinities: { domains: ["career"] } }),
      mode({ id: "long_term_foundation", meanings: ["long-term foundation", "deeply fixed base"], defaultPriority: "secondary", roles: ["state", "duration"], planes: ["abstract"] }),
      mode({ id: "attachment", meanings: ["attachment", "being tied to something", "held in place"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "literal_anchor_port", meanings: ["anchor", "port", "mooring place"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["state", "duration", "resource"],
    orientation: "contextual",
    tempo: "very_slow",
    duration: "persistent",
    ambiguityLevel: "high",
    specialBehaviors: ["stabilize_adjacent_theme", "extend_duration", "fix_adjacent_theme"],
    literalMeanings: ["anchor", "port"],
    contrasts: [25, 34, 15],
    semanticAgency: "mixed"
  },
  {
    id: 36,
    name: "Cross",
    primaryMeanings: ["burden", "hardship", "trial", "necessity"],
    secondaryMeanings: ["obligation", "sacrifice", "cost", "pain", "sorrow", "faith", "religion", "finalization"],
    coreModes: ["burden_hardship", "trial_test", "necessity_obligation"],
    semanticModes: [
      mode({ id: "burden_hardship", meanings: ["burden", "hardship", "heavy responsibility"], defaultPriority: "primary", roles: ["obstacle"], planes: ["abstract"], safetyTag: "fate_absolute", notes: "Output layer must avoid absolute fate language." }),
      mode({ id: "trial_test", meanings: ["trial", "test", "difficult passage"], defaultPriority: "primary", roles: ["obstacle", "core_theme"], planes: ["abstract"] }),
      mode({ id: "necessity_obligation", meanings: ["necessity", "obligation", "must-face issue"], defaultPriority: "primary", roles: ["core_theme", "action"], planes: ["abstract"] }),
      mode({ id: "sacrifice_cost", meanings: ["sacrifice", "cost", "price paid"], defaultPriority: "secondary", roles: ["resource", "obstacle"], planes: ["abstract"] }),
      mode({ id: "pain_sorrow", meanings: ["pain", "sorrow", "emotional weight"], defaultPriority: "secondary", roles: ["state"], planes: ["abstract"] }),
      mode({ id: "faith_religion", meanings: ["faith", "religion", "belief system"], defaultPriority: "secondary", roles: ["core_theme"], planes: ["abstract"] }),
      mode({ id: "necessity_fate", meanings: ["necessity", "fateful-feeling pressure", "unavoidable theme"], defaultPriority: "rare", roles: ["core_theme"], planes: ["abstract"], safetyTag: "fate_absolute" }),
      mode({ id: "finalization", meanings: ["finalization", "closing emphasis", "end point"], defaultPriority: "secondary", roles: ["result"], planes: ["abstract"] }),
      mode({ id: "religious_place_object", meanings: ["religious place", "cross object", "sacred item"], defaultPriority: "rare", roles: ["location"], planes: ["literal", "location"] })
    ],
    roles: ["obstacle", "core_theme", "result"],
    orientation: "challenging",
    duration: "persistent",
    ambiguityLevel: "medium",
    specialBehaviors: ["burden_adjacent_theme", "emphasize_following_theme", "finalize_previous_theme", "increase_cost"],
    literalMeanings: ["cross", "religious object"],
    contrasts: [21, 8],
    semanticAgency: "mixed"
  }
];
