import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateHint({
  word,
  targetLanguage,
  knownLanguages,
  contextSentence
}: {
  word: string;
  targetLanguage: string;
  knownLanguages: { language: string; languageCode: string; proficiency: string }[];
  contextSentence?: string;
}): Promise<{
  hint_text: string;
  hint_type: string;
  source_language_code: string;
  confidence: number;
} | null> {
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "You are an expert comparative linguist. Find the single most useful cross-language memory bridge for a language learner. For vocabulary: identify cognates, shared Latin/Greek roots, false friends. For grammar: identify structural parallels. Be specific and concrete.",
      messages: [
        {
          role: "user",
          content: `Target word: ${word} in ${targetLanguage}
Context: ${contextSentence ?? "none"}
Learner knows: ${knownLanguages.map((l) => `${l.language} (${l.proficiency})`).join(", ")}
You MUST only reference these specific languages the learner knows: ${knownLanguages
            .map((l) => l.language)
            .join(", ")}.
Do NOT reference English or any other language not in this list unless English is explicitly listed.

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "hint_text": "2 sentences max, conversational, e.g. Like esperar in Spanish...",
  "hint_type": "cognate|shared_root|grammar_analogy|false_friend|structural_parallel",
  "source_language_code": "ISO code",
  "confidence": 0.0 to 1.0
}`
        }
      ]
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.confidence < 0.4) return null;
    return parsed;
  } catch (e) {
    console.error("Hint generation failed:", e);
    return null;
  }
}
