-- Automatically synchronize new Supabase auth.users entries into public.users
-- This ensures foreign key constraints (e.g. applications.user_id -> users.id) are always satisfied immediately upon signup.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, skills, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'user-' || substring(NEW.id::text, 1, 8) || '@jobcopilot.local'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Job Candidate'),
    ARRAY[]::TEXT[],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger execution after insert on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
