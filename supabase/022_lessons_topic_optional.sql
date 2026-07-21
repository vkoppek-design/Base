-- ==============================================================
-- 022: Lessons can now be created without a topic — they're assigned
-- to a topic later from the topic editor, instead of picked at lesson
-- creation time.
-- ==============================================================

ALTER TABLE public.lessons ALTER COLUMN topic_id DROP NOT NULL;
