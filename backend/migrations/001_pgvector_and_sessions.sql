-- ============================================================
-- Spenny AI — Phase 2: pgvector + sage_sessions
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Enable pgvector extension (free, included in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to expenses for semantic search
--    Using 768 dimensions (nomic-embed-text / llama embeddings)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create an IVFFlat index for fast approximate nearest-neighbour search
--    (run AFTER backfilling embeddings — costs more build time but faster queries)
-- CREATE INDEX IF NOT EXISTS expenses_embedding_idx
--   ON expenses USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- 4. Conversation memory table
CREATE TABLE IF NOT EXISTS sage_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  thread_id   text NOT NULL DEFAULT '',
  messages    jsonb NOT NULL DEFAULT '[]',
  summary     text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE sage_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their sessions"
  ON sage_sessions FOR ALL
  USING (auth.uid() = user_id);

-- 5. Helper: updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sage_sessions_updated_at
  BEFORE UPDATE ON sage_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. pgvector similarity search function (used by query tool for semantic search)
CREATE OR REPLACE FUNCTION match_expenses(
  query_embedding vector(768),
  p_user_id      uuid,
  match_count    int DEFAULT 20,
  match_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  id          uuid,
  date        timestamptz,
  description text,
  category    text,
  amount      numeric,
  similarity  float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.date,
    e.description,
    e.category,
    e.amount,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM expenses e
  WHERE e.user_id = p_user_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
