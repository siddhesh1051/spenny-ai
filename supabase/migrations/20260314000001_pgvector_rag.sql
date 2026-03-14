-- Enable pgvector extension for RAG embeddings
create extension if not exists vector;

-- Add embedding column to chat_messages for semantic search
alter table chat_messages
  add column if not exists embedding vector(768);

-- HNSW index for fast approximate nearest-neighbor search
create index if not exists chat_messages_embedding_hnsw
  on chat_messages using hnsw (embedding vector_cosine_ops);

-- Add embedding column to expenses for semantic expense search
alter table expenses
  add column if not exists embedding vector(768);

create index if not exists expenses_embedding_hnsw
  on expenses using hnsw (embedding vector_cosine_ops);

-- Helper function: find semantically similar chat messages for a user
create or replace function match_chat_messages(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (
  id uuid,
  content text,
  role text,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cm.id,
    cm.content,
    cm.role,
    cm.created_at,
    1 - (cm.embedding <=> query_embedding) as similarity
  from chat_messages cm
  where cm.user_id = match_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by cm.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Helper function: find semantically similar expenses for a user
create or replace function match_expenses(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 10,
  match_threshold float default 0.6
)
returns table (
  id uuid,
  description text,
  category text,
  amount numeric,
  date timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    e.id,
    e.description,
    e.category,
    e.amount,
    e.date,
    1 - (e.embedding <=> query_embedding) as similarity
  from expenses e
  where e.user_id = match_user_id
    and e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;
