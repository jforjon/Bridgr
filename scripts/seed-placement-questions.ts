/**
 * One-time seed: generates 30 placement questions per language via Anthropic and
 * upserts into `placement_questions` (ON CONFLICT DO NOTHING on language_code + learner_profile + order_index).
 *
 * Run from repo root (needs scripts/tsconfig for CommonJS):
 *   npx ts-node --project scripts/tsconfig.json scripts/seed-placement-questions.ts
 *   npm run seed-placement-questions
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Loads env from `.env.local`.
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Manually parse .env.local and inject into process.env
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const LANGUAGES = [
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "ca", name: "Catalan" },
  { code: "en", name: "English" }
] as const;

const PROFILES = [
  {
    key: "romance",
    label: "Romance language speakers",
    languages: "French, Spanish, Italian, Portuguese, Catalan, Romanian",
    instruction:
      "The learner already speaks one or more Romance languages. For VOCABULARY and READING sections: avoid testing words that are obvious cognates with French/Spanish/Italian/Portuguese. Focus on: false friends between Romance languages, Catalan/target-language-specific vocabulary with no Romance cognate, words where the target language diverges from other Romance languages. For GRAMMAR: focus on structures that differ from other Romance languages, not shared Latin grammar."
  },
  {
    key: "germanic",
    label: "Germanic language speakers",
    languages: "English, German, Dutch, Swedish, Danish, Norwegian",
    instruction:
      'The learner speaks Germanic languages. For VOCABULARY: some cognates with English are acceptable (e.g. "normal", "hotel") but avoid testing vocabulary where the Germanic root makes the answer obvious. Focus on Romance/Latin vocabulary in the target language that has no Germanic parallel. For GRAMMAR: pay attention to structures that differ from Germanic word order and verb placement.'
  },
  {
    key: "other",
    label: "Non-European language speakers",
    languages: "Arabic, Chinese, Japanese, Russian, Turkish, Hindi, etc.",
    instruction:
      "The learner comes from a non-Romance, non-Germanic background. Use standard CEFR vocabulary and grammar questions. No cognate considerations needed. Focus on the most frequent and communicatively important vocabulary at each level."
  }
] as const;

type ProfileKey = (typeof PROFILES)[number]["key"];

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8000;

const SYSTEM_PROMPT =
  "You are a professional CEFR language assessment designer with expertise in the DELF (French), DELE (Spanish), CILS (Italian), TORFL (Russian), and CEFR frameworks. You create placement tests that accurately identify learner levels from A1 to C2. Questions must be original, pedagogically valid, and grounded in official CEFR descriptors.";

function buildUserPrompt(languageName: string, profile: (typeof PROFILES)[number]): string {
  return `LEARNER PROFILE: ${profile.label} (${profile.languages})
PROFILE INSTRUCTION: ${profile.instruction}

Generate exactly 30 placement questions for ${languageName} tailored to this learner profile.

The test has 4 sections:
1. VOCABULARY (10 questions): Multiple choice, 4 options each. 2 questions per level: A1, A2, B1, B2, C1. No C2 — vocabulary at C2 is near-native and not useful for placement.
2. GRAMMAR (8 questions): Fill-in-the-blank. User types the correct word/form. 2 questions each at A1, A2, B1, and B2 (8 total).
3. READING (8 questions): Short reading passage (2-3 sentences) + MCQ question about it. 4 options. 2 questions per level: A1, A2, B1, B2.
4. WRITING (4 questions, SKIPPABLE): Translate a sentence from English into ${languageName}. No options. 1 question per level: A1, A2, B1, B2.

Rules:
- Questions must be original — inspired by DELF/DELE/CILS/TORFL frameworks but NOT copied
- Vocabulary MCQ: options must be plausible distractors, not obviously wrong
- Grammar fill-in: prompt must have a clear blank (use ___ to mark it)
- Grammar fill-in questions must be unambiguous — if the correct answer requires knowing a very specific dialectal or archaic form, choose a different question.
- Reading: include the passage in context_text, question in prompt
- Writing: prompt is the English sentence to translate, correct_answer is the ${languageName} translation
- Never reveal the correct answer in the prompt
- NEVER include hints, notes, or cross-language comparisons in the question prompt itself. No "(Note: this is NOT the same as Spanish X)" or similar. The question must stand alone without meta-commentary.
- NEVER reference other languages in the prompt text.
- order_index: vocabulary 1-10, grammar 11-18, reading 19-26, writing 27-30

Return ONLY valid JSON (double-quoted keys and strings):
{
  "questions": [
    {
      "section": "vocabulary"|"grammar"|"reading"|"writing",
      "cefr_level": "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
      "prompt": string,
      "context_text": string | null,
      "options": string[] | null,
      "correct_answer": string,
      "order_index": number
    }
  ]
}`;
}

function sliceJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const body = fence ? fence[1].trim() : trimmed;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return body.slice(first, last + 1);
}

const SECTIONS = new Set(["vocabulary", "grammar", "reading", "writing"]);
const CEFR = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

type RawQuestion = {
  section: string;
  cefr_level: string;
  prompt: string;
  context_text: string | null;
  options: string[] | null;
  correct_answer: string;
  order_index: number;
};

function isRawQuestion(v: unknown): v is RawQuestion {
  if (!v || typeof v !== "object") return false;
  const q = v as Record<string, unknown>;
  if (typeof q.prompt !== "string" || !q.prompt.trim()) return false;
  if (typeof q.correct_answer !== "string" || !q.correct_answer.trim()) return false;
  if (typeof q.order_index !== "number" || !Number.isInteger(q.order_index)) return false;
  if (typeof q.section !== "string" || !SECTIONS.has(q.section)) return false;
  if (typeof q.cefr_level !== "string" || !CEFR.has(q.cefr_level)) return false;
  if (q.context_text != null && typeof q.context_text !== "string") return false;
  if (q.options != null) {
    if (!Array.isArray(q.options) || !q.options.every((o) => typeof o === "string")) return false;
  }
  return true;
}

function parseQuestions(raw: string): RawQuestion[] {
  const jsonStr = sliceJsonObject(raw);
  const parsed = JSON.parse(jsonStr) as { questions?: unknown };
  if (!Array.isArray(parsed.questions)) {
    throw new Error("Missing questions array");
  }
  const out = parsed.questions.filter(isRawQuestion);
  if (out.length !== parsed.questions.length) {
    console.warn(
      `[seed] dropped ${parsed.questions.length - out.length} invalid question(s) after validation`
    );
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  for (const lang of LANGUAGES) {
    for (const profile of PROFILES) {
      const profileKey: ProfileKey = profile.key;
      console.log(`\n--- ${lang.name} (${lang.code}) — ${profile.label} ---`);

      const { count: countBefore, error: countBeforeErr } = await supabase
        .from("placement_questions")
        .select("*", { count: "exact", head: true })
        .eq("language_code", lang.code)
        .eq("learner_profile", profileKey);

      if (countBeforeErr) {
        console.error("Count before failed:", countBeforeErr.message);
        process.exit(1);
      }

      if ((countBefore ?? 0) >= 30) {
        console.log(`Already seeded (${countBefore} rows) — skipping.`);
        continue;
      }

      let raw: string;
      try {
        console.log(`[${lang.name}] Calling Anthropic API...`);
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildUserPrompt(lang.name, profile) }]
          })
        });
        console.log(`[${lang.name}] API response status: ${response.status}`);
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API error ${response.status}: ${errText}`);
        }
        const responseData = (await response.json()) as { content: Array<{ type: string; text: string }> };
        const block = responseData.content[0];
        raw = block?.type === "text" ? block.text : "";
        if (!raw.trim()) throw new Error("Empty model response");
      } catch (e) {
        console.error("Anthropic error:", e instanceof Error ? e.message : e);
        process.exit(1);
      }

      let questions: RawQuestion[];
      try {
        questions = parseQuestions(raw);
      } catch (e) {
        console.error("Parse error:", e instanceof Error ? e.message : e);
        console.error("Raw (first 600 chars):", raw.slice(0, 600));
        process.exit(1);
      }

      console.log(`Parsed ${questions.length} valid questions (expected 30).`);

      const rows = questions.map((q) => ({
        language_code: lang.code,
        learner_profile: profileKey,
        section: q.section,
        cefr_level: q.cefr_level,
        prompt: q.prompt.trim(),
        context_text: q.context_text?.trim() ?? null,
        options: q.options ?? null,
        correct_answer: q.correct_answer.trim(),
        order_index: q.order_index
      }));

      const { error: upsertError } = await supabase.from("placement_questions").upsert(rows, {
        onConflict: "language_code,learner_profile,order_index",
        ignoreDuplicates: true
      });

      if (upsertError) {
        console.error("Upsert error:", upsertError.message);
        process.exit(1);
      }

      const { count: countAfter, error: countAfterErr } = await supabase
        .from("placement_questions")
        .select("*", { count: "exact", head: true })
        .eq("language_code", lang.code)
        .eq("learner_profile", profileKey);

      if (countAfterErr) {
        console.error("Count after failed:", countAfterErr.message);
        process.exit(1);
      }

      const netNew = (countAfter ?? 0) - (countBefore ?? 0);
      console.log(
        `language_code=${lang.code}, learner_profile=${profileKey}: row count ${countBefore ?? 0} → ${countAfter ?? 0} (net new this run: ${netNew}; duplicates ignored via upsert)`
      );

      await sleep(3000);
    }
  }

  console.log("\nDone.");
}

void main();
