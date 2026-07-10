-- ==============================================================
-- Consolidated fresh schema (replaces replaying 001-018 by hand)
-- Generated from the final state of migrations 001-018, schema
-- statements only — no legacy course/lesson content included.
-- Idempotent: safe to re-run.
-- ==============================================================

-- ----------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    gradient TEXT DEFAULT 'from-blue-500 to-indigo-500',
    is_published BOOLEAN DEFAULT false,
    sequential_access BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'BookOpen',
    gradient TEXT DEFAULT 'from-lime-500 to-emerald-500',
    sort_order INTEGER DEFAULT 0,
    block_name TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    video_url TEXT,
    sort_order INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    block_name TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT true,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.user_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.user_lesson_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- ----------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_lessons_topic_id ON public.lessons(topic_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON public.progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson_id ON public.progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_topics_sort_order ON public.topics(sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_sort_order ON public.lessons(sort_order);
CREATE INDEX IF NOT EXISTS idx_user_lesson_access_user_id ON public.user_lesson_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_access_lesson_id ON public.user_lesson_access(lesson_id);

-- ----------------------------------------------------------------
-- 3. Functions & triggers
-- ----------------------------------------------------------------

-- Admin check, SECURITY DEFINER + plpgsql to avoid RLS self-recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Auto-create profile row (with email) on new auth signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent non-admins from self-approving or self-promoting; backend/SQL Editor
-- writes (auth.uid() IS NULL) and admin writes pass through untouched.
CREATE OR REPLACE FUNCTION public.check_profile_update() RETURNS trigger AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    ELSE
        NEW.role = OLD.role;
        NEW.is_approved = OLD.is_approved;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_profile_security ON public.profiles;
CREATE TRIGGER ensure_profile_security
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();

-- ----------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_access ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.profiles FOR UPDATE USING (public.is_admin());

-- Courses
DROP POLICY IF EXISTS "Admins can do everything on courses" ON public.courses;
CREATE POLICY "Admins can do everything on courses"
    ON public.courses FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view accessible courses" ON public.courses;
CREATE POLICY "Students can view accessible courses"
    ON public.courses FOR SELECT
    USING (
        is_published = true AND
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.courses.id)
    );

-- Topics
DROP POLICY IF EXISTS "Admins full access to topics" ON public.topics;
DROP POLICY IF EXISTS "Admins can view all topics" ON public.topics;
CREATE POLICY "Admins full access to topics"
    ON public.topics FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view accessible topics" ON public.topics;
CREATE POLICY "Students can view accessible topics"
    ON public.topics FOR SELECT
    USING (
        is_published = true AND
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.topics.course_id)
    );

-- Lessons
DROP POLICY IF EXISTS "Admins full access to lessons" ON public.lessons;
DROP POLICY IF EXISTS "Admins can view all lessons" ON public.lessons;
CREATE POLICY "Admins full access to lessons"
    ON public.lessons FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view lessons with proper access" ON public.lessons;
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
        (
            NOT EXISTS (
                SELECT 1 FROM public.topics t2
                JOIN public.courses c ON t2.course_id = c.id
                WHERE t2.id = public.lessons.topic_id AND c.sequential_access = true
            )
            OR public.lessons.sort_order = 1
            OR EXISTS (
                SELECT 1 FROM public.user_lesson_access ula
                WHERE ula.user_id = auth.uid() AND ula.lesson_id = public.lessons.id
            )
        )
    );

-- Progress
DROP POLICY IF EXISTS "Users manage own progress" ON public.progress;
CREATE POLICY "Users manage own progress"
    ON public.progress FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all progress" ON public.progress;
CREATE POLICY "Admins can view all progress"
    ON public.progress FOR SELECT USING (public.is_admin());

-- User courses
DROP POLICY IF EXISTS "Admins can do everything on user_courses" ON public.user_courses;
CREATE POLICY "Admins can do everything on user_courses"
    ON public.user_courses FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own accesses" ON public.user_courses;
CREATE POLICY "Students can view their own accesses"
    ON public.user_courses FOR SELECT USING (user_id = auth.uid());

-- User lesson access
DROP POLICY IF EXISTS "Admins can do everything on user_lesson_access" ON public.user_lesson_access;
CREATE POLICY "Admins can do everything on user_lesson_access"
    ON public.user_lesson_access FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own lesson accesses" ON public.user_lesson_access;
CREATE POLICY "Students can view their own lesson accesses"
    ON public.user_lesson_access FOR SELECT USING (user_id = auth.uid());

-- ----------------------------------------------------------------
-- 5. Storage
-- ----------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-images', 'lesson-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
