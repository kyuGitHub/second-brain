-- AI 질문 켜기: 질문·답 기록 표 + 검색 기록 종류 추가 (schema.sql 의 "4. AI 질문" 절과 같아요)
-- Supabase 대시보드 → SQL Editor → New query 에 붙여넣고 Run (여러 번 실행해도 안전).
-- 4. AI 질문 -------------------------------------------------------------------
-- 질문·답은 질문한 본인만 다시 볼 수 있어요. 개요에는 사람 수·횟수 합계만 나와요.
create table if not exists public.brain_questions (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question      text not null check (length(question) <= 1000),
  answer        text,
  refs          jsonb not null default '[]',   -- AI 에게 보낸 근거 문서 id
  model         text,
  ok            boolean not null default true,
  error         text,
  input_tokens  int,
  output_tokens int,
  ms            int
);
create index if not exists brain_questions_user_at on public.brain_questions (user_id, at desc);
alter table public.brain_questions enable row level security;
drop policy if exists "brain_questions: own read" on public.brain_questions;
drop policy if exists "brain_questions: member insert own" on public.brain_questions;
create policy "brain_questions: own read" on public.brain_questions
  for select to authenticated using (user_id = auth.uid() and public.is_brain_member(false));
create policy "brain_questions: member insert own" on public.brain_questions
  for insert to authenticated with check (user_id = auth.uid() and public.is_brain_member(false));

-- 일반 검색어도 기록 (검색 결과를 눌러 연 경우)
alter table public.brain_events drop constraint if exists brain_events_kind_check;
alter table public.brain_events add constraint brain_events_kind_check check (kind in ('view', 'search', 'search_miss'));

-- 사용 현황 합계에 AI 질문 수 추가
create or replace function public.brain_usage(days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(days, 365)));
begin
  if not public.is_brain_member(false) then return null; end if;
  return json_build_object(
    'days', days,
    'users_7d',  (select count(distinct u) from (select user_id u from brain_events where at > now() - interval '7 days'
                    union all select user_id from brain_questions where at > now() - interval '7 days') x),
    'views_7d',  (select count(*) from brain_events where kind = 'view' and at > now() - interval '7 days'),
    'users',     (select count(distinct u) from (select user_id u from brain_events where at > since
                    union all select user_id from brain_questions where at > since) x),
    'views',     (select count(*) from brain_events where kind = 'view' and at > since),
    'asks_7d',   (select count(*) from brain_questions where at > now() - interval '7 days'),
    'asks',      (select count(*) from brain_questions where at > since),
    'searches',  (select count(*) from brain_events where kind in ('search', 'search_miss') and at > since),
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
                     group by lower(key) order by count(*) desc, max(at) desc limit 10) m),
    'queries',   (select coalesce(json_agg(m), '[]') from (
                    select lower(key) as q, count(*) as n, count(distinct user_id) as u
                      from brain_events where kind = 'search' and at > since
                     group by lower(key) order by count(*) desc, max(at) desc limit 10) m)
  );
end $$;
revoke all on function public.brain_usage(int) from public, anon;
grant execute on function public.brain_usage(int) to authenticated;
