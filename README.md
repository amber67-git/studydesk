# StudyDesk

A personal study notes app (formerly "My notebook") — Cornell-style notebooks, a study-material library (books, films, courses with API auto-fill), a recurring/one-off schedule, and flashcards. Pure HTML/CSS/JS, no build step, no backend. All data lives in the browser's `localStorage`.

## Running it

**Hosted:** https://amber67-git.github.io/studydesk/ (GitHub Pages, deployed from `main` by `.github/workflows/pages.yml`; one-time setup: repository Settings → Pages → Source: "GitHub Actions"). On a phone, open that URL and use "Add to Home Screen" / "Install app": StudyDesk is a PWA, so the installed app opens full-screen and works offline (`manifest.webmanifest`, `sw.js`). Sign in with Google on the Backup page to sync across devices (see below).

**Local:** just open `index.html` in a browser. No server, no install. (The service worker only registers over http(s), so offline caching is not active from `file://`.)

For live-reload while editing in VS Code, the **Live Server** extension works well:
1. Install the "Live Server" extension (ritwickdey.LiveServer)
2. Right-click `index.html` → "Open with Live Server"

## Sync (cross-device)

Optional. `Backup → cloud sync → sign in with Google` on each device. Firebase Auth (Google) + Firestore, one tree per user (`users/{uid}/…`), per-document last-write-wins on `updatedAt`, tombstones for deletions, offline queue via Firestore persistence. Only changed documents are written; pages are separate documents so images never hit the 1 MB document limit. The SDK is self-hosted in `vendor/firebase/`; the project config lives in `app.js` (`FIREBASE_CONFIG`), security rules in `firestore.rules`. Without a config the app is local-only.

## File structure

- `index.html` — markup only
- `style.css` — all styles
- `vendor/firebase/` — Firebase compat SDK (app, auth, firestore); `firestore.rules` — security rules to paste into the console
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA install metadata, offline service worker (app shell only; API calls are never cached) and app icons
- `fonts/` — self-hosted Latin webfonts (Patrick Hand, Architects Daughter, Inter, JetBrains Mono); the CJK handwriting fonts load from Google Fonts
- `app.js` — all behavior, organized into modules (see the header comment at the top of the file for the module map: Icons, Utils, Storage, AppState, Modal, Nav, Subjects, NotesModule, Library, Schedule, Flashcards, Settings, Stats, App)

## Data model

- **Subject** (economics, french...) — top-level grouping
- **Notebook** (a "note" in the code) — one activity within a subject, identified by `subjectId` + `type` (lecture / book / movie / project / self-study / other). A subject can have multiple notebooks, one per type.
- **Page** — each notebook holds a list of pages. Subject/type/topic stay fixed across pages; chapter, tags, and date vary per page and auto-advance as you write.

## Storage

Everything is saved to `localStorage` under the key `study-notes-app-chalkboard-v2` (kept as-is from an earlier name so existing saved data isn't lost — renaming this key would make the app act like all your notebooks vanished). Clearing browser storage wipes everything, so use the **Backup** page → **download backup** regularly; **load backup** restores from that JSON file and also works for moving notes to another browser or computer. There is no cloud sync yet.

## Known limitations

- No backend — nothing syncs across devices/browsers
- Images pasted into notes are stored as base64 in localStorage, so don't paste too many large screenshots (a few MB total storage limit)

## For Claude Code (인수인계)

이 프로젝트를 Claude Code로 이어서 개발한다면 **`CLAUDE.md`부터 읽을 것** — 데이터 호환성 계약(localStorage 키·백업 JSON 형식·스키마), 깨면 안 되는 도메인 규칙, 검증 워크플로우, 미해결 과제가 정리되어 있다. 스택을 바꾸더라도(React/Vue/네이티브 등) CLAUDE.md의 "재작성 시에도 살아남아야 하는 것" 섹션은 그대로 적용된다. `docs/`에는 기능별 원본 설계 스펙이 있다.
