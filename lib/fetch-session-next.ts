import type { SessionCard } from "@/types";

export type SessionNextResponse = {
  cards?: SessionCard[];
  total?: number;
  session_id?: string;
  lesson_id?: string | null;
  unit_id?: string | null;
  /** True when finishing this session introduces the last new cards of the current lesson. */
  lesson_exhausted?: boolean;
  error?: string;
};

export async function fetchSessionNext(languageCode: string): Promise<{
  ok: boolean;
  status: number;
  data: SessionNextResponse;
  requestUrl: string;
}> {
  const normalized = languageCode.toLowerCase().trim();
  const requestUrl = `/api/session/next?language_code=${encodeURIComponent(normalized)}`;
  const res = await fetch(requestUrl, { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as SessionNextResponse;
  return { ok: res.ok, status: res.status, data, requestUrl };
}
