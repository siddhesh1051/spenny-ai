-- Per-thread auto-incrementing seq so messages always load in insert order,
-- regardless of created_at timestamp precision.
alter table public.chat_messages
  add column if not exists seq integer;

create or replace function public.set_message_seq()
returns trigger language plpgsql as $$
begin
  select coalesce(max(seq), 0) + 1
    into new.seq
    from public.chat_messages
   where thread_id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_set_message_seq on public.chat_messages;
create trigger trg_set_message_seq
  before insert on public.chat_messages
  for each row execute function public.set_message_seq();
