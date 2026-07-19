create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null,
  document_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.prep_packs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  company text not null,
  job_title text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists prep_packs_user_created_idx on public.prep_packs(user_id, created_at desc);

create table if not exists public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.user_workspaces enable row level security;
alter table public.prep_packs enable row level security;
alter table public.usage_counters enable row level security;

create policy "Users manage their workspace" on public.user_workspaces
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their prep packs" on public.prep_packs
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read their usage" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.consume_daily_ai_allowance(p_limit integer default 25)
returns table(allowed boolean, used integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_limit < 1 or p_limit > 1000 then raise exception 'Invalid usage limit'; end if;

  insert into public.usage_counters(user_id, usage_date, count, updated_at)
  values (current_user_id, current_date, 1, now())
  on conflict (user_id, usage_date)
  do update set count = public.usage_counters.count + 1, updated_at = now()
  returning count into current_count;

  return query select current_count <= p_limit, current_count, (current_date + interval '1 day');
end;
$$;

revoke all on function public.consume_daily_ai_allowance(integer) from public;
grant execute on function public.consume_daily_ai_allowance(integer) to authenticated;
