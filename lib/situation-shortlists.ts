export type SituationShortlist = {
  grammar_anchor: string;
  cefr_level: "A1" | "A2" | "B1" | "B2" | "C1";
  language_specific?: string;
  situations: string[];
  goal_affinity: string[];
  interest_affinity: string[];
};

/** Maps curriculum_topics.topic_key values to SITUATION_SHORTLISTS grammar_anchor keys. */
export const TOPIC_KEY_TO_ANCHOR: Record<string, string> = {
  greetings: "present_tense",
  numbers_time: "numbers_time_dates",
  grammar_present: "present_tense",
  family_daily: "articles_pronouns",
  food_drink: "articles_pronouns",
  travel_directions: "simple_questions"
};

export function grammarAnchorForTopic(topic_key: string): string {
  return TOPIC_KEY_TO_ANCHOR[topic_key] ?? topic_key;
}

export const SITUATION_SHORTLISTS: SituationShortlist[] = [
  // ── A1 ──
  {
    grammar_anchor: "present_tense",
    cefr_level: "A1",
    situations: [
      "Ordering a coffee or snack at a café",
      "Introducing yourself at a language class or social event",
      "Describing your daily routine to a new acquaintance",
      "Chatting briefly with a neighbour"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: ["food_cooking", "travel", "family_relationships"]
  },
  {
    grammar_anchor: "basic_negation",
    cefr_level: "A1",
    situations: [
      "Saying you don't want something in a shop or café",
      "Politely declining an invitation",
      "Telling someone you don't understand or don't know"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: []
  },
  {
    grammar_anchor: "simple_questions",
    cefr_level: "A1",
    situations: [
      "Asking for directions in the street",
      "Checking in at a hotel or guesthouse",
      "Asking about opening hours or prices",
      "Meeting someone new at a gathering"
    ],
    goal_affinity: ["travel", "partner_family", "curious"],
    interest_affinity: ["travel", "food_cooking"]
  },
  {
    grammar_anchor: "articles_pronouns",
    cefr_level: "A1",
    situations: [
      "Describing your apartment or home to someone",
      "Talking about members of your family",
      "Pointing things out in a market or shop",
      "Describing objects on your desk or in your bag"
    ],
    goal_affinity: ["partner_family", "travel"],
    interest_affinity: ["family_relationships"]
  },
  {
    grammar_anchor: "numbers_time_dates",
    cefr_level: "A1",
    situations: [
      "Catching a train or bus — reading a timetable",
      "Making a restaurant or appointment reservation",
      "Arranging where and when to meet a friend"
    ],
    goal_affinity: ["travel", "work_professional", "partner_family"],
    interest_affinity: ["food_cooking", "travel"]
  },
  {
    grammar_anchor: "russian_nominative",
    cefr_level: "A1",
    language_specific: "ru",
    situations: [
      "Identifying people and objects by name",
      "Simple self-introduction: name, country, profession",
      "Describing what is in a room"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: []
  },

  // ── A2 ──
  {
    grammar_anchor: "simple_past",
    cefr_level: "A2",
    situations: [
      "Telling someone about your weekend",
      "Recounting a journey or trip",
      "Describing a meal or restaurant you visited",
      "Telling a colleague what you did yesterday"
    ],
    goal_affinity: ["travel", "partner_family", "work_professional"],
    interest_affinity: ["food_cooking", "travel"]
  },
  {
    grammar_anchor: "near_future",
    cefr_level: "A2",
    situations: [
      "Making plans with a friend for the weekend",
      "Talking about an upcoming trip",
      "Discussing what you're going to have for dinner",
      "Announcing a meeting or appointment"
    ],
    goal_affinity: ["travel", "work_professional", "partner_family"],
    interest_affinity: ["travel", "food_cooking"]
  },
  {
    grammar_anchor: "imperatives",
    cefr_level: "A2",
    situations: [
      "Giving a friend directions to your home",
      "Following or giving a simple recipe together",
      "A trainer or coach explaining an exercise",
      "Instructions from a colleague on a task"
    ],
    goal_affinity: ["work_professional"],
    interest_affinity: ["food_cooking", "sport"]
  },
  {
    grammar_anchor: "adjective_agreement",
    cefr_level: "A2",
    situations: [
      "Describing a person you met",
      "Choosing between two items while shopping",
      "Comparing two apartments or hotels you've visited"
    ],
    goal_affinity: ["travel", "partner_family"],
    interest_affinity: []
  },
  {
    grammar_anchor: "possession_genitive",
    cefr_level: "A2",
    situations: [
      "Talking about your family home and belongings",
      "Introducing your partner or a family member",
      "Describing a colleague's role at work"
    ],
    goal_affinity: ["partner_family", "work_professional"],
    interest_affinity: ["family_relationships"]
  },
  {
    grammar_anchor: "russian_accusative_prepositional",
    cefr_level: "A2",
    language_specific: "ru",
    situations: [
      "Saying where something is located (Prepositional)",
      "Saying what you are doing or seeing (Accusative)",
      "Talking about a place you're at or going to"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: []
  },
  {
    grammar_anchor: "russian_dative",
    cefr_level: "A2",
    language_specific: "ru",
    situations: [
      "Giving something to someone; expressing need",
      'Talking about age ("I am 30 years old")',
      "Expressing likes and dislikes"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: ["family_relationships"]
  },

  // ── B1 ──
  {
    grammar_anchor: "imperfect_vs_past",
    cefr_level: "B1",
    situations: [
      "Telling a story about something that happened to you",
      "Describing how you met your partner",
      "Recounting an unexpected incident at work",
      "Sharing a childhood memory"
    ],
    goal_affinity: ["partner_family", "curious", "work_professional"],
    interest_affinity: ["family_relationships", "books_culture"]
  },
  {
    grammar_anchor: "simple_conditional",
    cefr_level: "B1",
    situations: [
      "Politely asking for something in a formal context",
      "Discussing what you would do on holiday",
      "Negotiating a plan or arrangement with someone",
      "Expressing a preference in a professional setting"
    ],
    goal_affinity: ["travel", "work_professional", "partner_family"],
    interest_affinity: ["travel"]
  },
  {
    grammar_anchor: "relative_clauses",
    cefr_level: "B1",
    situations: [
      "Describing a person you admire or know well",
      "Talking about a book or film you've seen recently",
      "Describing a place you'd like to visit or live"
    ],
    goal_affinity: ["culture"],
    interest_affinity: ["books_culture", "film_tv", "travel"]
  },
  {
    grammar_anchor: "basic_passive",
    cefr_level: "B1",
    situations: [
      "Talking about how traditional food is made",
      "Discussing how something is done at work",
      "Describing a historical event or cultural tradition"
    ],
    goal_affinity: ["culture", "work_professional"],
    interest_affinity: ["food_cooking", "books_culture"]
  },
  {
    grammar_anchor: "modal_verbs",
    cefr_level: "B1",
    situations: [
      "Discussing workplace rules or expectations",
      "Asking for or granting permission in a formal context",
      "Expressing what you must or should do about a health issue"
    ],
    goal_affinity: ["work_professional", "study"],
    interest_affinity: []
  },
  {
    grammar_anchor: "russian_instrumental_genitive",
    cefr_level: "B1",
    language_specific: "ru",
    situations: [
      'Describing your profession: "I am a teacher" (Instrumental)',
      "Expressing absence or quantity (Genitive)",
      "Talking about means of transport or tools used"
    ],
    goal_affinity: ["travel", "partner_family", "curious", "culture", "work_professional", "study"],
    interest_affinity: []
  },

  // ── B2 ──
  {
    grammar_anchor: "subjunctive",
    cefr_level: "B2",
    situations: [
      "Expressing doubt, hope, or uncertainty about something",
      "Giving or receiving advice about an important decision",
      "Discussing emotions in a personal relationship",
      "Writing a formal request or recommendation"
    ],
    goal_affinity: ["partner_family", "work_professional"],
    interest_affinity: ["family_relationships"]
  },
  {
    grammar_anchor: "complex_conditionals",
    cefr_level: "B2",
    situations: [
      "Discussing a hypothetical career or life decision",
      "Reflecting on a past event that didn't go as planned",
      "Negotiating a complex professional arrangement"
    ],
    goal_affinity: ["work_professional", "study", "partner_family"],
    interest_affinity: []
  },
  {
    grammar_anchor: "reported_speech",
    cefr_level: "B2",
    situations: [
      "Relaying what a colleague or manager said at a meeting",
      "Retelling what happened in a conversation with a friend",
      "Summarising what you read or heard in the news"
    ],
    goal_affinity: ["work_professional"],
    interest_affinity: ["books_culture", "film_tv"]
  },
  {
    grammar_anchor: "nuanced_tenses",
    cefr_level: "B2",
    situations: [
      "Explaining the timeline of a complex past event",
      "Writing a professional update or report email",
      "Distinguishing completed vs ongoing actions in a project context"
    ],
    goal_affinity: ["work_professional", "study"],
    interest_affinity: []
  },

  // ── C1 ──
  {
    grammar_anchor: "idiomatic_register",
    cefr_level: "C1",
    situations: [
      "Informal conversation with native friends — colloquial register",
      "Presenting at a professional meeting — formal register",
      "Writing an opinion piece or blog post on a cultural topic"
    ],
    goal_affinity: ["work_professional", "culture"],
    interest_affinity: ["books_culture", "film_tv", "music"]
  },
  {
    grammar_anchor: "complex_subordinate_clauses",
    cefr_level: "C1",
    situations: [
      "Making a nuanced argument in a discussion or debate",
      "Writing a structured academic or professional text",
      "Explaining a complex process to a non-expert"
    ],
    goal_affinity: ["study", "work_professional"],
    interest_affinity: []
  },
  {
    grammar_anchor: "rhetorical_structures",
    cefr_level: "C1",
    situations: [
      "Chairing or contributing to a professional meeting",
      "Giving a structured talk or academic presentation",
      "Writing an editorial or analytical piece"
    ],
    goal_affinity: ["work_professional", "study"],
    interest_affinity: []
  }
];

export function getSituationsForAnchor(
  grammar_anchor: string,
  cefr_level: string,
  language_code?: string
): string[] {
  const specific = SITUATION_SHORTLISTS.find(
    (s) =>
      s.grammar_anchor === grammar_anchor &&
      s.cefr_level === cefr_level &&
      s.language_specific === language_code
  );
  if (specific) return specific.situations;

  const general = SITUATION_SHORTLISTS.find(
    (s) =>
      s.grammar_anchor === grammar_anchor &&
      s.cefr_level === cefr_level &&
      !s.language_specific
  );
  if (general) return general.situations;

  // The curriculum reuses the same topic keys (and therefore anchors) at every
  // CEFR level, but each shortlist is defined at a single level. Fall back to
  // the same anchor at any level so higher-level courses still get a situation.
  const anyLevelSpecific = SITUATION_SHORTLISTS.find(
    (s) => s.grammar_anchor === grammar_anchor && s.language_specific === language_code
  );
  if (anyLevelSpecific) return anyLevelSpecific.situations;

  const anyLevelGeneral = SITUATION_SHORTLISTS.find(
    (s) => s.grammar_anchor === grammar_anchor && !s.language_specific
  );
  return anyLevelGeneral?.situations ?? [];
}
