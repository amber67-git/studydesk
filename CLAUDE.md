# StudyDesk — Claude Code 인수인계 문서

코넬(Cornell) 노트 필기법 기반의 개인 공부 노트 웹앱. 성인 1인 사용자(앱 소유자 본인)용.
표시 이름은 **StudyDesk** (2026-11-01에 "My notebook"에서 변경; 사용자의 다른 앱 ClassDesk와 형제 네이밍).
이름이 세 번 바뀐 역사: my chalkboard → My notebook → StudyDesk. 내부 식별자에 옛 이름이 남아있는 건 의도된 것.
현재 상태: **순수 HTML+CSS+JS 단일 페이지 앱, 빌드 도구 없음. 동작하는 베이스라인이며 알려진 한계는 아래 '미해결 과제' 참조.**
이 문서는 claude.ai 대화에서 수개월간 쌓인 설계 결정의 인수인계본이다.

## 중요: 재작성/스택 변경 시에도 반드시 살아남아야 하는 것

개발 언어·프레임워크를 바꾸더라도 아래는 **데이터와 UX 계약**이므로 유지할 것.

### 1. 데이터 호환성 (최우선)
- localStorage 키: `study-notes-app-chalkboard-v2` — **절대 이름 변경 금지.**
  사용자의 실제 필기 데이터가 이 키에 있다. 키를 바꾸면 "노트가 전부 사라진" 것처럼 보인다.
  (이름이 chalkboard인 이유: 앱의 옛 이름. 데이터 보존을 위해 의도적으로 유지 중)
- 백업 JSON 형식: `{ app: "studydesk", backupVersion: 1, exportedAt, data: { subjects, notes, recurring, adhocTasks, completions, cards, library, settings } }`
  — import 시 `app`이 `"studydesk"` **또는 옛 이름 `"my-notebook"`** 이면 수용할 것 (사용자가 이미 내려받은 옛 백업 파일 호환). 래퍼 없는 raw data 객체도 수용.
- 스키마 (현재 shape):
  - subject: `{ id, name }`
  - note(=notebook): `{ id, title, subjectId, type, pages[] }` — type ∈ lecture|book|movie|project|self-study|other
  - page: `{ chapter, tags, date(YYYY-MM-DD), cues, body(HTML), summary }`
  - recurring task: `{ id, title, subjectId, type, days[0-6] }` / adhoc task: `{ id, title, subjectId, type, date }`
  - completions: `{ "<taskId>|<YYYY-MM-DD>": true }`
  - card: `{ id, front, back, subjectId }`
  - library item: `{ id, title, author, illustrator, publisher, isbn, coverUrl, coverRotation(0|90|180|270), type, category, genre, callNo, levelInput, status, progress(0-100), rating(0-5), notes, noteId, createdAt, updatedAt }`
    — type ∈ book|movie|series|lecture|video|paper|article|music|other, status ∈ want|in progress|done
  - settings: `{ fontMode('hand'|'clean'), noteFontSize(13-22), backupReminderDays, lastBackupAt, tmdbKey }`

### 2. 도메인 불변 규칙 (실수로 겪고 확정된 것들)
- **청구기호(callNo)는 실물 라벨**: 한 번 부여하면 삭제 후에도 재사용·재배열 금지. 다음 번호 = 같은 접두어 내 max+1 (count+1 아님).
- **touched 원칙**: 사용자가 직접 타이핑한 필드는 어떤 자동화(검색 자동채우기, 시리즈 상속)도 절대 덮어쓰지 않는다. 일부러 비운 칸도 존중.
- **Category(형태) vs Genre(주제)는 별개 축** — 합치면 필터가 무의미해짐.
- **Category/Genre UI는 `<select>` 사용, `<datalist>` 금지** (datalist는 값이 차면 목록이 안 떠 재선택 불가 — 실제 겪은 버그). 단, 자유 텍스트 자동완성(저자/출판사)은 "빈 입력=목록 없음, 타이핑 시 포함매칭 8개" 방식의 동적 datalist 허용.
- **이미지는 반드시 압축 후 저장**: 노트 본문 이미지 긴 변 1280px/JPEG 0.82, 라이브러리 표지 520px/JPEG 0.85. 안 하면 폰 사진 한 장에 localStorage(~5MB)가 터진다.
- **저장 실패를 조용히 삼키지 않는다**: `catch{}` 금지. 저장 실패(쿼터 초과)와 스토리지 차단(시크릿 모드)은 사용자에게 명시적으로 알린다. 손상 데이터는 지우지 말고 사본 보관 후 안내.
- **읽기 레벨(AR/Lexile) 금지**: 성인용 앱. 책에는 level 필드 없음. 레벨은 영화=연령등급, 강의=난이도, 논문=연도만.
- **Library ↔ Notebook은 별개**: 자료 등록 시 노트북 자동 생성 금지. "go to note"로 필요할 때만 연결(subject+type 키로 기존 노트북 재사용).
- **날짜/시간대**: 사용자는 Asia/Seoul. "오늘" 계산에 `toISOString()` 금지(UTC라 자정~9시에 하루 어긋남 — 실제 겪은 버그).
- **코넬 구조**: 고정정보(SUBJECT/TYPE/TOPIC은 노트북 단위) vs 페이지별 정보(chapter/tags/date). CUE | MAIN NOTES 좌우 분할 + 하단 SUMMARY. 폰(≤760px)에서는 CUE가 위로 쌓임.
- **사이드바 라벨과 내부 키는 별개**: 표시명 바꿀 때 내부 페이지 키(`showPage('schedule')` 등)는 건드리지 않는다. 상단 제목은 PAGE_TITLES에 따로 있음.

### 3. UX 계약 (사용자가 익숙해진 동작)
- 입력 즉시 자동 저장(디바운스 400ms). save 버튼은 확인용.
- 마지막 페이지에서 ▶ = 새 페이지(날짜 자동 오늘). 본문이 넘치면 자동 페이지 생성.
- self-test 모드: MAIN NOTES 블러 처리, CUE만 보고 회상 (코넬 복습 단계).
- 페이지 번호(N / M) 클릭 = 페이지 점프 목록(챕터·미리보기·날짜).
- 검색은 본문(body) 포함 전 필드 관통.
- 백업 리마인더 배너: 마지막 백업 후 N일(기본 7, 설정 가능, 0=끄기) 경과 시 표시. 노트 0개면 안 띄움.
- Library 등록 모달: 검색바 최상단("검색 한 번, 나머지는 확인만"), 표지 박스 하나가 클릭업로드+드래그+Ctrl+V 3-in-1(버튼 없음), Status/Progress/Rating/CallNo는 편집 모드에서만 표시, Delete는 왼쪽 빨강으로 격리.
- **Backup은 사이드바의 전용 페이지**(내부 키 `backup`, `page-backup`): download/load backup, 리마인더 주기, 저장 용량, 전체 삭제(별도 카드)가 여기 있다. Settings에는 글꼴·글자 크기·auto-fill 키·설명서만 남긴다.
- Settings에 한국어 사용 설명서(guide) 내장 — **기능 바꾸면 설명서도 같이 갱신** (FAQ는 실제 겪은 문제의 에러 문구 그대로).

## 현재 코드 구조 (app.js, IIFE 모듈)

Icons(인라인 SVG, CDN 금지 — 아이콘 폰트 차단으로 빈 네모 버그 겪음) → Utils → Storage(probe/fail-open/손상보관) → AppState(+migrateNotesToPages: 로드마다 전체 스키마 복구) → Modal → Nav → Subjects → NotesModule → Library → Schedule → Flashcards → Settings → Stats → App(boot try/catch 오버레이).

외부 API (Library 자동채우기): Google Books(키 불필요, intitle:), MusicBrainz, Crossref, TMDB(선택 — settings.tmdbKey, 없으면 영화 검색만 비활성·수동입력 가능). 모든 fetch: navigator.onLine 체크 + AbortController 15초 + 429/401·403 친절 메시지.

## 검증 워크플로우 (변경마다 돌리던 것 — 유지 권장)
1. `node -c app.js` (문법)
2. JS의 `Utils.$('id')` 참조 ↔ HTML id 전수 대조 (누락 0)
3. HTML 태그 여닫이 균형 (div/button/select/span/dl/dt/dd/details/summary/p...)
4. `data-icon` 사용처 ↔ Icons.paths 정의 대조
5. CSS 중괄호 균형
6. 핵심 로직은 Node 시뮬레이션으로 케이스 검증 (예: seriesKey, nextCallNo, computeLevel, 날짜 계산)

## 배포 산출물 (현재 방식)
- **GitHub Pages**: `main`에 push하면 `.github/workflows/pages.yml`이 저장소 루트를 그대로 배포한다 → https://amber67-git.github.io/studydesk/ . 빌드 단계 없음. 최초 1회 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꿔야 한다(GITHUB_TOKEN으로는 Pages를 켤 수 없음). 이 origin(amber67-git.github.io)은 소유자의 다른 프로젝트 페이지와 공유되므로 서비스 워커는 자기 캐시(`studydesk-*`)와 SHELL 목록의 URL만 건드린다.
- **PWA**: `manifest.webmanifest` + `sw.js` + `icons/`. 서비스 워커는 앱 셸만 캐시한다(루트 문서 `./`와 style.css/app.js는 network-first, 폰트·아이콘·manifest는 cache-first, Google Fonts는 stale-while-revalidate). 루트가 아닌 같은 origin의 다른 문서로 이동하는 요청은 캐시하지 않고 오프라인이면 루트로 리다이렉트한다. 외부 API(Google Books/MusicBrainz/Crossref/TMDB/표지 이미지)는 가로채지 않는다. localStorage는 건드리지 않는다. 등록은 app.js `App.init` 끝에서 http(s)일 때만 하므로 file://로 열어도 동작한다. 셸 파일을 추가하면 `sw.js`의 SHELL 목록에도 넣을 것(하나라도 404면 install 전체가 실패한다).
- 3파일 분리본(index.html/style.css/app.js) + **단일 HTML 병합본**(link/script 태그를 inline style/script 블록으로 치환). 병합 스크립트는 단순 문자열 치환이라 두 태그가 정확히 1개씩이어야 함.
- 라틴 웹폰트는 `fonts/`(woff2 8개, ~250KB)에 자체 호스팅하고 style.css 상단 `@font-face`에서 `src: url(fonts/...), url(https://fonts.gstatic.com/...)` 순으로 선언한다. 병합본을 fonts/ 없이 단독으로 열어도 두 번째 src(CDN)로 넘어가므로 같은 글꼴이 나온다. CJK 손글씨 3종(Nanum Pen Script/Yomogi/Zhi Mang Xing)은 Google Fonts가 각 ~100개 조각으로 쪼개 주기 때문에 번들하지 않고 CDN `<link>`를 유지한다.

## 미해결 과제 (우선순위순)
1. **모바일 폰트 불일치 (1차 조치 완료, 사용자 확인 대기)** — PC와 폰에서 글씨체가 다르게 보이던 문제. 원인으로 확인된 것: 글꼴 스택의 마지막이 generic `cursive`였고, 웹폰트가 실패하면 Android는 Dancing Script, iOS는 Snell Roundhand를 골라 기기마다 다른 글씨가 됐다. 조치: 라틴 폰트 자체 호스팅(`fonts/`) + 스택 끝을 시스템 한글 고딕 → `sans-serif`로 교체(위 배포 산출물 참조). 남은 확인: 폰에서 실제로 같은 글꼴이 나오는지 사용자 확인. 여전히 다르면 "폰에서 어떻게 열었는지(파일 직접 / 서버) / 손글씨가 아예 안 나오는지 vs 다른 손글씨인지"를 받아 진단.
2. **Google Books API 키 입력란 (선택)** — 429 "search limit reached" 재발 시 추가. TMDB 키 입력란(Settings → auto-fill)과 동일 패턴, 키 있으면 `&key=` 붙이기. 무료 1,000회/일.
3. **GitHub Pages 배포 + PWA 설치 (완료)** — https://amber67-git.github.io/studydesk/ , 홈 화면 설치·오프라인 동작. 데이터는 여전히 기기별(5번에서 해결). 설명서에 설치 방법 섹션 있음.
4. **구글 캘린더 단방향 가져오기** — 설계 합의됨: 전용 "공부" 캘린더 구독 방식, OAuth 클라이언트 필요, localhost에서 동작. 가져온 일정→subject 매핑 규칙 필요.
5. **기기 간 실시간 동기화** — 백엔드 필요(Firebase/Supabase 후보). Storage 모듈이 이 교체를 위해 격리돼 있음. 로그인 필수(개인 데이터). ※ 사용자는 ClassDesk라는 별개 앱에서 Firebase 전환 경험 있음 — 혼동 주의: ClassDesk(학생 관리)와 이 앱은 다른 프로젝트.

## 사용자 작업 스타일
- 한국어, 짧은 지시. 근본 원인 설명을 원함. 문제는 빨간 펜 스크린샷으로 보고.
- "검증까지 포함해서 끝내라"가 기본 기대치. 변경 후 위 검증 워크플로우 + 실패 케이스 시뮬레이션을 돌리고 결과를 보고할 것.
- 큰 변경 전에는 백업(export) 경로가 살아있는지 먼저 확인.
