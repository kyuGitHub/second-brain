-- 사용 현황만 따로 켜기: schema.sql 의 "3. 사용 현황" 절과 같은 내용이에요.
-- Supabase 대시보드 → SQL Editor → New query 에 붙여넣고 Run (여러 번 실행해도 안전).
-- 3. 사용 현황 (선택) ---------------------------------------------------------
-- 누가 어떤 문서를 열었는지, 결과가 없던 검색어를 모아 개요의 "사용 현황"에 보여줘요.
-- 원본 기록은 아무도 직접 읽을 수 없고(읽기 정책 없음), 아래 함수가 사람 수·횟수 같은 합계만 돌려줘요.
-- 이 절을 실행하지 않아도 사이트는 그대로 동작해요 (사용 현황만 안 보임).
create table if not exists public.brain_events (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind    text not null check (kind in ('view', 'search_miss')),
  key     text not null check (length(key) <= 200),   -- 문서 key(req:ID / id:경로) 또는 검색어
  title   text check (length(title) <= 300)
);
create index if not exists brain_events_at on public.brain_events (at desc);
alter table public.brain_events enable row level security;
drop policy if exists "brain_events: member insert own" on public.brain_events;
create policy "brain_events: member insert own" on public.brain_events
  for insert to authenticated with check (user_id = auth.uid() and public.is_brain_member(false));

create or replace function public.brain_usage(days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
begin
  if not public.is_brain_member(false) then return null; end if;
  return json_build_object(
    'days', days,
    'users_7d',  (select count(distinct user_id) from brain_events where at > now() - interval '7 days'),
    'views_7d',  (select count(*) from brain_events where kind = 'view' and at > now() - interval '7 days'),
    'users',     (select count(distinct user_id) from brain_events where at > since),
    'views',     (select count(*) from brain_events where kind = 'view' and at > since),
    'daily',     (select coalesce(json_agg(d order by d.day), '[]') from (
                    select (at at time zone 'Asia/Seoul')::date as day, count(*) as n, count(distinct user_id) as u
                      from brain_events where kind = 'view' and at > since group by 1) d),
    'top',       (select coalesce(json_agg(t), '[]') from (
                    select key, max(title) as title, count(*) as n, count(distinct user_id) as u
                      from brain_events where kind = 'view' and at > since
                     group by key order by count(*) desc, max(at) desc limit 10) t),
    'misses',    (select coalesce(json_agg(m), '[]') from (
                    select lower(key) as q, count(*) as n, count(distinct user_id) as u
                      from brain_events where kind = 'search_miss' and at > since
                     group by lower(key) order by count(*) desc, max(at) desc limit 10) m)
  );
end $$;
revoke all on function public.brain_usage(int) from public, anon;
grant execute on function public.brain_usage(int) to authenticated;
