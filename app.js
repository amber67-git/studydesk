/* ============================================================================
 * StudyDesk - application script
 *
 * Modular layout, organized like a Python package:
 *
 *   Icons          - inline SVG icon set + auto-hydration (no icon font)
 *   Utils          - small generic helpers (DOM, ids, dates, escaping)
 *   Storage        - localStorage read/write with debounced save
 *   AppState       - the single source of truth + sample data seeding
 *   Modal          - generic modal open/close + backdrop handling
 *   Nav            - sidebar page switching + mobile drawer
 *   Subjects       - subject CRUD
 *   NotesModule    - notebook list + cornell editor + format commands + images
 *   Library        - study-material catalog + API auto-fill (books, films, courses...)
 *   Schedule       - calendar + today's list + recurring/one-off tasks
 *   Flashcards     - card grid + study mode
 *   Settings       - font style + text size + data reset
 *   SyncCore/Sync  - cross-device sync: pure merge rules + Firebase (Google sign-in, Firestore)
 *   Stats          - dashboard counters at the top of the Notebooks page
 *   App            - init() and renderAll(), the main entry point
 *
 * Every module exposes only what other modules need. State lives on AppState.
 * ============================================================================ */
(function () {
  'use strict';

  /* Firebase project settings for cross-device sync (stage 3). A web config is
     not a secret: access is controlled by Google sign-in + Firestore rules.
     null = sync not configured, the app runs local-only exactly as before.
     (window.STUDYDESK_FIREBASE_CONFIG lets a test page inject one.) */
  var FIREBASE_CONFIG = (typeof window !== 'undefined' && window.STUDYDESK_FIREBASE_CONFIG) || null;

  /* ===========================================================
   * Icons - inline SVG icon set. No external icon font is loaded,
   * so icons always render even with no network access or a
   * blocked CDN. Every <span class="icon" data-icon="name"></span>
   * in the HTML gets its SVG injected by Icons.hydrate() on init.
   * =========================================================== */
  var Icons = (function () {
    var SHELL_OPEN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var SHELL_CLOSE = '</svg>';

    var paths = {
      notes: '<path d="M5 3h11l3 3v15H5z"/><path d="M16 3v3h3"/><line x1="8" y1="9" x2="14" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
      'calendar-month': '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none"/>',
      'list-check': '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
      checklist: '<rect x="4" y="4" width="6" height="6" rx="1"/><path d="M5.5 7l1 1 2-2"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M5.5 17l1 1 2-2"/><line x1="13" y1="7" x2="20" y2="7"/><line x1="13" y1="17" x2="20" y2="17"/>',
      cards: '<rect x="3" y="7" width="13" height="14" rx="2"/><path d="M8 7V5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.4-2.4.8a8 8 0 0 0-1.7-1L15 3h-4l-.3 2.9a8 8 0 0 0-1.7 1l-2.4-.8-2 3.4L6.6 11a7.97 7.97 0 0 0 0 2l-2 1.5 2 3.4 2.4-.8a8 8 0 0 0 1.7 1L9 21h4l.3-2.9a8 8 0 0 0 1.7-1l2.4.8 2-3.4z"/>',
      search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>',
      check: '<polyline points="5 13 9.5 18 19 7"/>',
      trash: '<polyline points="4 7 20 7"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
      'pencil-plus': '<path d="M14 5l4 4L8 19H4v-4z"/><line x1="18" y1="3" x2="18" y2="9"/><line x1="15" y1="6" x2="21" y2="6"/>',
      'chevron-left': '<polyline points="15 5 8 12 15 19"/>',
      'chevron-right': '<polyline points="9 5 16 12 9 19"/>',
      'menu-2': '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
      repeat: '<path d="M4 8h12a3 3 0 0 1 3 3v2"/><polyline points="14 4 18 8 14 12"/><path d="M20 16H8a3 3 0 0 1-3-3v-2"/><polyline points="10 20 6 16 10 12"/>',
      'player-play': '<circle cx="12" cy="12" r="9"/><polyline points="10 8 16 12 10 16" fill="currentColor" stroke="none"/>',
      typography: '<polyline points="5 6 5 4 19 4 19 6"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/>',
      'text-size': '<line x1="4" y1="6" x2="16" y2="6"/><line x1="10" y1="6" x2="10" y2="18"/><path d="M16 14h5"/><path d="M18.5 14v6"/>',
      language: '<path d="M4 5h11"/><path d="M9.5 3v2"/><path d="M7 5c0 4.5 4 7 7 7"/><path d="M12 5c-1 4.5-4.5 7-8 7"/><path d="M15 21l4-9 4 9"/><path d="M16.2 18h5.6"/>',
      database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 5 .2c0 1.6-2.5 2-2.5 3.2"/><circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none"/>',
      download: '<path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/><line x1="12" y1="4" x2="12" y2="15"/><polyline points="8 11 12 15 16 11"/>',
      upload: '<path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/><line x1="12" y1="15" x2="12" y2="4"/><polyline points="8 8 12 4 16 8"/>',
      eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
      'eye-off': '<path d="M2.5 12S6 5.5 12 5.5c1.6 0 3 .4 4.3 1M21.5 12S18 18.5 12 18.5c-1.6 0-3-.4-4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="4" y1="4" x2="20" y2="20"/>',
      library: '<path d="M4 4h4v16H4z"/><path d="M10 4h4v16h-4z"/><path d="M16.5 4.6l3.6 1-4 15-3.6-1z" opacity=".9"/>',
      star: '<path d="M12 3.6l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
      'external-link': '<path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
      pencil: '<path d="M14 5l4 4L8 19H4v-4z"/>',
      rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><polyline points="20 4 20 11 13 11"/>'
    };

    function svgFor(name) {
      var inner = paths[name];
      if (!inner) return '';
      return SHELL_OPEN + inner + SHELL_CLOSE;
    }

    /** Replace every icon span (.icon[data-icon]) in the document with its SVG. */
    function hydrate(root) {
      var scope = root || document;
      scope.querySelectorAll('.icon[data-icon]').forEach(function (el) {
        var name = el.getAttribute('data-icon');
        var svg = svgFor(name);
        if (svg) el.innerHTML = svg;
      });
    }

    /** Watch the whole document for newly-inserted icon spans (from any
        innerHTML-based render call) and hydrate them automatically, so no
        render function ever has to remember to call hydrate() itself. */
    function watch() {
      if (!window.MutationObserver) return;
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes && m.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            if (node.matches && node.matches('.icon[data-icon]') && !node.firstChild) {
              hydrate(node.parentNode || document);
            } else if (node.querySelector) {
              var empties = node.querySelectorAll('.icon[data-icon]:empty');
              if (empties.length) hydrate(node);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return { svgFor: svgFor, hydrate: hydrate, watch: watch };
  })();

  /* ===========================================================
   * Utils - generic helpers, used by every other module
   * =========================================================== */
  var Utils = {
    $: function (id) { return document.getElementById(id); },

    uid: function () {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    escapeHtml: function (s) {
      var d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    },

    todayStr: function () {
      var d = new Date();
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    },

    /** Monday=0 ... Sunday=6, matching DAY_LABELS order */
    todayDayIndex: function () {
      var jsDay = new Date().getDay();
      return jsDay === 0 ? 6 : jsDay - 1;
    },

    currentMonthStr: function () {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    },

    fmtDateYMD: function (d) {
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    },

    DAY_LABELS: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    SUBJECT_COLOR_CLASSES: ['bdg-c0', 'bdg-c1', 'bdg-c2', 'bdg-c3', 'bdg-c4', 'bdg-c5', 'bdg-c6']
  };

  /* ===========================================================
   * AppState - the single in-memory store; all modules read/write here
   * =========================================================== */
  var AppState = {
    subjects: [],
    notes: [],
    recurring: [],
    adhocTasks: [],
    completions: {},
    completionSync: {},   // "<date>|<taskKey>" -> syncAt of the last local/remote change (cloud sync only)
    cards: [],
    settings: { fontMode: 'hand', noteFontSize: 16 },
    activeNoteId: null,
    notebookSubjectFilter: 'all',
    notebookTypeFilter: 'all',
    studyIdx: 0,
    studyFlipped: false,
    calMonth: null,
    seededThisSession: false,   // true when this run started from sample data (nothing was saved before)

    /* Notebook "type" = the kind of activity a note tracks within a subject
       (lecture, book, movie, etc). A subject can have several notes, one per
       type, e.g. economics/lecture and economics/book are different notes. */
    NOTEBOOK_TYPES: ['lecture', 'book', 'movie', 'project', 'self-study', 'other'],

    /* ---------- Library ----------
       A catalog of study material (books, films, courses, papers...). It is
       deliberately SEPARATE from notebooks: plenty of material gets consumed
       without ever writing notes on it, and auto-creating an empty notebook
       for every item would clutter the notebook list. An item links to a
       notebook on demand instead (see Library.openNotebookFor). */
    library: [],
    libraryTypeFilter: 'all',
    libraryCategoryFilter: 'all',
    libraryGenreFilter: 'all',
    libraryStatusFilter: 'all',
    librarySelection: {},   // id -> true, for bulk edit

    ITEM_TYPES: ['book', 'movie', 'series', 'lecture', 'video', 'paper', 'article', 'music', 'other'],
    ITEM_STATUSES: ['want', 'in progress', 'done'],

    /* Category = the FORM of the material. Genre = its SUBJECT.
       Keeping these on separate axes is the whole point - collapsing them
       into one field makes filtering useless ("Documentary" and "History"
       answer different questions). */
    CATEGORY_PRESETS: {
      book: ['Picture Book', 'Chapter Book', 'Novel', 'Graphic Novel', 'Non-fiction', 'Textbook', 'Essay Collection'],
      movie: ['Feature Film', 'Documentary', 'Short Film', 'Animation'],
      series: ['TV Series', 'Documentary Series', 'Anime'],
      lecture: ['University Course', 'Online Course', 'Bootcamp', 'Workshop', 'Talk'],
      video: ['Tutorial', 'Explainer', 'Conference Talk', 'Interview'],
      paper: ['Journal Article', 'Conference Paper', 'Preprint', 'Thesis', 'Review'],
      article: ['News', 'Blog Post', 'Newsletter', 'Long-read'],
      music: ['Album', 'Single', 'Soundtrack', 'Classical Work'],
      other: ['Podcast', 'Exhibition', 'Game', 'Reference']
    },

    GENRE_PRESETS: [
      'Economics', 'Business', 'Science & Nature', 'Technology', 'History',
      'Philosophy', 'Psychology', 'Language', 'Literature', 'Art & Design',
      'Mathematics', 'Politics', 'Biography', 'Adventure', 'Mystery',
      'Humor', 'Animals', 'Self-improvement'
    ],

    itemById: function (id) {
      return this.library.find(function (it) { return it.id === id; });
    },

    /** Values actually present in the library, for filter dropdowns -
        offering options nobody has used is just noise. */
    usedValues: function (field) {
      var seen = {};
      this.library.forEach(function (it) {
        var v = (it[field] || '').trim();
        if (v) seen[v] = true;
      });
      return Object.keys(seen).sort();
    },

    /* A derived "level" badge per item type. Reading-level systems (AR,
       Lexile) are deliberately absent - this is an adult study library.
       Film gets its age rating, courses get a difficulty, papers a year. */
    computeLevel: function (item) {
      if (!item) return '';
      var t = item.type;
      if (t === 'book' || t === 'music') return '';   // no level concept here
      if (t === 'movie' || t === 'series') {
        var r = (item.levelInput || '').trim().toUpperCase();
        return r ? 'Rated ' + r : '';
      }
      if (t === 'lecture' || t === 'video' || t === 'other') {
        var d = (item.levelInput || '').trim().toLowerCase();
        if (!d) return '';
        if (d.indexOf('begin') === 0 || d === '1') return 'Beginner';
        if (d.indexOf('inter') === 0 || d === '2') return 'Intermediate';
        if (d.indexOf('adv') === 0 || d === '3') return 'Advanced';
        return item.levelInput;
      }
      return (item.levelInput || '').trim();  // paper/article: year or free text
    },

    /** Prefix used in the call number, derived from the computed level. */
    callPrefix: function (item) {
      var lvl = this.computeLevel(item);
      if (!lvl) return (item.type || 'x').slice(0, 2).toUpperCase();
      var m = lvl.match(/L(\d+)/);
      if (m) return lvl.charAt(0).toUpperCase() + m[1];   // "Blue · L5" -> B5
      return lvl.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
    },

    /* Call numbers behave like physical shelf labels: once assigned they are
       never reused or renumbered, because a printed label may already exist.
       So the next number is max(existing)+1 within the prefix - NOT count+1,
       which would recycle numbers after a deletion. */
    nextCallNo: function (item) {
      var prefix = this.callPrefix(item);
      var max = 0;
      this.library.forEach(function (it) {
        if (!it.callNo) return;
        var m = String(it.callNo).match(/^(.+)-(\d+)$/);
        if (m && m[1] === prefix) max = Math.max(max, parseInt(m[2], 10) || 0);
      });
      return prefix + '-' + String(max + 1).padStart(2, '0');
    },

    subjectById: function (id) {
      return this.subjects.find(function (s) { return s.id === id; });
    },

    subjectColorClass: function (subjectId) {
      var idx = this.subjects.findIndex(function (s) { return s.id === subjectId; });
      return Utils.SUBJECT_COLOR_CLASSES[(idx < 0 ? 0 : idx) % Utils.SUBJECT_COLOR_CLASSES.length];
    },

    currentNote: function () {
      var self = this;
      return this.notes.find(function (n) { return n.id === self.activeNoteId; });
    },

    /** Find the note for a given subject + type combo, e.g. (economics, lecture). */
    noteBySubjectAndType: function (subjectId, type) {
      return this.notes.find(function (n) { return n.subjectId === subjectId && n.type === type; });
    },

    activePageIndex: 0,

    currentPage: function () {
      var n = this.currentNote();
      if (!n) return null;
      if (!n.pages || n.pages.length === 0) this.ensurePages(n);
      if (this.activePageIndex < 0) this.activePageIndex = 0;
      if (this.activePageIndex >= n.pages.length) this.activePageIndex = n.pages.length - 1;
      return n.pages[this.activePageIndex];
    },

    ensurePages: function (n) {
      if (!Array.isArray(n.pages) || n.pages.length === 0) {
        n.pages = [{
          chapter: '', tags: n.tags || '', date: n.date || Utils.todayStr(),
          cues: n.cues || '', body: n.body || '', summary: n.summary || ''
        }];
      }
    },

    /** Create a fresh page for a note: date auto-fills to today, everything else starts blank. */
    newBlankPage: function () {
      return { chapter: '', tags: '', date: Utils.todayStr(), cues: '', body: '', summary: '' };
    },

    /* Runs on every load. Two jobs:
       1) migrate legacy shapes (content stored on the note instead of pages,
          the old folder layer) without losing anything, and
       2) repair anything structurally broken - a note with no id, a pages
          field that isn't an array, a subjectId pointing at a subject that
          no longer exists. A single bad record shouldn't break the whole app,
          so the goal here is "always end up with something renderable". */
    migrateNotesToPages: function () {
      var self = this;
      var validSubjectIds = {};
      this.subjects.forEach(function (s) {
        if (s && s.id) validSubjectIds[s.id] = true;
      });

      // guarantee there is always at least one subject to attach things to
      if (this.subjects.length === 0) {
        var fallback = { id: Utils.uid(), name: 'general' };
        this.subjects.push(fallback);
        validSubjectIds[fallback.id] = true;
      }
      var firstSubjectId = this.subjects[0].id;

      this.notes = this.notes.filter(function (n) { return n && typeof n === 'object'; });
      this.notes.forEach(function (n) {
        if (!n.id) n.id = Utils.uid();
        if (!Array.isArray(n.pages)) {
          n.pages = [{
            chapter: '', tags: n.tags || '', date: n.date || Utils.todayStr(),
            cues: n.cues || '', body: n.body || '', summary: n.summary || ''
          }];
        }
        // drop malformed pages, then guarantee at least one usable page
        n.pages = n.pages.filter(function (p) { return p && typeof p === 'object'; });
        if (n.pages.length === 0) n.pages = [self.newBlankPage()];
        n.pages.forEach(function (p) {
          if (typeof p.chapter !== 'string') p.chapter = '';
          if (typeof p.tags !== 'string') p.tags = '';
          if (typeof p.cues !== 'string') p.cues = '';
          if (typeof p.body !== 'string') p.body = '';
          if (typeof p.summary !== 'string') p.summary = '';
          if (typeof p.date !== 'string') p.date = Utils.todayStr();
        });

        if (typeof n.title !== 'string') n.title = '';
        if (self.NOTEBOOK_TYPES.indexOf(n.type) === -1) n.type = 'other';
        // re-home orphaned notes so they never vanish from the list
        if (!n.subjectId || !validSubjectIds[n.subjectId]) n.subjectId = firstSubjectId;

        delete n.cues; delete n.body; delete n.summary;
        delete n.tags; delete n.date; delete n.folderId;
      });

      // same orphan repair for tasks and cards
      this.recurring = this.recurring.filter(function (r) { return r && typeof r === 'object'; });
      this.recurring.forEach(function (r) {
        if (!r.id) r.id = Utils.uid();
        if (!Array.isArray(r.days)) r.days = [];
        if (self.NOTEBOOK_TYPES.indexOf(r.type) === -1) r.type = 'other';
        if (!r.subjectId || !validSubjectIds[r.subjectId]) r.subjectId = firstSubjectId;
      });
      this.adhocTasks = this.adhocTasks.filter(function (t) { return t && typeof t === 'object'; });
      this.adhocTasks.forEach(function (t) {
        if (!t.id) t.id = Utils.uid();
        if (self.NOTEBOOK_TYPES.indexOf(t.type) === -1) t.type = 'other';
        if (!t.subjectId || !validSubjectIds[t.subjectId]) t.subjectId = firstSubjectId;
        if (typeof t.date !== 'string') t.date = Utils.todayStr();
      });
      this.cards = this.cards.filter(function (c) {
        return c && typeof c === 'object' && typeof c.front === 'string' && typeof c.back === 'string';
      });
      this.cards.forEach(function (c) {
        if (!c.id) c.id = Utils.uid();
        if (!c.subjectId || !validSubjectIds[c.subjectId]) c.subjectId = firstSubjectId;
      });

      // library items: drop junk, normalize every field, clear dead notebook links
      if (!Array.isArray(this.library)) this.library = [];
      var validNoteIds = {};
      this.notes.forEach(function (n) { validNoteIds[n.id] = true; });
      this.library = this.library.filter(function (it) { return it && typeof it === 'object'; });
      this.library.forEach(function (it) {
        if (!it.id) it.id = Utils.uid();
        ['title', 'author', 'illustrator', 'publisher', 'isbn', 'coverUrl',
          'category', 'genre', 'callNo', 'levelInput', 'notes'].forEach(function (f) {
            if (typeof it[f] !== 'string') it[f] = '';
          });
        if (self.ITEM_TYPES.indexOf(it.type) === -1) it.type = 'other';
        if (self.ITEM_STATUSES.indexOf(it.status) === -1) it.status = 'want';
        var prog = parseInt(it.progress, 10);
        it.progress = (prog >= 0 && prog <= 100) ? prog : 0;       // clamp
        var rate = parseInt(it.rating, 10);
        it.rating = (rate >= 0 && rate <= 5) ? rate : 0;           // clamp
        if (it.noteId && !validNoteIds[it.noteId]) it.noteId = ''; // notebook was deleted
        if ([0, 90, 180, 270].indexOf(it.coverRotation) === -1) it.coverRotation = 0;
        if (!it.createdAt) it.createdAt = new Date().toISOString();
      });

      delete this.folders;
    },

    seedSampleData: function () {
      var econ = { id: Utils.uid(), name: 'economics' };
      var french = { id: Utils.uid(), name: 'french' };
      var startup = { id: Utils.uid(), name: 'startup' };
      var reading = { id: Utils.uid(), name: 'reading' };
      this.subjects = [econ, french, startup, reading];

      this.notes = [
        {
          id: Utils.uid(), title: 'Econ 101', subjectId: econ.id, type: 'lecture',
          pages: [{
            chapter: 'Ch.2 Supply and demand', tags: 'micro, equilibrium', date: Utils.todayStr(),
            cues: 'demand shifts?\nsupply shifts?\nelasticity',
            body: 'Demand curve slopes down: price up, quantity down.<br>Supply curve slopes up: price up, quantity up.<br><br>Equilibrium = where the two curves meet.<br><br>Shifts in demand: income, preferences, price of related goods, expectations.<br><br>Shifts in supply: input costs, technology, number of sellers.',
            summary: 'equilibrium is where supply meets demand'
          }]
        },
        {
          id: Utils.uid(), title: 'Freakonomics', subjectId: econ.id, type: 'book',
          pages: [{
            chapter: 'Ch.1 Incentives', tags: 'behavioral econ', date: Utils.todayStr(),
            cues: 'what makes a good incentive?',
            body: 'Incentives are the cornerstone of modern life. Economic, social, and moral incentives all shape behavior differently.',
            summary: 'incentives drive behavior in ways that are not always obvious'
          }]
        },
        {
          id: Utils.uid(), title: 'French class', subjectId: french.id, type: 'lecture',
          pages: [{
            chapter: 'Everyday verbs', tags: 'etre, avoir, irregular verbs', date: Utils.todayStr(),
            cues: 'etre vs avoir\nuses of faire',
            body: 'etre (to be): je suis, tu es, il/elle est<br>avoir (to have): jai, tu as, il/elle a<br><br>faire (to do/make): je fais, tu fais<br><br>Used for weather: il fait beau<br>Used for activities: faire du sport',
            summary: 'etre and avoir power most compound tenses'
          }]
        },
        {
          id: Utils.uid(), title: 'Lean startup', subjectId: startup.id, type: 'book',
          pages: [{
            chapter: 'Ch.3 MVP', tags: 'mvp, build-measure-learn', date: Utils.todayStr(),
            cues: 'what is MVP?\nbuild-measure-learn',
            body: 'MVP = minimum viable product. The smallest version of a product that lets you test a core assumption with real users.<br><br>Build -&gt; Measure -&gt; Learn -&gt; repeat.<br><br>Goal: validate demand before investing heavily in features nobody wants.',
            summary: 'ship the smallest testable version, learn, iterate'
          }]
        }
      ];

      this.recurring = [
        { id: Utils.uid(), title: 'Economics 101 lecture', subjectId: econ.id, type: 'lecture', days: [0, 2, 4] },
        { id: Utils.uid(), title: 'French class', subjectId: french.id, type: 'lecture', days: [1, 3] },
        { id: Utils.uid(), title: 'Startup course module', subjectId: startup.id, type: 'lecture', days: [5] }
      ];

      this.adhocTasks = [
        { id: Utils.uid(), title: 'Read Freakonomics', subjectId: econ.id, type: 'book', date: Utils.todayStr() }
      ];

      this.completions = {};

      this.cards = [
        { id: Utils.uid(), front: 'What is opportunity cost?', back: 'The value of the next best alternative given up when making a choice.', subjectId: econ.id },
        { id: Utils.uid(), front: 'Conjugate "etre" (to be) - je / tu / il', back: 'je suis / tu es / il est', subjectId: french.id },
        { id: Utils.uid(), front: 'What does MVP stand for?', back: 'Minimum viable product.', subjectId: startup.id },
        { id: Utils.uid(), front: 'What is the law of demand?', back: 'As price increases, quantity demanded decreases, all else equal.', subjectId: econ.id }
      ];

      this.settings = { fontMode: 'hand', noteFontSize: 16, backupReminderDays: 7, lastBackupAt: null };
    }
  };

  /* ===========================================================
   * Storage - localStorage persistence with debounced save
   * =========================================================== */
  var Storage = (function () {
    var KEY = 'study-notes-app-chalkboard-v2';
    var saveTimer = null;
    var storageBlocked = false;   // true when localStorage can't be used at all
    var warnedBlocked = false;
    var warnedFull = false;

    /* Some environments (private windows with cookies blocked, locked-down
       corporate browsers, iframes with restricted storage) throw on any
       localStorage access. Detect that once instead of crashing on every save. */
    function storageAvailable() {
      if (storageBlocked) return false;
      try {
        var probe = '__sd_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return true;
      } catch (e) {
        storageBlocked = true;
        return false;
      }
    }

    function warnBlockedOnce() {
      if (warnedBlocked) return;
      warnedBlocked = true;
      var status = Utils.$('save-status');
      if (status) status.textContent = 'not saving — this browser is blocking storage';
      alert('This browser is blocking local storage, so your notes cannot be saved.\n\n' +
        'This usually happens in a private/incognito window or when site data is blocked. ' +
        'Open the app in a normal window, or use Backup → download backup before you close the tab.');
    }

    function load() {
      if (!storageAvailable()) { warnBlockedOnce(); return false; }
      var raw;
      try {
        raw = localStorage.getItem(KEY);
      } catch (e) {
        storageBlocked = true;
        warnBlockedOnce();
        return false;
      }
      if (!raw) return false;

      var d;
      try {
        d = JSON.parse(raw);
      } catch (e) {
        // Saved data is corrupted (rare, but a truncated write can do it).
        // Don't silently wipe it: keep a copy so it can be inspected/recovered.
        try { localStorage.setItem(KEY + '-corrupt-' + Date.now(), raw); } catch (e2) { /* ignore */ }
        alert('Your saved data could not be read (it appears corrupted). ' +
          'Starting fresh — a copy of the unreadable data was kept in browser storage. ' +
          'If you have a backup file, use Backup → load backup to restore it.');
        return false;
      }
      if (!d || typeof d !== 'object') return false;

      // Coerce every field to the right shape: a hand-edited or partially
      // written record shouldn't be able to crash the app on startup.
      AppState.subjects = Array.isArray(d.subjects) ? d.subjects : [];
      AppState.notes = Array.isArray(d.notes) ? d.notes : [];
      AppState.recurring = Array.isArray(d.recurring) ? d.recurring : [];
      AppState.adhocTasks = Array.isArray(d.adhocTasks) ? d.adhocTasks : [];
      AppState.completions = (d.completions && typeof d.completions === 'object') ? d.completions : {};
      AppState.completionSync = (d.completionSync && typeof d.completionSync === 'object') ? d.completionSync : {};
      AppState.cards = Array.isArray(d.cards) ? d.cards : [];
      AppState.library = Array.isArray(d.library) ? d.library : [];
      AppState.settings = (d.settings && typeof d.settings === 'object') ? d.settings : {};
      Storage.applySettingDefaults();
      return true;
    }

    function applySettingDefaults() {
      var s = AppState.settings;
      if (s.fontMode !== 'clean') s.fontMode = 'hand';
      var size = parseInt(s.noteFontSize, 10);
      s.noteFontSize = (size >= 13 && size <= 22) ? size : 16;   // slider range
      var days = parseInt(s.backupReminderDays, 10);
      s.backupReminderDays = isNaN(days) ? 7 : days;
      if (typeof s.tmdbKey !== 'string') s.tmdbKey = '';
    }

    function updateUsageDisplay() {
      var el = Utils.$('storage-usage');
      if (!el) return;
      if (!storageAvailable()) {
        el.textContent = 'storage unavailable — this browser is blocking it, so nothing is being saved.';
        return;
      }
      var raw = '';
      try { raw = localStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
      var kb = Math.round(raw.length / 1024);
      var pct = Math.min(100, Math.round((raw.length / (5 * 1024 * 1024)) * 100));
      el.textContent = 'storage used: ~' + (kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB') +
        ' (about ' + pct + '% of a typical 5 MB browser limit)';
    }

    function save() {
      var status = Utils.$('save-status');
      if (!storageAvailable()) { warnBlockedOnce(); return; }
      if (status) status.textContent = 'saving...';
      // cloud sync: stamp changed entities first so the timestamp lands in this write too
      var pending = (typeof Sync !== 'undefined' && Sync.collectChanges) ? Sync.collectChanges() : null;
      try {
        localStorage.setItem(KEY, JSON.stringify({
          subjects: AppState.subjects,
          notes: AppState.notes,
          recurring: AppState.recurring,
          adhocTasks: AppState.adhocTasks,
          completions: AppState.completions,
          completionSync: AppState.completionSync,
          cards: AppState.cards,
          library: AppState.library,
          settings: AppState.settings
        }));
        updateUsageDisplay();
        if (pending) Sync.push(pending);
        if (status) {
          status.textContent = 'saved';
          setTimeout(function () {
            if (Utils.$('save-status')) Utils.$('save-status').textContent = '';
          }, 1200);
        }
      } catch (e) {
        // Almost always QuotaExceededError: browser storage is full. This is
        // the one failure that can silently lose work, so say it loudly once.
        if (status) status.textContent = 'save failed — storage full';
        if (!warnedFull) {
          warnedFull = true;
          alert('Saving failed: this browser\'s storage is full.\n\n' +
            'Your most recent edits are NOT saved. To fix this:\n' +
            '1. Use Backup → download backup to save what you can.\n' +
            '2. Delete some large images from your notes, then edit again.\n\n' +
            'Images are the usual cause — check the Backup page for current usage.');
        }
        updateUsageDisplay();
      }
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    }

    function reset() {
      try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':sync-uid'); } catch (e) { /* ignore */ }
    }

    return {
      load: load, save: save, scheduleSave: scheduleSave, reset: reset,
      updateUsageDisplay: updateUsageDisplay, applySettingDefaults: applySettingDefaults,
      storageAvailable: storageAvailable, KEY: KEY
    };
  })();

  /* ===========================================================
   * Modal - generic open/close + backdrop click handling
   * =========================================================== */
  var Modal = {
    open: function (id) {
      var m = Utils.$(id);
      if (m) m.classList.add('show');
    },

    close: function (id) {
      var m = Utils.$(id);
      if (m) m.classList.remove('show');
    },

    setupBackdropClose: function () {
      document.querySelectorAll('.mo').forEach(function (m) {
        var downOnBackdrop = false;
        m.addEventListener('mousedown', function (e) {
          downOnBackdrop = (e.target === m);
        });
        m.addEventListener('click', function (e) {
          if (downOnBackdrop && e.target === m) m.classList.remove('show');
          downOnBackdrop = false;
        });
      });
    }
  };

  /* ===========================================================
   * Nav - sidebar page switching + mobile drawer + page title
   * =========================================================== */
  var Nav = (function () {
    var PAGE_TITLES = {
      notes: 'Notebooks',
      library: 'Library',
      schedule: 'Calendar',
      manager: 'Schedule manager',
      cards: 'Flashcards',
      backup: 'Backup',
      settings: 'Settings'
    };

    function showPage(page) {
      document.querySelectorAll('.ni').forEach(function (b) {
        b.classList.toggle('active', b.dataset.page === page);
      });
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.remove('active');
      });
      var target = Utils.$('page-' + page);
      if (target) target.classList.add('active');
      Utils.$('tb-title').textContent = PAGE_TITLES[page] || page;
      closeMobile();
    }

    function toggleMobile() {
      Utils.$('sidebar').classList.toggle('mob-open');
      Utils.$('mob-overlay').classList.toggle('show');
    }

    function closeMobile() {
      Utils.$('sidebar').classList.remove('mob-open');
      Utils.$('mob-overlay').classList.remove('show');
    }

    function renderHeaderDate() {
      var d = new Date();
      Utils.$('header-date').textContent = d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric'
      });
      var lbl = Utils.$('today-date-label');
      if (lbl) {
        lbl.textContent = d.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
      }
    }

    return { showPage: showPage, toggleMobile: toggleMobile, renderHeaderDate: renderHeaderDate };
  })();

  // Expose Nav methods for inline onclick handlers in HTML
  window.showPage = Nav.showPage;
  window.toggleMobileSidebar = Nav.toggleMobile;

  /* ===========================================================
   * Subjects - subject CRUD + filter selects used across pages
   * =========================================================== */
  var Subjects = {
    renderSelects: function () {
      var opts = AppState.subjects.map(function (s) {
        return '<option value="' + s.id + '">' + Utils.escapeHtml(s.name) + '</option>';
      }).join('');
      // notebook list filter (Notebooks page)
      if (Utils.$('notebook-subject-filter')) {
        Utils.$('notebook-subject-filter').innerHTML = '<option value="all">all subjects</option>' + opts;
      }
      Utils.$('note-subject-select').innerHTML = opts;
      Utils.$('deck-filter').innerHTML = '<option value="all">all subjects</option>' + opts;
      // schedule manager / today's list now use real subjects instead of free categories
      ['rec-subject', 'adhoc-task-subject', 'manager-task-subject'].forEach(function (id) {
        if (Utils.$(id)) Utils.$(id).innerHTML = opts;
      });
    },

    setup: function () {
      Utils.$('new-subject-btn').addEventListener('click', function () {
        Utils.$('subject-name-input').value = '';
        Modal.open('mo-subject');
        Utils.$('subject-name-input').focus();
      });
      Utils.$('subject-modal-close').addEventListener('click', function () { Modal.close('mo-subject'); });
      Utils.$('subject-modal-cancel').addEventListener('click', function () { Modal.close('mo-subject'); });
      Utils.$('subject-modal-save').addEventListener('click', function () {
        var name = Utils.$('subject-name-input').value.trim();
        if (!name) return;
        AppState.subjects.push({ id: Utils.uid(), name: name });
        Subjects.renderSelects();
        NotesModule.renderList();
        Flashcards.renderGrid();
        Stats.render();
        Modal.close('mo-subject');
        Storage.scheduleSave();
      });
      Utils.$('subject-name-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('subject-modal-save').click();
      });

      Utils.$('notebook-subject-filter').addEventListener('change', function () {
        AppState.notebookSubjectFilter = this.value;
        NotesModule.renderList();
      });
      Utils.$('notebook-type-filter').addEventListener('change', function () {
        AppState.notebookTypeFilter = this.value;
        NotesModule.renderList();
      });
      Utils.$('deck-filter').addEventListener('change', Flashcards.renderGrid);
      Utils.$('note-search').addEventListener('input', NotesModule.renderList);
    }
  };

  /* ===========================================================
   * NotesModule - notes list, cornell editor, format toolbar,
   *               markdown shortcuts, images, modals (label/link)
   * =========================================================== */
  var NotesModule = (function () {
    var savedSelectionRange = null;

    function getVisibleNotes() {
      var subjectFilter = AppState.notebookSubjectFilter || 'all';
      var typeFilter = AppState.notebookTypeFilter || 'all';
      var query = (Utils.$('note-search').value || '').toLowerCase().trim();
      return AppState.notes
        .filter(function (n) { return subjectFilter === 'all' || n.subjectId === subjectFilter; })
        .filter(function (n) { return typeFilter === 'all' || n.type === typeFilter; })
        .filter(function (n) {
          if (!query) return true;
          var pagesText = (n.pages || []).map(function (p) {
            return (p.chapter || '') + ' ' + (p.tags || '') + ' ' + (p.cues || '') + ' ' +
              (p.summary || '') + ' ' + htmlToText(p.body); // body included: "where did I write that" works
          }).join(' ');
          var hay = ((n.title || '') + ' ' + pagesText).toLowerCase();
          return hay.indexOf(query) !== -1;
        })
        .sort(function (a, b) {
          var subjA = AppState.subjectById(a.subjectId);
          var subjB = AppState.subjectById(b.subjectId);
          var nameA = subjA ? subjA.name : '';
          var nameB = subjB ? subjB.name : '';
          if (nameA !== nameB) return nameA.localeCompare(nameB);
          return (a.title || '').localeCompare(b.title || '');
        });
    }

    /** Group the visible note list by subject, for the sidebar list display. */
    function getVisibleNotesGrouped() {
      var list = getVisibleNotes();
      var groups = [];
      var bySubject = {};
      list.forEach(function (n) {
        var subj = AppState.subjectById(n.subjectId);
        var key = n.subjectId || '';
        if (!bySubject[key]) {
          bySubject[key] = { subjectId: n.subjectId, subjectName: subj ? subj.name : 'unsorted', notes: [] };
          groups.push(bySubject[key]);
        }
        bySubject[key].notes.push(n);
      });
      return groups;
    }

    function renderList() {
      var groups = getVisibleNotesGrouped();

      if (groups.length === 0) {
        Utils.$('note-list').innerHTML =
          '<div class="empty"><span class="icon" data-icon="notes" aria-hidden="true"></span><p>No notes found.</p></div>';
        return;
      }

      Utils.$('note-list').innerHTML = groups.map(function (g) {
        var colorClass = AppState.subjectColorClass(g.subjectId);
        var rows = g.notes.map(function (n) {
          var active = n.id === AppState.activeNoteId;
          var pageCount = (n.pages || []).length;
          return '<div class="note-item ' + (active ? 'active' : '') + '" data-id="' + n.id + '">' +
            '<p class="ni-title">' + Utils.escapeHtml(n.title || 'untitled') + '</p>' +
            '<p class="ni-meta"><span class="badge bdg-type">' + Utils.escapeHtml(n.type || 'other') +
            '</span><span>' + pageCount + (pageCount === 1 ? ' page' : ' pages') + '</span></p>' +
            '</div>';
        }).join('');
        return '<div class="note-group">' +
          '<div class="note-group-head"><span class="badge ' + colorClass + '">' + Utils.escapeHtml(g.subjectName) + '</span></div>' +
          rows +
          '</div>';
      }).join('');

      document.querySelectorAll('.note-item').forEach(function (el) {
        el.addEventListener('click', function () { selectNote(el.dataset.id); });
      });
    }

    function flipToPage(direction) {
      var n = AppState.currentNote();
      if (!n) return;
      AppState.ensurePages(n);
      var total = n.pages.length;

      if (direction === 'next' && AppState.activePageIndex >= total - 1) {
        // at the last page already: create a new blank page rather than wrapping
        n.pages.push(AppState.newBlankPage());
        total = n.pages.length;
      }
      if (total <= 1) return;

      var nextIdx;
      if (direction === 'next') {
        nextIdx = Math.min(AppState.activePageIndex + 1, total - 1);
      } else {
        nextIdx = Math.max(AppState.activePageIndex - 1, 0);
      }
      if (nextIdx === AppState.activePageIndex) return;

      AppState.activePageIndex = nextIdx;
      renderActivePage();
      Storage.scheduleSave();
    }

    /* Auto-add a page when MAIN NOTES content grows taller than the
       visible editor area - mirrors flipping to the next physical
       page once a sheet of paper is full. */
    function checkAutoNewPage() {
      var editor = Utils.$('notes-body');
      if (!editor) return;
      if (editor.scrollHeight <= editor.clientHeight + 4) return; // still fits

      var n = AppState.currentNote();
      if (!n) return;
      AppState.ensurePages(n);

      // only auto-advance if we're on the last page (don't interrupt mid-note editing)
      if (AppState.activePageIndex !== n.pages.length - 1) return;

      // keep all content on the current page (nothing is ever deleted)
      // and immediately open a fresh page for what comes next.
      n.pages.push(AppState.newBlankPage());
      AppState.activePageIndex = n.pages.length - 1;
      renderActivePage();
      Storage.scheduleSave();
      Utils.$('notes-body').focus();
    }

    function renderPageIndicator() {
      var n = AppState.currentNote();
      var el = Utils.$('page-indicator');
      if (!el) return;
      if (!n || !n.pages) { el.textContent = ''; return; }
      el.textContent = (AppState.activePageIndex + 1) + ' / ' + n.pages.length;
    }

    /* Render only the page-level fields (cues/body/summary) for the
       currently active page, without touching the note-level fields
       (title/tags/date/subject/folder) which stay constant across pages. */
    function renderActivePage() {
      var n = AppState.currentNote();
      if (!n) return;
      AppState.ensurePages(n);
      var page = AppState.currentPage();
      Utils.$('note-chapter').value = page.chapter || '';
      Utils.$('note-tags').value = page.tags || '';
      Utils.$('note-date').value = page.date || '';
      Utils.$('cues').value = page.cues || '';
      Utils.$('summary').value = page.summary || '';
      Utils.$('notes-body').innerHTML = page.body || '';
      renderPageIndicator();
    }

    /** Open a note and jump straight to its most recent page (the "go to note"
        behavior used both from the sidebar list and from schedule items). */
    function selectNote(id) {
      AppState.activeNoteId = id;
      var n = AppState.notes.find(function (x) { return x.id === id; });
      if (!n) return;
      exitReviewMode(); // don't carry a hidden-notes state into another notebook
      AppState.ensurePages(n);
      AppState.activePageIndex = n.pages.length - 1;
      Utils.$('note-title').value = n.title || '';
      Utils.$('note-subject-select').value = n.subjectId || '';
      Utils.$('note-type-select').value = n.type || 'other';
      renderActivePage();
      renderList();
    }

    /** Re-render the open notebook after a remote (sync) change without moving
        the user: keeps the current page index when it still exists. If the open
        notebook was deleted elsewhere, falls back to the first notebook. */
    function refreshEditor() {
      var n = AppState.currentNote();
      if (!n) {
        AppState.activeNoteId = null;
        if (AppState.notes.length > 0) { selectNote(AppState.notes[0].id); return; }
        ['note-title', 'note-chapter', 'note-tags', 'note-date', 'cues', 'summary'].forEach(function (id) {
          Utils.$(id).value = '';
        });
        Utils.$('notes-body').innerHTML = '';
        renderPageIndicator();
        renderList();
        return;
      }
      AppState.ensurePages(n);
      if (AppState.activePageIndex >= n.pages.length) AppState.activePageIndex = n.pages.length - 1;
      Utils.$('note-title').value = n.title || '';
      Utils.$('note-subject-select').value = n.subjectId || '';
      Utils.$('note-type-select').value = n.type || 'other';
      renderActivePage();
      renderList();
    }

    function saveCurrentFields() {
      var n = AppState.currentNote();
      if (!n) return;
      n.title = Utils.$('note-title').value;
      n.subjectId = Utils.$('note-subject-select').value;
      n.type = Utils.$('note-type-select').value;
      AppState.ensurePages(n);
      var page = AppState.currentPage();
      if (page) {
        page.chapter = Utils.$('note-chapter').value;
        page.tags = Utils.$('note-tags').value;
        page.date = Utils.$('note-date').value;
        page.cues = Utils.$('cues').value;
        page.summary = Utils.$('summary').value;
        page.body = Utils.$('notes-body').innerHTML;
      }
    }

    // ------ image insertion (with automatic downscaling) ------
    var IMG_MAX_DIM = 1280;      // longest side after compression
    var IMG_SMALL_BYTES = 250000; // data-URLs under ~250KB are kept as-is

    /** Downscale big images before they hit localStorage. Screenshots pasted
        at full resolution eat the ~5MB quota fast; capping the longest side
        at 1280px and re-encoding as JPEG keeps notes light with no visible
        loss at note-reading size. Small images pass through untouched. */
    function compressImage(dataUrl, cb) {
      if (dataUrl.length < IMG_SMALL_BYTES) { cb(dataUrl); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        var scale = Math.min(1, IMG_MAX_DIM / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // JPEG has no alpha; avoid black behind transparency
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var out = canvas.toDataURL('image/jpeg', 0.82);
        // keep whichever is smaller (tiny PNGs can beat JPEG re-encode)
        cb(out.length < dataUrl.length ? out : dataUrl);
      };
      img.onerror = function () { cb(dataUrl); }; // fail-open: insert original
      img.src = dataUrl;
    }

    function readImageFile(file) {
      if (!file) return;
      // guard against non-images (a dragged PDF, a renamed file) and against
      // huge originals that would stall the browser before compression runs
      if (!/^image\//.test(file.type || '')) {
        alert('That file is not an image, so it can\'t be inserted into a note.');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert('That image is very large (' + Math.round(file.size / 1048576) + ' MB). ' +
          'Please resize it below 20 MB before adding it.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        compressImage(e.target.result, function (finalUrl) {
          insertImageAtCursor(finalUrl);
          saveCurrentFields();
          Storage.scheduleSave();
        });
      };
      reader.onerror = function () {
        alert('That image could not be read. It may be corrupted.');
      };
      reader.readAsDataURL(file);
    }

    function insertImageAtCursor(dataUrl) {
      var img = document.createElement('img');
      img.src = dataUrl;
      insertNodeAtCursor(img);
    }

    function insertNodeAtCursor(node) {
      var editor = Utils.$('notes-body');
      editor.focus();
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editor.appendChild(node);
      }
    }

    // ------ format commands ------
    function runFormatCommand(cmd) {
      var sel = window.getSelection();
      var hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;

      if (cmd === 'highlight' && !hasSelection) {
        alert('Select some text first, then click highlight.');
        return;
      }

      switch (cmd) {
        case 'bold': document.execCommand('bold'); break;
        case 'italic': document.execCommand('italic'); break;
        case 'highlight': wrapSelectionWith('mark'); break;
        case 'indent-add': document.execCommand('indent'); break;
        case 'indent-remove': document.execCommand('outdent'); break;
        case 'label': openLabelModal(); return;
        case 'link': openLinkModal(); return;
      }
      saveCurrentFields();
      Storage.scheduleSave();
    }

    function wrapSelectionWith(tagName) {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      var range = sel.getRangeAt(0);
      var el = document.createElement(tagName);
      el.appendChild(range.extractContents());
      range.insertNode(el);
      sel.removeAllRanges();
      var newRange = document.createRange();
      newRange.selectNodeContents(el);
      sel.addRange(newRange);
    }

    function applyForeColor(color) {
      var editor = Utils.$('notes-body');
      editor.focus();
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        alert('Select some text first, then pick a color.');
        return;
      }
      document.execCommand('foreColor', false, color);
      saveCurrentFields();
      Storage.scheduleSave();
    }

    // ------ selection save/restore (for modals that steal focus) ------
    function saveSelection() {
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && Utils.$('notes-body').contains(sel.anchorNode)) {
        savedSelectionRange = sel.getRangeAt(0).cloneRange();
      } else {
        savedSelectionRange = null;
      }
    }

    function restoreSelection() {
      var sel = window.getSelection();
      sel.removeAllRanges();
      if (savedSelectionRange) sel.addRange(savedSelectionRange);
    }

    function openLabelModal() {
      saveSelection();
      Utils.$('label-text-input').value = '';
      Modal.open('mo-label');
      Utils.$('label-text-input').focus();
    }

    function openLinkModal() {
      saveSelection();
      var sel = window.getSelection();
      var selectedText = sel && sel.toString();
      Utils.$('link-url-input').value = '';
      Utils.$('link-text-input').value = selectedText || '';
      Modal.open('mo-link');
      Utils.$('link-url-input').focus();
    }

    // ------ markdown shortcuts: **bold**, *italic*, ==highlight== ------
    function applyMarkdownShortcuts() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var node = sel.anchorNode;
      if (!node || node.nodeType !== Node.TEXT_NODE) return;
      var text = node.textContent;
      var caret = sel.anchorOffset;
      var before = text.slice(0, caret);

      var patterns = [
        { re: /==([^=]+)==$/, tag: 'mark' },
        { re: /\*\*([^*]+)\*\*$/, tag: 'strong' },
        { re: /\*([^*]+)\*$/, tag: 'em' }
      ];

      for (var i = 0; i < patterns.length; i++) {
        var m = before.match(patterns[i].re);
        if (!m) continue;
        var matchStart = caret - m[0].length;
        var range = document.createRange();
        range.setStart(node, matchStart);
        range.setEnd(node, caret);
        range.deleteContents();
        var el = document.createElement(patterns[i].tag);
        el.textContent = m[1];
        range.insertNode(el);
        var space = document.createTextNode('\u200b');
        el.parentNode.insertBefore(space, el.nextSibling);
        var newRange = document.createRange();
        newRange.setStart(space, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        return;
      }
    }

    function setupEditor() {
      // create / delete / save
      Utils.$('new-note-btn').addEventListener('click', function () {
        if (AppState.subjects.length === 0) { alert('Add a subject first.'); return; }
        openNewNotebookModal();
      });

      Utils.$('delete-note-btn').addEventListener('click', function () {
        if (!AppState.activeNoteId) return;
        var n = AppState.currentNote();
        var pageCount = (n && n.pages) ? n.pages.length : 0;
        if (!confirm('Delete "' + ((n && n.title) || 'this notebook') + '" and all ' +
          pageCount + (pageCount === 1 ? ' page' : ' pages') + ' in it?\n\nThis cannot be undone.')) return;
        AppState.notes = AppState.notes.filter(function (x) { return x.id !== AppState.activeNoteId; });
        AppState.activeNoteId = null;
        AppState.activePageIndex = 0;
        exitReviewMode(); // don't leave the editor blurred with no note open
        ['note-title', 'note-chapter', 'note-tags', 'note-date', 'cues', 'summary'].forEach(function (id) {
          Utils.$(id).value = '';
        });
        Utils.$('notes-body').innerHTML = '';
        renderPageIndicator();
        renderList(); Stats.render(); Storage.scheduleSave();
      });

      Utils.$('save-note-btn').addEventListener('click', function () {
        saveCurrentFields();
        Storage.scheduleSave();
        var btn = Utils.$('save-note-btn');
        var original = btn.innerHTML;
        btn.innerHTML = '<span class="icon" data-icon="check" aria-hidden="true"></span> saved';
        setTimeout(function () { btn.innerHTML = original; }, 1200);
      });

      // meta fields write-through
      ['note-title', 'note-chapter', 'note-tags', 'note-date', 'cues', 'summary'].forEach(function (id) {
        Utils.$(id).addEventListener('input', function () {
          saveCurrentFields();
          renderList();
          Storage.scheduleSave();
        });
      });
      // selects fire 'change', not reliable 'input'
      ['note-subject-select', 'note-type-select'].forEach(function (id) {
        Utils.$(id).addEventListener('change', function () {
          saveCurrentFields();
          renderList();
          Storage.scheduleSave();
        });
      });

      // notes body: markdown shortcuts + autosave
      Utils.$('notes-body').addEventListener('input', function () {
        applyMarkdownShortcuts();
        saveCurrentFields();
        Storage.scheduleSave();
        checkAutoNewPage();
      });

      // image attach via button + clipboard paste
      Utils.$('insert-image-btn').addEventListener('click', function () {
        Utils.$('image-file-input').click();
      });
      Utils.$('image-file-input').addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        readImageFile(file);
        this.value = '';
      });
      Utils.$('notes-body').addEventListener('paste', function (e) {
        var cd = e.clipboardData || window.clipboardData;
        if (!cd) return;
        var items = cd.items || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].kind === 'file' && items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            var file = items[i].getAsFile();
            if (file) readImageFile(file);
            return;
          }
        }
        var files = cd.files || [];
        for (var j = 0; j < files.length; j++) {
          if (files[j].type.indexOf('image') !== -1) {
            e.preventDefault();
            readImageFile(files[j]);
            return;
          }
        }
      });

      // format toolbar
      document.querySelectorAll('.fmt-btn[data-cmd]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Utils.$('notes-body').focus();
          runFormatCommand(btn.dataset.cmd);
        });
      });

      // color: preset chips (black / red / blue)
      document.querySelectorAll('.color-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          applyForeColor(chip.dataset.color);
        });
      });

      // page-flip navigation arrows
      Utils.$('page-flip-prev').addEventListener('click', function () { flipToPage('prev'); });
      Utils.$('page-flip-next').addEventListener('click', function () { flipToPage('next'); });

      // ------ self-test (review) mode: hide MAIN NOTES, recall from cues ------
      Utils.$('review-mode-btn').addEventListener('click', function () {
        if (!AppState.currentNote()) { alert('Open a notebook first.'); return; }
        var cornell = document.querySelector('.cornell');
        var on = cornell.classList.toggle('review-mode');
        this.innerHTML = on
          ? '<span class="icon" data-icon="eye" aria-hidden="true"></span> show notes'
          : '<span class="icon" data-icon="eye-off" aria-hidden="true"></span> self-test';
        Icons.hydrate(this);
      });

      // ------ page jump: click the "N / M" indicator to open the page list ------
      Utils.$('page-indicator').addEventListener('click', openPageListModal);
      Utils.$('page-list-modal-close').addEventListener('click', function () { Modal.close('mo-page-list'); });
    }

    function exitReviewMode() {
      var cornell = document.querySelector('.cornell');
      if (cornell && cornell.classList.contains('review-mode')) {
        cornell.classList.remove('review-mode');
        var b = Utils.$('review-mode-btn');
        b.innerHTML = '<span class="icon" data-icon="eye-off" aria-hidden="true"></span> self-test';
        Icons.hydrate(b);
      }
    }

    /** Strip HTML down to readable text (for page previews + search). */
    function htmlToText(html) {
      return (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function openPageListModal() {
      var n = AppState.currentNote();
      if (!n) return;
      AppState.ensurePages(n);
      Utils.$('page-list-body').innerHTML = n.pages.map(function (p, i) {
        var current = (i === AppState.activePageIndex) ? ' current' : '';
        var chapter = (p.chapter || '').trim() || '(no chapter)';
        var preview = htmlToText(p.body).slice(0, 60);
        return '<button type="button" class="page-list-item' + current + '" data-idx="' + i + '">' +
          '<span class="pli-num">' + (i + 1) + '</span>' +
          '<span class="pli-main"><span class="pli-chapter">' + Utils.escapeHtml(chapter) + '</span>' +
          (preview ? '<span class="pli-preview">' + Utils.escapeHtml(preview) + '</span>' : '') + '</span>' +
          '<span class="pli-date">' + (p.date || '') + '</span>' +
          '</button>';
      }).join('');
      document.querySelectorAll('.page-list-item').forEach(function (el) {
        el.addEventListener('click', function () {
          AppState.activePageIndex = parseInt(el.dataset.idx, 10);
          renderActivePage();
          Modal.close('mo-page-list');
        });
      });
      Modal.open('mo-page-list');
    }

    function openNewNotebookModal() {
      var subjOpts = AppState.subjects.map(function (s) {
        return '<option value="' + s.id + '">' + Utils.escapeHtml(s.name) + '</option>';
      }).join('');
      Utils.$('new-notebook-subject').innerHTML = subjOpts;
      Utils.$('new-notebook-type').value = 'lecture';
      Utils.$('new-notebook-title').value = '';
      Modal.open('mo-new-notebook');
      Utils.$('new-notebook-title').focus();
    }

    function setupNewNotebookModal() {
      Utils.$('new-notebook-modal-close').addEventListener('click', function () { Modal.close('mo-new-notebook'); });
      Utils.$('new-notebook-modal-cancel').addEventListener('click', function () { Modal.close('mo-new-notebook'); });
      Utils.$('new-notebook-modal-save').addEventListener('click', function () {
        var subjectId = Utils.$('new-notebook-subject').value;
        var type = Utils.$('new-notebook-type').value;
        var title = Utils.$('new-notebook-title').value.trim();
        if (!subjectId) { alert('Pick a subject.'); return; }
        if (!title) { alert('Give this notebook a name.'); return; }
        var existing = AppState.noteBySubjectAndType(subjectId, type);
        if (existing) {
          if (!confirm('You already have a "' + type + '" notebook for this subject ("' + existing.title + '"). Open it instead?')) return;
          Modal.close('mo-new-notebook');
          selectNote(existing.id);
          return;
        }
        var n = {
          id: Utils.uid(), title: title, subjectId: subjectId, type: type,
          pages: [AppState.newBlankPage()]
        };
        AppState.notes.push(n);
        Modal.close('mo-new-notebook');
        selectNote(n.id);
        renderList();
        Stats.render();
        Storage.scheduleSave();
      });
      Utils.$('new-notebook-title').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('new-notebook-modal-save').click();
      });
    }

    function setupFormatModals() {
      // label modal
      Utils.$('label-modal-close').addEventListener('click', function () { Modal.close('mo-label'); });
      Utils.$('label-modal-cancel').addEventListener('click', function () { Modal.close('mo-label'); });
      Utils.$('label-modal-save').addEventListener('click', function () {
        var text = Utils.$('label-text-input').value.trim();
        Modal.close('mo-label');
        if (!text) return;
        Utils.$('notes-body').focus();
        restoreSelection();
        var span = document.createElement('span');
        span.className = 'note-label';
        span.textContent = text;
        insertNodeAtCursor(span);
        saveCurrentFields();
        Storage.scheduleSave();
      });
      Utils.$('label-text-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('label-modal-save').click();
      });

      // link modal
      Utils.$('link-modal-close').addEventListener('click', function () { Modal.close('mo-link'); });
      Utils.$('link-modal-cancel').addEventListener('click', function () { Modal.close('mo-link'); });
      Utils.$('link-modal-save').addEventListener('click', function () {
        var raw = Utils.$('link-url-input').value.trim();
        var text = Utils.$('link-text-input').value.trim();
        Modal.close('mo-link');
        if (!raw) return;

        // Only allow safe web/mail links. Reject script-ish schemes outright,
        // and assume https:// when the scheme is simply missing (typing
        // "example.com" should produce a working link, not a broken one).
        var url = raw;
        if (/^\s*(javascript|data|vbscript|file):/i.test(url)) {
          alert('That link type is not allowed. Use an http://, https://, or mailto: address.');
          return;
        }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^\/\//.test(url)) {
          url = 'https://' + url;
        }

        Utils.$('notes-body').focus();
        restoreSelection();
        var a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = text.length > 0 ? text : raw;
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          var range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(a);
          sel.removeAllRanges();
        } else {
          insertNodeAtCursor(a);
        }
        saveCurrentFields();
        Storage.scheduleSave();
      });
      Utils.$('link-url-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('link-modal-save').click();
      });
    }

    return {
      renderList: renderList,
      selectNote: selectNote,
      refreshEditor: refreshEditor,
      setupEditor: setupEditor,
      setupFormatModals: setupFormatModals,
      setupNewNotebookModal: setupNewNotebookModal
    };
  })();

  /* ===========================================================
   * Schedule - calendar + today's list + recurring + one-off tasks
   * =========================================================== */
  var Schedule = (function () {

    // ------ recurring schedule ------
    function renderDayPicker() {
      Utils.$('day-picker').innerHTML = Utils.DAY_LABELS.map(function (label, idx) {
        return '<label><input type="checkbox" class="day-check" value="' + idx + '"><span>' + label + '</span></label>';
      }).join('');
    }

    function subjectName(subjectId) {
      var s = AppState.subjectById(subjectId);
      return s ? s.name : 'unsorted';
    }

    function renderRecurringList() {
      if (AppState.recurring.length === 0) {
        Utils.$('recurring-list').innerHTML = '<p class="empty-note">no recurring tasks yet.</p>';
        return;
      }
      Utils.$('recurring-list').innerHTML = AppState.recurring.map(function (r) {
        var dayLabels = r.days.map(function (d) { return Utils.DAY_LABELS[d]; }).join(', ');
        return '<div class="recurring-item">' +
          '<span>' + Utils.escapeHtml(r.title) + ' &middot; ' + Utils.escapeHtml(subjectName(r.subjectId)) +
          ' (' + r.type + ') &middot; ' + dayLabels + '</span>' +
          '<button class="del-recurring" data-id="' + r.id + '"><span class="icon" data-icon="x" aria-hidden="true"></span></button></div>';
      }).join('');
      document.querySelectorAll('.del-recurring').forEach(function (b) {
        b.addEventListener('click', function () {
          AppState.recurring = AppState.recurring.filter(function (r) { return r.id !== b.dataset.id; });
          renderRecurringList(); renderTodayTasks(); renderCalendar();
          Stats.render(); Storage.scheduleSave();
        });
      });
    }

    function setupRecurringForm() {
      Utils.$('add-recurring-btn').addEventListener('click', function () {
        var title = Utils.$('rec-title').value.trim();
        var subjectId = Utils.$('rec-subject').value;
        var type = Utils.$('rec-type').value;
        var days = Array.prototype.slice
          .call(document.querySelectorAll('.day-check:checked'))
          .map(function (c) { return parseInt(c.value, 10); });
        if (!title) { alert('Enter a task title.'); return; }
        if (!subjectId) { alert('Pick a subject.'); return; }
        if (days.length === 0) { alert('Pick at least one day.'); return; }
        AppState.recurring.push({ id: Utils.uid(), title: title, subjectId: subjectId, type: type, days: days });
        Utils.$('rec-title').value = '';
        document.querySelectorAll('.day-check:checked').forEach(function (c) { c.checked = false; });
        renderRecurringList(); renderTodayTasks(); renderCalendar();
        Stats.render(); Storage.scheduleSave();
      });
    }

    // ------ one-off (ad-hoc) tasks ------
    function setupAdhocForm() {
      // The compact form on the Notes page (always for today)
      Utils.$('adhoc-task-add').addEventListener('click', function () {
        var title = Utils.$('adhoc-task-input').value.trim();
        var subjectId = Utils.$('adhoc-task-subject').value;
        var type = Utils.$('adhoc-task-type').value;
        if (!title) return;
        AppState.adhocTasks.push({
          id: Utils.uid(), title: title, subjectId: subjectId, type: type, date: Utils.todayStr()
        });
        Utils.$('adhoc-task-input').value = '';
        renderTodayTasks(); renderCalendar(); renderManagerTaskList();
        Stats.render(); Storage.scheduleSave();
      });
      Utils.$('adhoc-task-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('adhoc-task-add').click();
      });

      // The full form on the Schedule manager page (any date)
      Utils.$('manager-task-date').value = Utils.todayStr();
      Utils.$('manager-task-add').addEventListener('click', function () {
        var title = Utils.$('manager-task-input').value.trim();
        var subjectId = Utils.$('manager-task-subject').value;
        var type = Utils.$('manager-task-type').value;
        var date = Utils.$('manager-task-date').value || Utils.todayStr();
        if (!title) { alert('Enter a task title.'); return; }
        AppState.adhocTasks.push({ id: Utils.uid(), title: title, subjectId: subjectId, type: type, date: date });
        Utils.$('manager-task-input').value = '';
        renderTodayTasks(); renderCalendar(); renderManagerTaskList();
        Stats.render(); Storage.scheduleSave();
      });
      Utils.$('manager-task-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') Utils.$('manager-task-add').click();
      });
    }

    function renderManagerTaskList() {
      var upcoming = AppState.adhocTasks.slice().sort(function (a, b) {
        return (a.date || '').localeCompare(b.date || '');
      });
      if (upcoming.length === 0) {
        Utils.$('manager-task-list').innerHTML = '<p class="empty-note">no one-off tasks yet.</p>';
        return;
      }
      Utils.$('manager-task-list').innerHTML = upcoming.map(function (t) {
        return '<div class="recurring-item">' +
          '<span>' + Utils.escapeHtml(t.title) + ' &middot; ' + Utils.escapeHtml(subjectName(t.subjectId)) +
          ' (' + t.type + ') &middot; ' + (t.date || '') + '</span>' +
          '<button class="del-manager-task" data-id="' + t.id + '"><span class="icon" data-icon="x" aria-hidden="true"></span></button></div>';
      }).join('');
      document.querySelectorAll('.del-manager-task').forEach(function (b) {
        b.addEventListener('click', function () {
          AppState.adhocTasks = AppState.adhocTasks.filter(function (t) { return t.id !== b.dataset.id; });
          renderManagerTaskList(); renderTodayTasks(); renderCalendar();
          Stats.render(); Storage.scheduleSave();
        });
      });
    }

    /** "Go to note": opens the subject+type notebook on its most recent page,
        creating a blank notebook first if one doesn't exist yet. This never
        silently creates a new page - it shows prior content and lets the
        user decide whether to add a fresh page. */
    function goToNoteForTask(subjectId, type, fallbackTitle) {
      if (!subjectId) { alert('This task has no subject linked yet.'); return; }
      var subj = AppState.subjectById(subjectId);
      if (!subj) {
        // the subject this task pointed at no longer exists
        alert('The subject for this task no longer exists, so its notebook can\'t be opened.');
        return;
      }
      var note = AppState.noteBySubjectAndType(subjectId, type);
      if (!note) {
        note = {
          id: Utils.uid(),
          title: fallbackTitle || (subj.name + ' - ' + type),
          subjectId: subjectId, type: type,
          pages: [AppState.newBlankPage()]
        };
        AppState.notes.push(note);
        Storage.scheduleSave();
      }
      Nav.showPage('notes');
      NotesModule.selectNote(note.id);
    }

    // ------ today's task list (Notes page sidebar widget) ------
    function isTaskDone(key) {
      var t = Utils.todayStr();
      return !!(AppState.completions[t] && AppState.completions[t][key]);
    }

    function setTaskDone(key, done) {
      var t = Utils.todayStr();
      if (!AppState.completions[t]) AppState.completions[t] = {};
      AppState.completions[t][key] = done;
      Storage.scheduleSave();
    }

    function taskRowHtml(key, title, subjectId, type, freqLabel, adhocId) {
      var checked = isTaskDone(key) ? 'checked' : '';
      var doneClass = isTaskDone(key) ? 'done' : '';
      var delBtn = adhocId
        ? '<button class="del-task del-adhoc" data-id="' + adhocId + '"><span class="icon" data-icon="x" aria-hidden="true"></span></button>'
        : '<span style="width:20px;display:inline-block;"></span>';
      var colorClass = AppState.subjectColorClass(subjectId);
      return '<div class="task-row">' +
        '<input type="checkbox" class="task-check" data-key="' + key + '" ' + checked + '>' +
        '<span class="task-label ' + doneClass + '">' + Utils.escapeHtml(title) + '</span>' +
        '<span class="badge ' + colorClass + '">' + Utils.escapeHtml(subjectName(subjectId)) + '</span>' +
        '<span style="font-family:var(--sans);font-size:10px;color:var(--txt3);">' + freqLabel + '</span>' +
        '<button class="btn-go-to-note" data-subject="' + (subjectId || '') + '" data-type="' + type + '" data-title="' + Utils.escapeHtml(title) + '">go to note</button>' +
        delBtn + '</div>';
    }

    function renderTodayTasks() {
      var dayIdx = Utils.todayDayIndex();
      var recurringToday = AppState.recurring.filter(function (r) { return r.days.indexOf(dayIdx) !== -1; });
      var adhocToday = AppState.adhocTasks.filter(function (t) { return t.date === Utils.todayStr(); });
      var rows = [];
      recurringToday.forEach(function (r) {
        rows.push(taskRowHtml('rec:' + r.id, r.title, r.subjectId, r.type, 'recurring'));
      });
      adhocToday.forEach(function (t) {
        rows.push(taskRowHtml('adhoc:' + t.id, t.title, t.subjectId, t.type, 'one-off', t.id));
      });

      if (rows.length === 0) {
        Utils.$('today-task-list').innerHTML =
          '<p class="empty-note">Nothing scheduled today. Add a recurring task in Schedule manager, or a one-off task below.</p>';
      } else {
        Utils.$('today-task-list').innerHTML = rows.join('');
      }

      document.querySelectorAll('.task-check').forEach(function (cb) {
        cb.addEventListener('change', function () {
          setTaskDone(cb.dataset.key, cb.checked);
          var label = cb.parentElement.querySelector('.task-label');
          if (label) label.classList.toggle('done', cb.checked);
        });
      });
      document.querySelectorAll('.del-adhoc').forEach(function (b) {
        b.addEventListener('click', function () {
          AppState.adhocTasks = AppState.adhocTasks.filter(function (t) { return t.id !== b.dataset.id; });
          renderTodayTasks(); renderCalendar(); renderManagerTaskList();
          Stats.render(); Storage.scheduleSave();
        });
      });
      document.querySelectorAll('.btn-go-to-note').forEach(function (b) {
        b.addEventListener('click', function () {
          goToNoteForTask(b.dataset.subject, b.dataset.type, b.dataset.title);
        });
      });
    }

    // ------ monthly calendar ------
    function getTasksForDate(dateStr) {
      var parts = dateStr.split('-').map(Number);
      var d = new Date(parts[0], parts[1] - 1, parts[2]);
      var dayIdx = (d.getDay() === 0) ? 6 : d.getDay() - 1;
      var items = [];
      AppState.recurring.forEach(function (r) {
        if (r.days.indexOf(dayIdx) !== -1) {
          items.push({ title: r.title, subjectId: r.subjectId, type: r.type, kind: 'recurring' });
        }
      });
      AppState.adhocTasks.forEach(function (t) {
        if (t.date === dateStr) items.push({ title: t.title, subjectId: t.subjectId, type: t.type, kind: 'one-off' });
      });
      return items;
    }

    function changeMonth(delta) {
      var parts = AppState.calMonth.split('-').map(Number);
      var d = new Date(parts[0], parts[1] - 1 + delta, 1);
      AppState.calMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      renderCalendar();
    }

    function renderCalendar() {
      var parts = AppState.calMonth.split('-').map(Number);
      var year = parts[0], monthNum = parts[1];
      Utils.$('cal-month-label').textContent = new Date(year, monthNum - 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      var firstOfMonth = new Date(year, monthNum - 1, 1);
      var leadOffset = (firstOfMonth.getDay() + 6) % 7;
      var daysInMonth = new Date(year, monthNum, 0).getDate();
      var daysInPrevMonth = new Date(year, monthNum - 1, 0).getDate();

      var cells = [];
      for (var i = leadOffset - 1; i >= 0; i--) {
        var dnum = daysInPrevMonth - i;
        var d = new Date(year, monthNum - 2, dnum);
        cells.push({ date: Utils.fmtDateYMD(d), dnum: dnum, otherMonth: true });
      }
      for (var dn = 1; dn <= daysInMonth; dn++) {
        var d2 = new Date(year, monthNum - 1, dn);
        cells.push({ date: Utils.fmtDateYMD(d2), dnum: dn, otherMonth: false });
      }
      while (cells.length % 7 !== 0) {
        var nextIdx = cells.length - leadOffset - daysInMonth + 1;
        var d3 = new Date(year, monthNum, nextIdx);
        cells.push({ date: Utils.fmtDateYMD(d3), dnum: d3.getDate(), otherMonth: true });
      }

      var todayDate = Utils.todayStr();
      var MAX_VISIBLE = 3;

      Utils.$('cal-grid').innerHTML = cells.map(function (cell) {
        var items = cell.otherMonth ? [] : getTasksForDate(cell.date);
        var isToday = cell.date === todayDate;
        var visible = items.slice(0, MAX_VISIBLE);
        var extra = items.length - visible.length;
        var eventsHtml = visible.map(function (it) {
          var safeTitle = Utils.escapeHtml(it.title);
          return '<div class="cal-event" style="background:var(--surf2);border-color:var(--txt2);color:var(--txt);" title="' + safeTitle + '">' + safeTitle + '</div>';
        }).join('');
        var moreHtml = extra > 0
          ? '<button class="cal-more-btn" data-date="' + cell.date + '">+' + extra + ' more</button>'
          : '';
        var cls = 'cal-day' + (cell.otherMonth ? ' other-month' : '');
        return '<div class="' + cls + '">' +
          '<div class="cal-daynum' + (isToday ? ' today' : '') + '">' + cell.dnum + '</div>' +
          eventsHtml + moreHtml +
          '</div>';
      }).join('');

      document.querySelectorAll('.cal-more-btn').forEach(function (b) {
        b.addEventListener('click', function () { openDayEventsModal(b.dataset.date); });
      });
    }

    function openDayEventsModal(dateStr) {
      var items = getTasksForDate(dateStr);
      var parts = dateStr.split('-').map(Number);
      var d = new Date(parts[0], parts[1] - 1, parts[2]);
      Utils.$('day-events-title').textContent = d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
      if (items.length === 0) {
        Utils.$('day-events-list').innerHTML = '<p class="empty-note">No tasks this day.</p>';
      } else {
        Utils.$('day-events-list').innerHTML = items.map(function (it) {
          var colorClass = AppState.subjectColorClass(it.subjectId);
          return '<div class="task-row">' +
            '<span class="task-label">' + Utils.escapeHtml(it.title) + '</span>' +
            '<span class="badge ' + colorClass + '">' + Utils.escapeHtml(subjectName(it.subjectId)) + '</span>' +
            '<span style="font-family:var(--sans);font-size:10px;color:var(--txt3);">' + it.kind + '</span>' +
            '<button class="btn-go-to-note" data-subject="' + (it.subjectId || '') + '" data-type="' + it.type + '" data-title="' + Utils.escapeHtml(it.title) + '">go to note</button>' +
            '</div>';
        }).join('');
        document.querySelectorAll('#day-events-list .btn-go-to-note').forEach(function (b) {
          b.addEventListener('click', function () {
            Modal.close('mo-day-events');
            goToNoteForTask(b.dataset.subject, b.dataset.type, b.dataset.title);
          });
        });
      }
      Modal.open('mo-day-events');
    }

    function setupCalendarControls() {
      Utils.$('cal-prev-btn').addEventListener('click', function () { changeMonth(-1); });
      Utils.$('cal-next-btn').addEventListener('click', function () { changeMonth(1); });
      Utils.$('day-events-modal-close').addEventListener('click', function () { Modal.close('mo-day-events'); });
      Utils.$('day-events-modal-cancel').addEventListener('click', function () { Modal.close('mo-day-events'); });
    }

    return {
      renderDayPicker: renderDayPicker,
      renderRecurringList: renderRecurringList,
      renderTodayTasks: renderTodayTasks,
      renderManagerTaskList: renderManagerTaskList,
      renderCalendar: renderCalendar,
      setupRecurringForm: setupRecurringForm,
      setupAdhocForm: setupAdhocForm,
      setupCalendarControls: setupCalendarControls
    };
  })();

  /* ===========================================================
   * Library - catalog of study material (books, films, courses...)
   *
   * Kept separate from notebooks on purpose: material is often consumed
   * without writing notes, so auto-creating a notebook per item would fill
   * the notebook list with empty shells. Items link to a notebook on demand.
   *
   * The add/edit modal follows a "search once, confirm the rest" flow:
   * the search bar is the primary input at the top; every other field is
   * auto-filled and merely confirmed. Auto-fill NEVER overwrites a field
   * the user has touched (tracked per-field), and implicit inheritance
   * (series/author) fills empty untouched fields only.
   *
   * Auto-fill APIs: Google Books / MusicBrainz / Crossref need no key.
   * TMDB (film & TV) needs a free key -> optional, set in Settings.
   * =========================================================== */
  var Library = (function () {
    var editingId = null;
    var lookupAbort = null;
    var touched = {};        // field id -> true once the user types in it
    var coverTouched = false;
    var coverRot = 0;        // rotation for URL covers (data-URLs rotate pixels)

    // ---------- text normalization ----------

    /* APIs frequently return SHOUTED names ("MARC BROWN"). Fix only when the
       whole string is caps - "HarperCollins" and "J.K. Rowling" are already
       correct and must not be touched. Hyphens/apostrophes need their own
       capital: JEAN-PAUL -> Jean-Paul, O'BRIEN -> O'Brien. */
    function titleCaseIfAllCaps(s) {
      if (!s) return s || '';
      var letters = s.replace(/[^A-Za-z]/g, '');
      if (!letters || letters !== letters.toUpperCase()) return s;
      return s.toLowerCase().replace(/(^|[\s\-'\u2019.])([a-z])/g, function (m, p, c) {
        return p + c.toUpperCase();
      });
    }

    var GENRE_RULES = [
      [/economic|business|finance|market/i, 'Economics'],
      [/comput|software|programming|technolog|engineering/i, 'Technology'],
      [/scien|nature|physics|chemistry|biolog/i, 'Science & Nature'],
      [/math/i, 'Mathematics'],
      [/histor/i, 'History'],
      [/philosoph/i, 'Philosophy'],
      [/psycholog|mind/i, 'Psychology'],
      [/language|linguistic|grammar/i, 'Language'],
      [/politic|government/i, 'Politics'],
      [/biograph|memoir/i, 'Biography'],
      [/art|design|photograph|music/i, 'Art & Design'],
      [/mystery|thriller|crime|detective/i, 'Mystery'],
      [/adventure|action/i, 'Adventure'],
      [/humor|comedy/i, 'Humor'],
      [/animal|bears|dogs|cats/i, 'Animals'],
      [/self-help|self improvement|productivity/i, 'Self-improvement'],
      [/fiction|literary|novel/i, 'Literature']
    ];

    function mapGenre(raw) {
      if (!raw) return null;
      for (var i = 0; i < GENRE_RULES.length; i++) {
        if (GENRE_RULES[i][0].test(raw)) return GENRE_RULES[i][1];
      }
      return null;
    }

    /* Series key v2: normalize, then strip trailing volume/level tokens so
       "Write Right 2 - Beginner" and "Write Right 3" share the key
       "write right". Two guards keep title numbers safe: stripping is
       capped at 2 tokens, and bare numbers only count as volume markers
       when they are 1-2 digits - "Physics 101" keeps its 101 (course
       numbers are 3+ digits, volume numbers rarely are). */
    var SERIES_TAIL = /^(beginner|intermediate|advanced|elementary|starter|level|lv|vol|volume|part|book|season|series|episode|ep|s\d+|e\d+|\d{1,2}|[ivx]+)$/;
    function seriesKey(title) {
      var t = (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return '';
      var words = t.split(' ');
      var stripped = 0;
      while (words.length > 1 && stripped < 2 && SERIES_TAIL.test(words[words.length - 1])) {
        words.pop();
        stripped++;
      }
      return words.join(' ');
    }

    /** First meaningful word (articles removed) - looser fallback so
        "Arthur's Tree House" still matches "Arthur and the Big Snow". */
    function firstWordKey(title) {
      var t = (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      var words = t.split(/\s+/).filter(function (w) {
        return w && ['a', 'an', 'the'].indexOf(w) === -1;
      });
      return words[0] || '';
    }

    function sameAuthor(a, b) {
      return (a || '').trim().toLowerCase().replace(/\s+/g, ' ') ===
        (b || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // ---------- touched tracking (the absolute rule) ----------

    var TRACKED_FIELDS = ['lib-title', 'lib-author', 'lib-illustrator', 'lib-publisher',
      'lib-isbn', 'lib-category', 'lib-genre', 'lib-level'];

    /** Set a field's value only when it is empty AND the user never typed in
        it. This is the one rule every automation path goes through. */
    function fillIfUntouched(id, value) {
      if (!value) return false;
      var el = Utils.$(id);
      if (touched[id]) return false;
      if (el.tagName === 'SELECT') {
        if (el.value) return false;
        setSelectValue(id, value);
        return true;
      }
      if (el.value.trim()) return false;
      el.value = value;
      return true;
    }

    /* Inherit publisher/category/genre (and illustrator for books) from an
       earlier item by the same author. Tiered match: exact series key first,
       then first-word, then any same-author item; most recent wins. */
    function inheritFromSeries() {
      var author = Utils.$('lib-author').value;
      if (!author.trim()) return;
      var sKey = seriesKey(Utils.$('lib-title').value);
      var fKey = firstWordKey(Utils.$('lib-title').value);

      var byAuthor = AppState.library.filter(function (it) {
        return it.id !== editingId && sameAuthor(it.author, author);
      });
      if (byAuthor.length === 0) return;

      var recent = function (arr) {
        return arr.slice().sort(function (a, b) {
          return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
        })[0];
      };
      var src =
        (sKey && recent(byAuthor.filter(function (it) { return seriesKey(it.title) === sKey; }))) ||
        (fKey && recent(byAuthor.filter(function (it) { return firstWordKey(it.title) === fKey; }))) ||
        recent(byAuthor);
      if (!src) return;

      var got = false;
      got = fillIfUntouched('lib-category', src.category) || got;
      got = fillIfUntouched('lib-genre', src.genre) || got;
      got = fillIfUntouched('lib-publisher', src.publisher) || got;
      if (Utils.$('lib-type').value === 'book') {
        got = fillIfUntouched('lib-illustrator', src.illustrator) || got;
      }
      if (got) setStatus('inherited details from "' + src.title + '"');
    }

    // ---------- autocomplete datalists (author / illustrator / publisher) ----------

    /* Native datalist, but populated dynamically: with an empty input the
       list is kept empty (so nothing pops up on focus), and once typing
       starts it holds up to 8 contains-matches from existing data. */
    function wireAutocomplete(inputId, listId, field) {
      var input = Utils.$(inputId);
      input.setAttribute('list', listId);
      input.addEventListener('input', function () {
        var list = Utils.$(listId);
        var q = this.value.trim().toLowerCase();
        if (!q) { list.innerHTML = ''; return; }
        var seen = {};
        var out = [];
        AppState.library.forEach(function (it) {
          var v = (it[field] || '').trim();
          if (!v || seen[v]) return;
          if (v.toLowerCase().indexOf(q) !== -1) { seen[v] = true; out.push(v); }
        });
        list.innerHTML = out.slice(0, 8).map(function (v) {
          return '<option value="' + Utils.escapeHtml(v) + '"></option>';
        }).join('');
      });
    }

    // ---------- select helpers (category/genre stay as <select>) ----------

    /* Category/Genre are fixed-choice axes, so they stay <select> (a
       datalist hides its list once filled, which kills re-picking). */
    function fillSelect(id, presets, currentValue, field) {
      var el = Utils.$(id);
      var used = AppState.usedValues(field);
      var seen = {};
      var opts = ['<option value=""></option>'];
      presets.concat(used).forEach(function (v) {
        if (!v || seen[v]) return;
        seen[v] = true;
        opts.push('<option value="' + Utils.escapeHtml(v) + '">' + Utils.escapeHtml(v) + '</option>');
      });
      if (currentValue && !seen[currentValue]) {
        opts.push('<option value="' + Utils.escapeHtml(currentValue) + '">' + Utils.escapeHtml(currentValue) + '</option>');
        seen[currentValue] = true;
      }
      opts.push('<option value="__custom__">+ Custom\u2026</option>');
      el.innerHTML = opts.join('');
      el.value = currentValue || '';
    }

    function setSelectValue(id, value) {
      var el = Utils.$(id);
      if (!value) { el.value = ''; return; }
      var exists = Array.prototype.some.call(el.options, function (o) { return o.value === value; });
      if (!exists) {
        var opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        el.insertBefore(opt, el.options[el.options.length - 1]);
      }
      el.value = value;
    }

    function handleCustomSelect(id) {
      Utils.$(id).addEventListener('change', function () {
        if (this.value !== '__custom__') return;
        var v = (prompt('Enter a custom value:') || '').trim();
        if (!v) { this.value = ''; return; }
        setSelectValue(id, v);
      });
    }

    function refreshCategorySelect() {
      var type = Utils.$('lib-type').value;
      var current = Utils.$('lib-category').value;
      var presets = AppState.CATEGORY_PRESETS[type] || AppState.CATEGORY_PRESETS.other;
      fillSelect('lib-category', presets, current === '__custom__' ? '' : current, 'category');
    }

    // ---------- per-type field visibility ----------

    var LEVEL_TYPES = { movie: 1, series: 1, lecture: 1, video: 1, paper: 1, article: 1, other: 1 };

    function levelPlaceholder() {
      var t = Utils.$('lib-type').value;
      if (t === 'movie' || t === 'series') return 'age rating, e.g. PG / 15';
      if (t === 'lecture' || t === 'video') return 'beginner / intermediate / advanced';
      if (t === 'paper' || t === 'article') return 'year, e.g. 2024';
      return 'level';
    }

    function applyTypeVisibility() {
      var t = Utils.$('lib-type').value;
      // illustrator only makes sense for books; hide it elsewhere
      Utils.$('lib-illustrator-wrap').style.display = (t === 'book') ? '' : 'none';
      // no reading levels for adults: books/music have no level field at all
      Utils.$('lib-level-wrap').style.display = LEVEL_TYPES[t] ? '' : 'none';
      Utils.$('lib-level').placeholder = levelPlaceholder();
    }

    // ---------- status line ----------
    function setStatus(msg, isError) {
      var el = Utils.$('lib-lookup-status');
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('err', !!isError);
    }

    // ---------- network ----------

    /* Shared lookup wrapper: offline check, hard 15s timeout, and quota/auth
       errors translated into actionable words. A failed lookup never blocks
       manual entry - the form stays editable throughout. */
    function fetchJson(url, cb) {
      if (!navigator.onLine) {
        setStatus('you appear to be offline — connect and try again, or fill the form in by hand.', true);
        return;
      }
      if (lookupAbort) lookupAbort.abort();
      lookupAbort = new AbortController();
      var timer = setTimeout(function () { lookupAbort.abort(); }, 15000);

      fetch(url, { signal: lookupAbort.signal })
        .then(function (res) {
          clearTimeout(timer);
          if (res.status === 429) throw new Error('quota');
          if (res.status === 401 || res.status === 403) throw new Error('auth');
          if (!res.ok) throw new Error('http ' + res.status);
          return res.json();
        })
        .then(cb)
        .catch(function (e) {
          clearTimeout(timer);
          if (e.name === 'AbortError') {
            setStatus('the search timed out. Check your connection, or enter the details manually.', true);
          } else if (e.message === 'quota') {
            setStatus('search limit reached for now. Wait a few minutes, or enter the details manually.', true);
          } else if (e.message === 'auth') {
            setStatus('the API key was rejected. Check it in Settings, or enter the details manually.', true);
          } else {
            setStatus('search failed. You can still fill the form in by hand.', true);
          }
        });
    }

    function search() {
      var q = Utils.$('lib-search-input').value.trim();
      if (!q) return;
      var type = Utils.$('lib-type').value;
      Utils.$('lib-results').innerHTML = '';
      setStatus('searching\u2026');

      if (type === 'book') return searchBooks(q);
      if (type === 'movie' || type === 'series') return searchTmdb(q, type);
      if (type === 'music') return searchMusic(q);
      if (type === 'paper') return searchCrossref(q);
      setStatus('automatic lookup isn\'t available for this type — fill the form in by hand.');
    }

    function renderResults(rows) {
      if (rows.length === 0) { setStatus('no matches — fill the form in by hand.'); return; }
      setStatus('');
      Utils.$('lib-results').innerHTML = rows.map(function (r, i) {
        return '<button type="button" class="lib-result" data-idx="' + i + '">' +
          (r.coverUrl
            ? '<img src="' + Utils.escapeHtml(r.coverUrl) + '" alt="" class="lib-result-img">'
            : '<span class="lib-result-img lib-result-noimg"></span>') +
          '<span class="lib-result-main">' +
          '<span class="lib-result-title">' + Utils.escapeHtml(r.title || '(untitled)') + '</span>' +
          '<span class="lib-result-sub">' + Utils.escapeHtml([r.author, r.publisher].filter(Boolean).join(' \u00b7 ')) + '</span>' +
          '</span></button>';
      }).join('');
      document.querySelectorAll('.lib-result').forEach(function (el) {
        el.addEventListener('click', function () {
          applyResult(rows[parseInt(el.dataset.idx, 10)]);
        });
      });
    }

    /* Result click is an explicit fill request, so it writes the searched
       fields - but still skips any field the user typed in by hand, and the
       cover if one was uploaded manually. Then the results collapse and a
       one-line note says what happened (per the "no leftover search UI"
       principle). */
    function applyResult(r) {
      if (!touched['lib-title']) Utils.$('lib-title').value = r.title || '';
      if (!touched['lib-author']) Utils.$('lib-author').value = r.author || '';
      if (!touched['lib-publisher']) Utils.$('lib-publisher').value = r.publisher || '';
      if (!touched['lib-isbn']) Utils.$('lib-isbn').value = r.isbn || '';
      if (r.coverUrl && !coverTouched) {
        Utils.$('lib-cover-url').value = r.coverUrl;
        coverRot = 0;
        renderCoverPreview();
      }
      refreshCategorySelect();

      inheritFromSeries();                       // implicit: empty+untouched only

      if (!Utils.$('lib-genre').value && !touched['lib-genre']) {
        var mapped = mapGenre(r.rawGenre);
        if (mapped) setSelectValue('lib-genre', mapped);
        else if (r.rawGenre) setSelectValue('lib-genre', r.rawGenre);
      }
      Utils.$('lib-results').innerHTML = '';     // collapse results
      setStatus('filled in from search — check the details and adjust as needed.');
    }

    function searchBooks(q) {
      var url = 'https://www.googleapis.com/books/v1/volumes?q=intitle:' + encodeURIComponent(q) + '&maxResults=8';
      fetchJson(url, function (data) {
        var rows = (data.items || []).map(function (it) {
          var v = it.volumeInfo || {};
          var ids = v.industryIdentifiers || [];
          var isbn13 = ids.find(function (x) { return x.type === 'ISBN_13'; });
          var isbn10 = ids.find(function (x) { return x.type === 'ISBN_10'; });
          return {
            title: v.title || '',
            author: (v.authors || []).map(titleCaseIfAllCaps).join(', '),
            publisher: titleCaseIfAllCaps(v.publisher || ''),
            isbn: (isbn13 && isbn13.identifier) || (isbn10 && isbn10.identifier) || '',
            coverUrl: (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail) || '')
              .replace(/^http:/, 'https:'),
            rawGenre: (v.categories || [])[0] || ''
          };
        });
        renderResults(rows);
      });
    }

    function searchTmdb(q, type) {
      var key = (AppState.settings.tmdbKey || '').trim();
      if (!key) {
        setStatus('film & TV lookup needs a free TMDB key — add one in Settings (auto-fill card), or fill the form in by hand.');
        return;
      }
      var kind = (type === 'series') ? 'tv' : 'movie';
      var url = 'https://api.themoviedb.org/3/search/' + kind +
        '?api_key=' + encodeURIComponent(key) + '&query=' + encodeURIComponent(q);
      fetchJson(url, function (data) {
        var rows = (data.results || []).slice(0, 8).map(function (m) {
          var date = m.release_date || m.first_air_date || '';
          return {
            title: m.title || m.name || '',
            author: '',
            publisher: date ? date.slice(0, 4) : '',
            isbn: '',
            coverUrl: m.poster_path ? 'https://image.tmdb.org/t/p/w200' + m.poster_path : '',
            rawGenre: ''
          };
        });
        renderResults(rows);
      });
    }

    function searchMusic(q) {
      var url = 'https://musicbrainz.org/ws/2/release-group?query=' +
        encodeURIComponent(q) + '&fmt=json&limit=8';
      fetchJson(url, function (data) {
        var rows = (data['release-groups'] || []).map(function (rg) {
          var credit = (rg['artist-credit'] || [])[0];
          return {
            title: rg.title || '',
            author: titleCaseIfAllCaps((credit && credit.name) || ''),
            publisher: (rg['first-release-date'] || '').slice(0, 4),
            isbn: '',
            coverUrl: rg.id ? 'https://coverartarchive.org/release-group/' + rg.id + '/front-250' : '',
            rawGenre: (rg['primary-type'] || '')
          };
        });
        renderResults(rows);
      });
    }

    function searchCrossref(q) {
      var url = 'https://api.crossref.org/works?query.title=' + encodeURIComponent(q) + '&rows=8';
      fetchJson(url, function (data) {
        var rows = ((data.message && data.message.items) || []).map(function (w) {
          var authors = (w.author || []).slice(0, 3).map(function (a) {
            return titleCaseIfAllCaps([a.given, a.family].filter(Boolean).join(' '));
          }).join(', ');
          return {
            title: (w.title || [])[0] || '',
            author: authors,
            publisher: (w['container-title'] || [])[0] || w.publisher || '',
            isbn: w.DOI || '',
            coverUrl: '',
            rawGenre: (w.subject || [])[0] || ''
          };
        });
        renderResults(rows);
      });
    }

    // ---------- cover: one box does click-upload + drag-drop + paste ----------

    function renderCoverPreview() {
      var url = Utils.$('lib-cover-url').value;
      var box = Utils.$('lib-cover-preview');
      if (!url) {
        box.innerHTML = '<span class="lib-cover-hint">Paste, drag<br>or click to upload</span>';
        box.classList.add('empty');
        return;
      }
      box.classList.remove('empty');
      var rotStyle = coverRot ? ' style="transform:rotate(' + coverRot + 'deg)"' : '';
      box.innerHTML = '<img src="' + Utils.escapeHtml(url) + '" alt="cover"' + rotStyle + '>';
    }

    /* Uploaded covers MUST be downscaled: one phone photo is 3-5MB and
       localStorage holds roughly 5MB total. Remote URLs cost nothing. */
    function processCoverImage(dataUrl, rotateDeg, cb) {
      var img = new Image();
      img.onload = function () {
        var max = 520;
        var w = img.width, h = img.height;
        var scale = Math.min(1, max / Math.max(w, h));
        var dw = Math.round(w * scale), dh = Math.round(h * scale);
        var c = document.createElement('canvas');
        var rot = ((rotateDeg || 0) % 360 + 360) % 360;
        if (rot === 90 || rot === 270) { c.width = dh; c.height = dw; }
        else { c.width = dw; c.height = dh; }
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate(rot * Math.PI / 180);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        cb(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { setStatus('that image could not be read.', true); };
      img.src = dataUrl;
    }

    function readCoverFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type || '')) {
        setStatus('that file is not an image.', true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        processCoverImage(e.target.result, 0, function (out) {
          Utils.$('lib-cover-url').value = out;
          coverRot = 0;
          coverTouched = true;
          renderCoverPreview();
          setStatus('cover added (resized to save space).');
        });
      };
      reader.onerror = function () { setStatus('that image could not be read.', true); };
      reader.readAsDataURL(file);
    }

    /* Rotate: pixel-rotate stored uploads (so the saved image is upright);
       for external URLs we can't touch the pixels, so store an angle and
       rotate with CSS wherever it's displayed. */
    function rotateCover() {
      var url = Utils.$('lib-cover-url').value;
      if (!url) return;
      if (/^data:/.test(url)) {
        processCoverImage(url, 90, function (out) {
          Utils.$('lib-cover-url').value = out;
          coverTouched = true;
          renderCoverPreview();
        });
      } else {
        coverRot = (coverRot + 90) % 360;
        renderCoverPreview();
      }
    }

    // ---------- modal ----------

    function blankItem() {
      return {
        id: '', title: '', author: '', illustrator: '', publisher: '', isbn: '',
        coverUrl: '', coverRotation: 0, type: 'book', category: '', genre: '',
        callNo: '', levelInput: '', status: 'want', progress: 0, rating: 0,
        notes: '', noteId: '', createdAt: '', updatedAt: ''
      };
    }

    function openModal(id) {
      editingId = id || null;
      var it = id ? AppState.itemById(id) : blankItem();
      if (!it) return;

      // hard reset: no leftovers from the previous search or edit session
      touched = {};
      coverTouched = false;
      coverRot = it.coverRotation || 0;
      Utils.$('lib-modal-title').textContent = id ? 'Edit item' : 'Add to library';
      Utils.$('lib-search-input').value = '';
      Utils.$('lib-results').innerHTML = '';
      setStatus('');

      Utils.$('lib-type').value = it.type || 'book';
      Utils.$('lib-title').value = it.title || '';
      Utils.$('lib-author').value = it.author || '';
      Utils.$('lib-illustrator').value = it.illustrator || '';
      Utils.$('lib-publisher').value = it.publisher || '';
      Utils.$('lib-isbn').value = it.isbn || '';
      Utils.$('lib-level').value = it.levelInput || '';
      Utils.$('lib-notes').value = it.notes || '';
      Utils.$('lib-cover-url').value = it.coverUrl || '';
      renderCoverPreview();

      refreshCategorySelect();
      setSelectValue('lib-category', it.category || '');
      fillSelect('lib-genre', AppState.GENRE_PRESETS, it.genre || '', 'genre');
      applyTypeVisibility();

      // tracking fields (status/progress/rating) belong to the EDIT phase -
      // at registration time they'd just be noise, so they stay hidden then
      var editing = !!id;
      Utils.$('lib-tracking').style.display = editing ? '' : 'none';
      Utils.$('lib-delete-btn').style.display = editing ? '' : 'none';
      if (editing) {
        Utils.$('lib-status').value = it.status || 'want';
        Utils.$('lib-progress').value = it.progress || 0;
        Utils.$('lib-rating').value = it.rating || 0;
        Utils.$('lib-callno').value = it.callNo || '';
      }
      renderNotebookLink(it);

      Modal.open('mo-library');
      Utils.$('lib-search-input').focus();
    }

    function renderNotebookLink(it) {
      var el = Utils.$('lib-notebook-link');
      var note = it.noteId ? AppState.notes.find(function (n) { return n.id === it.noteId; }) : null;
      el.textContent = note ? 'linked to notebook: ' + note.title : '';
    }

    function valueOf(id) {
      var v = Utils.$(id).value;
      return v === '__custom__' ? '' : v;
    }

    function save() {
      var title = Utils.$('lib-title').value.trim();
      if (!title) { setStatus('a title is required.', true); return; }

      var it = editingId ? AppState.itemById(editingId) : null;
      var isNew = !it;
      if (isNew) {
        it = blankItem();
        it.id = Utils.uid();
        it.createdAt = new Date().toISOString();
        AppState.library.push(it);
      }

      it.type = Utils.$('lib-type').value;
      it.title = title;
      it.author = Utils.$('lib-author').value.trim();
      it.illustrator = Utils.$('lib-illustrator').value.trim();
      it.publisher = Utils.$('lib-publisher').value.trim();
      it.isbn = Utils.$('lib-isbn').value.trim();
      it.coverUrl = Utils.$('lib-cover-url').value.trim();
      it.coverRotation = /^data:/.test(it.coverUrl) ? 0 : coverRot;
      it.category = valueOf('lib-category');
      it.genre = valueOf('lib-genre');
      it.levelInput = LEVEL_TYPES[it.type] ? Utils.$('lib-level').value.trim() : '';

      if (editingId) {
        it.status = Utils.$('lib-status').value;
        var prog = parseInt(Utils.$('lib-progress').value, 10);
        it.progress = isNaN(prog) ? 0 : Math.max(0, Math.min(100, prog));  // clamp
        var rate = parseInt(Utils.$('lib-rating').value, 10);
        it.rating = isNaN(rate) ? 0 : Math.max(0, Math.min(5, rate));      // clamp
        var typed = Utils.$('lib-callno').value.trim();
        it.callNo = typed || it.callNo || AppState.nextCallNo(it);
      } else {
        // registration defaults; call number assigned once, never renumbered
        it.callNo = it.callNo || AppState.nextCallNo(it);
      }

      it.notes = Utils.$('lib-notes').value;
      it.updatedAt = new Date().toISOString();

      Modal.close('mo-library');
      renderList();
      Storage.scheduleSave();
    }

    function deleteFromModal() {
      if (!editingId) return;
      var it = AppState.itemById(editingId);
      if (!it) return;
      if (!confirm('Remove "' + it.title + '" from the library?')) return;
      AppState.library = AppState.library.filter(function (x) { return x.id !== editingId; });
      delete AppState.librarySelection[editingId];
      Modal.close('mo-library');
      renderList();
      Storage.scheduleSave();
    }

    // ---------- list ----------

    function visibleItems() {
      var q = (Utils.$('lib-search').value || '').toLowerCase().trim();
      return AppState.library.filter(function (it) {
        if (AppState.libraryTypeFilter !== 'all' && it.type !== AppState.libraryTypeFilter) return false;
        if (AppState.libraryCategoryFilter !== 'all' && it.category !== AppState.libraryCategoryFilter) return false;
        if (AppState.libraryGenreFilter !== 'all' && it.genre !== AppState.libraryGenreFilter) return false;
        if (AppState.libraryStatusFilter !== 'all' && it.status !== AppState.libraryStatusFilter) return false;
        if (!q) return true;
        var hay = [it.title, it.author, it.publisher, it.isbn, it.callNo,
          it.category, it.genre, it.notes].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
      }).sort(function (a, b) {
        return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
      });
    }

    function renderFilters() {
      var mk = function (id, values, current, allLabel) {
        var el = Utils.$(id);
        el.innerHTML = '<option value="all">' + allLabel + '</option>' +
          values.map(function (v) {
            return '<option value="' + Utils.escapeHtml(v) + '">' + Utils.escapeHtml(v) + '</option>';
          }).join('');
        el.value = current;
        if (el.value !== current) el.value = 'all';
      };
      var types = {};
      AppState.library.forEach(function (it) { if (it.type) types[it.type] = true; });
      mk('lib-type-filter', Object.keys(types).sort(), AppState.libraryTypeFilter, 'all types');
      mk('lib-category-filter', AppState.usedValues('category'), AppState.libraryCategoryFilter, 'all categories');
      mk('lib-genre-filter', AppState.usedValues('genre'), AppState.libraryGenreFilter, 'all genres');
      mk('lib-status-filter', AppState.ITEM_STATUSES.slice(), AppState.libraryStatusFilter, 'any status');
    }

    function selectedIds() {
      return Object.keys(AppState.librarySelection).filter(function (id) {
        return AppState.librarySelection[id] && AppState.itemById(id);
      });
    }

    function renderBulkBar() {
      var n = selectedIds().length;
      Utils.$('lib-bulk-bar').style.display = n > 0 ? 'flex' : 'none';
      Utils.$('lib-bulk-count').textContent = n + ' selected';
    }

    function renderList() {
      renderFilters();
      var items = visibleItems();
      var grid = Utils.$('lib-grid');

      if (items.length === 0) {
        grid.innerHTML = '<div class="empty"><span class="icon" data-icon="library" aria-hidden="true"></span>' +
          '<p>' + (AppState.library.length === 0
            ? 'Nothing in your library yet. Add a book, film, or course.'
            : 'No items match these filters.') + '</p></div>';
        renderBulkBar();
        return;
      }

      grid.innerHTML = items.map(function (it) {
        var lvl = AppState.computeLevel(it);
        var checked = AppState.librarySelection[it.id] ? 'checked' : '';
        var stars = it.rating > 0
          ? '<span class="lib-stars">' + '\u2605'.repeat(it.rating) + '</span>' : '';
        var prog = (it.status === 'in progress' && it.progress > 0)
          ? '<span class="lib-progressbar"><span style="width:' + it.progress + '%"></span></span>' : '';
        var rotStyle = (it.coverRotation && !/^data:/.test(it.coverUrl))
          ? ' style="transform:rotate(' + it.coverRotation + 'deg)"' : '';
        return '<div class="lib-card" data-id="' + it.id + '">' +
          '<input type="checkbox" class="lib-check" data-id="' + it.id + '" ' + checked + ' aria-label="select">' +
          (it.coverUrl
            ? '<span class="lib-cover-box"><img class="lib-cover" src="' + Utils.escapeHtml(it.coverUrl) + '" alt=""' + rotStyle + ' onerror="this.classList.add(\'broken\')"></span>'
            : '<div class="lib-cover-box lib-cover-empty"><span class="icon" data-icon="library" aria-hidden="true"></span></div>') +
          '<div class="lib-info">' +
          '<p class="lib-title">' + Utils.escapeHtml(it.title) + '</p>' +
          '<p class="lib-author">' + Utils.escapeHtml(it.author || '') + '</p>' +
          '<p class="lib-meta">' +
          '<span class="badge bdg-type">' + Utils.escapeHtml(it.type) + '</span>' +
          (it.category ? '<span class="badge bdg-type">' + Utils.escapeHtml(it.category) + '</span>' : '') +
          (it.genre ? '<span class="badge bdg-type">' + Utils.escapeHtml(it.genre) + '</span>' : '') +
          (lvl ? '<span class="badge bdg-level">' + Utils.escapeHtml(lvl) + '</span>' : '') +
          '</p>' +
          '<p class="lib-meta">' +
          '<span class="lib-status lib-status-' + it.status.replace(/\s/g, '-') + '">' + Utils.escapeHtml(it.status) + '</span>' +
          (it.callNo ? '<span class="lib-callno">' + Utils.escapeHtml(it.callNo) + '</span>' : '') +
          stars + '</p>' + prog +
          '</div>' +
          '<div class="lib-actions">' +
          '<button class="btn-go-to-note lib-open-note" data-id="' + it.id + '">go to note</button>' +
          '<button class="bic lib-edit" data-id="' + it.id + '" aria-label="edit"><span class="icon" data-icon="pencil" aria-hidden="true"></span></button>' +
          '</div>' +
          '</div>';
      }).join('');

      document.querySelectorAll('.lib-edit').forEach(function (b) {
        b.addEventListener('click', function () { openModal(b.dataset.id); });
      });
      document.querySelectorAll('.lib-open-note').forEach(function (b) {
        b.addEventListener('click', function () { openNotebookFor(b.dataset.id); });
      });
      document.querySelectorAll('.lib-check').forEach(function (cb) {
        cb.addEventListener('change', function () {
          if (cb.checked) AppState.librarySelection[cb.dataset.id] = true;
          else delete AppState.librarySelection[cb.dataset.id];
          renderBulkBar();
        });
      });

      renderBulkBar();
    }

    function openNotebookFor(id) {
      var it = AppState.itemById(id);
      if (!it) return;

      if (it.noteId) {
        var existing = AppState.notes.find(function (n) { return n.id === it.noteId; });
        if (existing) { Nav.showPage('notes'); NotesModule.selectNote(existing.id); return; }
        it.noteId = '';
      }

      if (AppState.subjects.length === 0) { alert('Add a subject first.'); return; }
      var names = AppState.subjects.map(function (s, i) { return (i + 1) + '. ' + s.name; }).join('\n');
      var pick = prompt('Which subject is "' + it.title + '" for?\n\n' + names + '\n\nEnter a number:');
      if (pick === null) return;
      var idx = parseInt(pick, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= AppState.subjects.length) {
        alert('That is not one of the numbers listed.');
        return;
      }
      var subject = AppState.subjects[idx];

      var noteType = (AppState.NOTEBOOK_TYPES.indexOf(it.type) !== -1) ? it.type
        : (it.type === 'series' || it.type === 'video') ? 'movie'
          : (it.type === 'paper' || it.type === 'article') ? 'self-study' : 'other';

      var note = AppState.noteBySubjectAndType(subject.id, noteType);
      if (!note) {
        note = {
          id: Utils.uid(), title: it.title, subjectId: subject.id, type: noteType,
          pages: [AppState.newBlankPage()]
        };
        AppState.notes.push(note);
      }
      it.noteId = note.id;
      it.updatedAt = new Date().toISOString();
      Storage.scheduleSave();
      Nav.showPage('notes');
      NotesModule.selectNote(note.id);
    }

    // ---------- bulk edit ----------

    function openBulkModal() {
      var ids = selectedIds();
      if (ids.length === 0) return;
      Utils.$('bulk-count-label').textContent = ids.length + ' item' + (ids.length === 1 ? '' : 's') + ' selected';

      var uniq = function (arr) {
        return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; });
      };
      var catOpts = ['<option value="__keep__">(keep — no change)</option>'];
      uniq(AppState.usedValues('category').concat(
        AppState.CATEGORY_PRESETS.book, AppState.CATEGORY_PRESETS.movie,
        AppState.CATEGORY_PRESETS.lecture)).forEach(function (v) {
          catOpts.push('<option value="' + Utils.escapeHtml(v) + '">' + Utils.escapeHtml(v) + '</option>');
        });
      Utils.$('bulk-category').innerHTML = catOpts.join('');

      var genOpts = ['<option value="__keep__">(keep — no change)</option>'];
      uniq(AppState.GENRE_PRESETS.concat(AppState.usedValues('genre'))).forEach(function (v) {
        genOpts.push('<option value="' + Utils.escapeHtml(v) + '">' + Utils.escapeHtml(v) + '</option>');
      });
      Utils.$('bulk-genre').innerHTML = genOpts.join('');

      var stOpts = ['<option value="__keep__">(keep — no change)</option>'];
      AppState.ITEM_STATUSES.forEach(function (v) {
        stOpts.push('<option value="' + v + '">' + v + '</option>');
      });
      Utils.$('bulk-status').innerHTML = stOpts.join('');

      Modal.open('mo-bulk');
    }

    function applyBulk() {
      var ids = selectedIds();
      var cat = Utils.$('bulk-category').value;
      var gen = Utils.$('bulk-genre').value;
      var st = Utils.$('bulk-status').value;
      var now = new Date().toISOString();

      ids.forEach(function (id) {
        var it = AppState.itemById(id);
        if (!it) return;
        if (cat !== '__keep__') it.category = cat;
        if (gen !== '__keep__') it.genre = gen;
        if (st !== '__keep__') it.status = st;
        it.updatedAt = now;
      });

      Modal.close('mo-bulk');
      AppState.librarySelection = {};
      renderList();
      Storage.scheduleSave();
    }

    // ---------- setup ----------

    function setup() {
      Utils.$('lib-add-btn').addEventListener('click', function () { openModal(null); });
      Utils.$('lib-search').addEventListener('input', renderList);

      var filterMap = {
        'lib-type-filter': 'libraryTypeFilter',
        'lib-category-filter': 'libraryCategoryFilter',
        'lib-genre-filter': 'libraryGenreFilter',
        'lib-status-filter': 'libraryStatusFilter'
      };
      Object.keys(filterMap).forEach(function (id) {
        Utils.$(id).addEventListener('change', function () {
          AppState[filterMap[id]] = this.value;
          renderList();
        });
      });

      // modal chrome
      Utils.$('lib-modal-close').addEventListener('click', function () { Modal.close('mo-library'); });
      Utils.$('lib-modal-cancel').addEventListener('click', function () { Modal.close('mo-library'); });
      Utils.$('lib-modal-save').addEventListener('click', save);
      Utils.$('lib-delete-btn').addEventListener('click', deleteFromModal);
      Utils.$('lib-search-btn').addEventListener('click', search);
      Utils.$('lib-search-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); search(); }  // Enter = search, not submit
      });

      Utils.$('lib-type').addEventListener('change', function () {
        refreshCategorySelect();
        applyTypeVisibility();
      });
      Utils.$('lib-author').addEventListener('blur', inheritFromSeries);

      // publisher: fix ALL-CAPS on blur; ISBN: digits/X only, books only
      Utils.$('lib-publisher').addEventListener('blur', function () {
        this.value = titleCaseIfAllCaps(this.value);
      });
      Utils.$('lib-isbn').addEventListener('blur', function () {
        if (Utils.$('lib-type').value === 'book') {
          this.value = this.value.replace(/[^0-9Xx]/g, '').toUpperCase();  // DOIs untouched (non-book)
        }
      });

      // touched tracking: a field the user typed in is never auto-overwritten
      TRACKED_FIELDS.forEach(function (id) {
        var ev = Utils.$(id).tagName === 'SELECT' ? 'change' : 'input';
        Utils.$(id).addEventListener(ev, function () { touched[id] = true; });
      });

      handleCustomSelect('lib-category');
      handleCustomSelect('lib-genre');

      // autocomplete from existing data (empty input -> no list)
      wireAutocomplete('lib-author', 'dl-authors', 'author');
      wireAutocomplete('lib-illustrator', 'dl-illustrators', 'illustrator');
      wireAutocomplete('lib-publisher', 'dl-publishers', 'publisher');

      // cover box: click = upload, drag = drop, Ctrl+V anywhere in modal = paste
      var box = Utils.$('lib-cover-preview');
      box.addEventListener('click', function () { Utils.$('lib-cover-file').click(); });
      box.addEventListener('dragover', function (e) { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', function () { box.classList.remove('drag'); });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        box.classList.remove('drag');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) readCoverFile(f);
      });
      Utils.$('lib-cover-file').addEventListener('change', function () {
        readCoverFile(this.files && this.files[0]);
        this.value = '';
      });
      // modal-wide paste: only intercept when the clipboard holds an image,
      // so pasting text into the form fields keeps working normally
      Utils.$('mo-library').addEventListener('paste', function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            readCoverFile(items[i].getAsFile());
            e.preventDefault();
            return;
          }
        }
      });
      Utils.$('lib-cover-rotate').addEventListener('click', rotateCover);
      Utils.$('lib-cover-remove').addEventListener('click', function () {
        Utils.$('lib-cover-url').value = '';
        coverRot = 0;
        coverTouched = false;
        renderCoverPreview();
      });
      Utils.$('lib-cover-google').addEventListener('click', function () {
        var t = Utils.$('lib-title').value.trim();
        if (!t) { setStatus('enter a title first.', true); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(t).catch(function () { /* ignore */ });
        window.open('https://www.google.com/search?tbm=isch&q=' +
          encodeURIComponent(t + ' cover'), '_blank', 'noopener');
        setStatus('title copied — find a cover, copy the image, then press Ctrl+V here.');
      });

      // bulk
      Utils.$('lib-bulk-edit-btn').addEventListener('click', openBulkModal);
      Utils.$('lib-bulk-clear-btn').addEventListener('click', function () {
        AppState.librarySelection = {};
        renderList();
      });
      Utils.$('bulk-modal-close').addEventListener('click', function () { Modal.close('mo-bulk'); });
      Utils.$('bulk-modal-cancel').addEventListener('click', function () { Modal.close('mo-bulk'); });
      Utils.$('bulk-modal-save').addEventListener('click', applyBulk);
    }

    return { setup: setup, renderList: renderList };
  })();

  /* ===========================================================
   * Flashcards - card grid + add modal + study mode overlay
   * =========================================================== */
  var Flashcards = (function () {

    function renderGrid() {
      var filter = Utils.$('deck-filter').value || 'all';
      var list = AppState.cards.filter(function (c) {
        return filter === 'all' || c.subjectId === filter;
      });
      if (list.length === 0) {
        Utils.$('card-grid').innerHTML =
          '<div class="empty" style="grid-column:1/-1;"><span class="icon" data-icon="cards" aria-hidden="true"></span><p>No cards yet.</p></div>';
        return;
      }
      Utils.$('card-grid').innerHTML = list.map(function (c) {
        return '<div class="flash-card">' +
          '<p class="fc-front">' + Utils.escapeHtml(c.front) + '</p>' +
          '<p class="fc-back">' + Utils.escapeHtml(c.back) + '</p>' +
          '<button class="del-card" data-id="' + c.id + '"><span class="icon" data-icon="x" aria-hidden="true"></span></button></div>';
      }).join('');
      document.querySelectorAll('.del-card').forEach(function (b) {
        b.addEventListener('click', function () {
          AppState.cards = AppState.cards.filter(function (c) { return c.id !== b.dataset.id; });
          renderGrid(); Stats.render(); Storage.scheduleSave();
        });
      });
    }

    function setupCards() {
      Utils.$('add-card-btn').addEventListener('click', function () {
        if (AppState.subjects.length === 0) {
          alert('Add a subject first — cards are grouped by subject.');
          return;
        }
        Utils.$('card-front-input').value = '';
        Utils.$('card-back-input').value = '';
        Modal.open('mo-card');
        Utils.$('card-front-input').focus();
      });
      Utils.$('card-modal-close').addEventListener('click', function () { Modal.close('mo-card'); });
      Utils.$('card-modal-cancel').addEventListener('click', function () { Modal.close('mo-card'); });
      Utils.$('card-modal-save').addEventListener('click', function () {
        var front = Utils.$('card-front-input').value.trim();
        var back = Utils.$('card-back-input').value.trim();
        if (!front || !back) { alert('Fill in both the question and the answer.'); return; }
        if (AppState.subjects.length === 0) { alert('Add a subject first.'); Modal.close('mo-card'); return; }
        var filter = Utils.$('deck-filter').value;
        // when the deck filter is "all", fall back to the first subject
        var subjectId = (filter && filter !== 'all') ? filter : AppState.subjects[0].id;
        AppState.cards.push({ id: Utils.uid(), front: front, back: back, subjectId: subjectId });
        Modal.close('mo-card');
        renderGrid(); Stats.render(); Storage.scheduleSave();
      });
    }

    // ------ study mode ------
    function getStudyDeck() {
      var filter = Utils.$('deck-filter').value || 'all';
      return AppState.cards.filter(function (c) {
        return filter === 'all' || c.subjectId === filter;
      });
    }

    function setupStudyMode() {
      var overlay = Utils.$('study-overlay');
      var layout = document.querySelector('.layout');
      var returnFocusTo = null;

      // The overlay is position:fixed over the page, so the page behind it must leave
      // the tab order (inert) or Tab would reach the covered delete-card buttons.
      function openOverlay() {
        returnFocusTo = document.activeElement;
        overlay.classList.add('open');
        if (layout) layout.inert = true;
        Utils.$('study-flip').focus();
      }
      function closeOverlay() {
        if (!overlay.classList.contains('open')) return;
        overlay.classList.remove('open');
        if (layout) layout.inert = false;
        if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
        returnFocusTo = null;
      }

      function renderCard() {
        var deck = getStudyDeck();
        if (deck.length === 0) {
          // deck emptied while studying (cards deleted / filter changed)
          closeOverlay();
          return;
        }
        if (AppState.studyIdx >= deck.length) AppState.studyIdx = 0;
        var c = deck[AppState.studyIdx];
        Utils.$('study-progress').textContent = (AppState.studyIdx + 1) + ' / ' + deck.length;
        Utils.$('study-card').textContent = AppState.studyFlipped ? c.back : c.front;
      }

      Utils.$('study-mode-btn').addEventListener('click', function () {
        var deck = getStudyDeck();
        if (deck.length === 0) { alert('No cards to review.'); return; }
        AppState.studyIdx = 0;
        AppState.studyFlipped = false;
        overlay.classList.add('open');
        renderCard();   // card text first, then focus, so the question is there when focus lands
        openOverlay();
      });
      // Listen on the document: after tabbing past the last button, focus sits on
      // <body>, and Escape must still close the overlay from there.
      document.addEventListener('keydown', function (e) {
        if (!overlay.classList.contains('open')) return;
        if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); return; }
        if (e.key !== 'Tab') return;
        var focusables = overlay.querySelectorAll('button:not([disabled])');
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        var inside = overlay.contains(document.activeElement);
        if (!inside) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      Utils.$('study-card').addEventListener('click', function () {
        AppState.studyFlipped = !AppState.studyFlipped; renderCard();
      });
      Utils.$('study-flip').addEventListener('click', function () {
        AppState.studyFlipped = !AppState.studyFlipped; renderCard();
      });
      Utils.$('study-prev').addEventListener('click', function () {
        var deck = getStudyDeck();
        AppState.studyIdx = (AppState.studyIdx - 1 + deck.length) % deck.length;
        AppState.studyFlipped = false; renderCard();
      });
      Utils.$('study-next').addEventListener('click', function () {
        var deck = getStudyDeck();
        AppState.studyIdx = (AppState.studyIdx + 1) % deck.length;
        AppState.studyFlipped = false; renderCard();
      });
      Utils.$('study-close').addEventListener('click', closeOverlay);
    }

    return { renderGrid: renderGrid, setupCards: setupCards, setupStudyMode: setupStudyMode };
  })();

  /* ===========================================================
   * Settings - font style + text size + data reset
   * =========================================================== */
  var Settings = {
    applyFontMode: function () {
      document.body.classList.toggle('font-clean', AppState.settings.fontMode === 'clean');
    },

    /** Serialize everything to a JSON file download, and remember when we
        did it so the reminder banner knows how fresh the last backup is. */
    exportBackup: function () {
      var payload = {
        app: 'studydesk',
        backupVersion: 1,
        exportedAt: new Date().toISOString(),
        data: {
          subjects: AppState.subjects,
          notes: AppState.notes,
          recurring: AppState.recurring,
          adhocTasks: AppState.adhocTasks,
          completions: AppState.completions,
          completionSync: AppState.completionSync,
          cards: AppState.cards,
          library: AppState.library,
          settings: AppState.settings
        }
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'studydesk-backup-' + Utils.todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      AppState.settings.lastBackupAt = new Date().toISOString();
      Storage.scheduleSave();
      this.hideBackupBanner();
      if (Utils.$('backup-status')) {
        Utils.$('backup-status').textContent =
          'backup downloaded (' + AppState.notes.length + ' notebooks, ' + AppState.cards.length + ' cards)';
      }
    },

    hideBackupBanner: function () {
      var b = Utils.$('backup-banner');
      if (b) b.style.display = 'none';
    },

    /** Show the reminder banner if the last backup is older than the chosen
        interval. Runs once at startup; "later" hides it for this session. */
    checkBackupReminder: function () {
      var days = AppState.settings.backupReminderDays;
      if (!days || days <= 0) return;              // reminders turned off
      if (AppState.notes.length === 0) return;      // nothing worth backing up yet

      var last = AppState.settings.lastBackupAt;
      var text;
      if (!last) {
        text = "You haven't downloaded a backup yet — your notes exist only in this browser.";
      } else {
        var elapsedDays = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
        if (elapsedDays < days) return;
        text = 'Last backup was ' + elapsedDays + (elapsedDays === 1 ? ' day' : ' days') + ' ago.';
      }
      Utils.$('backup-banner-text').textContent = text;
      Utils.$('backup-banner').style.display = 'flex';
    },

    applyFontSize: function () {
      document.documentElement.style.setProperty('--note-font-size',
        AppState.settings.noteFontSize + 'px');
      if (Utils.$('font-size-value')) {
        Utils.$('font-size-value').textContent = AppState.settings.noteFontSize + 'px';
      }
      if (Utils.$('font-size-slider')) {
        Utils.$('font-size-slider').value = AppState.settings.noteFontSize;
      }
    },

    setup: function () {
      var self = this;
      Utils.$('font-mode-hand').addEventListener('change', function () {
        if (this.checked) {
          AppState.settings.fontMode = 'hand';
          self.applyFontMode();
          App.renderAll();
          Storage.scheduleSave();
        }
      });
      Utils.$('font-mode-clean').addEventListener('change', function () {
        if (this.checked) {
          AppState.settings.fontMode = 'clean';
          self.applyFontMode();
          App.renderAll();
          Storage.scheduleSave();
        }
      });
      Utils.$('font-size-slider').addEventListener('input', function () {
        AppState.settings.noteFontSize = parseInt(this.value, 10);
        self.applyFontSize();
        Storage.scheduleSave();
      });
      Utils.$('reset-data-btn').addEventListener('click', function () {
        var msg = Sync.isSignedIn()
          ? 'Cloud sync is on: this clears only the copy in this browser and downloads your notes again from the cloud after the reload.\n\n'
            + 'To delete notes everywhere, delete them inside the app (deletions sync too). Continue?'
          : 'This will permanently delete all notes, tasks, and flashcards in this browser. Continue?';
        if (!confirm(msg)) return;
        Storage.reset();
        location.reload();
      });

      // ------ backup reminder banner + interval setting ------
      Utils.$('backup-banner-now').addEventListener('click', function () {
        Settings.exportBackup();
      });
      Utils.$('backup-banner-later').addEventListener('click', function () {
        Settings.hideBackupBanner(); // this session only; shows again next open
      });
      var remSel = Utils.$('backup-reminder-select');
      remSel.value = String(AppState.settings.backupReminderDays);
      remSel.addEventListener('change', function () {
        AppState.settings.backupReminderDays = parseInt(this.value, 10) || 0;
        Storage.scheduleSave();
        if (AppState.settings.backupReminderDays === 0) Settings.hideBackupBanner();
      });

      // ------ optional TMDB key for Library film & TV auto-fill ------
      var tmdbInput = Utils.$('tmdb-key-input');
      tmdbInput.value = AppState.settings.tmdbKey || '';
      tmdbInput.addEventListener('change', function () {
        AppState.settings.tmdbKey = this.value.trim();
        Storage.scheduleSave();
      });

      // ------ backup: export ------
      Utils.$('export-data-btn').addEventListener('click', function () {
        Settings.exportBackup();
      });

      // ------ backup: import ------
      Utils.$('import-data-btn').addEventListener('click', function () {
        Utils.$('import-file-input').click();
      });
      Utils.$('import-file-input').addEventListener('change', function () {
        var file = this.files && this.files[0];
        this.value = ''; // allow re-selecting the same file later
        if (!file) return;

        var st = Utils.$('backup-status');
        // a real backup is text; anything huge is either not ours or would
        // never fit in storage anyway - reject before reading it into memory
        if (file.size > 25 * 1024 * 1024) {
          st.textContent = 'that file is too large to be a backup (' +
            Math.round(file.size / 1048576) + ' MB).';
          return;
        }

        var reader = new FileReader();
        reader.onload = function () {
          var parsed;
          try {
            parsed = JSON.parse(reader.result);
          } catch (e) {
            st.textContent = 'that file is not a valid backup (could not read it as JSON).';
            return;
          }
          // accept both wrapped backups and raw data objects
          // accept backups from both the old app name and the new one
          var d = (parsed && (parsed.app === 'studydesk' || parsed.app === 'my-notebook') && parsed.data) ? parsed.data : parsed;
          if (!d || typeof d !== 'object' || !Array.isArray(d.subjects) || !Array.isArray(d.notes)) {
            st.textContent = 'that file does not look like a StudyDesk backup.';
            return;
          }

          var summary = d.notes.length + ' notebooks, ' +
            (Array.isArray(d.cards) ? d.cards.length : 0) + ' cards, ' +
            (Array.isArray(d.recurring) ? d.recurring.length : 0) + ' recurring tasks';
          if (!confirm('Load this backup? (' + summary + ')\n\nThis REPLACES everything currently in this browser.')) return;

          // snapshot current state so a bad file can't leave the app wrecked
          var snapshot = {
            subjects: AppState.subjects, notes: AppState.notes,
            recurring: AppState.recurring, adhocTasks: AppState.adhocTasks,
            completions: AppState.completions, completionSync: AppState.completionSync, cards: AppState.cards,
            library: AppState.library, settings: AppState.settings
          };

          try {
            AppState.subjects = Array.isArray(d.subjects) ? d.subjects : [];
            AppState.notes = Array.isArray(d.notes) ? d.notes : [];
            AppState.recurring = Array.isArray(d.recurring) ? d.recurring : [];
            AppState.adhocTasks = Array.isArray(d.adhocTasks) ? d.adhocTasks : [];
            AppState.completions = (d.completions && typeof d.completions === 'object') ? d.completions : {};
            AppState.completionSync = (d.completionSync && typeof d.completionSync === 'object') ? d.completionSync : {};
            AppState.cards = Array.isArray(d.cards) ? d.cards : [];
            AppState.library = Array.isArray(d.library) ? d.library : [];
            AppState.settings = (d.settings && typeof d.settings === 'object') ? d.settings : {};
            Storage.applySettingDefaults();
            AppState.migrateNotesToPages(); // repairs old shapes and broken records
            AppState.activeNoteId = null;
            AppState.activePageIndex = 0;

            Storage.scheduleSave();
            App.renderAll();
            if (AppState.notes.length > 0) NotesModule.selectNote(AppState.notes[0].id);
            st.textContent = 'backup loaded: ' + summary;
            Utils.$('backup-reminder-select').value = String(AppState.settings.backupReminderDays);
          } catch (e) {
            // roll back to exactly what the user had before
            AppState.subjects = snapshot.subjects;
            AppState.notes = snapshot.notes;
            AppState.recurring = snapshot.recurring;
            AppState.adhocTasks = snapshot.adhocTasks;
            AppState.completions = snapshot.completions;
            AppState.completionSync = snapshot.completionSync;
            AppState.cards = snapshot.cards;
            AppState.library = snapshot.library;
            AppState.settings = snapshot.settings;
            App.renderAll();
            st.textContent = 'that backup could not be loaded — your existing notes were left untouched.';
          }
        };
        reader.onerror = function () {
          Utils.$('backup-status').textContent = 'could not read that file.';
        };
        reader.readAsText(file);
      });

      if (AppState.settings.fontMode === 'clean') {
        Utils.$('font-mode-clean').checked = true;
      } else {
        Utils.$('font-mode-hand').checked = true;
      }
      this.applyFontMode();
      this.applyFontSize();
    }
  };

  /* ===========================================================
   * Stats - dashboard counters at the top of the Notes page
   * =========================================================== */
  var Stats = {
    render: function () {
      Utils.$('st-notes').textContent = AppState.notes.length;
      Utils.$('st-subjects').textContent = AppState.subjects.length;
      Utils.$('st-cards').textContent = AppState.cards.length;
      var dayIdx = Utils.todayDayIndex();
      var recurringToday = AppState.recurring.filter(function (r) {
        return r.days.indexOf(dayIdx) !== -1;
      }).length;
      var adhocToday = AppState.adhocTasks.filter(function (t) {
        return t.date === Utils.todayStr();
      }).length;
      Utils.$('st-tasks').textContent = recurringToday + adhocToday;
    }
  };

  /* ===========================================================
   * SyncCore - pure helpers for cross-device sync (no DOM, no Firebase).
   * Exported on window for the Node simulation tests.
   *
   * Cloud layout (Firestore), everything under users/{uid}:
   *   subjects/{id} recurring/{id} adhocTasks/{id} cards/{id} library/{id}
   *   notes/{id}            the note WITHOUT its pages, plus pageCount
   *   pages/{noteId}_{idx}  one document per page (keeps every document far
   *                         below Firestore's 1 MB limit even with images)
   *   completions/{date|taskKey}  { done: true }  (local shape is completions[date][taskKey] = true|false;
   *                         LWW stamps for these live in AppState.completionSync[date|taskKey],
   *                         a local-only additive field, because the booleans have no room for one)
   *   meta/settings         the settings object
   * Every document carries syncAt (ms since epoch, stamped by the device
   * that changed it; a separate field because library items already use
   * updatedAt as an ISO string). Deleted things become tombstones { deleted: true,
   * syncAt } so a device that was offline still learns about the deletion.
   * Conflict rule: last write wins per document, compared on syncAt.
   *
   * The local data contract is untouched: localStorage key, backup format and
   * schema stay as they are; syncAt is the only field added, and only on
   * things that were actually changed while sync was on. Pages created as
   * stand-ins for cloud pages that have not arrived yet are flagged
   * placeholder:true and never uploaded while they are still empty.
   * =========================================================== */
  var SyncCore = (function () {
    var ENTITY_COLLECTIONS = ['subjects', 'notes', 'recurring', 'adhocTasks', 'cards', 'library'];
    var ALL_COLLECTIONS = ENTITY_COLLECTIONS.concat(['pages', 'completions', 'meta']);
    var MAX_DOC_BYTES = 900 * 1024;   // Firestore limit is 1 MiB; keep a margin for metadata

    function byteLength(str) {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
      return str.length;
    }

    function blankPage() {
      return { chapter: '', tags: '', date: '', cues: '', body: '', summary: '', placeholder: true };
    }

    function isEmptyPage(p) {
      return !(p.body || p.cues || p.summary || p.chapter || p.tags);
    }

    /** Content fingerprint of the notes/tasks/cards/library (settings excluded):
        used to tell "still just the sample data" from "the user wrote something". */
    function fingerprint(state) {
      var data = flatten(state).data;
      var copy = {};
      Object.keys(data).forEach(function (c) { if (c !== 'meta') copy[c] = data[c]; });
      return canon(copy);
    }

    function noteHead(note) {
      var h = {};
      Object.keys(note).forEach(function (k) { if (k !== 'pages') h[k] = note[k]; });
      h.pageCount = Array.isArray(note.pages) ? note.pages.length : 0;
      return h;
    }

    function completionId(date, key) { return date + '|' + key; }

    /** "<YYYY-MM-DD>|<taskKey>" -> { date, key }; null for anything else. */
    function splitCompletionId(id) {
      if (typeof id !== 'string' || id.length < 12 || id.charAt(10) !== '|') return null;
      return { date: id.slice(0, 10), key: id.slice(11) };
    }

    function pageId(noteId, idx) { return noteId + '_' + idx; }

    function splitPageId(id) {
      var at = id.lastIndexOf('_');
      return { noteId: id.slice(0, at), idx: parseInt(id.slice(at + 1), 10) };
    }

    /** Flatten app data into cloud documents: { data: {col: {id: doc}}, src: {col: {id: object to stamp}} }.
        src points at the live objects so a stamp (syncAt) lands in AppState too. */
    function flatten(state) {
      var data = {}, src = {};
      ALL_COLLECTIONS.forEach(function (c) { data[c] = {}; src[c] = {}; });
      ENTITY_COLLECTIONS.forEach(function (c) {
        (state[c] || []).forEach(function (e) {
          if (!e || !e.id) return;
          data[c][e.id] = (c === 'notes') ? noteHead(e) : e;
          src[c][e.id] = e;
        });
      });
      (state.notes || []).forEach(function (n) {
        if (!n || !n.id) return;
        (n.pages || []).forEach(function (p, i) {
          if (p.placeholder && isEmptyPage(p)) return;   // stand-in for a cloud page not received yet
          var id = pageId(n.id, i);
          var doc = { noteId: n.id, idx: i };
          Object.keys(p).forEach(function (k) { if (k !== 'placeholder') doc[k] = p[k]; });
          data.pages[id] = doc;
          src.pages[id] = p;
        });
      });
      var comp = state.completions || {};
      Object.keys(comp).forEach(function (date) {
        var byKey = comp[date];
        if (!byKey || typeof byKey !== 'object') return;
        Object.keys(byKey).forEach(function (k) {
          if (byKey[k]) data.completions[completionId(date, k)] = { done: true };
        });
      });
      if (!state.completionSync || typeof state.completionSync !== 'object') state.completionSync = {};
      var stamps = state.completionSync;
      data.meta.settings = state.settings || {};
      src.meta.settings = state.settings || null;
      return { data: data, src: src, stamps: stamps };
    }

    function sortKeys(v) {
      if (Array.isArray(v)) return v.map(sortKeys);
      if (!v || typeof v !== 'object') return v;
      var out = {};
      Object.keys(v).sort().forEach(function (k) { out[k] = sortKeys(v[k]); });
      return out;
    }

    /** Content fingerprint: key order and the syncAt stamp are ignored, so a
        document rebuilt from the cloud (different key order) or a completion
        (no live object to carry the stamp) does not look "changed". */
    function canon(doc) {
      return JSON.stringify(sortKeys(doc), function (k, v) { return k === 'syncAt' ? undefined : v; });
    }

    function sameContent(json, doc) {
      if (typeof json !== 'string') return false;
      var parsed;
      try { parsed = JSON.parse(json); } catch (e) { return false; }
      return canon(parsed) === canon(doc);
    }

    /** Compare local documents with what we know is in the cloud. Changed or new
        documents are stamped with `now` (on the live object, so the next local
        save persists the stamp too) and returned as puts; documents that
        disappeared locally become tombstones. Oversized documents are reported,
        not sent. */
    function diff(flat, snapshot, now) {
      var puts = [], tombstones = [], oversized = [];
      Object.keys(flat.data).forEach(function (c) {
        var docs = flat.data[c], snap = snapshot[c] || {};
        Object.keys(docs).forEach(function (id) {
          var doc = docs[id];
          if (sameContent(snap[id], doc)) return;
          var stamped = {};
          Object.keys(doc).forEach(function (k) { stamped[k] = doc[k]; });
          stamped.syncAt = now;
          var json = JSON.stringify(stamped);
          if (byteLength(json) > MAX_DOC_BYTES) { oversized.push({ col: c, id: id }); return; }  // left unstamped: retried when it shrinks
          var live = flat.src[c] && flat.src[c][id];
          if (live) live.syncAt = now;
          if (c === 'completions' && flat.stamps) flat.stamps[id] = now;
          doc.syncAt = now;
          puts.push({ col: c, id: id, json: json });
        });
        Object.keys(snap).forEach(function (id) {
          if (docs[id]) return;
          if (snap[id].indexOf('"deleted":true') !== -1) return;  // already a tombstone
          var t = { deleted: true, syncAt: now };
          if (c === 'completions' && flat.stamps) flat.stamps[id] = now;
          tombstones.push({ col: c, id: id, json: JSON.stringify(t) });
        });
      });
      return { puts: puts, tombstones: tombstones, oversized: oversized };
    }

    function findIndexById(arr, id) {
      for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === id) return i;
      return -1;
    }

    /** Apply one cloud document to the local state with last-write-wins.
        Returns true when local data changed. `state` is AppState-shaped. */
    function applyRemote(state, c, id, remote) {
      if (!remote || typeof remote !== 'object') return false;
      var ts = remote.syncAt || 0;

      if (c === 'meta') {
        if (id !== 'settings') return false;
        if (remote.deleted) return false;
        if (ts <= ((state.settings && state.settings.syncAt) || 0)) return false;
        state.settings = JSON.parse(JSON.stringify(remote));
        return true;
      }

      if (c === 'completions') {
        var ref = splitCompletionId(id);
        if (!ref) return false;                                   // not a "<date>|<taskKey>" document
        state.completions = state.completions || {};
        if (!state.completionSync || typeof state.completionSync !== 'object') state.completionSync = {};
        if (ts < (state.completionSync[id] || 0)) return false;   // this device changed it more recently
        state.completionSync[id] = ts;
        var day = state.completions[ref.date];
        if (remote.deleted) {
          if (!day || !day[ref.key]) return false;
          delete day[ref.key];
          if (!Object.keys(day).length) delete state.completions[ref.date];
          return true;
        }
        if (day && day[ref.key]) return false;
        if (!day) day = state.completions[ref.date] = {};
        day[ref.key] = true;
        return true;
      }

      if (c === 'pages') {
        var ref = splitPageId(id);
        var noteId = remote.noteId || ref.noteId;
        var idx = (typeof remote.idx === 'number') ? remote.idx : ref.idx;
        var ni = findIndexById(state.notes || [], noteId);
        if (ni === -1 || isNaN(idx)) return false;   // head not here (yet): the head carries pageCount
        var note = state.notes[ni];
        if (!Array.isArray(note.pages)) note.pages = [];
        if (remote.deleted) {
          // page deletions always trim from the end (indices are positional)
          if (idx !== note.pages.length - 1 || note.pages.length <= 1) return false;
          if (((note.pages[idx] || {}).syncAt || 0) > ts) return false;
          note.pages.pop();
          return true;
        }
        var localPage = note.pages[idx];
        if (localPage && (localPage.syncAt || 0) >= ts) return false;
        var p = JSON.parse(JSON.stringify(remote));
        delete p.noteId; delete p.idx; delete p.deleted;
        while (note.pages.length <= idx) note.pages.push(blankPage());
        note.pages[idx] = p;
        return true;
      }

      if (ENTITY_COLLECTIONS.indexOf(c) === -1) return false;
      var arr = state[c] = state[c] || [];
      var i = findIndexById(arr, id);
      if (remote.deleted) {
        if (i === -1) return false;
        if ((arr[i].syncAt || 0) > ts) return false;
        arr.splice(i, 1);
        return true;
      }
      if (i !== -1 && (arr[i].syncAt || 0) >= ts) return false;
      var e = JSON.parse(JSON.stringify(remote));
      if (c === 'notes') {
        var count = e.pageCount || 0;
        delete e.pageCount;
        var pages = (i !== -1 && Array.isArray(arr[i].pages)) ? arr[i].pages.slice(0, count) : [];
        while (pages.length < count) pages.push(blankPage());
        e.pages = pages;
      }
      if (i === -1) arr.push(e); else arr[i] = e;
      return true;
    }

    return {
      ENTITY_COLLECTIONS: ENTITY_COLLECTIONS,
      ALL_COLLECTIONS: ALL_COLLECTIONS,
      MAX_DOC_BYTES: MAX_DOC_BYTES,
      byteLength: byteLength,
      flatten: flatten,
      diff: diff,
      applyRemote: applyRemote,
      splitPageId: splitPageId,
      completionId: completionId,
      splitCompletionId: splitCompletionId,
      noteHead: noteHead,
      canon: canon,
      fingerprint: fingerprint,
      isEmptyPage: isEmptyPage
    };
  })();

  /* ===========================================================
   * Sync - Firebase (Google sign-in + Firestore) wiring around SyncCore.
   *
   * Local-first: the app always loads and saves localStorage exactly as before.
   * When signed in, every local save also pushes the changed documents, and a
   * realtime listener per collection merges other devices' changes in.
   * Nothing is pushed until the initial download + merge has finished, so an
   * app start can never overwrite the cloud with stale local data.
   * The SDK is loaded from vendor/firebase/ (self-hosted) only when a config
   * exists; without one, or if loading fails, the app simply runs local-only.
   * =========================================================== */
  var Sync = (function () {
    var SDK_VERSION = '10.14.1';
    var SDK_FILES = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
    var auth = null, db = null, uid = null, userEmail = '';
    var snapshot = {};        // col -> id -> JSON of the document as last seen/sent in the cloud
    var pendingPages = {};    // page documents whose note head has not arrived yet (listeners are per collection)
    var generation = 0;       // bumped by start()/stop(); async work from an older session is ignored
    var currentUser = null;   // Firebase user of the active session (for the offline retry of the first download)
    var pushQueue = Promise.resolve();   // pushes of one session run strictly one after another
    var UID_KEY = Storage.KEY + ':sync-uid';   // the account this browser's data was last synced with
    var ready = false;        // initial merge done: only then do local saves push
    var unsubscribers = [];
    var lastInputAt = 0;
    var refreshTimer = null;
    var phase = 'off', detail = '', lastSyncAt = null;

    function $(id) { return Utils.$(id); }

    function timeLabel(d) {
      return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    }

    function setStatus(p, d) {
      phase = p; detail = d || '';
      if (p === 'synced') lastSyncAt = new Date();
      var card = $('sync-status'), foot = $('sb-foot-status');
      var who = userEmail ? ' as ' + userEmail : '';
      var text, footText;
      switch (p) {
        case 'unconfigured':
          text = 'cloud sync is not set up yet: this build has no Firebase config, so notes stay in this browser only.';
          footText = 'stored only in this browser'; break;
        case 'loading':
          text = 'loading sync…'; footText = 'stored only in this browser'; break;
        case 'signedout':
          text = 'not signed in: notes stay only in this browser. Sign in with the same Google account on every device to keep them in sync.';
          footText = 'stored only in this browser'; break;
        case 'syncing':
          text = 'syncing' + who + (detail ? ' (' + detail + ')' : '') + '…'; footText = 'syncing…'; break;
        case 'synced':
          text = 'synced' + who + ' · last change ' + timeLabel(lastSyncAt);
          footText = 'synced · ' + (userEmail.split('@')[0] || 'signed in'); break;
        case 'offline':
          text = 'offline' + who + ': changes are kept here and sent when you are back online.';
          footText = 'offline · will sync'; break;
        case 'error':
          text = 'sync error: ' + detail; footText = 'sync error'; break;
        default:
          text = ''; footText = 'stored only in this browser';
      }
      if (card) card.textContent = text;
      if (foot) foot.textContent = footText;
      var inBtn = $('sync-signin-btn'), outBtn = $('sync-signout-btn');
      var signedIn = !!uid;
      if (inBtn) inBtn.style.display = (p === 'unconfigured' || signedIn) ? 'none' : '';
      if (outBtn) outBtn.style.display = signedIn ? '' : 'none';
    }

    function describe(e) {
      var code = (e && e.code) || '';
      if (code === 'permission-denied') return 'Firestore rejected this account (permission denied). Check the security rules in the Firebase console (firestore.rules in the repository).';
      if (code === 'unavailable') return 'Firestore is unreachable right now; it retries when the connection returns.';
      if (code === 'auth/unauthorized-domain') return 'this site is not on the Firebase "authorized domains" list (Authentication → Settings).';
      if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled in the Firebase console (Authentication → Sign-in method).';
      return (code ? code + ': ' : '') + ((e && e.message) || String(e));
    }

    function loadScript(src, cb) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { cb(null); };
      s.onerror = function () { cb(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    }

    /** Load the three compat bundles in order. Local copy first; Google's CDN
        is the fallback for a build that ships without vendor/ (single-file). */
    function loadSdk(cb) {
      var i = 0;
      (function next() {
        if (i >= SDK_FILES.length) { cb(null); return; }
        var file = SDK_FILES[i++];
        loadScript('vendor/firebase/' + file, function (err) {
          if (!err) { next(); return; }
          loadScript('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/' + file, function (err2) {
            if (err2) { cb(err2); return; }
            next();
          });
        });
      })();
    }

    function col(name) { return db.collection('users').doc(uid).collection(name); }

    function emptyLocal() {
      AppState.subjects = []; AppState.notes = []; AppState.recurring = []; AppState.adhocTasks = [];
      AppState.completions = {}; AppState.completionSync = {}; AppState.cards = []; AppState.library = [];
      AppState.activeNoteId = null; AppState.activePageIndex = 0;
    }

    function hasLocalContent() {
      return !!(AppState.notes.length || AppState.cards.length || AppState.library.length ||
        AppState.recurring.length || AppState.adhocTasks.length);
    }

    /** True while the local data is still exactly the sample data this session started with. */
    function stillSample() {
      return !!(AppState.seededThisSession && AppState.seedFingerprint &&
        SyncCore.fingerprint(AppState) === AppState.seedFingerprint);
    }

    function storedUid() { try { return localStorage.getItem(UID_KEY) || ''; } catch (e) { return ''; } }
    function rememberUid(u) { try { localStorage.setItem(UID_KEY, u); } catch (e) { /* storage blocked: nothing to remember */ } }

    function refreshUI() {
      AppState.migrateNotesToPages();
      Storage.save();            // persists the merged state; pushes only what is genuinely local
      App.renderAll();
      NotesModule.refreshEditor();
    }

    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(tryRefresh, 300);
    }

    function tryRefresh() {
      // don't yank the editor while the user is typing: wait for a pause
      if (Date.now() - lastInputAt < 2500) { refreshTimer = setTimeout(tryRefresh, 1500); return; }
      refreshUI();
    }

    /** First download after sign-in: cloud documents are merged into local data
        (last write wins), then the local save that follows pushes whatever only
        exists here. A device that only holds the sample data drops it when the
        cloud already has real notes. */
    function initialMerge(gen) {
      var cols = SyncCore.ALL_COLLECTIONS;
      return Promise.all(cols.map(function (c) { return col(c).get(); })).then(function (snaps) {
        if (gen !== generation) return false;                    // signed out (or in again) while downloading
        var cloudHasData = snaps.some(function (s) { return !s.empty; });
        var changed = false;
        // only drop local data when it is still exactly the sample data this session started with
        if (stillSample() && cloudHasData) { emptyLocal(); changed = true; }
        snaps.forEach(function (s, k) {
          var c = cols[k];
          snapshot[c] = {};
          s.forEach(function (d) {
            var data = d.data();
            snapshot[c][d.id] = JSON.stringify(data);
            if (SyncCore.applyRemote(AppState, c, d.id, data)) changed = true;
          });
        });
        return changed;
      });
    }

    function noteExists(noteId) {
      return AppState.notes.some(function (n) { return n.id === noteId; });
    }

    /** Pages that arrived before their note head are applied once the head is here,
        and only then recorded in the snapshot (so a placeholder can never be
        mistaken for a local change to a page we have not actually received). */
    function applyPendingPages(noteId) {
      var changed = false;
      Object.keys(pendingPages).forEach(function (id) {
        var p = pendingPages[id];
        if (p.noteId !== noteId) return;
        delete pendingPages[id];
        snapshot.pages = snapshot.pages || {};
        snapshot.pages[id] = p.json;
        if (SyncCore.applyRemote(AppState, 'pages', id, p.data)) changed = true;
      });
      return changed;
    }

    function listen() {
      SyncCore.ALL_COLLECTIONS.forEach(function (c) {
        unsubscribers.push(col(c).onSnapshot({ includeMetadataChanges: true }, function (qs) {
          var changed = false;
          qs.docChanges().forEach(function (ch) {
            if (ch.type === 'removed') return;                  // we never hard-delete; tombstones instead
            if (ch.doc.metadata.hasPendingWrites) return;        // echo of our own write
            var data = ch.doc.data();
            var json = JSON.stringify(data);
            snapshot[c] = snapshot[c] || {};
            if (snapshot[c][ch.doc.id] === json) return;        // already known
            if (c === 'pages') {
              var noteId = data.noteId || SyncCore.splitPageId(ch.doc.id).noteId;
              if (!noteExists(noteId)) {
                // buffer puts AND tombstones, keeping the newer one, until the note head is here
                var held = pendingPages[ch.doc.id];
                if (!held || (held.data.syncAt || 0) <= (data.syncAt || 0)) pendingPages[ch.doc.id] = { noteId: noteId, data: data, json: json };
                return;
              }
            }
            snapshot[c][ch.doc.id] = json;
            if (SyncCore.applyRemote(AppState, c, ch.doc.id, data)) changed = true;
            if (c === 'notes' && !data.deleted && applyPendingPages(ch.doc.id)) changed = true;
          });
          if (changed) scheduleRefresh();
          if (phase !== 'error' && phase !== 'syncing') setStatus(qs.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced');
        }, function (err) {
          setStatus('error', describe(err));
        }));
      });
    }

    function start(user) {
      var gen = ++generation;
      currentUser = user;
      uid = user.uid; userEmail = user.email || '';
      ready = false; snapshot = {}; pendingPages = {}; pushQueue = Promise.resolve();
      // The local copy belongs to the account it was last synced with. Another
      // account must not inherit (and upload) it.
      var wiped = false, prev = storedUid();
      if (prev && prev !== user.uid && hasLocalContent() && !stillSample()) {
        var ok = confirm('The notes in this browser were synced with a different Google account.\n\n' +
          'OK = replace them with the notes of ' + userEmail + ' from the cloud (the local copy is discarded; ' +
          'download a backup first if you want to keep it).\nCancel = sign out and keep the local notes.');
        if (!ok) { setStatus('syncing', 'signing out'); auth.signOut(); return; }
        emptyLocal(); wiped = true;
      }
      setStatus('syncing', 'downloading');
      initialMerge(gen).then(function (changed) {
        if (gen !== generation) return;
        rememberUid(user.uid);
        ready = true;
        listen();
        if (changed || wiped) refreshUI(); else Storage.save();   // either way: push local-only data
        setStatus(navigator.onLine ? 'synced' : 'offline');
      }).catch(function (e) {
        if (gen !== generation) return;
        var code = (e && e.code) || '';
        // first download not possible right now: retried by the 'online' handler (start() again)
        if (code === 'unavailable' || !navigator.onLine) { setStatus('offline', 'download pending'); return; }
        setStatus('error', describe(e));
      });
    }

    function stop() {
      generation++;
      unsubscribers.forEach(function (u) { try { u(); } catch (e) { /* listener already gone */ } });
      unsubscribers = [];
      ready = false; uid = null; userEmail = ''; currentUser = null;
      snapshot = {}; pendingPages = {}; pushQueue = Promise.resolve();
      setStatus('signedout');
    }

    function signIn() {
      if (!auth) return;
      var provider = new firebase.auth.GoogleAuthProvider();
      setStatus('syncing', 'signing in');
      auth.signInWithPopup(provider).catch(function (e) {
        var code = (e && e.code) || '';
        if (/popup/.test(code)) { auth.signInWithRedirect(provider); return; }
        setStatus('error', describe(e));
      });
    }

    function signOut() {
      if (!auth) return;
      auth.signOut().catch(function (e) { setStatus('error', describe(e)); });
    }

    /* ---- hooks used by Storage.save ---- */

    /** Called before the local write: stamps changed entities and returns the
        write set (or null). Nothing is pushed before the initial merge. */
    function collectChanges() {
      if (!ready || !db) return null;
      var d = SyncCore.diff(SyncCore.flatten(AppState), snapshot, Date.now());
      reportOversized(d.oversized);
      return (d.puts.length || d.tombstones.length) ? d : null;
    }

    function docRef(c, id) { return col(c).doc(id); }

    /** Batched writes. The snapshot is updated optimistically so a save while a
        previous batch is still in flight (offline queue) does not resend it;
        a real failure rolls those entries back so the next save retries. */
    function push(d) {
      var ops = d.puts.concat(d.tombstones);
      if (!ops.length || !db) return;
      setStatus('syncing', 'uploading ' + ops.length);
      var snap = snapshot;   // the signed-in session this push belongs to (stop() replaces the object)
      var prev = ops.map(function (op) { snap[op.col] = snap[op.col] || {}; return snap[op.col][op.id]; });
      ops.forEach(function (op) { snap[op.col][op.id] = op.json; });
      var chunks = [];
      for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
      // one queue per session: a later save never overtakes the chunks of an earlier one
      pushQueue = pushQueue.then(function () {
        return chunks.reduce(function (p, chunk) {
          return p.then(function () {
            if (snap !== snapshot) return;   // signed out (or in again): never write this session's ops under another uid
            var batch = db.batch();
            chunk.forEach(function (op) { batch.set(docRef(op.col, op.id), JSON.parse(op.json)); });
            return batch.commit();
          });
        }, Promise.resolve());
      }).then(function () {
        if (snap !== snapshot) return;   // signed out (or in again) meanwhile
        if (phase !== 'error') setStatus(navigator.onLine ? 'synced' : 'offline');
      }, function (e) {
        if (snap !== snapshot) return;   // signed out meanwhile: nothing to roll back
        // put the snapshot back exactly as it was, so the next save retries puts AND tombstones
        ops.forEach(function (op, k) {
          if (prev[k] === undefined) delete snap[op.col][op.id]; else snap[op.col][op.id] = prev[k];
        });
        setStatus('error', describe(e));
      });
    }

    function reportOversized(list) {
      var el = $('sync-oversized');
      if (!el) return;
      if (!list.length) { el.textContent = ''; return; }
      var parts = list.map(function (o) {
        if (o.col === 'pages') {
          var ref = SyncCore.splitPageId(o.id);
          var n = AppState.notes.find(function (x) { return x.id === ref.noteId; });
          return 'page ' + (ref.idx + 1) + ' of "' + ((n && n.title) || 'untitled') + '"';
        }
        return o.col + ' ' + o.id;
      });
      el.textContent = 'not synced (over the 900 KB per-page limit, too many images): ' + parts.join(', ') + '. These stay on this device only; remove or shrink an image to sync them.';
    }

    function setup() {
      document.addEventListener('input', function () { lastInputAt = Date.now(); }, true);
      var inBtn = $('sync-signin-btn'), outBtn = $('sync-signout-btn');
      if (inBtn) inBtn.addEventListener('click', signIn);
      if (outBtn) outBtn.addEventListener('click', signOut);
      window.addEventListener('online', function () {
        if (uid && !ready && currentUser) { start(currentUser); return; }   // first download never finished
        if (uid && phase === 'offline') setStatus('syncing', 'reconnecting');
      });
      window.addEventListener('offline', function () { if (uid) setStatus('offline'); });

      if (!FIREBASE_CONFIG) { setStatus('unconfigured'); return; }
      setStatus('loading');
      loadSdk(function (err) {
        if (err) { setStatus('error', 'the sync library could not be loaded (' + err.message + '). The app keeps working locally.'); return; }
        try {
          firebase.initializeApp(FIREBASE_CONFIG);
          auth = firebase.auth();
          db = firebase.firestore();
        } catch (e) { setStatus('error', describe(e)); return; }
        // offline queue + cache (IndexedDB); if another tab holds it we still sync, just without cache
        db.enablePersistence({ synchronizeTabs: true }).catch(function (e) {
          console.warn('StudyDesk sync: offline persistence not available:', e && e.code);
        });
        auth.getRedirectResult().catch(function (e) { setStatus('error', describe(e)); });
        auth.onAuthStateChanged(function (user) {
          if (user) start(user); else stop();
        });
      });
    }

    return {
      setup: setup,
      collectChanges: collectChanges,
      push: push,
      isSignedIn: function () { return !!uid; },
      phase: function () { return phase; }
    };
  })();

  /* ===========================================================
   * App - main entry point. init() wires everything together,
   *       renderAll() refreshes every view (used after settings changes)
   * =========================================================== */
  var App = {
    renderAll: function () {
      Settings.applyFontMode();
      Settings.applyFontSize();
      Nav.renderHeaderDate();
      Subjects.renderSelects();
      NotesModule.renderList();
      Library.renderList();
      Schedule.renderDayPicker();
      Schedule.renderRecurringList();
      Schedule.renderTodayTasks();
      Schedule.renderCalendar();
      Schedule.renderManagerTaskList();
      Flashcards.renderGrid();
      Stats.render();
    },

    init: function () {
      // render all inline SVG icons first so the UI never shows empty boxes,
      // then keep watching so icons added later (search results, lists,
      // modals) are hydrated automatically without each render function
      // needing to remember to do it.
      Icons.hydrate();
      Icons.watch();

      // load persisted state; seed sample data if first run
      var hadData = Storage.load();
      if (!hadData || AppState.subjects.length === 0) {
        AppState.seedSampleData();
        AppState.seededThisSession = true;
      }
      AppState.migrateNotesToPages();
      if (AppState.seededThisSession) AppState.seedFingerprint = SyncCore.fingerprint(AppState);
      AppState.calMonth = Utils.currentMonthStr();

      // wire up every module's event handlers
      Modal.setupBackdropClose();
      Subjects.setup();
      NotesModule.setupEditor();
      NotesModule.setupFormatModals();
      NotesModule.setupNewNotebookModal();
      Library.setup();
      Schedule.setupRecurringForm();
      Schedule.setupAdhocForm();
      Schedule.setupCalendarControls();
      Flashcards.setupCards();
      Flashcards.setupStudyMode();
      Settings.setup();

      // first render
      this.renderAll();

      // auto-select the first note so the editor isn't empty on first load
      if (!AppState.activeNoteId && AppState.notes.length > 0) {
        NotesModule.selectNote(AppState.notes[0].id);
      }

      // nudge for a fresh backup if the last one is older than the chosen interval
      Settings.checkBackupReminder();
      Storage.updateUsageDisplay();

      // cloud sync (stage 3): local-only until FIREBASE_CONFIG is set
      Sync.setup();

      // PWA: the service worker caches the app shell so the installed app opens
      // offline. Only on http(s): file:// has no service workers, and the app
      // must keep working there too.
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(function (e) {
          console.warn('StudyDesk: service worker not registered (the app still works, just not offline):', e);
        });
      }
    }
  };

  // expose App.renderAll for Settings module's cross-call
  window.App = App;
  window.SyncCore = SyncCore;   // pure sync helpers, used by the Node simulation tests

  /* ===========================================================
   * Boot
   *
   * If init() throws (corrupted data we didn't anticipate, a browser API
   * that isn't available), the app would otherwise render as a dead blank
   * page with the error only visible in the console. Catch it, tell the
   * user plainly, and point them at the one action that can rescue them.
   * =========================================================== */
  function boot() {
    try {
      App.init();
    } catch (e) {
      console.error('StudyDesk failed to start:', e);
      var msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;background:#fdfcf7;z-index:9999;font-family:system-ui,sans-serif;text-align:center';
      msg.innerHTML =
        '<div style="max-width:460px">' +
        '<h2 style="margin:0 0 10px;font-size:18px">StudyDesk could not start</h2>' +
        '<p style="margin:0 0 8px;font-size:14px;color:#555">Something in the saved data could not be read. ' +
        'Your notes have not been deleted.</p>' +
        '<p style="margin:0;font-size:13px;color:#777">Try reloading the page. If it keeps failing, ' +
        'reload with a backup file ready, or clear this site\'s data as a last resort ' +
        '(that erases notes, so back up first if you can).</p>' +
        '</div>';
      document.body.appendChild(msg);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

