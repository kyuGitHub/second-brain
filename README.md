# Second Brain — 옵시디언 노트를 지식 그래프로

옵시디언 볼트의 `.md` 파일로 노트 사이의 관계를 지식 그래프로 보여주는 사이트입니다.
**로그인한 사람만** 볼 수 있어요. 구성은 페퍼 어드민 제너레이터와 같습니다 (Vercel + Supabase 로그인, 초대 메일로 계정 발급).

```
D:\RIS Project (원본 볼트)
     │  deploy.bat 더블클릭
     ▼
① .md 만 vault/ 로 복사 (내 PC에만, GitHub 에 안 올라감)
② 그래프 만들기 → ③ Supabase 비공개 저장소에 업로드 (내 계정으로 로그인해서)

GitHub (프로그램만) ──▶ Vercel 자동 배포 ──▶ 접속 → 로그인 → 비공개 저장소에서 그래프 받기
```

- **GitHub 저장소와 웹사이트 파일에는 노트가 없어요.** 노트 데이터는 Supabase 비공개 저장소에만 있고, `brain_members` 명단에 있는 계정이 로그인해야 받을 수 있어요.
- 내 PC에서 `start.bat` 으로 볼 때는 로그인 없이 원본 볼트를 바로 읽어요.

## 1. 처음 한 번만: Supabase

어드민 제너레이터와 **같은 Supabase 프로젝트를 써도 돼요** (계정을 같이 씀). 그래도 세컨브레인은 아래 명단에 있는 계정만 볼 수 있어요.

1. Supabase 대시보드 → **SQL Editor → New query** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**
2. 같은 화면에서 내 이메일을 명단에 넣기 (업로드 권한 포함):
   ```sql
   insert into public.brain_members (email, can_upload) values ('내이메일@example.com', true)
   on conflict (email) do update set can_upload = excluded.can_upload;
   ```
3. 계정이 없다면: **Authentication → Users → Invite user** 로 초대 메일 발송 → 메일의 링크를 열면 비밀번호 설정 화면이 나와요.
4. **Project Settings → API** 에서 `Project URL` 과 `anon public` 키를 복사해 두기

다른 사람에게 보여주려면: 초대 메일 발송 + `brain_members` 에 이메일 추가 (`can_upload` 은 false).

## 2. 처음 한 번만: Vercel

1. [Vercel 에서 Import](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FkyuGitHub%2Fsecond-brain) → 저장소 `kyuGitHub/second-brain` 선택 (빌드 설정은 `vercel.json` 에 있어요)
2. **Environment Variables** 에 두 개 등록 → Deploy
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public 키
3. Supabase → **Authentication → URL Configuration** 의 Site URL 에 Vercel 주소를 넣기 (초대 메일 링크가 이 주소로 열려요)

> GitHub Pages 도 같은 화면으로 계속 배포돼요. 쓰려면 저장소 **Settings → Secrets and variables → Actions → Variables** 에 같은 두 값을 등록하세요. 등록 전에는 "설정이 필요해요" 화면만 보여요.

## 3. 처음 한 번만: 내 PC

1. [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com) 설치
2. `git clone https://github.com/kyuGitHub/second-brain.git D:\SecondBrain`
3. `deploy.bat` 더블클릭 → 메모장에 `.env` 가 열리면 값 채우고 저장
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: 위에서 복사한 값
   - `SB_EMAIL`: 내 로그인 이메일 / `SB_PASSWORD`: 비워 두면 올릴 때마다 물어봐요
   - `.env` 는 GitHub 에 올라가지 않아요

## 4. 노트 올리기

`deploy.bat` (Mac: `deploy.command`) 더블클릭.

1. 최신 프로그램 받기 → 2. `D:\RIS Project` 의 `.md` 만 `vault/` 로 복사 → 3. 그래프 만들기 → 4. Supabase 에 업로드
"완료!" 가 나오면 웹사이트를 새로 고치면 바로 보여요. Vercel 재배포는 필요 없어요.

## 5. 내 PC에서 먼저 보기

`start.bat` (Mac: `start.command`) 더블클릭 → `http://localhost:5173`. 로그인 없이 원본 볼트를 바로 읽고, 옵시디언에서 고치면 자동으로 바뀌어요. 내 PC에서만 보여요.

## 6. 설정 (`config.json`)

| 항목 | 뜻 |
|---|---|
| `sourcePath` | 원본 볼트 경로 (Windows `"D:/RIS Project"`, Mac `"/Users/<이름>/..."`) |
| `exclude` | 가져오지 않을 폴더 이름 |
| `folderTypes` | 폴더별 노트 유형. 예: `"1_위키": "semantic"`, `"10_회의록&인터뷰": "episodic"` |
| `publishMode` | `"all"` 전부 / `"flag"` 는 `publish: true` 인 노트만 |
| `features` | 나중에 켤 기능: `categories`(왼쪽 카테고리), `search`(검색), `reader`(본문 읽기) |

노트 유형: `thesis` 핵심 주장 · `semantic` 개념 · `procedural` 방법 · `episodic` 경험 · `reflective` 회고 · `entity` 개체.
관계 키(프런트매터): `supports` · `extends` · `instantiates` · `refines` · `contradicts` · `requires` · `composes` · `triggered_by` · `thesis`. 본문 `[[링크]]` 는 '언급' 연결이 돼요.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run sync` | 원본 볼트 → `vault/` (.md 만) |
| `npm run upload` | 그래프 만들기 + Supabase 업로드 |
| `npm run dev:live` | 원본 볼트로 내 PC에서 보기 (로그인 없음) |
| `npm run build` | 웹 배포용 화면 만들기 (노트 데이터는 포함되지 않음) |

## 폴더 구조

```
├─ deploy.bat / deploy.command   노트 올리기 (Windows / Mac)
├─ start.bat  / start.command    내 PC에서 보기
├─ config.json / .env.example    설정 / 비밀 값 양식
├─ supabase/schema.sql           열람 명단 + 비공개 저장소
├─ scripts/  sync-vault · build-graph · upload · dev
└─ src/      main.js(그래프) · auth.js(로그인) · data.js(데이터 받기)
```
