-- ==============================================================
-- 021: Video becomes an inline content block (drop lessons.video_url),
-- quizzes become a standalone, reusable library (drop quizzes.lesson_id).
-- ==============================================================

-- ----------------------------------------------------------------
-- 1. Fold any existing video_url into a leading content marker before
--    dropping the column, so no data is lost.
-- ----------------------------------------------------------------
UPDATE public.lessons
SET content = '<!-- VIDEO:' || video_url || ' -->' || E'\n\n' || COALESCE(content, '')
WHERE video_url IS NOT NULL AND video_url <> '';

ALTER TABLE public.lessons DROP COLUMN IF EXISTS video_url;

-- ----------------------------------------------------------------
-- 2. Quizzes are no longer owned by a single lesson — they're a
--    reusable library, referenced from lesson content via
--    <!-- QUIZ:<quiz_id> --> markers instead of a foreign key.
-- ----------------------------------------------------------------
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_lesson_id_fkey;
ALTER TABLE public.quizzes DROP COLUMN IF EXISTS lesson_id;
