# StudyDesk

A personal study notes app (formerly "My notebook") — Cornell-style notebooks, a study-material library (books, films, courses with API auto-fill), a recurring/one-off schedule, and flashcards. Pure HTML/CSS/JS, no build step, no backend. All data lives in the browser's `localStorage`.

## Running it

Just open `index.html` in a browser. No server, no install.

For live-reload while editing in VS Code, the **Live Server** extension works well:
1. Install the "Live Server" extension (ritwickdey.LiveServer)
2. Right-click `index.html` → "Open with Live Server"

## File structure

- `index.html` — markup only
- `style.css` — all styles
- `app.js` — all behavior, organized into modules (see the header comment at the top of the file for the module map: Utils, Icons, Storage, AppState, Subjects, NotesModule, Schedule, Flashcards, Settings, Stats, App)

## Data model

- **Subject** (economics, french...) — top-level grouping
- **Notebook** (a "note" in the code) — one activity within a subject, identified by `subjectId` + `type` (lecture / book / movie / project / self-study / other). A subject can have multiple notebooks, one per type.
- **Page** — each notebook holds a list of pages. Subject/type/topic stay fixed across pages; chapter, tags, and date vary per page and auto-advance as you write.

## Storage

Everything is saved to `localStorage` under the key `study-notes-app-chalkboard-v2` (kept as-is from an earlier name so existing saved data isn't lost — renaming this key would make the app act like all your notebooks vanished). Clearing browser storage wipes everything, so use Settings → data → **download backup** regularly; **load backup** restores from that JSON file and also works for moving notes to another browser or computer. There is no cloud sync yet.

## Known limitations

- No backend — nothing syncs across devices/browsers
- Images pasted into notes are stored as base64 in localStorage, so don't paste too many large screenshots (a few MB total storage limit)

## For Claude Code (인수인계)

이 프로젝트를 Claude Code로 이어서 개발한다면 **`CLAUDE.md`부터 읽을 것** — 데이터 호환성 계약(localStorage 키·백업 JSON 형식·스키마), 깨면 안 되는 도메인 규칙, 검증 워크플로우, 미해결 과제가 정리되어 있다. 스택을 바꾸더라도(React/Vue/네이티브 등) CLAUDE.md의 "재작성 시에도 살아남아야 하는 것" 섹션은 그대로 적용된다. `docs/`에는 기능별 원본 설계 스펙이 있다.
