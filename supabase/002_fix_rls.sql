-- Create a security definer function to bypass RLS when checking admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Update profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- Update topics policies
DROP POLICY IF EXISTS "Admins full access to topics" ON public.topics;
CREATE POLICY "Admins full access to topics"
    ON public.topics FOR ALL
    USING (public.is_admin());

-- Update lessons policies
DROP POLICY IF EXISTS "Admins full access to lessons" ON public.lessons;
CREATE POLICY "Admins full access to lessons"
    ON public.lessons FOR ALL
    USING (public.is_admin());

-- Update progress policies
DROP POLICY IF EXISTS "Admins can view all progress" ON public.progress;
CREATE POLICY "Admins can view all progress"
    ON public.progress FOR SELECT
    USING (public.is_admin());
