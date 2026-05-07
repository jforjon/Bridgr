import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORTED_LANGUAGES } from "@/types";

const LESSON_MODEL = "claude-sonnet-4-5";

export type KnownLanguageInput = {
  language_code: string;
  language_name: string;
  proficiency?: string;
};

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(first, last + 1);
}

const LESSON_TYPES = ["vocabulary", "grammar", "reading", "review"] as const;

/**
 * Generates four lessons (vocabulary → grammar → reading → review) via Anthropic
 * and inserts them for the unit. First lesson is `available`, the rest `locked`.
 */
export async function generateLessonsForUnit(
  supabase: SupabaseClient,
  unit_id: string,
  topic_key: string,
  language_code: string,
  cefr_level: string,
  known_languages: KnownLanguageInput[]
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const languageName = resolveLanguageName(language_code);
  const knownSummary =
    known_languages.length === 0
      ? "(none listed)"
      : known_languages
          .map(
            (k) =>
              `${k.language_name} (${k.language_code})${k.proficiency ? ` ~${k.proficiency}` : ""}`
          )
          .join(", ");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userPrompt = `Create exactly 4 sequential micro-lessons for ONE unit of a language course.

Target language: ${languageName} (${language_code})
CEFR level: ${cefr_level}
Unit topic_key (curriculum theme): ${topic_key}
Learner's known languages: ${knownSummary}
Use cognates, contrasts, or grammar parallels with known languages where it helps learning.

Return ONLY valid JSON (double-quoted keys and strings). Structure:
{
  "lessons": [
    {
      "type": "vocabulary",
      "title": string,
      "content": {
        "intro": string,
        "items": [{"term": string, "translation": string, "example_sentence": string, "learning_tip": string}]
      }
    },
    {
      "type": "grammar",
      "title": string,
      "content": {
        "focus": string,
        "explanation": string,
        "guided_examples": [{"sentence": string, "translation": string}],
        "practice": [{"prompt": string, "model_answer": string}]
      }
    },
    {
      "type": "reading",
      "title": string,
      "content": {
        "passage": string,
        "questions": [{"question": string, "choices": string[] | null, "correct_answer": string}]
      }
    },
    {
      "type": "review",
      "title": string,
      "content": {
        "summary_bullets": string[],
        "recall_items": [{"prompt": string, "answer": string}]
      }
    }
  ]
}

Rules:
- Exactly 4 lessons in this order: vocabulary, grammar, reading, review.
- Each object must have "type" matching one of those four strings.
- Keep vocabulary items to 6–12 entries appropriate for ${cefr_level}.
- Reading passage length suitable for ${cefr_level}; questions may use 4 multiple-choice strings in "choices" or null choices for short written answers.
`;

  const msg = await client.messages.create({
    model: LESSON_MODEL,
    max_tokens: 6000,
    system:
      "You are a language curriculum specialist. You write concrete, level-appropriate lesson payloads for apps. Always return strictly valid JSON.",
    messages: [{ role: "user", content: userPrompt }]
  });

  const block = msg.content[0];
  const text = block.type === "text" ? block.text : "";
  if (!text.trim()) {
    throw new Error("Empty model response for lessons.");
  }

  const parsed = JSON.parse(sliceJsonObject(text)) as { lessons?: unknown };
  if (!Array.isArray(parsed.lessons) || parsed.lessons.length < 4) {
    throw new Error("Invalid lessons JSON: expected lessons array with at least 4 entries.");
  }

  const arr = parsed.lessons as Array<{
    type?: string;
    title?: string;
    content?: Record<string, unknown>;
  }>;

  function pick(type: (typeof LESSON_TYPES)[number]) {
    const found = arr.find((l) => l?.type === type);
    if (!found) {
      throw new Error(`Missing lesson type "${type}" in model output.`);
    }
    return found;
  }

  const rows = LESSON_TYPES.map((type, order_index) => {
    const raw = pick(type);
    const title =
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : `${type.charAt(0).toUpperCase() + type.slice(1)} — ${topic_key}`;
    const content = raw.content && typeof raw.content === "object" ? raw.content : {};
    return {
      unit_id,
      type,
      title,
      order_index,
      status: order_index === 0 ? ("available" as const) : ("locked" as const),
      content
    };
  });

  const { error } = await supabase.from("lessons").insert(rows);
  if (error) {
    throw new Error(error.message);
  }
}
