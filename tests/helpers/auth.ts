import type { Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export async function login(page: Page) {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test')
  }

  // Retry up to 3 attempts total. The dev server can be slow to respond after a
  // long preceding test, causing the post-login redirect to time out.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(email)
      await page.getByPlaceholder('Enter your password').fill(password)
      await page.getByRole('button', { name: /log in/i }).click()
      // Wait for the redirect away from /login — confirms the server responded.
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
      return
    } catch (err) {
      lastError = err
      console.warn(`[login] attempt ${attempt + 1} failed, retrying…`)
    }
  }
  throw lastError
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

  // Cascade delete: flashcards → lessons → units → courses (no FK cascade in DB).
  const { data: userCourses } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)

  const courseIds = (userCourses ?? []).map((c) => c.id)
  console.log(`[resetTestUser] courses found: ${courseIds.length}`)

  if (courseIds.length > 0) {
    const { data: courseUnits } = await supabase
      .from('units')
      .select('id')
      .in('course_id', courseIds)

    const unitIds = (courseUnits ?? []).map((u) => u.id)
    console.log(`[resetTestUser] units found: ${unitIds.length}`)

    if (unitIds.length > 0) {
      const { data: unitLessons } = await supabase
        .from('lessons')
        .select('id')
        .in('unit_id', unitIds)

      const lessonIds = (unitLessons ?? []).map((l) => l.id)
      console.log(`[resetTestUser] lessons found: ${lessonIds.length}`)

      if (lessonIds.length > 0) {
        const { error: allFlashcardErr } = await supabase
          .from('flashcards')
          .delete()
          .in('lesson_id', lessonIds)
        if (allFlashcardErr) throw new Error(`resetTestUser: delete all flashcards failed: ${allFlashcardErr.message}`)
        console.log(`[resetTestUser] flashcards deleted`)
      }

      const { error: userFlashcardErr } = await supabase
        .from('flashcards')
        .delete()
        .eq('user_id', userId)
      if (userFlashcardErr) throw new Error(`resetTestUser: delete user flashcards failed: ${userFlashcardErr.message}`)

      const { error: lessonErr } = await supabase.from('lessons').delete().in('unit_id', unitIds)
      if (lessonErr) throw new Error(`resetTestUser: delete lessons failed: ${lessonErr.message}`)
      console.log(`[resetTestUser] lessons deleted`)
    }

    const { error: unitErr } = await supabase.from('units').delete().in('course_id', courseIds)
    if (unitErr) throw new Error(`resetTestUser: delete units failed: ${unitErr.message}`)
    console.log(`[resetTestUser] units deleted`)
  }

  const { error: courseErr } = await supabase.from('courses').delete().eq('user_id', userId)
  if (courseErr) throw new Error(`resetTestUser: delete courses failed: ${courseErr.message}`)
  console.log(`[resetTestUser] courses deleted`)

  const { error: placementErr } = await supabase.from('placements').delete().eq('user_id', userId)
  if (placementErr) throw new Error(`resetTestUser: delete placements failed: ${placementErr.message}`)

  const { error: knownErr } = await supabase.from('known_languages').delete().eq('user_id', userId)
  if (knownErr) throw new Error(`resetTestUser: delete known_languages failed: ${knownErr.message}`)

  const { error: learningErr } = await supabase.from('learning_languages').delete().eq('user_id', userId)
  if (learningErr) throw new Error(`resetTestUser: delete learning_languages failed: ${learningErr.message}`)

  console.log(`[resetTestUser] done — all user data cleared`)
}

export async function seedTestUserPrePlacement() {
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

  // Cascade delete: lessons → units → courses (no FK cascade in DB).
  // Sequential, not parallel, so each step completes before the next begins
  // and FK violations surface as thrown errors rather than silent failures.
  const { data: userCourses } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)

  const courseIds = (userCourses ?? []).map((c) => c.id)

  if (courseIds.length > 0) {
    const { data: courseUnits } = await supabase
      .from('units')
      .select('id')
      .in('course_id', courseIds)

    const unitIds = (courseUnits ?? []).map((u) => u.id)

    if (unitIds.length > 0) {
      const { data: unitLessons } = await supabase
        .from('lessons')
        .select('id')
        .in('unit_id', unitIds)

      const lessonIds = (unitLessons ?? []).map((l) => l.id)

      if (lessonIds.length > 0) {
        const { error: flashcardErr } = await supabase.from('flashcards').delete().in('lesson_id', lessonIds)
        if (flashcardErr) throw new Error(`seedTestUserPrePlacement: delete flashcards failed: ${flashcardErr.message}`)
      }

      const { error: lessonErr } = await supabase.from('lessons').delete().in('unit_id', unitIds)
      if (lessonErr) throw new Error(`seedTestUserPrePlacement: delete lessons failed: ${lessonErr.message}`)
    }

    const { error: unitErr } = await supabase.from('units').delete().in('course_id', courseIds)
    if (unitErr) throw new Error(`seedTestUserPrePlacement: delete units failed: ${unitErr.message}`)
  }

  const { error: courseErr } = await supabase.from('courses').delete().eq('user_id', userId)
  if (courseErr) throw new Error(`seedTestUserPrePlacement: delete courses failed: ${courseErr.message}`)

  const { error: placementErr } = await supabase.from('placements').delete().eq('user_id', userId)
  if (placementErr) throw new Error(`seedTestUserPrePlacement: delete placements failed: ${placementErr.message}`)

  const { error: langErr } = await supabase.from('learning_languages').delete().eq('user_id', userId)
  if (langErr) throw new Error(`seedTestUserPrePlacement: delete learning_languages failed: ${langErr.message}`)

  // Profile — name + native language marks onboarding complete in middleware
  await supabase
    .from('profiles')
    .update({ name: 'Test User', native_language_code: 'en' })
    .eq('id', userId)

  // Native language — middleware checks knownCount > 0 to skip onboarding redirect
  await supabase.from('known_languages').upsert(
    { user_id: userId, language_code: 'en', language_name: 'English', proficiency: 'C2' },
    { onConflict: 'user_id,language_code' }
  )

  // Learning language — Italian, no placement done, no course
  const { error: insertLangErr } = await supabase.from('learning_languages').insert({
    user_id: userId,
    language_code: 'it',
    language_name: 'Italian',
    cefr_level: 'A1',
    placement_completed: false,
  })
  if (insertLangErr) throw new Error(`seedTestUserPrePlacement: insert learning_language failed: ${insertLangErr.message}`)
}

// topic_key used for the seeded test unit and its curriculum vocabulary.
// A distinct key prevents collisions with real curriculum content.
const E2E_TOPIC_KEY = 'e2e_greetings'

// Pre-built sentence cards so the session flow (SessionDeck stage-1 multiple
// choice) works without any Anthropic generation calls.
const E2E_SENTENCE_CARDS = [
  {
    target_item: 'ciao',
    target_item_en: 'hello',
    english_sentence: 'Hello, how are you today?',
    english_sentence_with_marker: '[[Hello]], how are you today?',
    target_sentence: 'Ciao, come stai oggi?',
    correct_answer: 'ciao',
    distractors: ['grazie', 'arrivederci'],
  },
  {
    target_item: 'grazie',
    target_item_en: 'thank you',
    english_sentence: 'Thank you for the coffee.',
    english_sentence_with_marker: '[[Thank you]] for the coffee.',
    target_sentence: 'Grazie per il caffè.',
    correct_answer: 'grazie',
    distractors: ['ciao', 'arrivederci'],
  },
  {
    target_item: 'arrivederci',
    target_item_en: 'goodbye',
    english_sentence: 'Goodbye, see you tomorrow!',
    english_sentence_with_marker: '[[Goodbye]], see you tomorrow!',
    target_sentence: 'Arrivederci, a domani!',
    correct_answer: 'arrivederci',
    distractors: ['ciao', 'grazie'],
  },
] as const

// Child-first teardown of a set of courses (no FK cascades in the DB):
// flashcards / sentence_cards → lessons → units → courses.
async function deleteCourseTrees(supabase: SupabaseClient, courseIds: string[]) {
  if (courseIds.length === 0) return

  const { data: courseUnits } = await supabase
    .from('units')
    .select('id')
    .in('course_id', courseIds)

  const unitIds = (courseUnits ?? []).map((u) => u.id)

  if (unitIds.length > 0) {
    const { data: unitLessons } = await supabase
      .from('lessons')
      .select('id')
      .in('unit_id', unitIds)

    const lessonIds = (unitLessons ?? []).map((l) => l.id)

    if (lessonIds.length > 0) {
      const { data: lessonCards } = await supabase
        .from('sentence_cards')
        .select('id')
        .in('lesson_id', lessonIds)

      const cardIds = (lessonCards ?? []).map((c) => c.id)

      if (cardIds.length > 0) {
        const { error: fcCardErr } = await supabase
          .from('flashcards')
          .delete()
          .in('sentence_card_id', cardIds)
        if (fcCardErr) throw new Error(`deleteCourseTrees: delete flashcards by card failed: ${fcCardErr.message}`)
      }

      const { error: fcLessonErr } = await supabase
        .from('flashcards')
        .delete()
        .in('lesson_id', lessonIds)
      if (fcLessonErr) throw new Error(`deleteCourseTrees: delete flashcards failed: ${fcLessonErr.message}`)

      const { error: cardErr } = await supabase
        .from('sentence_cards')
        .delete()
        .in('lesson_id', lessonIds)
      if (cardErr) throw new Error(`deleteCourseTrees: delete sentence_cards failed: ${cardErr.message}`)

      const { error: lessonErr } = await supabase.from('lessons').delete().in('unit_id', unitIds)
      if (lessonErr) throw new Error(`deleteCourseTrees: delete lessons failed: ${lessonErr.message}`)
    }

    const { error: unitErr } = await supabase.from('units').delete().in('course_id', courseIds)
    if (unitErr) throw new Error(`deleteCourseTrees: delete units failed: ${unitErr.message}`)
  }

  const { error: courseErr } = await supabase.from('courses').delete().in('id', courseIds)
  if (courseErr) throw new Error(`deleteCourseTrees: delete courses failed: ${courseErr.message}`)
}

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

  // Check whether a valid course with at least one available lesson that has
  // sentence cards (the session flow's material) and no flashcards for the test
  // user already exists. If so, just ensure the profile/language rows are
  // correct and return early — skipping the rebuild avoids extra churn.
  const { data: existingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)
    .eq('language_code', 'it')
    .maybeSingle()

  if (existingCourse?.id) {
    const { data: existingUnits } = await supabase
      .from('units')
      .select('id')
      .eq('course_id', existingCourse.id)

    const unitIds = (existingUnits ?? []).map((u) => u.id)

    if (unitIds.length > 0) {
      const { data: availableLessons } = await supabase
        .from('lessons')
        .select('id')
        .in('unit_id', unitIds)
        .eq('status', 'available')
        .limit(1)

      const availableLessonId = availableLessons?.[0]?.id

      if (availableLessonId) {
        const { data: lessonCards } = await supabase
          .from('sentence_cards')
          .select('id')
          .eq('lesson_id', availableLessonId)
          .limit(50)

        const cardIds = (lessonCards ?? []).map((c) => c.id)

        let hasUnseenCards = false
        if (cardIds.length > 0) {
          const { data: userFlashcards } = await supabase
            .from('flashcards')
            .select('id')
            .eq('user_id', userId)
            .in('sentence_card_id', cardIds)
            .limit(1)
          hasUnseenCards = (userFlashcards ?? []).length === 0
        }

        if (hasUnseenCards) {
          // Valid course found — just keep profile and language rows up to date.
          await supabase
            .from('profiles')
            .update({ name: 'Test User', native_language_code: 'en' })
            .eq('id', userId)
          await supabase.from('known_languages').upsert(
            { user_id: userId, language_code: 'en', language_name: 'English', proficiency: 'C2' },
            { onConflict: 'user_id,language_code' }
          )
          await supabase.from('learning_languages').upsert(
            { user_id: userId, language_code: 'it', language_name: 'Italian', cefr_level: 'A1', placement_completed: true },
            { onConflict: 'user_id,language_code' }
          )
          console.log('[seedTestUserWithCourse] valid course already exists — skipping rebuild')
          return
        }
      }
    }
  }

  // No usable course — tear down whatever partial/consumed state exists so the
  // rebuild below is idempotent instead of accumulating units across runs.
  const { data: staleCourses } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)
  await deleteCourseTrees(supabase, (staleCourses ?? []).map((c) => c.id))

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
  const { data: lesson, error: lessonErr } = await supabase
    .from('lessons')
    .insert({
      unit_id: unit.id,
      type: 'vocabulary',
      title: 'Vocabulary: Greetings',
      order_index: 0,
      status: 'available',
      content: {},
    })
    .select('id')
    .single()

  if (lessonErr || !lesson) throw new Error(`Could not create lesson: ${lessonErr?.message}`)

  // Sentence cards — the material /api/session/next serves for the lesson.
  const { error: cardsErr } = await supabase.from('sentence_cards').insert(
    E2E_SENTENCE_CARDS.map((card) => ({
      lesson_id: lesson.id,
      language_code: 'it',
      cefr_level: 'A1',
      target_item: card.target_item,
      target_item_en: card.target_item_en,
      english_sentence: card.english_sentence,
      english_sentence_with_marker: card.english_sentence_with_marker,
      target_sentence: card.target_sentence,
      correct_answer: card.correct_answer,
      distractors: [...card.distractors],
      part_of_speech: 'interjection',
      topic_key: E2E_TOPIC_KEY,
      situation_context: 'Greeting people at a café',
      grammar_anchor: 'present_tense',
      cross_linguistic: { cognates: [], false_friends: [], partial: [] },
    }))
  )

  if (cardsErr) throw new Error(`Could not create sentence cards: ${cardsErr.message}`)
}
