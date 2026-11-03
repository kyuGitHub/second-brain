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

## 1. 처음 한 번만: Supabase (프로젝트 `knuenhkquktmxwawkawv`)

연결 정보(주소·공개 anon 키)는 `.env.production` 에 들어 있어서 따로 설정할 필요가 없어요. 이 두 값은 브라우저로 전달되는 공개용 값이고, 데이터 보호는 로그인 + 열람 명단 + 비공개 저장소 규칙이 맡아요. **`service_role` 키는 절대 저장소에 넣지 마세요.**

1. Supabase 대시보드 → **SQL Editor → New query** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**
2. 같은 화면에서 내 이메일을 명단에 넣기 (업로드 권한 포함):
   ```sql
   insert into public.brain_members (email, can_upload) values ('내이메일@example.com', true)
   on conflict (email) do update set can_upload = excluded.can_upload;
   ```
3. **Authentication → URL Configuration → Site URL** 에 웹사이트 주소 넣기 (초대 메일 링크가 이 주소로 열려요)
   - GitHub Pages: `https://kyugithub.github.io/second-brain/`
   - Vercel 을 쓰면 Vercel 주소
4. 내 계정 만들기: **Authentication → Users → Add user**
   - **Send invitation**: 메일의 링크를 열면 비밀번호 설정 화면이 나와요
   - 또는 **Create new user** 로 비밀번호를 직접 정하고 **Auto Confirm User** 켜기

다른 사람에게 보여주려면: 계정 초대 + `brain_members` 에 이메일 추가 (`can_upload` 은 false).

## 2. 웹사이트

- **GitHub Pages**: `main` 에 올라가면 자동 배포돼요 → https://kyugithub.github.io/second-brain/
- **Vercel** (선택, 어드민 제너레이터와 같은 방식): [Import](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FkyuGitHub%2Fsecond-brain) → 그대로 Deploy. 환경변수 설정은 필요 없어요.

## 3. 처음 한 번만: 내 PC

1. [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com) 설치
2. `git clone https://github.com/kyuGitHub/second-brain.git D:\SecondBrain` (이미 있으면 그 폴더에서 `git pull`)
3. (선택) `.env.example` 을 `.env` 로 복사해서 `SB_EMAIL` 을 적어 두면 올릴 때 이메일을 묻지 않아요.

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

## 화면 기능 (요구사항 탐색 중심)

- **범위**: `1_위키` 전체를 읽되, 목록·그래프에는 `primaryScopes`(`10_회의록&인터뷰`, `20_요구사항`)만 보여요.
  나머지(색인 MOC, 프로젝트 허브, 참고·보고·계약 자료)는 **보조 자료**로 검색·본문 링크·연결 통계에만 쓰여요 (`auxRules`).
  `90_원본` 백업과 `처리결과: 숨김` 요구사항은 아예 제외해요.
- **카테고리 탭**: 요구사항(업무 › 대분류 › 중분류) / 회의록·인터뷰(하위 폴더). 항목을 누르면 그래프를 거르고 오른쪽에 목록이 열려요.
- **요구사항 목록**: ID순·이름순·연결 많은 순, 처리결과(유지/취소)·개발유형(신규/기존변경/기존유지/미지정) 필터, 목록 안 검색.
- **검색**: 요구사항 ID 우선 (`REQ-AP-508`, `AP-508`, `508` 모두 가능). 보조 자료는 "참고 자료" 표시와 함께 나와요.
- **요구사항 읽기**: 속성표 + 본문 + 연결(상위·하위·관련 요구사항, 근거 회의). 근거 회의가 없으면 채우는 방법을 안내해요.
- **개요**: 요구사항·회의 현황, 업무 영역별 요구사항, 추적성, 데이터 점검 목록.

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
├─ config.json                   설정
├─ .env.production               Supabase 주소·공개 키 (공개용 값)
├─ supabase/schema.sql           열람 명단 + 비공개 저장소
├─ scripts/  sync-vault · build-graph · upload · dev
└─ src/      main.js(그래프) · auth.js(로그인) · data.js(데이터 받기)
```
