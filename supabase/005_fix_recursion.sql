-- ==============================================
-- Migration 005: Fix RLS Infinite Recursion
-- ==============================================

-- 1. Fix the is_admin function by using plpgsql.
-- This prevents PostgreSQL from inlining the function and guarantees 
-- it runs in the SECURITY DEFINER context (bypassing RLS recursion).
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

-- 2. Simplify courses SELECT policy (remove redundant profiles check)
DROP POLICY IF EXISTS "Students can view accessible courses if approved" ON public.courses;
CREATE POLICY "Students can view accessible courses" 
    ON public.courses FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.courses.id)
    );

-- 3. Simplify topics SELECT policy
DROP POLICY IF EXISTS "Students can view published topics of accessible courses if approved" ON public.topics;
CREATE POLICY "Students can view accessible topics" 
    ON public.topics FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = auth.uid() AND course_id = public.topics.course_id)
    );

-- 4. Simplify lessons SELECT policy
DROP POLICY IF EXISTS "Students can view published lessons of accessible courses if approved" ON public.lessons;
CREATE POLICY "Students can view accessible lessons" 
    ON public.lessons FOR SELECT 
    USING (
        is_published = true AND 
        EXISTS (
            SELECT 1 FROM public.topics t 
            JOIN public.user_courses uc ON t.course_id = uc.course_id 
            WHERE t.id = public.lessons.topic_id AND uc.user_id = auth.uid()
        )
    );
