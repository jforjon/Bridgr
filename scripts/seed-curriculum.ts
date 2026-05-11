import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
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

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SEED_SECRET = process.env.CURRICULUM_SEED_SECRET;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function seedOne(
  languageCode: string,
  languageName: string,
  cefrLevel: string
): Promise<void> {
  console.log(`  Calling seed API...`);
  const response = await fetch(`${BASE_URL}/api/curriculum/seed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      SEED_SECRET: SEED_SECRET ?? ""
    },
    body: JSON.stringify({
      language_code: languageCode,
      language_name: languageName,
      cefr_level: cefrLevel
    })
  });

  const data = (await response.json()) as {
    topics_inserted?: number;
    rules_inserted?: number;
    vocabulary_inserted?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`);
  }

  console.log(
    `  ✓ topics: ${data.topics_inserted ?? 0}, rules: ${data.rules_inserted ?? 0}, vocab: ${data.vocabulary_inserted ?? 0}`
  );
}

async function main(): Promise<void> {
  if (!SEED_SECRET) {
    console.error("Missing CURRICULUM_SEED_SECRET in .env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: seededRows } = await supabase
    .from("curriculum_topics")
    .select("language_code, cefr_level")
    .order("language_code");

  const seeded = new Set((seededRows ?? []).map((r) => `${r.language_code}:${r.cefr_level}`));

  console.log("Already seeded combinations:", Array.from(seeded).sort().join(", "));

  // We'll just attempt all and let ON CONFLICT DO NOTHING handle duplicates

  for (const lang of LANGUAGES) {
    for (const level of LEVELS) {
      const key = `${lang.code}:${level}`;
      if (seeded.has(key)) {
        console.log(`\n--- ${lang.name} (${lang.code}) ${level} --- already seeded, skipping.`);
        continue;
      }
      console.log(`\n--- ${lang.name} (${lang.code}) ${level} ---`);
      try {
        await seedOne(lang.code, lang.name, level);
      } catch (e) {
        console.error(`  ✗ Failed:`, e instanceof Error ? e.message : e);
        console.error(`  Continuing...`);
      }
      await sleep(3000);
    }
  }

  console.log("\nDone.");
}

void main();
