-- ============================================================
-- GARAGE — Supabase Database Schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/<your-project>/sql
-- ============================================================

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  status      text        NOT NULL DEFAULT 'todo'
                          CHECK (status IN ('todo', 'inprogress', 'done')),
  github_url  text,
  position    integer     NOT NULL DEFAULT 0,
  created_by  uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Row-Level Security: only authenticated users can read/write
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users — full access"
  ON cards
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Enable Realtime for live sync between both users
ALTER PUBLICATION supabase_realtime ADD TABLE cards;

-- Optional: index for fast status-based queries
CREATE INDEX IF NOT EXISTS idx_cards_status_position
  ON cards (status, position);
