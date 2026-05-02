import { randomUUID } from "crypto";

export type PlacementQuestionType = "vocabulary" | "grammar" | "comprehension";

export type PlacementCefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface PlacementStoredQuestion {
  id: string;
  type: PlacementQuestionType;
  cefr_level: PlacementCefrLevel;
  /** When missing, submit route falls back to \`${type}_${cefr_level}\` for weak_areas. */
  topic_key?: string;
  prompt: string;
  context?: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}

export interface PlacementSessionPayload {
  userId: string;
  language_code: string;
  language_name: string;
  questions: PlacementStoredQuestion[];
  expiresAt: number;
}

const TTL_MS = 2 * 60 * 60 * 1000;

function getCache(): Map<string, PlacementSessionPayload> {
  const g = globalThis as typeof globalThis & {
    __placementSessionCache?: Map<string, PlacementSessionPayload>;
  };
  if (!g.__placementSessionCache) {
    g.__placementSessionCache = new Map();
  }
  return g.__placementSessionCache;
}

function pruneExpired(): void {
  const cache = getCache();
  const now = Date.now();
  for (const [id, payload] of cache) {
    if (payload.expiresAt <= now) {
      cache.delete(id);
    }
  }
}

export function createPlacementSession(payload: Omit<PlacementSessionPayload, "expiresAt">): string {
  pruneExpired();
  const test_session_id = randomUUID();
  const cache = getCache();
  cache.set(test_session_id, {
    ...payload,
    expiresAt: Date.now() + TTL_MS
  });
  return test_session_id;
}

export function getPlacementSession(test_session_id: string): PlacementSessionPayload | null {
  pruneExpired();
  const cache = getCache();
  const row = cache.get(test_session_id);
  if (!row || row.expiresAt <= Date.now()) {
    if (row) cache.delete(test_session_id);
    return null;
  }
  return row;
}

export function deletePlacementSession(test_session_id: string): void {
  getCache().delete(test_session_id);
}
