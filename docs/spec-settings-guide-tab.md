> **원본 설계 스펙 (역사 기록용).** 범용 템플릿이라 `<i class="아이콘">` 자리표시자를 쓰지만, 실제 구현은 `<span class="icon" data-icon="help" aria-hidden="true"></span>` 인라인 SVG 패턴을 쓴다(`CLAUDE.md` 아이콘 규칙: 아이콘 폰트·CDN 금지).

웹앱의 Settings 페이지에 "Guide"(사용 설명서) 탭을 추가해줘. 단일 HTML 구조 기준.

## 구조
### 1. Settings가 탭 방식인 경우 (권장)
- 기존 탭 버튼 줄 끝에 추가: <button class="stab-btn" onclick="switchSettingsTab('guide')">Guide</button>
- 기존 탭 전환 함수가 id 규칙(예: "st-"+탭이름)으로 pane을 토글한다면 JS 수정 없이
  <div class="stab-pane" id="st-guide">…</div> 만 추가하면 작동함 — 먼저 전환 함수 확인할 것
### 2. Settings가 카드 나열식인 경우
- 맨 아래에 카드 하나 추가, 내용이 길므로 접기(details/summary) 또는 "설명서 열기" 버튼 → 모달

## 마크업
<div class="stab-pane" id="st-guide">
  <div class="card">
    <div class="ch"><div class="ct"><i class="아이콘"></i>{제품명} 사용 설명서</div></div>
    <div class="cb p guide-body">
      … h3 섹션들 …
    </div>
  </div>
</div>
※ 기존 앱의 카드 클래스(.card/.ch/.cb 등)를 그대로 재사용해 디자인 통일

## 전용 타이포그래피 CSS (.guide-body 스코프로만 적용, 앱 전역 오염 금지)
.guide-body{font-size:13px;line-height:1.65;max-width:760px}
.guide-body h3{font-size:14px;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--bdr)}
.guide-body h3:first-child{margin-top:0}
.guide-body p{margin:0 0 10px}
.guide-body ul,.guide-body ol{margin:0 0 10px;padding-left:20px}
.guide-body li{margin-bottom:5px}
.guide-body dl{margin:0 0 10px}
.guide-body dt{font-weight:700;margin-top:8px}
.guide-body dd{margin:2px 0 0;padding-left:14px;color:var(--txt2)}
※ 색상은 앱의 CSS 변수(var(--txt) 등) 재사용

## 내용 구성 (이 순서로 작성)
1. <h3>{제품명}이란?</h3> — 한 문단 소개(누구를 위한, 무엇을 해결). 
   핵심 특징 3개를 <ul>로: 설치/실행 방식, 데이터 저장 방식(프라이버시), 대표 자동화 기능
2. <h3>페이지별 기능</h3> — <dl>로 네비게이션의 모든 페이지를 순서대로,
   <dt>페이지명</dt><dd>한 줄 설명</dd>. 핵심 페이지는 "아래 상세 참고" 표기
3. <h3>{핵심 기능} 자세히</h3> — 제품의 대표 기능 1~2개를 단계별로 상세히.
   실제 버튼 이름을 <b>굵게</b> 표기, 자동화 조건("~하면 자동으로")을 명시
4. <h3>{주요 워크플로우}</h3> — 사용자가 반복할 작업을 <ol> 번호 순서로
   (필요한 외부 준비물, 설정값을 정확한 수치로)
5. 선택 기능 섹션 — API 키 등 설정이 필요한 기능은 "선택사항" 표기 후 발급~등록 단계
6. <h3>데이터 보관 — 꼭 읽어주세요</h3> — 저장 위치, 백업/복원 방법,
   데이터가 사라지는 조건을 경고. (localStorage 앱이면 브라우저 데이터 삭제 경고 필수)
7. <h3>자주 묻는 질문</h3> — 주제별 소제목(<p><b>)으로 묶은 <dl>.
   ★ 개발 중 실제로 겪었던 모든 문제를 증상(사용자가 보는 에러 문구 그대로) → 원인 → 해결 순으로.
   추측성 FAQ보다 실제 발생했던 문제가 우선

## 작성 톤
- 판매용 제품 매뉴얼 톤: 존댓말, 간결, 기능명은 UI에 표시되는 영문 그대로 + 굵게
- 에러 메시지는 화면에 뜨는 문구 그대로 인용 (사용자가 검색하듯 대조할 수 있게)
- 개인화된 값(소유자 이름 등)이 있다면 판매 버전에서는 일반화하거나 커스터마이징 방법 안내

## 검증
- 작성 후 h3/ul/ol/dl/dt/dd/p 여닫이 태그 수 일치 확인
- 탭 전환 동작 확인 (기존 탭들과 충돌 없는지)

핵심 포인트만 짚으면:

기존 탭 시스템에 얹기 — 대부분의 탭 전환 함수는 id 규칙만 맞으면 자동으로 작동해서, JS 한 줄 안 건드리고 버튼+pane만 추가하면 돼요. 단, 먼저 전환 함수를 확인하라는 지시가 중요해요.
.guide-body 스코프 CSS — 설명서용 타이포그래피가 앱 전체 스타일을 오염시키지 않게 격리하는 게 핵심이에요.
내용 7단 구성 — 소개 → 페이지별 → 핵심 기능 상세 → 워크플로우 → 선택 설정 → 데이터 경고 → FAQ. 어떤 제품이든 이 뼈대면 매뉴얼이 돼요.
FAQ는 실제 겪은 문제로 — 이게 제일 중요한 원칙이에요. 개발하면서 실제로 부딪힌 오류(에러 문구 그대로)를 넣어야 구매자가 같은 상황에서 바로 찾아요.