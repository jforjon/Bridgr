import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a professional language curriculum designer with expertise in CEFR frameworks, frequency linguistics, and communicative language teaching. You create structured, pedagogically sound curriculum content based on official CEFR guidelines, frequency dictionaries, and established exam frameworks (DELF, DELE, CILS, TORFL). Always ground your content in these official sources.";

interface SeedRequestBody {
  language_code: string;
  language_name: string;
  cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
}

interface CurriculumExample {
  sentence: string;
  translation: string;
}

interface CurriculumRule {
  rule_title: string;
  rule_explanation: string;
  examples: CurriculumExample[];
  source: string;
}

interface CurriculumTopic {
  topic_key: string;
  topic_name: string;
  topic_type: "vocabulary" | "grammar" | "reading" | "culture";
  description: string;
  source: string;
  order_index: number;
  rules?: CurriculumRule[];
}

interface CurriculumVocabRow {
  word: string;
  translation_en: string;
  part_of_speech: string;
  frequency_rank: number;
  topic_key: string;
  source: string;
}

const MAX_OUTPUT_TOKENS = 16000;

function buildTopicsPrompt(languageName: string, languageCode: string, cefrLevel: string): string {
  return `Generate ${cefrLevel} curriculum topics and rules for ${languageName} (${languageCode}).

Return ONLY valid JSON (double-quoted keys and strings). Do not include a "vocabulary" field. Use this exact structure:
{
  "topics": [
    {
      "topic_key": string,
      "topic_name": string,
      "topic_type": "vocabulary"|"grammar"|"reading"|"culture",
      "description": string,
      "source": string,
      "order_index": number,
      "rules": [
        {
          "rule_title": string,
          "rule_explanation": string,
          "examples": [{"sentence": string, "translation": string}],
          "source": string
        }
      ]
    }
  ]
}

Include exactly 6 topics with these topic_key values: greetings, numbers_time, grammar_present, family_daily, food_drink, travel_directions.
For grammar topics, include 2-3 rules with clear explanations at ${cefrLevel} level and 3 examples each (sentence + translation).`;
}

function buildVocabularyPrompt(languageName: string, languageCode: string, cefrLevel: string): string {
  return `Generate exactly 60 ${cefrLevel} vocabulary items for ${languageName} (${languageCode}): the most common ${cefrLevel} words per CEFR frequency lists, exactly 10 words per topic_key.

Topic keys (use only these): greetings, numbers_time, grammar_present, family_daily, food_drink, travel_directions.

Return ONLY valid JSON (double-quoted keys and strings). Do not include a "topics" field. Use this exact structure:
{
  "vocabulary": [
    {
      "word": string,
      "translation_en": string,
      "part_of_speech": string,
      "frequency_rank": number,
      "topic_key": string,
      "source": "CEFR ${cefrLevel} word list"
    }
  ]
}`;
}

function sliceJsonObject(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in response");
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function parseTopicsPayload(text: string): CurriculumTopic[] {
  const jsonStr = sliceJsonObject(text);
  const parsed = JSON.parse(jsonStr) as { topics?: unknown };
  if (!Array.isArray(parsed.topics)) {
    throw new Error("Invalid curriculum JSON: missing topics array.");
  }
  return parsed.topics as CurriculumTopic[];
}

function parseVocabularyPayload(text: string): CurriculumVocabRow[] {
  const jsonStr = sliceJsonObject(text);
  const parsed = JSON.parse(jsonStr) as { vocabulary?: unknown };
  if (!Array.isArray(parsed.vocabulary)) {
    throw new Error("Invalid curriculum JSON: missing vocabulary array.");
  }
  return parsed.vocabulary as CurriculumVocabRow[];
}

export async function POST(request: Request) {
  const secret = request.headers.get("SEED_SECRET");
  const expected = process.env.CURRICULUM_SEED_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SeedRequestBody;
  try {
    body = (await request.json()) as SeedRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { language_code, language_name, cefr_level } = body;
  const VALID_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  if (!language_code || !language_name || !VALID_LEVELS.includes(cefr_level)) {
    return NextResponse.json(
      { error: "Invalid body: require language_code, language_name, and a valid cefr_level (A1–C2)." },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  async function runAnthropicUserPrompt(userContent: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }
    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const block = data.content[0];
    const text = block?.type === "text" ? block.text : "";
    if (!text) throw new Error("Empty model response.");
    return text;
  }

  let topicsText: string;
  try {
    topicsText = await runAnthropicUserPrompt(buildTopicsPrompt(language_name, language_code, cefr_level));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[curriculum/seed] Anthropic error (topics):", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log("Raw Anthropic response — topics (first 500 chars):", topicsText.slice(0, 500));

  let topics: CurriculumTopic[];
  try {
    topics = parseTopicsPayload(topicsText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[curriculum/seed] JSON parse error (topics):", message, topicsText.slice(0, 500));
    return NextResponse.json({ error: `Failed to parse topics JSON: ${message}` }, { status: 500 });
  }

  const topicRows = topics.map((t, i) => ({
    language_code,
    cefr_level,
    topic_key: t.topic_key,
    topic_name: t.topic_name,
    topic_type: t.topic_type,
    description: t.description ?? "",
    source: t.source ?? "",
    order_index: typeof t.order_index === "number" ? t.order_index : i
  }));

  const { data: insertedTopics, error: topicsError } = await supabase
    .from("curriculum_topics")
    .upsert(topicRows, {
      onConflict: "language_code,cefr_level,topic_key",
      ignoreDuplicates: true
    })
    .select("id, topic_key");

  if (topicsError) {
    console.error("[curriculum/seed] topics upsert:", topicsError);
    return NextResponse.json({ error: topicsError.message }, { status: 500 });
  }

  const topicsInserted = insertedTopics?.length ?? 0;
  console.log("Topics inserted:", topicsInserted);

  const { data: topicRowsFetched, error: topicFetchError } = await supabase
    .from("curriculum_topics")
    .select("id, topic_key")
    .eq("language_code", language_code)
    .eq("cefr_level", cefr_level);

  if (topicFetchError || !topicRowsFetched?.length) {
    console.error("[curriculum/seed] topic fetch:", topicFetchError);
    return NextResponse.json(
      { error: topicFetchError?.message ?? "Could not load curriculum topics after upsert." },
      { status: 500 }
    );
  }

  const topicIdByKey = new Map(topicRowsFetched.map((row) => [row.topic_key, row.id]));
  const topicIds = topicRowsFetched.map((row) => row.id);

  if (topicIds.length > 0) {
    const { error: deleteRulesError } = await supabase.from("curriculum_rules").delete().in("topic_id", topicIds);
    if (deleteRulesError) {
      console.error("[curriculum/seed] rules delete:", deleteRulesError);
      return NextResponse.json({ error: deleteRulesError.message }, { status: 500 });
    }
  }

  const ruleRows: Array<{
    topic_id: string;
    language_code: string;
    rule_title: string;
    rule_explanation: string;
    examples: CurriculumExample[];
    source: string;
  }> = [];

  for (const topic of topics) {
    const topicId = topicIdByKey.get(topic.topic_key);
    if (!topicId) {
      console.warn("[curriculum/seed] missing topic_id for key:", topic.topic_key);
      continue;
    }
    const rules = Array.isArray(topic.rules) ? topic.rules : [];
    for (const rule of rules) {
      ruleRows.push({
        topic_id: topicId,
        language_code,
        rule_title: rule.rule_title ?? "",
        rule_explanation: rule.rule_explanation ?? "",
        examples: Array.isArray(rule.examples) ? rule.examples : [],
        source: rule.source ?? ""
      });
    }
  }

  let rulesInserted = 0;
  if (ruleRows.length > 0) {
    const { data: insertedRules, error: rulesError } = await supabase
      .from("curriculum_rules")
      .insert(ruleRows)
      .select("id");

    if (rulesError) {
      console.error("[curriculum/seed] rules insert:", rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }
    rulesInserted = insertedRules?.length ?? 0;
  }

  console.log("Rules inserted:", rulesInserted);

  let vocabularyText: string;
  try {
    vocabularyText = await runAnthropicUserPrompt(
      buildVocabularyPrompt(language_name, language_code, cefr_level)
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[curriculum/seed] Anthropic error (vocabulary):", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  console.log("Raw Anthropic response — vocabulary (first 500 chars):", vocabularyText.slice(0, 500));

  let vocabulary: CurriculumVocabRow[];
  try {
    vocabulary = parseVocabularyPayload(vocabularyText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[curriculum/seed] JSON parse error (vocabulary):", message, vocabularyText.slice(0, 500));
    return NextResponse.json({ error: `Failed to parse vocabulary JSON: ${message}` }, { status: 500 });
  }

  const vocabRows = vocabulary.map((v) => ({
    language_code,
    cefr_level,
    word: v.word,
    translation_en: v.translation_en,
    part_of_speech: v.part_of_speech ?? "",
    frequency_rank: typeof v.frequency_rank === "number" ? v.frequency_rank : 0,
    topic_key: v.topic_key,
    source: v.source ?? "CEFR A1 word list"
  }));

  const { error: deleteVocabError } = await supabase
    .from("curriculum_vocabulary")
    .delete()
    .eq("language_code", language_code)
    .eq("cefr_level", cefr_level);

  if (deleteVocabError) {
    console.error("[curriculum/seed] vocabulary delete:", deleteVocabError);
    return NextResponse.json({ error: deleteVocabError.message }, { status: 500 });
  }

  let vocabInserted = 0;
  if (vocabRows.length > 0) {
    const { data: insertedVocab, error: vocabError } = await supabase
      .from("curriculum_vocabulary")
      .upsert(vocabRows, {
        onConflict: "language_code,word",
        ignoreDuplicates: true
      })
      .select("id");

    if (vocabError) {
      console.error("[curriculum/seed] vocabulary insert:", vocabError);
      return NextResponse.json({ error: vocabError.message }, { status: 500 });
    }
    vocabInserted = insertedVocab?.length ?? 0;
  }

  console.log("Vocabulary inserted:", vocabInserted);

  return NextResponse.json({
    topics_inserted: topicsInserted,
    rules_inserted: rulesInserted,
    vocabulary_inserted: vocabInserted
  });
}
