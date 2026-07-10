-- ==============================================================
-- 019: Lesson attachments (downloadable files) + interactive quizzes
-- ==============================================================

-- ----------------------------------------------------------------
-- 1. Lesson attachments
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_attachments_lesson_id ON public.lesson_attachments(lesson_id);

ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to lesson_attachments" ON public.lesson_attachments;
CREATE POLICY "Admins full access to lesson_attachments"
    ON public.lesson_attachments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view attachments of visible lessons" ON public.lesson_attachments;
CREATE POLICY "Students can view attachments of visible lessons"
    ON public.lesson_attachments FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_attachments.lesson_id)
    );

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-files', 'lesson-files', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ----------------------------------------------------------------
-- 2. Quizzes — admin-only RLS on all content tables. Students never
--    read quizzes/quiz_questions/quiz_options directly; all
--    student-facing reads go through /api/quiz/[lessonId] (service-role
--    client, strips is_correct before the response leaves the server).
--    This avoids a column-level leak: RLS is row-only, and admin/student
--    share the same Postgres role, so a row-visible policy on
--    quiz_options would expose is_correct to any direct REST call.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question_id ON public.quiz_options(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to quizzes" ON public.quizzes;
CREATE POLICY "Admins full access to quizzes" ON public.quizzes FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins full access to quiz_questions" ON public.quiz_questions;
CREATE POLICY "Admins full access to quiz_questions" ON public.quiz_questions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins full access to quiz_options" ON public.quiz_options;
CREATE POLICY "Admins full access to quiz_options" ON public.quiz_options FOR ALL USING (public.is_admin());

-- Students may read (never write) their own attempt row directly.
-- All writes go through /api/quiz/submit via the service-role client so
-- a self-computed score can never be POSTed straight into this table.
DROP POLICY IF EXISTS "Students can view own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can view own quiz attempts"
    ON public.quiz_attempts FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access to quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "Admins full access to quiz_attempts"
    ON public.quiz_attempts FOR ALL USING (public.is_admin());
