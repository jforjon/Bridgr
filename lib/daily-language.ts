/**
 * Frontend-only language flavour for the home screen: a localized greeting
 * and a curated "phrase of the day" per language. No backend involved — the
 * phrase rotates deterministically by day of year so it's stable across
 * reloads and identical for everyone on a given day.
 */

export interface DailyPhrase {
  phrase: string;
  /** One line: literal meaning + why it's interesting. */
  meaning: string;
}

const GREETINGS: Record<string, { morning: string; day: string; evening: string }> = {
  it: { morning: "Buongiorno", day: "Buongiorno", evening: "Buonasera" },
  es: { morning: "Buenos días", day: "Buenas tardes", evening: "Buenas noches" },
  fr: { morning: "Bonjour", day: "Bonjour", evening: "Bonsoir" },
  de: { morning: "Guten Morgen", day: "Guten Tag", evening: "Guten Abend" },
  ca: { morning: "Bon dia", day: "Bona tarda", evening: "Bon vespre" },
  pt: { morning: "Bom dia", day: "Boa tarde", evening: "Boa noite" },
  nl: { morning: "Goedemorgen", day: "Goedemiddag", evening: "Goedenavond" },
  sv: { morning: "God morgon", day: "God dag", evening: "God kväll" },
  pl: { morning: "Dzień dobry", day: "Dzień dobry", evening: "Dobry wieczór" },
  ru: { morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер" },
  ja: { morning: "おはようございます", day: "こんにちは", evening: "こんばんは" },
  ko: { morning: "좋은 아침이에요", day: "안녕하세요", evening: "안녕하세요" },
  zh: { morning: "早上好", day: "你好", evening: "晚上好" },
  tr: { morning: "Günaydın", day: "İyi günler", evening: "İyi akşamlar" }
};

export function localizedGreeting(languageCode: string, date = new Date()): string {
  const g = GREETINGS[languageCode.toLowerCase()];
  const hour = date.getHours();
  if (!g) {
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
  if (hour < 12) return g.morning;
  if (hour < 18) return g.day;
  return g.evening;
}

const PHRASES: Record<string, DailyPhrase[]> = {
  it: [
    { phrase: "In bocca al lupo", meaning: "“Into the wolf's mouth” — how Italians wish good luck. The reply is «crepi»." },
    { phrase: "Dolce far niente", meaning: "The sweetness of doing nothing — idleness as an art form." },
    { phrase: "Boh", meaning: "The untranslatable shrug: “no idea, and I'm at peace with that.”" },
    { phrase: "Magari!", meaning: "“If only!” — desire, hope and envy compressed into one word." },
    { phrase: "Fa un freddo cane", meaning: "“It's a dog's cold” — bitterly freezing, no dogs involved." },
    { phrase: "Meglio tardi che mai", meaning: "Better late than never — the unofficial motto of Italian trains." },
    { phrase: "Avere le braccine corte", meaning: "“To have short little arms” — too short to reach your wallet, that is." }
  ],
  es: [
    { phrase: "Sobremesa", meaning: "The hours of talk after a meal ends — the meal is the excuse." },
    { phrase: "No pasa nada", meaning: "“Nothing's wrong” — Spain's all-purpose absolution." },
    { phrase: "Ojalá", meaning: "“God willing” — borrowed from Arabic a thousand years ago, still doing hope's work." },
    { phrase: "Estar en las nubes", meaning: "“To be in the clouds” — daydreaming, pleasantly unreachable." },
    { phrase: "Me suena a chino", meaning: "“Sounds like Chinese to me” — what Spaniards say instead of “it's Greek to me”." },
    { phrase: "Ponerse las pilas", meaning: "“Put your batteries in” — get it together, starting now." }
  ],
  fr: [
    { phrase: "L'esprit de l'escalier", meaning: "“Staircase wit” — the perfect retort you think of on the way out." },
    { phrase: "Flâner", meaning: "To wander a city with no destination and full attention." },
    { phrase: "Ça marche", meaning: "“It walks” — deal, works for me, consider it done." },
    { phrase: "Avoir le cafard", meaning: "“To have the cockroach” — a bout of the blues." },
    { phrase: "Coup de foudre", meaning: "“A lightning strike” — love at first sight." },
    { phrase: "Râler", meaning: "To grumble contentedly — a French civic duty." }
  ],
  de: [
    { phrase: "Feierabend", meaning: "The moment work ends and the evening becomes yours — a small daily holiday." },
    { phrase: "Fernweh", meaning: "Homesickness for places you've never been." },
    { phrase: "Doch", meaning: "The one-word rebuttal: “yes it is, actually.”" },
    { phrase: "Das ist mir Wurst", meaning: "“That's sausage to me” — I couldn't care less." },
    { phrase: "Jein", meaning: "Yes and no at once — German honesty in three letters." },
    { phrase: "Schnapsidee", meaning: "“Schnapps idea” — a plan that only made sense while drinking." }
  ],
  ca: [
    { phrase: "Déu n'hi do", meaning: "Untranslatable admiration: “quite something, that.”" },
    { phrase: "Fer el vermut", meaning: "The pre-lunch vermouth ritual — an institution, not a drink." },
    { phrase: "Som-hi!", meaning: "“Let's go!” — Catalonia's all-purpose rallying cry." },
    { phrase: "Seny i rauxa", meaning: "Level-headedness and wild impulse — the two poles of the Catalan soul." },
    { phrase: "Bufar i fer ampolles", meaning: "“Blowing and making bottles” — something dead easy." }
  ],
  pt: [
    { phrase: "Saudade", meaning: "Longing for something absent — sadder than missing, sweeter than grief." },
    { phrase: "Desenrascar", meaning: "To improvise a way out of trouble with nothing but nerve." },
    { phrase: "Pois é", meaning: "“Well, yes” — agreement, resignation and philosophy in two words." },
    { phrase: "Ficar de molho", meaning: "“To stay soaking” — laid up at home, out of action." }
  ]
};

export function dailyPhrase(languageCode: string, date = new Date()): DailyPhrase | null {
  const list = PHRASES[languageCode.toLowerCase()];
  if (!list || list.length === 0) return null;
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  return list[dayOfYear % list.length];
}
