-- ==============================================================
-- 023: Course-defined structure.
-- Topics become a reusable library; a course composes topics (ordered)
-- and, within each, a chosen subset of lessons (ordered). Per-lesson
-- manual access grants are removed — course enrollment grants all of a
-- course's content, and sequential progression is gated client-side by
-- the course order.
-- ==============================================================

-- ----------------------------------------------------------------
-- 1. Join tables
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id  UUID NOT NULL REFERENCES public.topics(id)  ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    block_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, topic_id)
);

CREATE TABLE IF NOT EXISTS public.course_topic_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_topic_id UUID NOT NULL REFERENCES public.course_topics(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(course_topic_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_course_topics_course_id ON public.course_topics(course_id);
CREATE INDEX IF NOT EXISTS idx_course_topics_topic_id ON public.course_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_course_topic_lessons_ct ON public.course_topic_lessons(course_topic_id);
CREATE INDEX IF NOT EXISTS idx_course_topic_lessons_lesson ON public.course_topic_lessons(lesson_id);

-- ----------------------------------------------------------------
-- 2. Migrate existing data into the join tables (idempotent).
--    Only runs while the old columns still exist.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'course_id'
  ) THEN
    -- One course_topics row per existing topic, from its owning course.
    INSERT INTO public.course_topics (course_id, topic_id, sort_order, block_name)
    SELECT t.course_id, t.id, COALESCE(t.sort_order, 0), t.block_name
    FROM public.topics t
    WHERE t.course_id IS NOT NULL
    ON CONFLICT (course_id, topic_id) DO NOTHING;

    -- All of each topic's existing lessons, under the matching course_topic.
    INSERT INTO public.course_topic_lessons (course_topic_id, lesson_id, sort_order)
    SELECT ct.id, l.id, COALESCE(l.sort_order, 0)
    FROM public.lessons l
    JOIN public.topics t ON t.id = l.topic_id
    JOIN public.course_topics ct ON ct.topic_id = t.id AND ct.course_id = t.course_id
    ON CONFLICT (course_topic_id, lesson_id) DO NOTHING;
  END IF;
END
$$;

-- ----------------------------------------------------------------
-- 3. Drop the now-obsolete coupling columns and per-lesson access table.
--    The old RLS policies reference topics.course_id, so drop them first.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view accessible topics" ON public.topics;
DROP POLICY IF EXISTS "Students can view lessons with proper access" ON public.lessons;

ALTER TABLE public.topics DROP COLUMN IF EXISTS course_id;
ALTER TABLE public.topics DROP COLUMN IF EXISTS sort_order;
ALTER TABLE public.topics DROP COLUMN IF EXISTS block_name;

DROP TABLE IF EXISTS public.user_lesson_access CASCADE;

-- ----------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------
ALTER TABLE public.course_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_topic_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to course_topics" ON public.course_topics;
CREATE POLICY "Admins full access to course_topics"
    ON public.course_topics FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view course_topics of accessible courses" ON public.course_topics;
CREATE POLICY "Students can view course_topics of accessible courses"
    ON public.course_topics FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.user_courses uc WHERE uc.user_id = auth.uid() AND uc.course_id = course_topics.course_id)
    );

DROP POLICY IF EXISTS "Admins full access to course_topic_lessons" ON public.course_topic_lessons;
CREATE POLICY "Admins full access to course_topic_lessons"
    ON public.course_topic_lessons FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view course_topic_lessons of accessible courses" ON public.course_topic_lessons;
CREATE POLICY "Students can view course_topic_lessons of accessible courses"
    ON public.course_topic_lessons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.course_topics ct
            JOIN public.user_courses uc ON uc.course_id = ct.course_id
            WHERE ct.id = course_topic_lessons.course_topic_id AND uc.user_id = auth.uid()
        )
    );

-- Topics: no longer course-scoped. Approved students may read published
-- topics (needed to render course structure); admins full access.
DROP POLICY IF EXISTS "Students can view accessible topics" ON public.topics;
DROP POLICY IF EXISTS "Admins full access to topics" ON public.topics;
DROP POLICY IF EXISTS "Admins can view all topics" ON public.topics;
CREATE POLICY "Admins full access to topics"
    ON public.topics FOR ALL USING (public.is_admin());
CREATE POLICY "Students can view published topics"
    ON public.topics FOR SELECT
    USING (
        is_published = true AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true)
    );

-- Lessons: readable when published, the student is approved, and the lesson
-- is reachable through a course they're enrolled in. Sequential unlocking is
-- enforced client-side by course order, not here.
DROP POLICY IF EXISTS "Students can view lessons with proper access" ON public.lessons;
CREATE POLICY "Students can view lessons with proper access"
    ON public.lessons FOR SELECT
    USING (
        is_published = true AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true) AND
        EXISTS (
            SELECT 1 FROM public.course_topic_lessons ctl
            JOIN public.course_topics ct ON ct.id = ctl.course_topic_id
            JOIN public.user_courses uc ON uc.course_id = ct.course_id
            WHERE ctl.lesson_id = lessons.id AND uc.user_id = auth.uid()
        )
    );
