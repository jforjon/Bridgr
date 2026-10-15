import { SUPPORTED_LANGUAGES, type SentenceCard } from "@/types";

export type CognateNote = {
  line: string;
  detail: string;
};

function languageNameForCode(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase());
  if (found) return found.name;
  const trimmed = code.trim();
  if (!trimmed) return "another language";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function cognateNoteForCard(sentenceCard: SentenceCard): CognateNote | null {
  const cognates = sentenceCard.cross_linguistic?.cognates ?? [];
  const cognate = cognates.find(
    (c) => typeof c.word === "string" && c.word.trim() && typeof c.note === "string"
  );
  if (!cognate) return null;

  const langName = languageNameForCode(cognate.language_code);
  return {
    line: `✓ Cognate with ${langName} '${cognate.word.trim()}' 💡`,
    detail: cognate.note.trim()
  };
}
