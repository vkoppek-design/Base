-- ==============================================
-- Migration 006: Bulletproof Recursion Fix
-- ==============================================

-- 1. Drop the problematic SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. Create a single, simple SELECT policy that does NOT use is_admin()
-- This breaks the infinite loop forever. Any logged-in user can fetch profiles
-- (which only contain public info like name and avatar anyway).
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles FOR SELECT 
USING (auth.role() = 'authenticated');
