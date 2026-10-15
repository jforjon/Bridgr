import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CEFR_LEVELS, SUPPORTED_LANGUAGES, type CEFRLevel } from "@/types";

const GENERATE_MAX_TOKENS = 4000;

const SYSTEM_PROMPT =
  "You are an expert language curriculum designer specialising in CEFR-aligned communicative language teaching. Every sentence you create must be something a person could realistically say or hear in the specified real-life situation. No artificial, abstract, or absurd sentences. Grammar in all surrounding words must stay at or below the learner's CEFR level. Each correct_answer must have only one unambiguous answer.";

function personalSystemPrompt(cefr_level: string): string {
  return `${SYSTEM_PROMPT} Generate a natural, realistic sentence at CEFR ${cefr_level} for this word. The sentence should feel like something a real person would say in everyday life.`;
}

type VocabRow = {
  word: string;
  translation_en: string;
  part_of_speech: string | null;
};

type KnownLanguageRow = {
  language_name: string;
  language_code: string;
  proficiency: string;
};

type GeneratedCard = {
  target_item: string;
  target_item_en: string;
  english_sentence: string;
  english_sentence_with_marker: string;
  target_sentence: string;
  correct_answer: string;
  distractors: string[];
  cross_linguistic: {
    cognates: { language_code: string; word: string; note: string }[];
    false_friends: { language_code: string; word: string; confusion_note: string }[];
    partial: { language_code: string; word: string; note: string }[];
  };
};

export type VocabularyItemOverride = {
  word: string;
  translation_en?: string | null;
  part_of_speech?: string | null;
};

export type GenerateCardsInput = {
  userId: string;
  unit_id: string | null;
  lesson_id: string | null;
  topic_key: string;
  grammar_anchor: string | null;
  situation_context: string | null;
  language_code: string;
  cefr_level: string;
  vocabulary_items?: VocabularyItemOverride[];
};

export type GenerateCardsSuccess = {
  ok: true;
  cards_generated: number;
  false_friends_found: number;
};

export type GenerateCardsFailure = {
  ok: false;
  error: string;
  status: number;
};

export type GenerateCardsResult = GenerateCardsSuccess | GenerateCardsFailure;

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text
    .slice(first, last + 1)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase());
  if (found) return found.name;
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

function normalizeCefrLevel(value: string): CEFRLevel | null {
  const normalized = value.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(normalized) ? (normalized as CEFRLevel) : null;
}

function buildUserPrompt(params: {
  language_name: string;
  cefr_level: string;
  grammar_anchor: string;
  situation_context: string;
  goal: string | null;
  interests: string[];
  knownLanguagesSummary: string;
  vocabularyLines: string;
}): string {
  return `Generate sentence cards for the following vocabulary items.

Target language: ${params.language_name} at CEFR ${params.cefr_level}
Grammar anchor: ${params.grammar_anchor}
Situation: ${params.situation_context}
All sentences must fit naturally inside this situation.

Learner goal: ${params.goal ?? "(not set)"}
Learner interests: ${params.interests.length ? params.interests.join(", ") : "(none)"}
Known languages: ${params.knownLanguagesSummary}

Vocabulary items to generate cards for:
${params.vocabularyLines}

Return ONLY valid JSON:
{
  "cards": [
    {
      "target_item": string,
      "target_item_en": string,
      "english_sentence": string,
      "english_sentence_with_marker": string,
      "target_sentence": string,
      "correct_answer": string,
      "distractors": string[],
      "cross_linguistic": {
        "cognates": [{ "language_code": string, "word": string, "note": string }],
        "false_friends": [{ "language_code": string, "word": string, "confusion_note": string }],
        "partial": [{ "language_code": string, "word": string, "note": string }]
      }
    }
  ]
}

Rules:
- All sentences must fit naturally inside: ${params.situation_context}
- Surrounding vocabulary must be at or below CEFR ${params.cefr_level}
- Flag any word that could be confused with a known-language word as a false friend
- Cognate notes should read as 'aha' moments, not textbook facts
- Generate one card per vocabulary item`;
}

function buildPersonalUserPrompt(params: {
  language_name: string;
  cefr_level: string;
  goal: string | null;
  interests: string[];
  knownLanguagesSummary: string;
  vocabularyLines: string;
}): string {
  return `Generate a sentence card for the following word the learner wants to learn.

Target language: ${params.language_name} at CEFR ${params.cefr_level}
Generate a natural, realistic sentence at CEFR ${params.cefr_level} for this word. The sentence should feel like something a real person would say in everyday life.

Learner goal: ${params.goal ?? "(not set)"}
Learner interests: ${params.interests.length ? params.interests.join(", ") : "(none)"}
Known languages: ${params.knownLanguagesSummary}

Word to generate a card for:
${params.vocabularyLines}

Return ONLY valid JSON:
{
  "cards": [
    {
      "target_item": string,
      "target_item_en": string,
      "english_sentence": string,
      "english_sentence_with_marker": string,
      "target_sentence": string,
      "correct_answer": string,
      "distractors": string[],
      "cross_linguistic": {
        "cognates": [{ "language_code": string, "word": string, "note": string }],
        "false_friends": [{ "language_code": string, "word": string, "confusion_note": string }],
        "partial": [{ "language_code": string, "word": string, "note": string }]
      }
    }
  ]
}

Rules:
- Surrounding vocabulary must be at or below CEFR ${params.cefr_level}
- Flag any word that could be confused with a known-language word as a false friend
- Cognate notes should read as 'aha' moments, not textbook facts
- Generate exactly one card for this word`;
}

function isGeneratedCard(value: unknown): value is GeneratedCard {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.target_item === "string" &&
    typeof c.target_item_en === "string" &&
    typeof c.english_sentence === "string" &&
    typeof c.english_sentence_with_marker === "string" &&
    typeof c.target_sentence === "string" &&
    typeof c.correct_answer === "string" &&
    Array.isArray(c.distractors) &&
    c.cross_linguistic != null &&
    typeof c.cross_linguistic === "object"
  );
}

async function callAnthropicMessages(
  userPrompt: string,
  systemPrompt: string = SYSTEM_PROMPT
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: GENERATE_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const block = data.content[0];
  const text = block?.type === "text" ? block.text : "";
  if (!text.trim()) {
    throw new Error("Empty model response.");
  }
  return text;
}

function normalizeCrossLinguistic(raw: GeneratedCard["cross_linguistic"]) {
  const empty = {
    cognates: [] as GeneratedCard["cross_linguistic"]["cognates"],
    false_friends: [] as GeneratedCard["cross_linguistic"]["false_friends"],
    partial: [] as GeneratedCard["cross_linguistic"]["partial"]
  };

  if (!raw || typeof raw !== "object") return empty;

  const cl = raw as Record<string, unknown>;
  return {
    cognates: Array.isArray(cl.cognates) ? cl.cognates : [],
    false_friends: Array.isArray(cl.false_friends) ? cl.false_friends : [],
    partial: Array.isArray(cl.partial) ? cl.partial : []
  };
}

function isPersonalGeneration(input: GenerateCardsInput): boolean {
  return (
    input.topic_key.trim() === "personal" ||
    input.situation_context == null ||
    (input.vocabulary_items?.length ?? 0) > 0
  );
}

export async function generateCards(input: GenerateCardsInput): Promise<GenerateCardsResult> {
  const unit_id = input.unit_id?.trim() || null;
  const lesson_id = input.lesson_id?.trim() || null;
  const topic_key = input.topic_key.trim();
  const grammar_anchor = input.grammar_anchor?.trim() || null;
  const situation_context = input.situation_context?.trim() || null;
  const language_code = input.language_code.toLowerCase().trim();
  const cefr_level = normalizeCefrLevel(input.cefr_level);
  const personal = isPersonalGeneration(input);

  if (!language_code || !topic_key) {
    return { ok: false, error: "Invalid body: missing required fields.", status: 400 };
  }
  if (!cefr_level) {
    return { ok: false, error: "Invalid body: cefr_level.", status: 400 };
  }
  if (!personal && (!unit_id || !lesson_id || !grammar_anchor || !situation_context)) {
    return { ok: false, error: "Invalid body: missing required fields.", status: 400 };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured.", status: 500 };
  }

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/generate] service role client:", e);
    return { ok: false, error: message, status: 500 };
  }

  if (unit_id) {
    const { data: unitRows, error: unitErr } = await adminClient
      .from("units")
      .select("id, course_id")
      .eq("id", unit_id)
      .limit(1);

    if (unitErr) {
      console.error("[cards/generate] unit:", unitErr);
      return { ok: false, error: unitErr.message, status: 500 };
    }

    const unitRow = unitRows?.[0] ?? null;
    if (!unitRow) {
      return { ok: false, error: "Unit not found.", status: 404 };
    }

    const { data: courseRow, error: courseErr } = await adminClient
      .from("courses")
      .select("user_id")
      .eq("id", unitRow.course_id as string)
      .maybeSingle();

    if (courseErr) {
      console.error("[cards/generate] course:", courseErr);
      return { ok: false, error: courseErr.message, status: 500 };
    }
    if (!courseRow || courseRow.user_id !== input.userId) {
      return { ok: false, error: "Forbidden.", status: 403 };
    }
  } else {
    const { data: learningAccess, error: accessErr } = await adminClient
      .from("learning_languages")
      .select("user_id")
      .eq("user_id", input.userId)
      .eq("language_code", language_code)
      .maybeSingle();

    if (accessErr) {
      console.error("[cards/generate] learning_languages access:", accessErr);
      return { ok: false, error: accessErr.message, status: 500 };
    }
    if (!learningAccess) {
      return { ok: false, error: "Forbidden.", status: 403 };
    }
  }

  const profilePromise = adminClient
    .from("profiles")
    .select("interests")
    .eq("id", input.userId)
    .maybeSingle();
  const knownPromise = adminClient
    .from("known_languages")
    .select("language_name, language_code, proficiency")
    .eq("user_id", input.userId);
  const learningPromise = adminClient
    .from("learning_languages")
    .select("goal")
    .eq("user_id", input.userId)
    .eq("language_code", language_code)
    .maybeSingle();

  const vocabPromise = personal
    ? Promise.resolve({ data: null, error: null })
    : adminClient
        .from("curriculum_vocabulary")
        .select("word, translation_en, part_of_speech")
        .eq("language_code", language_code)
        .eq("cefr_level", cefr_level)
        .eq("topic_key", topic_key);

  const [
    { data: profileRow, error: profileErr },
    { data: knownRows, error: knownErr },
    { data: learningRow, error: learningErr },
    { data: vocabRows, error: vocabErr }
  ] = await Promise.all([profilePromise, knownPromise, learningPromise, vocabPromise]);

  if (profileErr) {
    console.error("[cards/generate] profiles:", profileErr);
    return { ok: false, error: profileErr.message, status: 500 };
  }
  if (knownErr) {
    console.error("[cards/generate] known_languages:", knownErr);
    return { ok: false, error: knownErr.message, status: 500 };
  }
  if (learningErr) {
    console.error("[cards/generate] learning_languages:", learningErr);
    return { ok: false, error: learningErr.message, status: 500 };
  }
  if (vocabErr) {
    console.error("[cards/generate] curriculum_vocabulary:", vocabErr);
    return { ok: false, error: vocabErr.message, status: 500 };
  }

  let vocabulary: VocabRow[];
  if (personal) {
    const overrides = (input.vocabulary_items ?? []).filter((item) => item.word.trim());
    if (overrides.length === 0) {
      return { ok: false, error: "vocabulary_items required for personal cards.", status: 400 };
    }
    vocabulary = overrides.map((item) => ({
      word: item.word.trim(),
      translation_en: item.translation_en?.trim() ?? "",
      part_of_speech: item.part_of_speech?.trim() ?? null
    }));
  } else {
    vocabulary = (vocabRows ?? []) as VocabRow[];
    if (vocabulary.length === 0) {
      return { ok: false, error: "no_vocabulary_for_topic", status: 400 };
    }
  }

  const interests = Array.isArray(profileRow?.interests)
    ? (profileRow.interests as string[]).filter((i) => typeof i === "string")
    : [];
  const goal = typeof learningRow?.goal === "string" ? learningRow.goal : null;

  const knownLanguages = (knownRows ?? []) as KnownLanguageRow[];
  const knownLanguagesSummary =
    knownLanguages.length === 0
      ? "(none)"
      : knownLanguages
          .map((l) => `${l.language_name} (${l.proficiency})`)
          .join(", ");

  const vocabularyLines = vocabulary
    .map((v) => {
      if (v.translation_en.trim()) {
        return `${v.word} = ${v.translation_en} (${v.part_of_speech ?? ""})`;
      }
      return v.word;
    })
    .join("\n");

  const language_name = resolveLanguageName(language_code);
  const userPrompt = personal
    ? buildPersonalUserPrompt({
        language_name,
        cefr_level,
        goal,
        interests,
        knownLanguagesSummary,
        vocabularyLines
      })
    : buildUserPrompt({
        language_name,
        cefr_level,
        grammar_anchor: grammar_anchor!,
        situation_context: situation_context!,
        goal,
        interests,
        knownLanguagesSummary,
        vocabularyLines
      });

  let text: string;
  try {
    text = await callAnthropicMessages(
      userPrompt,
      personal ? personalSystemPrompt(cefr_level) : SYSTEM_PROMPT
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/generate] Anthropic:", e);
    return { ok: false, error: message, status: 502 };
  }

  let parsed: { cards?: unknown };
  try {
    parsed = JSON.parse(sliceJsonObject(text)) as { cards?: unknown };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/generate] JSON parse:", message, text.slice(0, 400));
    return { ok: false, error: `Failed to parse cards JSON: ${message}`, status: 502 };
  }

  if (!Array.isArray(parsed.cards)) {
    return { ok: false, error: "Invalid cards JSON: missing cards array.", status: 502 };
  }

  const cards = parsed.cards.filter(isGeneratedCard);
  if (cards.length === 0) {
    return { ok: false, error: "Model returned no valid cards.", status: 502 };
  }

  const posByWord = new Map(
    vocabulary.map((v) => [v.word.toLowerCase(), v.part_of_speech ?? null])
  );

  const sentenceCardRows = cards.map((card) => ({
    lesson_id,
    language_code,
    cefr_level,
    target_item: card.target_item.trim(),
    target_item_en: card.target_item_en.trim(),
    english_sentence: card.english_sentence.trim(),
    english_sentence_with_marker: card.english_sentence_with_marker.trim(),
    target_sentence: card.target_sentence.trim(),
    correct_answer: card.correct_answer.trim(),
    distractors: card.distractors.map((d) => String(d).trim()).filter(Boolean),
    part_of_speech: posByWord.get(card.target_item.trim().toLowerCase()) ?? null,
    topic_key,
    situation_context,
    grammar_anchor,
    cross_linguistic: normalizeCrossLinguistic(card.cross_linguistic)
  }));

  const { error: insertCardsErr } = await adminClient.from("sentence_cards").insert(sentenceCardRows);

  if (insertCardsErr) {
    console.error("[cards/generate] sentence_cards insert:", insertCardsErr);
    return { ok: false, error: insertCardsErr.message, status: 500 };
  }

  const falseFriendRows: {
    language_code: string;
    word: string;
    known_language_code: string;
    known_language_word: string;
    known_language_meaning: string;
    target_meaning: string;
    alert_shown_to: string[];
  }[] = [];

  for (const card of cards) {
    const cross = normalizeCrossLinguistic(card.cross_linguistic);
    for (const ff of cross.false_friends) {
      if (
        typeof ff.language_code !== "string" ||
        typeof ff.word !== "string" ||
        typeof ff.confusion_note !== "string"
      ) {
        continue;
      }
      falseFriendRows.push({
        language_code,
        word: card.target_item.trim(),
        known_language_code: ff.language_code.trim().toLowerCase(),
        known_language_word: ff.word.trim(),
        known_language_meaning: ff.confusion_note.trim(),
        target_meaning: card.target_item_en.trim(),
        alert_shown_to: []
      });
    }
  }

  if (falseFriendRows.length > 0) {
    const { error: ffErr } = await adminClient
      .from("false_friend_alerts")
      .upsert(falseFriendRows, {
        onConflict: "language_code,word,known_language_code",
        ignoreDuplicates: true
      });

    if (ffErr) {
      console.error("[cards/generate] false_friend_alerts upsert:", ffErr);
      return { ok: false, error: ffErr.message, status: 500 };
    }
  }

  if (unit_id) {
    const { error: unitUpdateErr } = await adminClient
      .from("units")
      .update({
        cards_generated: true,
        cards_generated_at: new Date().toISOString()
      })
      .eq("id", unit_id);

    if (unitUpdateErr) {
      console.error("[cards/generate] units update:", unitUpdateErr);
      return { ok: false, error: unitUpdateErr.message, status: 500 };
    }
  }

  return {
    ok: true,
    cards_generated: sentenceCardRows.length,
    false_friends_found: falseFriendRows.length
  };
}
