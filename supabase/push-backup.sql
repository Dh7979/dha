-- DHA: weekly automatic backup + 5-minute reminder schedule. Run once in the SQL editor.
-- Replace <ANON_KEY> with the project's "anon public" key (Project Settings → API). It is a public key.

-- 1) Backups: one snapshot of every user's docs per week, kept 8 weeks.
create table if not exists public.doc_backups (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists doc_backups_user_created on public.doc_backups (user_id, created_at desc);
alter table public.doc_backups enable row level security;
drop policy if exists "read own backups" on public.doc_backups;
create policy "read own backups" on public.doc_backups for select using (auth.uid() = user_id);

create or replace function public.backup_docs() returns void
language sql security definer set search_path = public as $$
  insert into doc_backups (user_id, data)
    select user_id, jsonb_object_agg(key, data) from docs where key not in ('push', 'push-sent') group by user_id;
  delete from doc_backups where created_at < now() - interval '56 days';
$$;
revoke all on function public.backup_docs() from public, anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sunday 19:00 UTC = Monday 04:00 KST
select cron.unschedule(jobid) from cron.job where jobname in ('dha-weekly-backup', 'dha-push-reminders');
select cron.schedule('dha-weekly-backup', '0 19 * * 0', $$select public.backup_docs()$$);
select public.backup_docs(); -- first backup right away

-- 2) Reminders: call the push-reminders function every 5 minutes.
select cron.schedule(
  'dha-push-reminders',
  '*/5 * * * *',
  $$select net.http_post(
      url := 'https://qriezdwiqebvukhypnfl.supabase.co/functions/v1/push-reminders',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'),
      body := '{}'::jsonb
    )$$
);
