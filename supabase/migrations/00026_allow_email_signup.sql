-- 00026_allow_email_signup.sql
-- Allow users to sign up with email (phone may be null for email-based signups)

-- Make phone nullable so email-only users can exist
ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;

-- Update the trigger to handle both phone and email signups
-- Must use explicit public schema and SET search_path because GoTrue
-- runs with a restricted search_path that excludes public
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email)
  VALUES (NEW.id, NEW.phone, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
