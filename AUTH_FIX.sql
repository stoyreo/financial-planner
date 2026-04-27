-- Supabase Auth Fix - Run this in Supabase SQL Editor
-- Database: Financial 101 project (https://qmuvdpnnpptfrinhnzlv.supabase.co)
--
-- This adds the auth_user_id column linking app_users to Supabase Auth users

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON public.app_users(auth_user_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_users'
  AND column_name = 'auth_user_id';
