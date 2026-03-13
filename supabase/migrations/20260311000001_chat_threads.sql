-- Chat threads table: one row per conversation session
create table if not exists public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New Chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Chat messages table: messages within a thread
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.chat_threads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null default '',
  -- Serialised SageResponse JSON for assistant messages
  response    jsonb,
  -- Optional voice metadata
  voice       jsonb,
  -- Optional receipt metadata (file name only, not the blob)
  receipt     jsonb,
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists chat_threads_user_id_idx   on public.chat_threads(user_id, updated_at desc);
create index if not exists chat_messages_thread_id_idx on public.chat_messages(thread_id, created_at asc);

-- Auto-bump updated_at on the parent thread when a message is inserted
create or replace function public.touch_thread_updated_at()
returns trigger language plpgsql as $$
begin
  update public.chat_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_thread on public.chat_messages;
create trigger trg_touch_thread
  after insert on public.chat_messages
  for each row execute function public.touch_thread_updated_at();

-- Row-level security
alter table public.chat_threads  enable row level security;
alter table public.chat_messages enable row level security;

-- Policies: users can only access their own rows
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'chat_threads' and policyname = 'threads: owner only'
  ) then
    execute 'create policy "threads: owner only" on public.chat_threads for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'chat_messages' and policyname = 'messages: owner only'
  ) then
    execute 'create policy "messages: owner only" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
