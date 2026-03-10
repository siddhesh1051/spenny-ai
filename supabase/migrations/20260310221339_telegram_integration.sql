-- Migration: Telegram Integration
-- Run this in your Supabase SQL editor

-- 1. Add telegram_chat_id to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

-- 2. Index for fast lookups by telegram_chat_id (used in webhook)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_idx
ON profiles (telegram_chat_id)
WHERE telegram_chat_id IS NOT NULL;

-- 3. Table for one-time link tokens (10-minute expiry)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_link_tokens_token_idx ON telegram_link_tokens (token);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_id_idx ON telegram_link_tokens (user_id);

-- 4. Table for multi-step export state (mirrors whatsapp_export_state)
CREATE TABLE IF NOT EXISTS telegram_export_state (
  chat_id   BIGINT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step      INTEGER NOT NULL DEFAULT 1,
  date_from TEXT,
  date_to   TEXT,
  format    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RLS policies — service role bypasses RLS, but lock down anon access
ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_export_state ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write these tables
CREATE POLICY "service_role_only_link_tokens"
  ON telegram_link_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_export_state"
  ON telegram_export_state FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Auto-cleanup: delete expired/used tokens older than 1 day
-- (optional cron or manual cleanup)
-- You can set up a pg_cron job:
-- SELECT cron.schedule('cleanup-telegram-tokens', '0 * * * *',
--   $$DELETE FROM telegram_link_tokens WHERE expires_at < NOW() - INTERVAL '1 day'$$);
