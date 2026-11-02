# Second Brain — 옵시디언 노트를 지식 그래프 사이트로

옵시디언 볼트의 `.md` 파일을 읽어서 노트와 노트 사이의 관계를 지식 그래프로 보여주는 사이트입니다.
노트(자료)와 프로그램을 **한 GitHub 저장소**에 함께 올리면, GitHub 이 사이트를 자동으로 만들어 웹에 띄웁니다 (GitHub Pages).

```
D:\RIS Project (원본 볼트, 옵시디언 싱크)
      │  deploy.bat 더블클릭
      ▼
① .md 파일만 vault/ 폴더로 복사   ② GitHub 에 올리기 (git push)
      ▼
③ GitHub Actions 가 그래프를 만들어 GitHub Pages 에 배포 → https://<아이디>.github.io/<저장소>/
```

> ⚠️ **공개 범위 주의**: GitHub Pages 사이트는 **주소를 아는 누구나 볼 수 있어요.** 저장소가 공개(public)라면 `vault/` 폴더의 노트 원문도 누구나 볼 수 있어요.
> 회사 업무 내용, 개인정보가 들어간 노트는 올리기 전에 꼭 빼 주세요. (아래 "올리지 않을 노트" 참고)

## 폴더 구조

```
SecondBrain/
├─ deploy.bat / deploy.command   더블클릭: .md 동기화 → GitHub 업로드 (Windows / Mac)
├─ start.bat  / start.command    더블클릭: 내 PC에서 원본 볼트를 바로 보기 (Windows / Mac)
├─ config.json                   원본 볼트 경로·제외 폴더·기능 스위치
├─ vault/                        원본에서 복사한 .md 파일 (GitHub 에 함께 올라감)
├─ .github/workflows/deploy.yml  GitHub 자동 배포 설정
├─ scripts/
│  ├─ sync-vault.mjs             원본 볼트 → vault/ (.md 만, 지운 노트도 반영)
│  ├─ build-graph.mjs            vault/ → 그래프 데이터
│  └─ dev.mjs                    내 PC 실행 + 자동 갱신
└─ src/                          화면 (main.js, style.css)
```

## 1. 처음 한 번만 (Windows)

1. 설치: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com)
2. GitHub 저장소를 `D:\SecondBrain` 으로 내려받기 (명령 프롬프트에서):
   ```bash
   git clone https://github.com/<아이디>/<저장소>.git D:\SecondBrain
   ```
3. GitHub 저장소 화면 → **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾸기
4. `config.json` 의 `sourcePath` 가 원본 볼트 경로인지 확인 (기본값 `"D:/RIS Project"`, 역슬래시 대신 `/`)

## 2. 노트를 웹에 반영하기

`deploy.bat` 을 더블클릭하면 끝이에요.

1. `D:\RIS Project` 에서 `.md` 파일만 `vault/` 로 복사해요 (이미지·PDF 등은 제외, 원본에서 지운 노트는 같이 지움)
2. GitHub 에 올려요
3. 1~2분 뒤 사이트에 반영돼요. 진행 상황은 저장소의 **Actions** 탭에서 볼 수 있어요.

> 처음 저장소에 들어 있는 예시 노트 25개는 첫 동기화 때 내 노트로 바뀌어요.

## 3. 올리기 전에 내 PC에서 먼저 보기

`start.bat` 을 더블클릭하면 `http://localhost:5173` 이 열려요. 원본 볼트를 바로 읽기 때문에 옵시디언에서 노트를 고치면 화면이 자동으로 바뀌어요. 이 화면은 내 PC에서만 보여요.

## 4. 올리지 않을 노트

- `config.json` 의 `exclude` 에 폴더 이름 추가 (기본: `.obsidian`, `templates`, `private` 등)
- 노트 프런트매터에 `publish: false` 또는 `private: true`
- 더 안전하게: `publishMode` 를 `"flag"` 로 바꾸면 `publish: true` 라고 적은 노트**만** 사이트에 나와요.

> `exclude` 와 프런트매터 규칙은 **사이트**에 적용돼요. `vault/` 로 복사할 때는 `exclude` 폴더만 빠지고, `publish: false` 노트는 복사돼서 GitHub 저장소에는 올라가요.
> 저장소에도 올리면 안 되는 노트는 `private` 폴더처럼 `exclude` 에 있는 폴더로 옮겨 주세요.

## 5. 노트 쓰는 법 (선택)

노트 맨 위(프런트매터)에 적으면 그래프가 풍부해져요. 안 적어도 동작해요.

```yaml
---
type: thesis                 # thesis 핵심 주장 / semantic 개념 / procedural 방법 / episodic 경험 / reflective 회고 / entity 개체
topics: [여신 신청 UX]
tags: [퍼널, 전환율]
date: 2026-11-02
supports: "[[뒷받침할 핵심 주장 노트]]"
---
```

- `type` 을 안 적으면 폴더 이름으로 정해요 (`config.json` 의 `folderTypes`). 기본값은 `semantic`(개념).
- 관계 키: `supports` 뒷받침 · `extends` 확장 · `instantiates` 사례 · `refines` 다듬음 · `contradicts` 반박 · `requires` 전제 · `composes` 구성 · `triggered_by` 계기 · `thesis` 핵심 주장
- 본문의 `[[노트 이름]]` 은 **언급** 연결이 돼요.

## 6. 화면 기능

**현재 범위: 지식 그래프 중심**
- 보기: 브레인 3D · 자유 · 별자리 · 계층 · 타임라인
- 색상 기준 · 간격 · 라벨, 노드·연결 유형 켜고 끄기
- 노드를 누르면 연결이 강조되고 요약 카드가 떠요

**요구사항 정의 후 추가 (꺼 둔 상태)** — `config.json` 의 `features` 를 `true` 로 바꾸면 켜져요.
- `categories`: 왼쪽 렌즈·주제·태그·핵심 주장 목록
- `search`: 검색창
- `reader`: 노트 본문 패널

## 7. Mac 에서 쓸 때 (집 PC)

- `config.json` 의 `sourcePath` 를 Mac 의 볼트 경로로 바꿔요. 예: `"/Users/<이름>/Documents/RIS Project"`
- `deploy.command`, `start.command` 를 더블클릭해요. (처음에 "확인되지 않은 개발자" 경고가 뜨면 우클릭 → 열기)
- 정기 자동 배포(크론)는 다음 단계에서 추가할 예정이에요.

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run sync` | 원본 볼트 → `vault/` (.md 만) |
| `npm run dev:live` | 원본 볼트를 바로 읽어 내 PC에서 보기 |
| `npm run dev` | `vault/` 기준으로 내 PC에서 보기 |
| `npm run build` | 웹에 올릴 `dist/` 만들기 (GitHub 이 자동으로 실행) |
