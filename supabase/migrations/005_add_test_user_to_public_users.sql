/**
 * Migration: Add test user to public.users table
 *
 * Creates the test user record in the public.users table so that the Mail Agent
 * can successfully create applications. This user matches the test user created
 * in auth.users by migration 004.
 *
 * Test User UUID: 00000000-0000-0000-0000-000000000001
 * Email: test@example.com
 */

-- Insert test user into public.users table
insert into public.users (
  id,
  email,
  full_name,
  profile_picture_url,
  bio,
  skills,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  'test@example.com',
  'Test User',
  null,
  null,
  ARRAY[]::text[],
  now(),
  now()
where not exists (
  select 1 from public.users where id = '00000000-0000-0000-0000-000000000001'::uuid
);
