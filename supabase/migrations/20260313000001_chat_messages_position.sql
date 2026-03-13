-- Add position column to chat_messages so user/assistant ordering is
-- deterministic even when both rows are inserted within the same millisecond.
alter table public.chat_messages
  add column if not exists position integer;

-- Add a per-thread sequence using a bigserial-style default:
-- seq is set by a BEFORE INSERT trigger so every new message in a thread
-- gets the next integer automatically, no client coordination needed.
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

alter table public.chat_messages
  add column if not exists seq integer;

drop trigger if exists trg_set_message_seq on public.chat_messages;
create trigger trg_set_message_seq
  before insert on public.chat_messages
  for each row execute function public.set_message_seq();
