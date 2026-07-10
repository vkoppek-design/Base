-- =========================================================================
-- Migration 015: Neurocontent Course + Sequential Lesson Access
-- «Нейроконтент и продвижение в соцсетях» — Образовательный центр Belhard
-- =========================================================================

-- 1. Add sequential_access flag to courses
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS sequential_access BOOLEAN DEFAULT false;

-- 2. Create user_lesson_access table for per-lesson access control
CREATE TABLE IF NOT EXISTS public.user_lesson_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- Indexes for user_lesson_access
CREATE INDEX IF NOT EXISTS idx_user_lesson_access_user_id ON public.user_lesson_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_access_lesson_id ON public.user_lesson_access(lesson_id);

-- RLS for user_lesson_access
ALTER TABLE public.user_lesson_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on user_lesson_access" ON public.user_lesson_access;
CREATE POLICY "Admins can do everything on user_lesson_access"
    ON public.user_lesson_access FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own lesson accesses" ON public.user_lesson_access;
CREATE POLICY "Students can view their own lesson accesses"
    ON public.user_lesson_access FOR SELECT
    USING (user_id = auth.uid());

-- 3. Create the new course
INSERT INTO public.courses (id, title, description, gradient, is_published, sequential_access)
VALUES (
    'aa0e8400-e29b-41d4-a716-446655440001',
    'Нейроконтент и продвижение в соцсетях',
    'Курс для студентов образовательного центра «Belhard». Создание контента с помощью нейросетей: от идей и текстов до видео, аватаров и автоматизации продаж.',
    'from-pink-500 to-violet-500',
    true,
    true
) ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    gradient = EXCLUDED.gradient,
    is_published = EXCLUDED.is_published,
    sequential_access = EXCLUDED.sequential_access;

-- 4. Create a single topic for the course (used as a container for the 8 lessons)
INSERT INTO public.topics (id, course_id, title, description, icon, gradient, sort_order, is_published)
VALUES (
    'bb0e8400-e29b-41d4-a716-446655440001',
    'aa0e8400-e29b-41d4-a716-446655440001',
    'Нейроконтент и продвижение',
    'Полная программа курса: 8 занятий по созданию контента с нейросетями',
    'Sparkles',
    'from-pink-500 to-violet-500',
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    gradient = EXCLUDED.gradient,
    sort_order = EXCLUDED.sort_order,
    is_published = EXCLUDED.is_published;

-- 5. Create 8 lessons
INSERT INTO public.lessons (id, topic_id, title, content, sort_order, duration_minutes, is_published, block_name) VALUES

-- Урок 1
('cc0e8400-e29b-41d4-a716-446655440001',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'ИИ-фундамент и генерация идей: собираем рабочую систему',
 NULL, 1, 90, true, NULL),

-- Урок 2
('cc0e8400-e29b-41d4-a716-446655440002',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Позиционирование и смыслы блога',
 NULL, 2, 90, true, NULL),

-- Урок 3
('cc0e8400-e29b-41d4-a716-446655440003',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Промпт-инжиниринг и создание личных ИИ-помощников',
 NULL, 3, 90, true, NULL),

-- Урок 4
('cc0e8400-e29b-41d4-a716-446655440004',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Создание качественных изображений в нейросетях',
 NULL, 4, 90, true, NULL),

-- Урок 5
('cc0e8400-e29b-41d4-a716-446655440005',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Создание вовлекающих нейровидео',
 NULL, 5, 90, true, NULL),

-- Урок 6
('cc0e8400-e29b-41d4-a716-446655440006',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Создание AI-аватара для видео',
 NULL, 6, 90, true, NULL),

-- Урок 7
('cc0e8400-e29b-41d4-a716-446655440007',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Динамичный монтаж видео с помощью ИИ',
 NULL, 7, 90, true, NULL),

-- Урок 8
('cc0e8400-e29b-41d4-a716-446655440008',
 'bb0e8400-e29b-41d4-a716-446655440001',
 'Превращение просмотров в заявки',
 NULL, 8, 90, true, NULL)

ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    sort_order = EXCLUDED.sort_order,
    duration_minutes = EXCLUDED.duration_minutes,
    is_published = EXCLUDED.is_published,
    block_name = EXCLUDED.block_name;

-- 6. Update RLS on lessons to also check user_lesson_access for sequential courses
-- Drop the existing student SELECT policy for lessons and recreate it
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lessons' AND cmd = 'SELECT' AND policyname LIKE '%Students%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.lessons', pol.policyname);
    END LOOP;
END
$$;

-- New lessons SELECT policy: for sequential courses, also require user_lesson_access
CREATE POLICY "Students can view lessons with proper access"
    ON public.lessons FOR SELECT
    USING (
        is_published = true AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true) AND
        EXISTS (
            SELECT 1 FROM public.topics t
            JOIN public.user_courses uc ON t.course_id = uc.course_id
            WHERE t.id = public.lessons.topic_id AND uc.user_id = auth.uid()
        ) AND
        -- For sequential access courses, additionally check user_lesson_access
        (
            NOT EXISTS (
                SELECT 1 FROM public.topics t2
                JOIN public.courses c ON t2.course_id = c.id
                WHERE t2.id = public.lessons.topic_id AND c.sequential_access = true
            )
            OR
            public.lessons.sort_order = 1
            OR
            EXISTS (
                SELECT 1 FROM public.user_lesson_access ula
                WHERE ula.user_id = auth.uid() AND ula.lesson_id = public.lessons.id
            )
        )
    );
