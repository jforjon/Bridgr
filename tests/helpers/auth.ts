import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

export async function login(page: Page) {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test')
  }

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
}

export async function resetTestUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.TEST_USER_EMAIL

  if (!url || !key || !email) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEST_USER_EMAIL must be set'
    )
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData } = await supabase.auth.admin.listUsers()
  const user = userData?.users.find((u) => u.email === email)
  if (!user) throw new Error(`Test user ${email} not found`)

  const userId = user.id

  await supabase
    .from('profiles')
    .update({ name: null, native_language_code: null, weekly_goal: null })
    .eq('id', userId)

  // Delete lessons and units before courses (no cascade FK in DB)
  const { data: userCourses } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)

  const courseIds = userCourses?.map((c) => c.id) ?? []

  if (courseIds.length > 0) {
    const { data: courseUnits } = await supabase
      .from('units')
      .select('id')
      .in('course_id', courseIds)

    const unitIds = courseUnits?.map((u) => u.id) ?? []

    if (unitIds.length > 0) {
      await supabase.from('lessons').delete().in('unit_id', unitIds)
    }

    await supabase.from('units').delete().in('course_id', courseIds)
  }

  await Promise.all([
    supabase.from('known_languages').delete().eq('user_id', userId),
    supabase.from('learning_languages').delete().eq('user_id', userId),
    supabase.from('courses').delete().eq('user_id', userId),
    supabase.from('placements').delete().eq('user_id', userId),
  ])
}

// topic_key used for the seeded test unit and its curriculum vocabulary.
// A distinct key prevents collisions with real curriculum content.
const E2E_TOPIC_KEY = 'e2e_greetings'

export async function seedTestUserWithCourse() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.TEST_USER_EMAIL

  if (!url || !key || !email) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEST_USER_EMAIL must be set'
    )
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData } = await supabase.auth.admin.listUsers()
  const user = userData?.users.find((u) => u.email === email)
  if (!user) throw new Error(`Test user ${email} not found`)

  const userId = user.id

  // Profile
  await supabase
    .from('profiles')
    .update({ name: 'Test User', native_language_code: 'en' })
    .eq('id', userId)

  // Native language (required by /learn page: knownCount > 0)
  await supabase.from('known_languages').upsert(
    { user_id: userId, language_code: 'en', language_name: 'English', proficiency: 'C2' },
    { onConflict: 'user_id,language_code' }
  )

  // Learning language
  await supabase.from('learning_languages').upsert(
    {
      user_id: userId,
      language_code: 'it',
      language_name: 'Italian',
      cefr_level: 'A1',
      placement_completed: true,
    },
    { onConflict: 'user_id,language_code' }
  )

  // Vocabulary words — seeded directly into the words table so the vocab bank
  // API always finds them via its words-lookup step and never needs to INSERT
  // on-the-fly (which is what gates the Next button appearing in the lesson).
  // Use limit(1) instead of maybeSingle() to avoid PGRST116 when duplicates
  // exist from previous runs (words has no unique constraint on language+word).
  const E2E_VOCAB = [
    { word: 'ciao',        translation: 'hello',      part_of_speech: 'interjection' },
    { word: 'grazie',      translation: 'thank you',  part_of_speech: 'interjection' },
    { word: 'arrivederci', translation: 'goodbye',    part_of_speech: 'interjection' },
  ] as const

  for (const v of E2E_VOCAB) {
    const { data: existing } = await supabase
      .from('words')
      .select('id')
      .eq('language_code', 'it')
      .eq('word', v.word)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('words').insert({
        word: v.word,
        language_code: 'it',
        translation: v.translation,
        romanization: null,
        part_of_speech: v.part_of_speech,
      })
    }
  }

  // Curriculum vocabulary — drives the primary path in the vocab bank API so
  // it returns exactly these 3 words (not all Italian words from the fallback).
  await supabase.from('curriculum_vocabulary').upsert(
    E2E_VOCAB.map((v, i) => ({
      language_code: 'it',
      cefr_level: 'A1',
      topic_key: E2E_TOPIC_KEY,
      word: v.word,
      translation_en: v.translation,
      part_of_speech: v.part_of_speech,
      frequency_rank: i + 1,
      source: 'e2e_test',
    })),
    { onConflict: 'language_code,cefr_level,word' }
  )

  // Course
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .upsert(
      { user_id: userId, language_code: 'it', cefr_level: 'A1' },
      { onConflict: 'user_id,language_code' }
    )
    .select('id')
    .single()

  if (courseErr || !course) throw new Error(`Could not create course: ${courseErr?.message}`)

  // Unit
  const { data: unit, error: unitErr } = await supabase
    .from('units')
    .insert({
      course_id: course.id,
      topic_key: E2E_TOPIC_KEY,
      title: 'Greetings',
      description: 'Basic Italian greetings',
      cefr_level: 'A1',
      order_index: 0,
      status: 'available',
    })
    .select('id')
    .single()

  if (unitErr || !unit) throw new Error(`Could not create unit: ${unitErr?.message}`)

  // Lesson
  const { error: lessonErr } = await supabase.from('lessons').insert({
    unit_id: unit.id,
    type: 'vocabulary',
    title: 'Vocabulary: Greetings',
    order_index: 0,
    status: 'available',
    content: {},
  })

  if (lessonErr) throw new Error(`Could not create lesson: ${lessonErr.message}`)
}
