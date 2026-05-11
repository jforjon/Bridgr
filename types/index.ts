export type HintType =
  | "cognate"
  | "shared_root"
  | "grammar_analogy"
  | "false_friend"
  | "structural_parallel";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_LEVELS: readonly CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export type Proficiency = CEFRLevel;

export interface Profile {
  id: string;
  email: string;
  name?: string | null;
  native_language_code: string | null;
  native_language_name: string | null;
  /** Default: 3 */
  weekly_goal: number;
  notification_enabled: boolean;
  notification_days: string[];
  notification_time: string;
  weekly_streak: number;
  sessions_this_week: number;
  week_start_date: string;
  best_weekly_streak: number;
  subscription_status: "free" | "pro";
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  type: string;
  value: number;
  unlocked_at: string;
}

export type WeeklyGoalOption = 1 | 2 | 3 | 4 | 5 | 7;

export interface KnownLanguage {
  id: string;
  user_id: string;
  language_code: string;
  language_name: string;
  proficiency: Proficiency;
  /** From onboarding "other languages"; coarse B1, reference-oriented */
  is_reference_only?: boolean;
  created_at: string;
}

export interface LearningLanguage {
  id: string;
  user_id: string;
  language_code: string;
  language_name: string;
  cefr_level: CEFRLevel;
  placement_completed: boolean;
  last_accessed_at: string | null;
  created_at: string;
}

export interface Placement {
  id: string;
  user_id: string;
  language_code: string;
  cefr_level: CEFRLevel;
  score: number;
  total_questions: number;
  weak_areas: string[];
  skipped: boolean;
  completed_at: string;
}

export interface CurriculumTopic {
  id: string;
  language_code: string;
  cefr_level: CEFRLevel;
  topic_key: string;
  topic_name: string;
  topic_type: "vocabulary" | "grammar" | "reading" | "culture";
  description: string | null;
  source: string | null;
  order_index: number;
}

export interface CurriculumRule {
  id: string;
  topic_id: string;
  language_code: string;
  rule_title: string;
  rule_explanation: string;
  examples: { sentence: string; translation: string }[];
  source: string | null;
}

export interface CurriculumVocabulary {
  id: string;
  language_code: string;
  cefr_level: CEFRLevel;
  word: string;
  translation_en: string;
  part_of_speech: string | null;
  frequency_rank: number | null;
  topic_key: string | null;
  source: string | null;
}

export interface Course {
  id: string;
  user_id: string;
  language_code: string;
  cefr_level: CEFRLevel;
  generated_at: string;
}

export interface Unit {
  id: string;
  course_id: string;
  topic_key: string;
  title: string;
  description: string | null;
  personalisation_note?: string | null;
  cefr_level: CEFRLevel;
  order_index: number;
  status: "locked" | "available" | "completed";
  unlocked_at: string | null;
}

export interface Lesson {
  id: string;
  unit_id: string;
  type: "vocabulary" | "grammar" | "reading" | "review";
  title: string;
  order_index: number;
  status: "locked" | "available" | "completed";
  content: any;
  completed_at: string | null;
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
  lesson_id?: string | null;
  language_code?: string | null;
  last_typed_answer?: string | null;
  typing_accuracy?: number | null;
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

export const WEEKLY_GOAL_OPTIONS: {
  value: WeeklyGoalOption;
  label: string;
  description: string;
}[] = [
  { value: 1, label: "Once a week", description: "Light touch" },
  { value: 2, label: "Twice a week", description: "Building a habit" },
  {
    value: 3,
    label: "3 times a week",
    description: "Recommended — most learners hit this"
  },
  { value: 4, label: "4 times a week", description: "Serious learner" },
  { value: 5, label: "5 times a week", description: "Intensive" },
  { value: 7, label: "Every day", description: "Full commitment" }
];

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
