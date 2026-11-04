-- 세컨브레인 · Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전합니다 (if not exists / or replace).
-- 어드민 제너레이터와 같은 Supabase 프로젝트를 써도 됩니다. 그 경우에도 아래 1절의 명단에 있는 계정만 그래프를 볼 수 있어요.

-- 1. 열람 허용 명단 -----------------------------------------------------------
-- 노트를 올리는(업로드) 계정만 이 명단에 넣어요. 보기는 Supabase 에 추가한 계정이면 누구나 가능해요.
create table if not exists public.brain_members (
  email      text primary key,
  can_upload boolean not null default false,   -- true: deploy.bat 으로 노트를 올릴 수 있음
  created_at timestamptz not null default now()
);
alter table public.brain_members enable row level security;
drop policy if exists "brain_members: own read" on public.brain_members;
create policy "brain_members: own read" on public.brain_members
  for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 권한 확인용 함수 (스토리지·기록 정책에서 사용)
-- 보기: Supabase 에 추가한 로그인 계정이면 누구나 (가입 허용은 꺼 둘 것) · 올리기: brain_members 의 can_upload 계정만
create or replace function public.is_brain_member(want_upload boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not want_upload then
      auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    else exists (
      select 1 from public.brain_members m
       where lower(m.email) = lower(auth.jwt() ->> 'email') and m.can_upload
    )
  end;
$$;

-- ★ 여기에 내 이메일을 넣어 실행하세요 (업로드 권한 포함)
-- insert into public.brain_members (email, can_upload) values ('me@example.com', true) on conflict (email) do update set can_upload = excluded.can_upload;

-- 2. 비공개 저장소 -------------------------------------------------------------
-- 그래프 데이터(graph.json, notes.json)를 보관. 공개 링크로는 열 수 없어요.
insert into storage.buckets (id, name, public)
values ('second-brain', 'second-brain', false)
on conflict (id) do update set public = false;

drop policy if exists "second-brain: member read"   on storage.objects;
drop policy if exists "second-brain: member insert" on storage.objects;
drop policy if exists "second-brain: member update" on storage.objects;
drop policy if exists "second-brain: member delete" on storage.objects;

create policy "second-brain: member read"   on storage.objects for select to authenticated
  using (bucket_id = 'second-brain' and public.is_brain_member(false));
create policy "second-brain: member insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'second-brain' and public.is_brain_member(true));
create policy "second-brain: member update" on storage.objects for update to authenticated
  using (bucket_id = 'second-brain' and public.is_brain_member(true));
create policy "second-brain: member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'second-brain' and public.is_brain_member(true));

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
