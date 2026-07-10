-- ==============================================
-- Migration 004: Admin, Approval, and Courses
-- ==============================================

-- 1. Add is_approved to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Approve all existing users so they don't get locked out
UPDATE public.profiles SET is_approved = true;

-- Security trigger to prevent students from approving themselves or making themselves admins
CREATE OR REPLACE FUNCTION public.check_profile_update() RETURNS trigger AS $$
BEGIN
    -- If the user making the update is NOT an admin
    IF NOT public.is_admin() THEN
        -- Force the sensitive fields to remain unchanged
        NEW.role = OLD.role;
        NEW.is_approved = OLD.is_approved;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_profile_security ON public.profiles;
CREATE TRIGGER ensure_profile_security
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();

-- 2. Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    gradient TEXT DEFAULT 'from-blue-500 to-indigo-500',
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the Main Course
INSERT INTO public.courses (id, title, description, gradient, is_published)
VALUES (
    '880e8400-e29b-41d4-a716-446655440001',
    'Основной курс "Нейросети"',
    'Полная программа обучения: от промпт-инжиниринга до создания ИИ-агентов.',
    'from-lime-500 to-emerald-500',
    true
) ON CONFLICT (id) DO NOTHING;

-- 3. Add course_id to topics
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE;

-- Assign all existing topics to the Main Course
UPDATE public.topics SET course_id = '880e8400-e29b-41d4-a716-446655440001' WHERE course_id IS NULL;

-- Make course_id NOT NULL after setting defaults
ALTER TABLE public.topics ALTER COLUMN course_id SET NOT NULL;

-- 4. Create user_courses table for individual access
CREATE TABLE IF NOT EXISTS public.user_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- Grant all existing users access to the Main Course
INSERT INTO public.user_courses (user_id, course_id)
SELECT id, '880e8400-e29b-41d4-a716-446655440001' FROM public.profiles
ON CONFLICT (user_id, course_id) DO NOTHING;

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Courses RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on courses" 
    ON public.courses FOR ALL USING (public.is_admin());

CREATE POLICY "Students can view accessible courses if approved" 
    ON public.courses FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true) AND
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.courses.id)
    );

-- User Courses RLS
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on user_courses" 
    ON public.user_courses FOR ALL USING (public.is_admin());

CREATE POLICY "Students can view their own accesses" 
    ON public.user_courses FOR SELECT 
    USING (user_id = auth.uid());

-- Rebuild Topics RLS
-- First, drop existing SELECT policies for topics
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'topics' AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.topics', pol.policyname);
    END LOOP;
END
$$;

-- Create new robust SELECT policy for topics
CREATE POLICY "Admins can view all topics" 
    ON public.topics FOR ALL USING (public.is_admin());

CREATE POLICY "Students can view published topics of accessible courses if approved" 
    ON public.topics FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true) AND
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.topics.course_id)
    );

-- Rebuild Lessons RLS
-- First, drop existing SELECT policies for lessons
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'lessons' AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.lessons', pol.policyname);
    END LOOP;
END
$$;

-- Create new robust SELECT policy for lessons
CREATE POLICY "Admins can view all lessons" 
    ON public.lessons FOR ALL USING (public.is_admin());

CREATE POLICY "Students can view published lessons of accessible courses if approved" 
    ON public.lessons FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = true) AND
        EXISTS (
            SELECT 1 FROM public.topics t 
            JOIN public.user_courses uc ON t.course_id = uc.course_id 
            WHERE t.id = public.lessons.topic_id AND uc.user_id = auth.uid()
        )
    );

-- Also add Admin policy for updating profiles (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update all profiles') THEN
        CREATE POLICY "Admins can update all profiles" 
            ON public.profiles FOR UPDATE USING (public.is_admin());
    END IF;
END
$$;
