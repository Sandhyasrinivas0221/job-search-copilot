/**
 * Migration: Create test user for development
 *
 * Creates a test user in the auth.users table for local development and testing.
 * This allows the email credentials table foreign key constraint to work.
 */

-- Create a test user with a fixed UUID
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
select
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test@example.com',
  crypt('test-password-123', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  'authenticated'
where not exists (
  select 1 from auth.users where id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Insert a test identity for the test user
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '{"sub":"00000000-0000-0000-0000-000000000001"}'::jsonb,
  'email',
  'test@example.com',
  now(),
  now(),
  now()
where not exists (
  select 1 from auth.identities where user_id = '00000000-0000-0000-0000-000000000001'::uuid and provider = 'email'
);
