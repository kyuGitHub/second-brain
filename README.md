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

**(선택) 사용 현황 켜기**: SQL Editor 에서 `supabase/usage.sql` 을 한 번 실행하면 개요에 "사용 현황"이 보여요 (이번 주 이용자·조회 수, 일별 조회, 많이 본 문서, 찾지 못한 검색어). 사람별 기록은 누구도 직접 볼 수 없고 합계만 보여요. 실행하지 않아도 사이트는 그대로 동작해요.

**(선택) AI 질문 켜기** — 검색창의 "✦ AI 질문"으로 요구사항을 물어보면 Claude 가 관련 문서만 보고 답해요.
1. SQL Editor 에서 `supabase/ask.sql` 실행 (질문·답 기록 표, 검색어 기록)
2. **Edge Functions → Deploy a new function → Via Editor** → 이름 `ask`, `supabase/functions/ask/index.ts` 내용 붙여넣기 → Deploy
3. **Edge Functions → Secrets** 에 `ANTHROPIC_API_KEY` (Claude API 키) 추가 — 키는 서버에만 있고 브라우저·GitHub 로 나가지 않아요
- 동작: 브라우저가 질문과 관련된 문서를 최대 10개 고름 → `ask` 함수가 로그인·명단·사용량(1인 1시간 30회)을 확인 → Claude(`claude-sonnet-5-5`, 빠른 답 설정)가 그 문서만 근거로 답 → 질문·답·근거 문서·토큰 수를 `brain_questions` 에 저장
- 질문 기록은 본인만 볼 수 있고, 개요의 사용 현황에는 질문 수 합계만 나와요.

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
  **본문 전체**도 찾아요: 검색창을 처음 누를 때 `search.json` 을 한 번 받고, 본문에서 찾은 결과는 "본문" 표시와 함께 찾은 곳 앞뒤 글을 보여줘요. 표 안 검색도 본문까지 찾아요.
- **AI 질문**: 검색창 오른쪽 "✦ AI 질문" 버튼, 검색 결과 맨 아래 "AI에게 물어보기", 또는 Shift+Enter. 오른쪽 패널에서 이어서 물어볼 수 있고, 답 속 요구사항 ID 는 링크가 돼요. "내 질문 기록"에서 지난 질문을 다시 봐요.
- **검색창 위치**: 오른쪽 패널이 열리면 남은 영역 가운데로 비켜서 가려지지 않아요.
- **요구사항 수준**: `업무: 상위요구사항` 은 **상위(RFP)**, 나머지는 **세부** (`config.json` 의 `levelRule`). 표의 "수준" 열·필터, 목록 필터, 요구사항 속성표, 변경 이력의 "상위 N" 표시에 쓰여요.
- **요구사항 읽기**: 속성표 + 본문 + 연결(상위·하위·관련 요구사항, 근거 회의). 근거 회의가 없으면 채우는 방법을 안내해요.
- **개요**: 요구사항·회의 현황, 업무 영역별 요구사항, 추적성, 데이터 점검 목록.
- **요구사항 표** (첫 화면): 머리글을 눌러 정렬, 처리결과·개발유형·표 안 검색으로 거르기, 왼쪽 카테고리와 연동, CSV 내려받기(엑셀에서 바로 열림).
- **공유 링크**: 요구사항은 `#/req/REQ-AP-508`, 카테고리는 `#/cat/req/ADMIN/주택담보대출` 주소로 바로 열려요. 노트의 "링크 복사" 버튼으로 복사해요.
- **본문 속 요구사항 ID**는 자동으로 링크가 돼요. 노트 위쪽 분류 경로(ADMIN › 주택담보대출 › 심사)를 누르면 그 분류로 이동해요.
- **연결 목록**은 상위 → 하위 → 근거 회의 → 관련 요구사항 순서로, 8개가 넘으면 접혀요.
- **최근 본 문서**가 개요에 보여요 (이 브라우저에만 저장).
- **변경 이력**: 올릴 때마다 이전 업로드와 비교해 요구사항의 추가·변경·삭제를 기록해요 (요구사항ID 기준, 속성은 "이전 → 이후", 본문은 "바뀜"). 개요의 "최근 변경", 표의 "최근 변경" 열·필터, 요구사항 상세의 "변경 이력"에서 봐요. 바뀐 게 없으면 업로드를 건너뛰어요 (`npm run upload -- --force` 로 강제). 프로그램이 바뀌어 데이터 형식(`meta.format`)이 달라지면 노트 변경이 없어도 한 번 올려요 (이력에는 안 남김).

## 자동 업로드 (회사 Windows PC · 집 Mac)

정해진 간격마다 `.md` 동기화 → 바뀐 노트가 있을 때만 업로드해요. 사이드바의 "업로드 N시간 전" 표시가 하루를 넘으면 주황색으로 바뀌어요.

**회사 Windows PC (선택)**
1. `install-autoupdate.bat` 더블클릭 → 계정 이메일·비밀번호(화면에 안 보임), 간격(기본 60분) 입력
2. 기록: `%LOCALAPPDATA%\second-brain-upload.log`
3. 끄기: `uninstall-autoupdate.bat`
- PC 가 켜져 있고 로그인돼 있을 때만 실행돼요. 회사 정책으로 작업 스케줄러가 막혀 있으면 등록에 실패해요.

### 집 Mac (지금 쓰는 방법 · 설치 완료)

1. `install-autoupdate.command` 더블클릭 → 계정 이메일·비밀번호, Mac 의 볼트 경로, 간격(기본 60분)을 입력
   - 비밀번호는 이 Mac 의 `.env` 에만, 볼트 경로는 `config.local.json` 에만 저장돼요 (둘 다 GitHub 에 안 올라감)
2. 정해진 간격마다: 최신 프로그램 받기 → `.md` 동기화 → 바뀐 노트가 있으면 업로드
3. 기록 보기: 터미널에서 `tail -f ~/Library/Logs/second-brain-upload.log`
4. 끄기: `uninstall-autoupdate.command` 더블클릭

옵시디언 앱이 켜져 있어야 싱크로 노트가 내려오고, Mac 이 잠자기면 실행되지 않아요.

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
