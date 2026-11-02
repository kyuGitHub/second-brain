-- 세컨브레인 · Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전합니다 (if not exists / or replace).
-- 어드민 제너레이터와 같은 Supabase 프로젝트를 써도 됩니다. 그 경우에도 아래 1절의 명단에 있는 계정만 그래프를 볼 수 있어요.

-- 1. 열람 허용 명단 -----------------------------------------------------------
-- 로그인 계정이 있어도 이 명단에 이메일이 있어야 세컨브레인 데이터를 읽고 올릴 수 있어요.
create table if not exists public.brain_members (
  email      text primary key,
  can_upload boolean not null default false,   -- true: deploy.bat 으로 노트를 올릴 수 있음
  created_at timestamptz not null default now()
);
alter table public.brain_members enable row level security;
drop policy if exists "brain_members: own read" on public.brain_members;
create policy "brain_members: own read" on public.brain_members
  for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 명단 확인용 함수 (스토리지 정책에서 사용)
create or replace function public.is_brain_member(want_upload boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brain_members m
     where lower(m.email) = lower(auth.jwt() ->> 'email')
       and (not want_upload or m.can_upload)
  );
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
