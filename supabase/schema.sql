-- DHA standalone app: one JSON document per (user, key), the same shape the claude.ai
-- version stored (todos, ddays, habits, sleep, budget, expenses-YYYY-MM, j-YYYY-MM-DD,
-- news, summary). Row Level Security keeps every row private to its owner.
create table if not exists public.docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.docs enable row level security;

drop policy if exists "own docs: read" on public.docs;
drop policy if exists "own docs: insert" on public.docs;
drop policy if exists "own docs: update" on public.docs;
drop policy if exists "own docs: delete" on public.docs;
create policy "own docs: read" on public.docs for select using (auth.uid() = user_id);
create policy "own docs: insert" on public.docs for insert with check (auth.uid() = user_id);
create policy "own docs: update" on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own docs: delete" on public.docs for delete using (auth.uid() = user_id);

-- Live updates across devices (phone ↔ PC).
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
