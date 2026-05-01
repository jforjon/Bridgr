export type HintType =
  | "cognate"
  | "shared_root"
  | "grammar_analogy"
  | "false_friend"
  | "structural_parallel";

export type Proficiency = "basic" | "conversational" | "fluent";

export interface Profile {
  id: string;
  email: string;
  name?: string | null;
  subscription_status: "free" | "pro";
  stripe_customer_id: string | null;
  created_at: string;
}

export interface UserLanguage {
  id: string;
  user_id: string;
  language_code: string;
  language_name: string;
  proficiency: Proficiency;
  is_target: boolean;
}

export interface Word {
  id: string;
  word: string;
  language_code: string;
  translation: string;
  romanization: string | null;
  part_of_speech: string | null;
  audio_url: string | null;
}

export interface Flashcard {
  id: string;
  user_id: string;
  word_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  last_quality: number | null;
  words?: Word;
}

export interface Hint {
  id: string;
  word_id: string;
  source_language_code: string;
  hint_text: string;
  hint_type: HintType;
  confidence: number;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_date: string;
  words_seen: number;
  words_mastered: number;
  streak_days: number;
  xp_earned: number;
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" }
];
