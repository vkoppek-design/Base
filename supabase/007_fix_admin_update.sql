-- Disable the trigger temporarily
ALTER TABLE public.profiles DISABLE TRIGGER ensure_profile_security;

-- Update the user
UPDATE public.profiles SET role = 'admin', is_approved = true;

-- Update the trigger function to allow backend/SQL editor updates!
CREATE OR REPLACE FUNCTION public.check_profile_update() RETURNS trigger AS $$
BEGIN
    -- Allow if it's the backend (auth.uid is null) OR if the user is an admin
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    ELSE
        -- Force the sensitive fields to remain unchanged for regular users
        NEW.role = OLD.role;
        NEW.is_approved = OLD.is_approved;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable the trigger
ALTER TABLE public.profiles ENABLE TRIGGER ensure_profile_security;
