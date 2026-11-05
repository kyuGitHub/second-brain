-- 보안 보강 (여러 번 실행해도 안전) — schema.sql 의 "5. 보안 보강" 절과 같아요
-- 5. 보안 보강 -------------------------------------------------------------------
-- ① AI 질문 기록은 서버 함수(ask)만 쓴다: 브라우저에서 직접 넣는 규칙을 없앤다 (본인 열람은 그대로)
drop policy if exists "brain_questions: member insert own" on public.brain_questions;

-- ② 사용 기록은 시간·사용자를 서버가 정한다 (미래 날짜·다른 사람 이름으로 넣기 방지)
create or replace function public.brain_events_stamp() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.at := now();
  new.user_id := auth.uid();
  new.key := left(new.key, 200);
  new.title := left(new.title, 300);
  return new;
end $$;
drop trigger if exists brain_events_stamp on public.brain_events;
create trigger brain_events_stamp before insert on public.brain_events
  for each row execute function public.brain_events_stamp();

-- ③ AI 질문에 외부 자료(웹 검색) 사용 여부와 출처를 함께 저장
alter table public.brain_questions add column if not exists web boolean not null default false;
alter table public.brain_questions add column if not exists sources jsonb not null default '[]';
