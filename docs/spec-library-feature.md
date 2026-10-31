> **원본 설계 스펙 (역사 기록용).** claude.ai 대화에서 기능을 처음 요청할 때 쓴 문서다. 현재 계약은 `CLAUDE.md`가 우선한다.
> 이 문서의 AR/Lexile 읽기 레벨 예시와 `level` 필드는 구현에 채택되지 않았다. StudyDesk는 성인용이라 책에 읽기 레벨이 없고, 저장 필드는 `levelInput`이며 배지는 거기서 파생된다.

아이템 라이브러리(책/영화/논문/레시피 등) 관리 기능을 추가해줘. 
핵심 철학: "사용자는 제목만 입력하고, 나머지는 앱이 채운다."

## 1) 자동 채우기 (Google Books API — 무료, 키 불필요)

모달 상단에 검색창 + Search 버튼. 제목 입력 → 결과 8개를 썸네일과 함께 리스트로 표시 → 
클릭하면 폼에 자동 입력:
  fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8`)
  → items[].volumeInfo에서 title, authors, publisher, industryIdentifiers(ISBN_13 우선), 
    imageLinks.thumbnail, categories 추출

자동 채울 때 반드시 적용할 정규화:
- **전체 대문자 이름 교정**: "MARC BROWN" → "Marc Brown". 
  단, 문자열 전체가 대문자일 때만 변환할 것. "HarperCollins"나 "J.K. Rowling"은 건드리지 않음.
  하이픈·어포스트로피 처리 필수: "JEAN-PAUL" → "Jean-Paul", "O'BRIEN" → "O'Brien"
```js
  function titleCaseIfAllCaps(s){
    if(!s)return s||"";
    const letters=s.replace(/[^A-Za-z]/g,"");
    if(!letters||letters!==letters.toUpperCase())return s;  // 이미 정상 → 그대로
    return s.toLowerCase().replace(/(^|[\s\-'’.])([a-z])/g,(m,p,c)=>p+c.toUpperCase());
  }
```
- **분류 매핑**: Google의 BISAC 문자열("Juvenile Fiction / Animals / Bears")을 
  우리 앱의 장르 프리셋으로 번역. 키워드 정규식 규칙 배열로 순차 매칭, 
  매칭 실패 시 null 반환 → 호출부에서 원문을 그대로 옵션으로 주입.

## 2) 두 축의 분류 (중요)

Category(형태)와 Genre(주제)를 **별개 필드**로 둘 것. 흔한 실수가 이 둘을 합치는 것.
- Category = 형태: Picture Book, Chapter Book, Novel, Graphic Novel, Non-fiction …
- Genre = 주제: Animals, Adventure, Mystery, Humor, Science & Nature …

UI는 **datalist가 아니라 <select> 드롭다운**으로. 
(datalist는 값이 채워지면 목록이 안 떠서 재선택이 불가능 — 실제로 겪은 문제)
옵션 구성: 프리셋 + 라이브러리에 이미 쓰인 값(중복 제거) + 현재 레코드 값 + 맨 끝에 "+ Custom…".
"+ Custom…" 선택 시 prompt()로 자유 입력 받고 옵션에 주입 후 선택.

## 3) 시리즈/저자 상속 (반복 입력 제거)

같은 저자의 책을 연달아 등록할 때 매번 분류를 고르는 건 낭비. 
Google Books 채우기 직후 + 저자 입력칸 blur 시점에 실행:

1. 같은 저자(대소문자·공백 무시)의 기존 항목을 라이브러리에서 검색
2. 그중 **제목의 첫 유의미 단어가 같으면 같은 시리즈**로 판단해 우선 
   (관사 a/an/the 제거, 어포스트로피 등 특수문자 제거 → "Arthur's Tree House"와 
    "Arthur and the Big Snow"가 둘 다 "arthur"로 매칭)
3. 가장 최근 항목의 Category/Genre를 가져옴
4. **빈 칸일 때만 채움** — 사용자가 이미 고른 값은 절대 덮어쓰지 않음

우선순위: ①시리즈/저자 상속 → ②Google 분류 매핑 → ③빈 칸

## 4) 커버 이미지

- Google Books 썸네일 URL을 그대로 저장 (문자열이라 용량 거의 0)
- 파일 업로드 / 클립보드 붙여넣기 / 드래그앤드롭 모두 지원
- **업로드 이미지는 반드시 압축 후 저장**: canvas로 최대 520px 리사이즈 + JPEG 0.85. 
  안 하면 폰 사진 한 장(3~5MB)에 localStorage(약 5MB)가 터짐
- 표시는 object-fit:cover + object-position:center로 통일 (박스를 꽉 채우고 중앙 크롭)
- "Search Google Images" 링크: 제목을 클립보드에 복사하고 구글 이미지 검색을 새 탭으로 열기 
  → 더 좋은 커버를 찾아 붙여넣게

## 5) 자동 계산 필드 + 고유번호

- 레벨/등급 같은 파생값은 입력받지 말고 **다른 필드에서 자동 계산**해 뱃지로 표시 
  (예: AR 3.1 → "Blue · L5"). 입력 즉시 갱신
- 고유번호(청구기호) 자동 부여: `{등급접두어}-{순번2자리}` (예: B5-07). 
  저장 시 빈 칸이면 해당 등급의 최대 순번+1로 채움. 
  **삭제해도 번호를 재배열하지 말 것** (이미 라벨을 붙여놨을 수 있음)

## 6) 목록 UI

- 필터: 각 분류 축마다 드롭다운. 옵션은 **실제 데이터에 존재하는 값만** 동적으로 생성 
  (빈 카테고리가 목록에 뜨면 지저분함)
- 검색: 제목·저자·출판사·ISBN·고유번호·장르·메모를 한 번에 관통
- 체크박스 다중 선택 → 선택 시 나타나는 액션 버튼:
  - **일괄 편집**: 선택 항목의 Category/Genre를 한 번에 변경. 
    각 필드에 "(keep — 변경 안 함)" 옵션을 둬서 하나만 바꿀 수 있게
  - 기타 대량 작업(인쇄/내보내기 등)
- 컬럼 표시/순서/이름을 사용자가 커스터마이즈 가능하게 (설정에서)

## 7) 방어 코드 (필수)

- localStorage 쓰기는 반드시 try/catch + **실패 시 사용자에게 알림**. 
  조용히 삼키면(`catch{}`) 저장 실패를 모른 채 새로고침 후 데이터를 잃음
- 모든 fetch에 AbortController 15초 타임아웃 + `navigator.onLine` 체크
- HTTP 429(할당량 초과) / 403(키 거부)는 원문 에러 대신 해결 방법을 안내
- 숫자 입력은 clamp (음수·비현실적 값 차단)

## 8) 스키마

{ id, title, author, illustrator, publisher, isbn, coverUrl,
  category, genre, callNo, level(자동계산), rating, notes,
  createdAt, updatedAt }