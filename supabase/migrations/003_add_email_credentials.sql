/**
 * Migration: Add email credentials table
 *
 * Stores user email connection settings (Gmail OAuth or SMTP)
 */

-- Create email_credentials table
create table if not exists email_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('gmail', 'smtp')), -- 'gmail' or 'smtp'
  email_address text not null,

  -- Gmail OAuth fields
  gmail_refresh_token text, -- Encrypted
  gmail_access_token text, -- Encrypted
  gmail_token_expiry timestamptz,

  -- SMTP fields
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text, -- Encrypted
  smtp_use_tls boolean default true,

  -- Status
  is_connected boolean default true,
  last_verified_at timestamptz,
  error_message text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, provider)
);

-- Add indexes
create index if not exists idx_email_credentials_user_id on email_credentials(user_id);
create index if not exists idx_email_credentials_provider on email_credentials(provider);

-- Add RLS (Row Level Security)
alter table email_credentials enable row level security;

create policy "Users can view their own email credentials"
  on email_credentials for select
  using (auth.uid() = user_id);

create policy "Users can insert their own email credentials"
  on email_credentials for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own email credentials"
  on email_credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own email credentials"
  on email_credentials for delete
  using (auth.uid() = user_id);
