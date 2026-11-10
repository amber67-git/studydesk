# StudyDesk — Claude Code 인수인계 문서

코넬(Cornell) 노트 필기법 기반의 개인 공부 노트 웹앱. 성인 1인 사용자(앱 소유자 본인)용.
표시 이름은 **StudyDesk** (2026-11-01에 "My notebook"에서 변경; 사용자의 다른 앱 ClassDesk와 형제 네이밍).
이름이 세 번 바뀐 역사: my chalkboard → My notebook → StudyDesk. 내부 식별자에 옛 이름이 남아있는 건 의도된 것.
현재 상태: **순수 HTML+CSS+JS 단일 페이지 앱, 빌드 도구 없음. 동작하는 베이스라인이며 알려진 한계는 아래 '미해결 과제' 참조.**
이 문서는 claude.ai 대화에서 수개월간 쌓인 설계 결정의 인수인계본이다.

**앱의 목적(북극성, 2026-11-09 소유자 확정): "열자마자, 공부한 내용을 바로 적는다."** 기능·디자인 변경은 "첫 글자를 쓰기까지의 탭 수가 줄어드는가"로 판단하고, 그렇지 않은 것(장식·테마·토큰 정리)은 뒤로 미룬다. 같은 문장이 Settings → Guide 맨 앞 "이 앱의 목적"에 사용자용으로 적혀 있다(소유자가 나중에 판매도 고려하므로 설명서는 제품 소개를 겸한다 — 목적·원칙이 바뀌면 거기도 고친다).

## 중요: 재작성/스택 변경 시에도 반드시 살아남아야 하는 것

개발 언어·프레임워크를 바꾸더라도 아래는 **데이터와 UX 계약**이므로 유지할 것.

### 1. 데이터 호환성 (최우선)
- localStorage 키: `study-notes-app-chalkboard-v2` — **절대 이름 변경 금지.**
  사용자의 실제 필기 데이터가 이 키에 있다. 키를 바꾸면 "노트가 전부 사라진" 것처럼 보인다.
  (이름이 chalkboard인 이유: 앱의 옛 이름. 데이터 보존을 위해 의도적으로 유지 중)
- 백업 JSON 형식: `{ app: "studydesk", backupVersion: 1, exportedAt, data: { subjects, notes, recurring, adhocTasks, completions, completionSync(선택, 동기화 켠 뒤에만 의미 있음), cards, library, settings } }`
  — import 시 `app`이 `"studydesk"` **또는 옛 이름 `"my-notebook"`** 이면 수용할 것 (사용자가 이미 내려받은 옛 백업 파일 호환). 래퍼 없는 raw data 객체도 수용.
- 스키마 (현재 shape):
  - subject: `{ id, name }`
  - note(=notebook): `{ id, title, subjectId, type, pages[] }` — type ∈ lecture|book|movie|project|self-study|other
  - page: `{ chapter, tags, date(YYYY-MM-DD), cues, body(HTML), summary }`
  - recurring task: `{ id, title, subjectId, type, days[0-6] }` / adhoc task: `{ id, title, subjectId, type, date }`
  - completions: `{ "<YYYY-MM-DD>": { "rec:<id>" | "adhoc:<id>": true|false } }` — **날짜 → 태스크 키 중첩 구조**(코드 `isTaskDone/setTaskDone` 기준; 예전 이 문서의 `"<taskId>|<date>": true` 표기는 틀렸었다). 동기화는 `completions/<date>|<key>` 문서(`{done:true}`)로 펼치고, 해제는 톰스톤. LWW 비교용 시각은 불리언에 넣을 수 없어 **`completionSync: { "<date>|<key>": syncAt }`** 라는 추가 필드(로컬 저장/백업에 같이 들어가며 없어도 됨)에 둔다.
  - card: `{ id, front, back, subjectId }`
  - library item: `{ id, title, author, illustrator, publisher, isbn, coverUrl, coverRotation(0|90|180|270), type, category, genre, callNo, levelInput, status, progress(0-100), rating(0-5), notes, noteId, createdAt, updatedAt }`
    — type ∈ book|movie|series|lecture|video|paper|article|music|other, status ∈ want|in progress|done
  - settings: `{ fontMode('hand'|'clean'), noteFontSize(13-22), backupReminderDays, lastBackupAt, tmdbKey, customCategories[], customGenres[], lang('en'|'ko') }` — `customCategories`·`customGenres`는 Settings → Lists에서 사용자가 직접 추가한 Library 카테고리·장르(자료에 쓰이기 전에도 드롭다운에 보이게)로, `applySettingDefaults`가 없으면 `[]`로 채운다(시드 직후에도 호출). `lang`은 없으면 `I18n.detect()`(브라우저 언어) 값으로 채우고, 읽을 때도 없으면 같은 규칙을 쓴다(옛 백업·옛 기기의 설정이 영어로 바꿔 버리지 않게).
  - 이 브라우저의 데이터가 마지막으로 동기화된 계정 uid는 `study-notes-app-chalkboard-v2:sync-uid`(별도 localStorage 키)에 둔다. 다른 uid로 로그인하면 로컬에 내용이 있을 때 confirm으로 묻고(확인=서버에서 실제로 내려받은 뒤 설정까지 포함해 로컬 폐기, 취소=로그아웃) 두 계정의 데이터가 섞여 올라가는 것을 막는다. 내려받는 동안 편집이 있었으면 한 번 더 묻는다. 첫 다운로드는 `get({source:'server'})`라 오프라인 캐시로는 절대 로컬을 대체하지 않는다. clear all data가 이 키도 지운다.
  - 로그아웃 시 이 기기가 갖고 있던 문서 id 목록을 `study-notes-app-chalkboard-v2:sync-known`(`{uid, at, ids}`)에 적어 둔다. 같은 계정으로 다시 로그인하면 "그때 이미 있었고 그 뒤 클라우드에서 바뀌지 않은 문서"는 로컬이 더 최신으로 보고 내려받지 않는다(로그아웃 중 지운 노트가 되살아나지 않고 톰스톤으로 전파됨). 병합 후 키 삭제, clear all data도 삭제.
  - 동기화가 켜진 뒤 바뀐 항목에는 `syncAt`(ms)이 추가로 붙는다(note/page/subject/task/card/library item/settings). 추가 필드일 뿐이라 옛 백업 파일과 호환된다. **library item의 `updatedAt`(ISO 문자열)과는 별개 필드**다(라이브러리 정렬이 `localeCompare`를 쓰므로 숫자를 넣으면 깨진다). 아직 받지 못한 클라우드 페이지의 자리표시 페이지는 `placeholder: true`로 표시되며 비어 있는 동안 업로드되지 않는다.

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
- **열면 바로 종이(2026-11-09)**: 마지막에 쓰던 노트북·페이지를 기기별 localStorage 키 `study-notes-app-chalkboard-v2:last-note`(`{noteId, page}`, 동기화 데이터 아님, `renderActivePage`가 기록, clear all data가 지움)에 두고 시작 시 `NotesModule.restoreLastPosition()`으로 복원한다(없거나 노트북이 사라졌으면 첫 노트북). 키보드 기기(`(min-width:761px) and (hover:hover)`, 모달 없을 때)는 `focusBodyIfDesktop()`이 MAIN NOTES 끝에 커서를 둔다 — 터치 기기에서는 키보드가 튀어나오므로 하지 않는다. **폰(≤760px)에서는 종이가 맨 위**: `#page-notes>.pc`를 flex column으로 두고 `order`로 notes-card(편집기 → 그 아래 fbar·노트북 목록) → 오늘 목록 → 통계 순. 상단바 `#tb-notebooks-btn`(notes 페이지·폰에서만)이 목록의 `.fbar`로 스크롤. **배너는 하단 도크**: `#banner-dock`(fixed bottom, 사이드바 폭만큼 left)에 이사 안내·백업 알림이 들어가고 `Settings.updateBannerDock()`이 `--dock-h`를 재서 `.main`의 padding-bottom으로 가려짐을 막는다(표시/숨김/resize마다 호출).
- 마지막 페이지에서 ▶ = 새 페이지(날짜 자동 오늘). 본문이 넘치면 자동 페이지 생성.
- self-test 모드: MAIN NOTES 블러 처리, CUE만 보고 회상 (코넬 복습 단계).
- 페이지 번호(N / M) 클릭 = 페이지 점프 목록(챕터·미리보기·날짜).
- 검색은 본문(body) 포함 전 필드 관통.
- 백업 리마인더 배너: 마지막 백업 후 N일(기본 7, 설정 가능, 0=끄기) 경과 시 표시. 노트 0개면 안 띄움. 샘플 데이터로 막 시작한 실행(`AppState.seededThisSession`)에서도 안 띄움(내 노트가 아니고, 새 주소에서는 이사 안내 띠가 같은 자리에서 load backup을 안내해 띠 두 개가 겹치던 문제).
- Library 등록 모달: 검색바 최상단("검색 한 번, 나머지는 확인만"), 표지 박스 하나가 클릭업로드+드래그+Ctrl+V 3-in-1(버튼 없음), Status/Progress/Rating/CallNo는 편집 모드에서만 표시, Delete는 왼쪽 빨강으로 격리.
- **Settings는 탭 6개**(2026-11-08 탭 5개로 분리, 2026-11-09 Lists 추가. 소유자가 ClassDesk처럼 나눠 달라고 요청): **Backup**(download/load backup, 리마인더 주기, 저장 용량, 맨 아래 빨간 테두리 `card-danger`로 clear all data) · **Account**(cloud sync) · **Display**(글꼴, 글자 크기) · **Lists**(아래) · **Integrations**(auto-fill 키) · **Guide**(설명서, 접기 없이 바로 펼침). 마크업은 `.stabs > .stab[data-stab]` + `.spanel#spanel-<이름>`(비활성은 `hidden`), 전환은 `Settings.showTab(name)`, 마지막 탭은 기기별 localStorage 키 `study-notes-app-chalkboard-v2:settings-tab`에 둔다(동기화 데이터 아님). 기본 탭은 Backup이라 "백업이 Settings 맨 앞"이라는 옛 약속이 유지되고, 옛 주소 안내 띠의 load backup도 Backup 탭을 연다. 사이드바에 Backup 메뉴는 없다. 옛 내부 키 `showPage('backup')`은 settings로 연결된다. 요소 id(`export-data-btn`, `sync-signin-btn` 등)는 그대로다. 그 전(2026-11-03~07)에는 카드 8개가 한 페이지에 세로로 있었다. 설명서에서 경로를 적을 때는 탭 이름을 넣는다(예: Settings → Backup → download backup).
- **Lists 탭**(2026-11-09, `Lists` 모듈): 카드 3개 — subjects / library categories / library genres. 행은 `.lrow` 그리드(이름 1fr | `.lrow-meta` 고정 칸 92/64/64px | `.lrow-actions` 60px)로 컨테이너 ≤460px에서 메타가 아래 줄로. **과목 삭제는 "옮긴 뒤 삭제"**: 사용 중(노트북·일정·카드)이면 `mo-subject-delete` 모달에서 대상 과목을 고르게 하고 subjectId를 전부 바꾼 뒤 지운다(고아 금지). 과목은 최소 1개 유지, 이름 중복(대소문자 무시) 금지. 카테고리·장르 목록은 **custom ∪ 사용 중 값**만 보여 준다(기본 프리셋 ~60개는 드롭다운에만). 이름 변경은 그 값을 쓰는 모든 library item에 적용(철자 합치기 용도. `updatedAt`은 건드리지 않음 — 라벨 변경은 자료 편집이 아니고 정렬이 흔들린다). 사용 중인 값은 삭제 버튼 대신 자리표시(`.bic-ph`)로 칸 너비 유지. 추가·이름 변경은 공용 모달 `mo-list-edit`. 노트 종류(type)는 HTML 3곳의 고정 enum + 라이브러리 type 매핑에 묶여 있어 Lists에 넣지 않았다.
- **기기 간 동기화**는 Settings → Account 탭의 cloud sync 카드에서 Google 로그인으로 켠다. 사이드바 맨 아래(`sb-foot-status`)가 상태 표시: stored only in this browser / syncing / synced · 이름 / offline · will sync / sync error. 로그아웃해도 로컬 사본은 남는다. clear all data는 로그인 중이면 로컬 사본만 지우고 재다운로드한다.
- **디자인(2026-11-03, 사용자가 시안 5개 중 "Ink sidebar" 선택)**: 사이드바는 잉크색(`--sb-bg #18181b`) 패널에 크림 로고, 선택된 메뉴는 왼쪽 노트 파랑 막대(`--sb-hi #7faed0`). 본문 바탕은 따뜻한 오프화이트 `--bg #f6f5f1`, 카드는 흰색, 선택된 노트·항목은 연한 파랑 `--accent-l #eaf2f8`. 통계 카드 상단 띠는 아이콘의 책 색(`--book1~4`: 검정·진파랑·노트 파랑·빨강). 기본 버튼은 잉크, 마우스를 올리면 진파랑. 노트 종이(크림·파란 줄·연한 빨강 세로선 `#d97a7a`)는 그대로다. 색은 모두 `:root` 변수에 있다.
- **화면 크기 대응(2026-11-04, 점검 기준: PC 전체 1920 / PC 분할 960 / 갤럭시탭 S8 가로 1280·세로 800 / 폰 세로 360~430 / 폰 가로 854×340)**: 노트 페이지 배치는 뷰포트가 아니라 **컨테이너 쿼리**로 정한다(사이드바·오늘 목록·노트북 목록이 폭을 나눠 가져서 뷰포트 기준으로는 종이 폭을 알 수 없음). `.notes-pc`(폭 ≤860이면 노트북 목록을 종이 위로, 테두리 있는 스크롤 상자로), `.editor-col`(폭 ≥640이면 ◀▶가 종이 바깥 여백에, 종이는 양옆 52px 양보. 그보다 좁으면 ◀▶가 하단 바의 페이지 번호 양옆 `.page-mini`로), `.cornell-body`(폭 ≤580이면 서식 도구줄이 정확히 두 줄 84px, CUE 쪽 `.cues-spacer`도 84px로 맞춰 줄이 어긋나지 않게). 도구줄을 가로 스크롤로 되돌리지 말 것(스크롤바가 숨겨져 있어 링크·이미지 버튼이 안 보이던 버그). 두 줄일 때는 종이 높이를 560→602px로 늘려 필기 칸(476px, 16줄)이 넓은 화면과 같다(폰은 420→462px, 필기 칸 336px). MAIN NOTES 본문은 `overflow-y:auto` + `background-attachment:local`(줄이 글과 같이 스크롤): 예전 `hidden`은 PC에서 꽉 채운 페이지를 폰에서 열면 아래 줄이 보이지도 스크롤되지도 않았다. 자동 새 페이지는 여전히 마지막 페이지에서 `scrollHeight > clientHeight`일 때 생긴다. 오늘 목록(today's study list)은 뷰포트 ≥1500px에서만 왼쪽 칼럼, 그 아래는 위에 가로형으로 쌓인다. 400px 이하 폰에서는 self-test 버튼이 아이콘만 보인다(`.btn-label`). 저장 상태 문구(`#save-status`)는 폰에서 비어 있지 않을 때만 하단 바 아래 줄에 나온다(오류 문구가 숨지 않게).
- **고정 너비 칸·짧은 설명**(2026-11-08 소유자 지적): 목록 행의 보조 칸은 내용 길이에 따라 줄마다 움직이면 안 된다. 오늘 목록·달력 날짜 모달의 행은 `.task-row` 그리드(check | title | `.task-meta` | delete)이고 `.task-meta`는 과목 배지 110px(넘치면 말줄임) · 종류 56px · go to note 고정 칸이다(좁은 컨테이너 ≤520px에서는 제목 아래 줄로 내려가고 96/52px). 새 목록을 만들 때도 가장 긴 값을 기준으로 칸 너비를 정한다. 설정 카드의 설명은 `.card-note` 한 줄 이내, 없어도 되면 없앤다(2026-11-08에 다국어 미리보기 카드와 schedule 안내 카드, 긴 문단들을 지움).
- **영어·한국어 두 언어(2026-11-10, 소유자가 판매를 염두에 두고 요청)**: 모든 사용자 문구는 app.js 상단 `I18N = { en:{…}, ko:{…} }` 한 표에 있다(키 ≈360개). **정적 HTML은 키를 적지 않는다**: `I18n.apply()`가 시작 시 텍스트 노드·placeholder·title·aria-label을 **영어 열과 정확히 일치**시켜 키를 찾아 노드에 붙이고 번역한다(언어를 바꾸면 같은 키로 다시). 사용자 데이터를 그리는 컨테이너(`SKIP_IDS`: note-list, lib-grid, 과목 select들, 상태 문구 등)와 `.guide-body`는 걷지 않으므로 "Library"라는 과목명이 번역되는 일은 없다. 영어 열의 문구를 고치면 HTML의 같은 문구도 함께 고칠 것(안 맞으면 번역이 안 됨 — scratch `i18n-check.js`가 "HTML에 표에 없는 영어 문구"로 잡는다). 키를 명시하는 곳은 넷뿐: 줄바꿈 있는 textarea 힌트 2개(cues/summary)는 `data-i18n-placeholder=`, contenteditable인 MAIN NOTES(`notes-body`)의 힌트는 속성 이름이 `data-placeholder`라 `data-i18n-data-placeholder="cornell.bodyPh"`, 한국어 제목(설명서)은 `data-i18n=`. 스킵 컨테이너(`SKIP_IDS`)는 **내용만** 건너뛰고 자기 자신의 `aria-label`/`title`/`placeholder`/`data-placeholder`는 번역한다. 백업 불러오기·클라우드 설정 변경으로 언어가 바뀌면 `App.renderAll()` 첫 줄의 `I18n.syncLanguage()`가 정적 문구를 다시 번역한다. **동적 문구는 `tx('key', {vars})`**(= `I18n.t`; `t`는 지역 변수로 많이 쓰여 별칭이 `tx`), 개수는 `I18n.tn('key', n)`로 `{n}`과 `(s)`를 처리(한국어는 `노트북 {n}개`). 저장값(type/status/category/genre/샘플 데이터)은 영어 그대로 두고 **표시만** `tx('type.'+v)`, `lt.`, `statusLabel()`로 바꾼다. 언어는 `settings.lang`(동기화·백업에 포함), 처음 값은 `I18n.detect()`(브라우저 언어가 ko면 ko), 스위치는 Settings → Display → language(`#lang-select`)이고 바꾸면 `I18n.apply()` + `Nav.refreshTitle()` + `App.renderAll()` + `NotesModule.refreshEditor()` + `Sync.refreshStatus()`로 새로고침 없이 바뀐다. 날짜는 `I18n.locale()`(en-US/ko-KR). 설명서는 `.guide-body[lang=ko]`와 `[lang=en]` 두 벌이고 `I18n.applyGuide()`가 현재 언어만 보인다 — **한국어 설명서는 화면의 한국어 이름을 그대로 쓴다**(예: "설정 → 백업 → 백업 받기", FAQ의 오류 문구도 한국어 표 값 그대로. 한국어 모드에서만 보이므로 영어 버튼 이름을 쓰면 화면과 안 맞는다. 표의 ko 값을 바꾸면 설명서의 같은 이름도 바꿀 것) — **변경 이력은 두 벌에 같은 줄을 더하고**(버전 = 항목 수라 둘이 같아야 함) 기준일도 둘 다 올린다. **교차검증**(PR마다): scratch `i18n/i18n-check.js`(키 집합 동일·빈 값 0·`{자리표시}` 동일·코드가 참조하는 키 존재·안 쓰는 키 0·HTML의 표 밖 영어 문구 0)와 `i18n/i18n-ui.js`(두 언어로 전 페이지·탭·모달을 열어 한국어 모드에 영어 단어, 영어 모드에 한글이 남아 있으면 실패. 고유명사 허용 목록 `ALLOW`, 데이터 컨테이너 제외. 전환이 새로고침 없이 되고 저장되는지도 확인).
- Settings에 한국어 사용 설명서(guide) 내장 — **기능 바꾸면 설명서도 같이 갱신** (FAQ는 실제 겪은 문제의 에러 문구 그대로). 설명서 끝에 **변경 이력**(날짜 + 한 줄, 최신이 위)과 **기준일**(`.guide-foot`)이 있다(2026-11-08 소유자 요청). 사용자가 체감하는 변경(동작·화면·주소·설치·데이터·백업)은 **같은 PR에서** 변경 이력에 한 줄 더하고 기준일을 그날로 올린다. **앱 버전**(2026-11-09, 소유자 요청으로 ClassDesk처럼): app.js 상단 `APP_VERSION`/`APP_UPDATED`가 사이드바 왼쪽 아래 `#sb-foot-ver`에 "v12 · 2026-11-09"로 나온다. 버전 = 변경 이력 항목 수. 변경 이력에 줄을 더하는 PR에서 둘 다 올린다(scratch의 version 검사가 세 곳 일치를 확인). 내부 리팩터링·문서만 바뀐 PR은 생략. 해당 기능 섹션·FAQ도 같이 고친다.

## 현재 코드 구조 (app.js, IIFE 모듈)

Icons(인라인 SVG, CDN 금지 — 아이콘 폰트 차단으로 빈 네모 버그 겪음) → I18N(문자열 표) → Utils → I18n(번역 적용) → Storage(probe/fail-open/손상보관) → AppState(+migrateNotesToPages: 로드마다 전체 스키마 복구) → Modal → Nav → Subjects → NotesModule → Library → Schedule → Flashcards → Settings → Lists(Settings → Lists 탭) → Stats → SyncCore/Sync → App(boot try/catch 오버레이).

### 동기화 (SyncCore + Sync, app.js)
- **구성**: Firebase Auth(Google) + Firestore. `FIREBASE_CONFIG`(app.js 상단)가 null이면 완전히 비활성. SDK는 `vendor/firebase/*-compat.js`(자체 호스팅, 10.14.1)를 필요할 때만 `<script>`로 로드하고 실패 시 gstatic CDN으로 폴백. 규칙은 `firestore.rules`(uid 트리만 읽기/쓰기).
- **클라우드 구조**: `users/{uid}/` 아래 `subjects|notes|recurring|adhocTasks|cards|library/{id}`, `pages/{noteId}_{idx}`(노트 문서에는 pages 대신 `pageCount`), `completions/{date|taskKey}`({done:true}), `meta/settings`. 모든 문서에 `syncAt`(기기 시각 ms). 삭제는 `{deleted:true, syncAt}` 톰스톤.
- **규칙**: 문서 단위 last-write-wins(`syncAt` 비교). 페이지는 인덱스 기반 문서라 페이지 삭제는 항상 끝에서만 잘리는 것으로 가정(앱의 페이지 삭제 동작과 일치). 900KB를 넘는 문서는 보내지 않고(스탬프도 찍지 않아 줄어들면 다시 시도) Settings 페이지 cloud sync 칸에 빨간 글씨로 표시(이미지 과다 페이지).
- **흐름**: `Storage.save()`가 `Sync.collectChanges()`(스냅샷과 정규화 JSON 비교 → 바뀐 것에 syncAt 스탬프)를 먼저 부르고 localStorage에 쓴 뒤 `Sync.push()`(400개씩 batch). 로그인 직후 `initialMerge()`가 전체를 내려받아 LWW로 합친 다음에야 `ready`가 되어 push가 시작된다(앱 시작이 클라우드를 덮어쓰는 일 방지). 샘플 데이터만 있던 새 기기(`AppState.seededThisSession` + 시드 직후 `seedFingerprint`와 현재 내용이 같을 때만)는 클라우드에 데이터가 있으면 샘플을 버린다. 컬렉션별 리스너가 따로 오므로 노트 헤드보다 먼저 온 페이지 문서는 `pendingPages`에 두었다가 헤드가 오면 적용하고 그때 스냅샷에 넣는다. push 실패 시 스냅샷을 이전 값으로 되돌려 put과 톰스톤 모두 다음 저장에서 재시도된다. 편집기(`saveCurrentFields`)와 할 일 체크(`setTaskDone`)는 로그인 중이면 입력 즉시 `syncAt`을 찍는다(디바운스 저장 전에 도착한 더 오래된 원격 사본이 타이핑 중인 내용을 덮지 못하게). 원격 문서가 로컬보다 오래돼 거부되면 리스너가 바로 `push(collectChanges())`로 우리 사본을 다시 보내 클라우드가 즉시 최신으로 수렴한다(다른 기기의 오프라인 쓰기가 늦게 도착하는 경우). 한 세션의 push는 `pushQueue`로 직렬화되고(400개 묶음이 서로 끼어들지 않음), `generation` 카운터로 로그아웃/재로그인 이후 도착한 옛 세션의 비동기 결과(첫 다운로드·배치)는 무시한다. 첫 다운로드가 `unavailable`/오프라인으로 실패하면 `offline · download pending` 상태로 두고 `online` 이벤트에서 `start()`를 다시 부른다. 이후 컬렉션별 `onSnapshot`이 원격 변경을 LWW로 반영하고, 사용자가 타이핑 중(마지막 input 2.5초 이내)이면 화면 갱신을 미룬다. `NotesModule.refreshEditor()`는 현재 페이지 인덱스를 유지한 채 편집기를 다시 그린다.
- **백업 import와의 관계**: import로 바뀐 내용도 diff를 통해 그대로 클라우드에 반영된다(없어진 id는 톰스톤). 즉 백업 복원은 모든 기기에 전파된다.
- **검증**: `SyncCore`는 window에 노출돼 Node 시뮬레이션(scratch의 sync-core.test.js)으로 diff/merge/톰스톤/용량 케이스를 돌린다. 실제 Firebase 왕복은 콘솔 프로젝트가 있는 기기에서 수동 확인.

외부 API (Library 자동채우기): Google Books(키 불필요, intitle:), MusicBrainz, Crossref, TMDB(선택 — settings.tmdbKey, 없으면 영화 검색만 비활성·수동입력 가능). 모든 fetch: navigator.onLine 체크 + AbortController 15초 + 429/401·403 친절 메시지.

## 검증 워크플로우 (변경마다 돌리던 것 — 유지 권장)
1. `node -c app.js` (문법)
2. JS의 `Utils.$('id')` 참조 ↔ HTML id 전수 대조 (누락 0)
3. HTML 태그 여닫이 균형 (div/button/select/span/dl/dt/dd/details/summary/p...)
4. `data-icon` 사용처 ↔ Icons.paths 정의 대조
5. CSS 중괄호 균형
6. 핵심 로직은 Node 시뮬레이션으로 케이스 검증 (예: seriesKey, nextCallNo, computeLevel, 날짜 계산)

## 배포 산출물 (현재 방식)
- **배포 주소(2026-11-04부터): Netlify https://amber-studydesk.netlify.app/** — 소유자의 Netlify 계정(GitHub 로그인)이 이 저장소에 연결돼 `main`에 push하면 저장소 루트를 그대로 배포한다(빌드 없음, Build command·Publish directory 비움). PR마다 deploy preview도 생긴다. 앱 코드의 `APP_HOME`(app.js 상단)이 이 주소다. Netlify 무료 플랜에서 2026-08-19 이후 만든 프로젝트는 화면 오른쪽 아래에 **"Powered by Netlify" 배지**가 떠서 하단 버튼(오늘 목록의 add 등)을 가린다. 코드로는 못 끄고 Netlify의 Project configuration → General → Powered by Netlify badge에서 끈다(새 앱마다).
- **옛 주소 GitHub Pages https://amber67-git.github.io/studydesk/ 는 이사 안내용으로만 유지**: `.github/workflows/pages.yml`이 계속 같은 파일을 배포한다. 그 호스트에서만 (1) 상단 안내 띠(`#move-banner`, `Settings.checkMoveBanner`)가 백업 받기·새 주소 열기를 안내하고 (2) index.html의 인라인 스크립트가 manifest 링크를 지워 Chrome이 **설치를 권하지 않게** 한다(앱 자체는 그대로 동작, 데이터 자동 삭제 없음). 수동 "홈 화면에 추가"까지 막을 수는 없어서 안내 띠·설명서가 "옛 주소로 설치하지 말 것"을 따로 말한다. 새 주소에서는 첫 방문(샘플 데이터)일 때만 같은 띠가 load backup을 안내하고, 백업을 불러오면 사라진다.
- **왜 옮겼나 (같은 origin 규칙 — 소유자의 모든 앱에 적용)**: amber67-git 계정의 GitHub Pages 사이트는 전부 `amber67-git.github.io/<저장소>/`라 origin이 하나다. **현재 안드로이드 Chrome은 한 origin에 웹앱을 하나만 설치한다** (Chromium에 버그로 보고됨: issues.chromium.org/issues/572287931, 중복 568841400. 고쳐질 때까지 이 전제로 운영)(2026-11-04 소유자 폰에서 양방향 확인: ClassDesk WebAPK가 있으면 StudyDesk가, StudyDesk WebAPK가 있으면 ClassDesk가 "This app is already installed" / "Could not open app". `chrome://webapks`상 각 앱의 Scope·Manifest Id가 자기 폴더로 정상이어도 막혔다). 같은 origin은 localStorage(~5MB)·IndexedDB·캐시도 공유해서 한 앱의 "사이트 데이터 삭제"가 다른 앱 데이터까지 지운다. 그래서 **설치형 앱은 앱마다 자기 origin**을 쓴다: ClassDesk만 `amber67-git.github.io/classdesk/`에 남고, 나머지와 새 앱은 Netlify 사이트 하나씩(`<이름>.netlify.app`). 처음엔 원인을 "Chrome의 옛 설치 기록"(PR #7, StudyDesk id 추가), 다음엔 "ClassDesk manifest의 `id: "./"`"(StudyDesk PR #9, classdesk PR #4 = ClassDesk v116)로 잘못 짚었다. 두 수정은 해롭지 않아 그대로 두지만 문제를 풀지 못했다. 안드로이드 설치 문제는 `chrome://webapks`와 설치 창 스크린샷으로 먼저 확인하고 고칠 것.
- **PWA**: `manifest.webmanifest` + `sw.js` + `icons/`. 아이콘은 `tools/make-icons.py`(Pillow)로 생성한다: 줄 노트 종이 위에 왼쪽→오른쪽으로 키가 커지는 책 4권(검정→진파랑→노트 파랑→빨강) + 파란 책장 선. 앱 색상(종이 `#fdfcf7`, 노트 줄 `#7faed0`, 잉크 `#18181b`, 포인트 `#b91c1c`)만 쓴다. 64px 이하(탭용 `favicon-32.png`)에서는 바탕 줄을 생략한다. 아이콘을 바꾸면 `sw.js`의 `CACHE` 버전을 올릴 것(안 올리면 설치된 앱이 옛 아이콘을 계속 쓴다). manifest의 **`id`는 `"/studydesk/app"`로 고정, 다시 바꾸지 말 것**: id는 origin 기준 경로로 해석된다. 같은 파일이 두 주소에서 서빙되므로 새 주소에서는 `https://amber-studydesk.netlify.app/studydesk/app`(그 origin 안이라 유효), 옛 주소에서는 `.../studydesk/app`(옛 설치와 같은 값)이 된다. `"./app"`이나 `"/app"`으로 바꾸면 옛 주소에서 `amber67-git.github.io/app`이 되어 같은 origin의 다른 프로젝트와 겹친다. Chrome은 설치된 앱을 이 id로 식별하므로 바꾸면 별개의 두 번째 앱이 생긴다. 서비스 워커는 앱 셸만 캐시한다(루트 문서 `./`와 style.css/app.js는 network-first, 폰트·아이콘·manifest는 cache-first, Google Fonts는 stale-while-revalidate). 루트가 아닌 같은 origin의 다른 문서로 이동하는 요청은 캐시하지 않고 오프라인이면 루트로 리다이렉트한다. 외부 API(Google Books/MusicBrainz/Crossref/TMDB/표지 이미지)는 가로채지 않는다. localStorage는 건드리지 않는다. 등록은 app.js `App.init` 끝에서 http(s)일 때만 하므로 file://로 열어도 동작한다. 셸 파일을 추가하면 `sw.js`의 SHELL 목록에도 넣을 것(하나라도 404면 install 전체가 실패한다).
- 3파일 분리본(index.html/style.css/app.js) + **단일 HTML 병합본**(link/script 태그를 inline style/script 블록으로 치환). 병합 스크립트는 단순 문자열 치환이라 두 태그가 정확히 1개씩이어야 함.
- 라틴 웹폰트는 `fonts/`(woff2 8개, ~250KB)에 자체 호스팅하고 style.css 상단 `@font-face`에서 `src: url(fonts/...), url(https://fonts.gstatic.com/...)` 순으로 선언한다. 병합본을 fonts/ 없이 단독으로 열어도 두 번째 src(CDN)로 넘어가므로 같은 글꼴이 나온다. CJK 손글씨 3종(Nanum Pen Script/Yomogi/Zhi Mang Xing)은 Google Fonts가 각 ~100개 조각으로 쪼개 주기 때문에 번들하지 않고 CDN `<link>`를 유지한다.

## 미해결 과제 (우선순위순)
1. **모바일 폰트 불일치 (해결, Android에서 확인)** — PC와 폰에서 글씨체가 다르게 보이던 문제. 원인으로 확인된 것: 글꼴 스택의 마지막이 generic `cursive`였고, 웹폰트가 실패하면 Android는 Dancing Script, iOS는 Snell Roundhand를 골라 기기마다 다른 글씨가 됐다. 조치: 라틴 폰트 자체 호스팅(`fonts/`) + 스택 끝을 시스템 한글 고딕 → `sans-serif`로 교체(위 배포 산출물 참조). 남은 확인: 폰에서 실제로 같은 글꼴이 나오는지 사용자 확인. 여전히 다르면 "폰에서 어떻게 열었는지(파일 직접 / 서버) / 손글씨가 아예 안 나오는지 vs 다른 손글씨인지"를 받아 진단.
2. **Google Books API 키 입력란 (선택)** — 429 "search limit reached" 재발 시 추가. TMDB 키 입력란(Settings → auto-fill)과 동일 패턴, 키 있으면 `&key=` 붙이기. 무료 1,000회/일.
3. **배포 + PWA 설치 (완료, 2026-11-04 주소 이사)** — https://amber-studydesk.netlify.app/ (Netlify). 옛 GitHub Pages 주소는 이사 안내만(위 배포 산출물 참조). 홈 화면 설치·오프라인 동작. 데이터는 여전히 기기별(5번에서 해결). 설명서에 설치 방법과 "주소 이사" 섹션 있음.
4. **구글 캘린더 단방향 가져오기** — 설계 합의됨: 전용 "공부" 캘린더 구독 방식, OAuth 클라이언트 필요, localhost에서 동작. 가져온 일정→subject 매핑 규칙 필요.
5. **기기 간 실시간 동기화 (구현 완료, Firebase 설정 대기)** — 위 '동기화' 절 참조. 남은 일: 소유자가 Firebase 프로젝트(studydesk 전용, ClassDesk와 별개)를 만들고 웹 설정을 `FIREBASE_CONFIG`에 넣기, `firestore.rules` 게시, Authentication에 Google 로그인과 승인 도메인(**amber-studydesk.netlify.app**. 옛 주소에서는 로그인을 지원하지 않아도 된다) 등록, 로그인 1회 후 신규 가입 차단. ※ ClassDesk(학생 관리)와 이 앱은 다른 프로젝트 — 혼동 주의.

## PR 리뷰 (CodeRabbit)
- 2026-11-10부터 CodeRabbit이 별 10개 미만 저장소는 **자동 검토를 하지 않는다**. PR을 올리거나 커밋을 푸시한 뒤 PR에 `@coderabbitai review` 댓글을 달아야 검토가 돈다(증분 검토라 새 커밋만 본다). 무료 한도는 **시간당 1회**라, 지적을 고칠 때는 한 번에 모아 푸시하고 다시 요청한다.

## 사용자 작업 스타일
- 한국어, 짧은 지시. 근본 원인 설명을 원함. 문제는 빨간 펜 스크린샷으로 보고.
- "검증까지 포함해서 끝내라"가 기본 기대치. 변경 후 위 검증 워크플로우 + 실패 케이스 시뮬레이션을 돌리고 결과를 보고할 것.
- 큰 변경 전에는 백업(export) 경로가 살아있는지 먼저 확인.
