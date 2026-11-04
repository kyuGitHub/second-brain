-- 열람 명단 없이: Supabase 에 추가한 사용자(로그인 계정)는 모두 볼 수 있게
-- Supabase 대시보드 → SQL Editor → New query 에 붙여넣고 Run (여러 번 실행해도 안전).
-- ⚠ 전제: Authentication 설정에서 "Allow new users to sign up" 이 꺼져 있어야 해요 (아무나 가입하면 아무나 보게 됨).
-- 업로드(노트 올리기)는 그대로 brain_members 의 can_upload = true 계정만 할 수 있어요.
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
