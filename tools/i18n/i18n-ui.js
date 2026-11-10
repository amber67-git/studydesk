// Runtime cross-check: open every page, Settings tab and modal in both
// languages and scan what is visible. Korean mode must show no English UI
// words (outside user data and an allowlist of proper nouns); English mode
// must show no Hangul outside the guide. Also: language switch re-renders in
// place, default follows the browser language, and the choice persists.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const REPO = process.env.REPO || path.resolve(__dirname, '../..'), NEW = 'https://amber-studydesk.netlify.app/', K = 'study-notes-app-chalkboard-v2';
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const SCR = process.env.SCREENS || os.tmpdir();   // screenshots, never inside the repo
// proper nouns / acronyms / data-like tokens allowed in Korean mode
const ALLOW = new Set(['studydesk', 'google', 'tmdb', 'api', 'isbn', 'doi', 'url', 'cue', 'main', 'notes', 'summary', 'pg', 'mb', 'kb', 'tv', 'ctrl', 'json', 'firebase', 'firestore', 'netlify', 'english', 'themoviedb', 'org', 'https', 'chrome', 'android', 'ios', 'pc', 'px', 'ok', 'esc', 'www', 'com', 'http', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
// containers that hold user data (sample notes are English content): not scanned
const DATA = '#note-list, #today-task-list, #lib-grid, #cal-grid, #card-grid, #notes-body, #cues, #summary, #day-events-list, #page-list-body, #recurring-list, #manager-task-list, #lib-results, #study-card, #sb-foot-ver, #header-date, #today-date-label, #cal-month-label, .guide-body, select, #note-title, #note-chapter, #note-tags, #lists-subjects, #lists-categories, #lists-genres, #lib-search-input, #sync-status, #storage-usage, #subject-delete-target, #subject-delete-text, #lib-notebook-link';

async function run(lang, browserLang) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, locale: browserLang });
  await ctx.route(NEW + '**', r => {
    let rel = r.request().url().slice(NEW.length).split('?')[0] || 'index.html'; const f = path.join(REPO, rel);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.goto(NEW); await p.waitForTimeout(500);
  const detected = await p.evaluate(() => document.documentElement.lang);
  ok(detected === lang, lang + ': browser locale ' + browserLang + ' → html lang "' + detected + '"');
  // seed a library item so Library renders cards + the sample tasks exist
  await p.fill('#adhoc-task-input', 'seed'); await p.click('#adhoc-task-add'); await p.waitForTimeout(600);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('study-notes-app-chalkboard-v2')); const now = new Date().toISOString();
    const t = new Date(), today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    for (let i = 0; i < 6; i++) d.adhocTasks.push({ id: 'many' + i, title: 'extra ' + i, subjectId: d.subjects[0].id, type: 'lecture', date: today });
    d.library = [{ id: 'l1', title: 'SPQR', author: 'Mary Beard', illustrator: '', publisher: '', isbn: '', coverUrl: '', coverRotation: 0, type: 'book', category: 'Non-fiction', genre: 'History', callNo: '', levelInput: '', status: 'in progress', progress: 40, rating: 4, notes: '', noteId: '', createdAt: now, updatedAt: now }];
    localStorage.setItem('study-notes-app-chalkboard-v2', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(500);

  const scan = async (label) => {
    const r = await p.evaluate((DATA) => {
      const out = [];
      const dataEls = Array.from(document.querySelectorAll(DATA));
      const EMPTY = '.empty-note, .lrows-empty, .empty';   // empty-state lines are UI text even inside a data container
      const inData = el => !el.closest(EMPTY) && dataEls.some(d => d === el || d.contains(el));
      const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && (r.width || r.height); };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const n = walker.currentNode; const el = n.parentElement; if (!el || !n.nodeValue.trim()) continue; if (['SCRIPT', 'STYLE'].includes(el.tagName)) continue; if (inData(el) || !visible(el)) continue; out.push({ t: n.nodeValue.trim(), where: (el.id || el.className || el.tagName).toString().slice(0, 40) }); }
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => { if (inData(el) || !visible(el)) return; ['placeholder', 'title', 'aria-label'].forEach(a => { const v = el.getAttribute(a); if (v && v.trim()) out.push({ t: v.trim(), where: a + '@' + (el.id || el.className || el.tagName).toString().slice(0, 30) }); }); });
      return out;
    }, DATA);
    const bad = [];
    for (const { t, where } of r) {
      if (lang === 'ko') {
        const words = (t.match(/[A-Za-z]{2,}/g) || []).filter(w => !ALLOW.has(w.toLowerCase()));
        if (words.length) bad.push(where + ': ' + t);
      } else if (/[가-힣]/.test(t)) bad.push(where + ': ' + t);
    }
    ok(bad.length === 0, lang + ' / ' + label + ': no ' + (lang === 'ko' ? 'English' : 'Korean') + ' UI text left (' + r.length + ' strings) ' + JSON.stringify([...new Set(bad)].slice(0, 12)));
  };

  for (const pg of ['notes', 'library', 'schedule', 'manager', 'cards', 'settings']) {
    await p.evaluate(x => showPage(x), pg); await p.waitForTimeout(300);
    if (pg === 'settings') { for (const tab of ['backup', 'account', 'display', 'lists', 'integrations', 'guide']) { await p.click('.stab[data-stab=' + tab + ']'); await p.waitForTimeout(100); await scan('settings/' + tab); } }
    else await scan(pg);
  }
  // modals
  const closeAll = () => p.evaluate(() => document.querySelectorAll('.mo.show').forEach(m => m.classList.remove('show')));
  const shown = () => p.evaluate(() => Array.from(document.querySelectorAll('.mo.show')).map(m => m.id));
  // a dialog counts as scanned only once it has actually opened (natural() asserts exactly one is showing)
  const scanned = new Set();
  // dialogs opened the way the user opens them, so their dynamic text is filled in
  const natural = async (label, expectedId, open) => { await open(); await p.waitForTimeout(250); const ids = await shown(); const hit = ids.length === 1 && ids[0] === expectedId; ok(hit, lang + ': ' + label + ' opened ' + expectedId + ' (' + ids + ')'); if (hit) scanned.add(ids[0]); await scan(label); await closeAll(); };
  await p.evaluate(() => showPage('library'));
  await natural('modal/library', 'mo-library', () => p.click('#lib-add-btn'));
  await p.evaluate(() => showPage('notes'));
  await natural('modal/new-notebook', 'mo-new-notebook', () => p.click('#new-note-btn'));
  await natural('modal/subject', 'mo-subject', () => p.click('#new-subject-btn'));
  await p.evaluate(() => showPage('cards'));
  await natural('modal/card', 'mo-card', () => p.click('#add-card-btn'));
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=lists]');
  await natural('modal/list-edit', 'mo-list-edit', () => p.click('#lists-add-subject'));
  await natural('modal/subject-delete', 'mo-subject-delete', () => p.click('#lists-subjects .lrow:first-child [data-act="delete-subject"]'));
  const sdt = await p.textContent('#subject-delete-text');   // holds a subject name (user data), so checked on its own
  ok(lang === 'ko' ? /쓰고 있습니다/.test(sdt) && /노트북 \d+개/.test(sdt) : /is used by/.test(sdt) && /notebook/.test(sdt), lang + ': subject-delete message in ' + lang + ': "' + sdt + '"');
  await p.evaluate(() => showPage('notes'));
  await natural('modal/page-list', 'mo-page-list', () => p.click('#page-indicator'));
  await p.evaluate(() => showPage('schedule')); await p.waitForTimeout(200);
  await natural('modal/day-events', 'mo-day-events', () => p.click('.cal-more-btn'));
  // every other dialog: shown directly so its static text is scanned too
  const rest = await p.evaluate(s => Array.from(document.querySelectorAll('.mo')).map(m => m.id).filter(id => !s.includes(id)), [...scanned]);
  for (const id of rest) { await p.evaluate(i => document.getElementById(i).classList.add('show'), id); await p.waitForTimeout(100); scanned.add(id); await scan('modal/' + id.replace(/^mo-/, '') + ' (static)'); await closeAll(); }
  // labels that only appear after a click
  await p.evaluate(() => showPage('notes')); await p.waitForTimeout(150);
  const label = sel => p.evaluate(s => document.querySelector(s).textContent.trim(), sel);
  const want = (en, ko) => lang === 'ko' ? ko : en;
  await p.click('#review-mode-btn'); ok((await label('#review-mode-btn')) === want('show notes', '노트 보기'), lang + ': self-test on -> "' + (await label('#review-mode-btn')) + '"');
  await p.click('#review-mode-btn'); ok((await label('#review-mode-btn')) === want('self-test', '셀프 테스트'), lang + ': self-test off -> "' + (await label('#review-mode-btn')) + '"');
  await p.click('#save-note-btn'); ok((await label('#save-note-btn')) === want('saved', '저장됨'), lang + ': save pressed -> "' + (await label('#save-note-btn')) + '"');
  await p.waitForTimeout(1300);
  // empty states: no tasks at all
  await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.recurring = []; d.adhocTasks = []; localStorage.setItem(k, JSON.stringify(d)); }, K);
  await p.reload(); await p.waitForTimeout(500);
  for (const pg of ['notes', 'manager']) { await p.evaluate(x => showPage(x), pg); await p.waitForTimeout(200); await scan(pg + ' (no tasks)'); }
  const empties = await p.evaluate(() => Array.from(document.querySelectorAll('#recurring-list .empty-note, #manager-task-list .empty-note, #today-task-list .empty-note')).map(e => e.textContent.trim()));
  ok(empties.length === 3, lang + ': three empty-state lines rendered ' + JSON.stringify(empties));
  const all = await p.evaluate(() => document.querySelectorAll('.mo').length);
  ok(scanned.size === all, lang + ': every dialog scanned (' + scanned.size + ' / ' + all + ')');
  // guide: only the current language's guide is visible
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=guide]'); await p.waitForTimeout(100);
  const guides = await p.evaluate(() => Array.from(document.querySelectorAll('.guide-body')).map(g => ({ lang: g.getAttribute('lang'), hidden: g.hidden })));
  ok(guides.length === 2 && guides.every(g => g.hidden === (g.lang !== lang)), lang + ': only the ' + lang + ' guide is shown ' + JSON.stringify(guides));
  // the editor's own label and hint are UI text even though its contents are skipped
  const ed = await p.evaluate(() => { const e = document.getElementById('notes-body'); return { aria: e.getAttribute('aria-label'), ph: e.getAttribute('data-placeholder') }; });
  ok(lang === 'ko' ? (ed.aria === '본문 필기' && /^여기에/.test(ed.ph)) : (ed.aria === 'main notes' && /^Take notes/.test(ed.ph)), lang + ': editor aria-label + placeholder translated ' + JSON.stringify(ed));
  const filt = await p.getAttribute('#lib-type-filter', 'title');
  ok(lang === 'ko' ? filt === '종류로 거르기' : filt === 'filter by type', lang + ': title attribute on a skipped select is translated ("' + filt + '")');
  // date labels follow the locale
  const dateTxt = await p.evaluate(() => document.getElementById('header-date').textContent);
  ok(lang === 'ko' ? /[가-힣]/.test(dateTxt) : /^[A-Za-z]/.test(dateTxt), lang + ': header date in locale: "' + dateTxt + '"');
  // page title (topbar) translated
  const title = await p.textContent('#tb-title');
  ok(lang === 'ko' ? title === '설정' : title === 'Settings', lang + ': topbar title "' + title + '"');
  ok(errs.length === 0, lang + ': no page errors ' + JSON.stringify(errs));
  await p.evaluate(() => showPage('notes')); await p.screenshot({ path: SCR + '/i18n-' + lang + '.png' });
  await b.close();
}

async function switchTest() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  await ctx.route(NEW + '**', r => { let rel = r.request().url().slice(NEW.length).split('?')[0] || 'index.html'; const f = path.join(REPO, rel); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(NEW); await p.waitForTimeout(500);
  ok((await p.textContent('.ni[data-page=notes]')).trim() === 'Notebooks', 'switch: starts in English');
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=display]'); await p.selectOption('#lang-select', 'ko'); await p.waitForTimeout(700);
  ok((await p.textContent('.ni[data-page=notes]')).trim() === '노트북', 'switch: sidebar re-translated in place without reload');
  ok((await p.textContent('#tb-title')) === '설정', 'switch: topbar title re-translated');
  ok((await p.textContent('.stab[data-stab=backup]')).trim() === '백업', 'switch: settings tabs re-translated');
  ok((await p.getAttribute('#adhoc-task-input', 'placeholder')) === '오늘 할 일 추가', 'switch: placeholders re-translated');
  await p.evaluate(() => showPage('notes')); await p.waitForTimeout(200);
  ok((await p.textContent('#today-task-list .task-kind')).trim() === '반복', 'switch: dynamic lists re-rendered (task kind)');
  await p.reload(); await p.waitForTimeout(500);
  ok((await p.textContent('.ni[data-page=notes]')).trim() === '노트북', 'switch: choice persists across reload (settings.lang)');
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=display]'); await p.selectOption('#lang-select', 'en'); await p.waitForTimeout(700);
  ok((await p.textContent('.ni[data-page=notes]')).trim() === 'Notebooks', 'switch: back to English in place');
  ok((await p.getAttribute('#adhoc-task-input', 'placeholder')) === 'add a one-off task for today', 'switch: placeholder back to English');
  // labels rewritten at runtime keep their key: click in Korean, switch, they follow
  const lbl = sel => p.evaluate(x => document.querySelector(x).textContent.trim(), sel);
  const setLang = async l => { await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=display]'); await p.selectOption('#lang-select', l); await p.waitForTimeout(500); await p.evaluate(() => showPage('notes')); await p.waitForTimeout(150); };
  await setLang('ko');
  await p.click('#review-mode-btn'); await p.click('#review-mode-btn');   // self-test on, off: label rebuilt in Korean
  await p.click('#save-note-btn'); await p.waitForTimeout(1400);         // flash and restore, both in Korean
  ok((await lbl('#review-mode-btn')) === '셀프 테스트' && (await lbl('#save-note-btn')) === '저장', 'switch: Korean labels after clicking (' + (await lbl('#review-mode-btn')) + ' / ' + (await lbl('#save-note-btn')) + ')');
  await setLang('en');
  ok((await lbl('#review-mode-btn')) === 'self-test', 'switch: self-test label follows the switch after a click ("' + (await lbl('#review-mode-btn')) + '")');
  ok((await lbl('#save-note-btn')) === 'save', 'switch: save label follows the switch after a click ("' + (await lbl('#save-note-btn')) + '")');
  await setLang('ko'); await p.click('#review-mode-btn');                 // show notes, in Korean
  await setLang('en');
  ok((await lbl('#review-mode-btn')) === 'show notes', 'switch: "show notes" state follows the switch ("' + (await lbl('#review-mode-btn')) + '")');
  await p.click('#review-mode-btn');
  // switch during the 1.2s flash: fire the selector's change directly, with no
  // navigation or fixed waits, so the check cannot drift past the timer
  const quickLang = l => p.evaluate(v => { const el = document.getElementById('lang-select'); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, l);
  await p.click('#save-note-btn'); await quickLang('ko');
  ok((await lbl('#save-note-btn')) === '저장됨', 'switch: the flash itself follows a switch ("' + (await lbl('#save-note-btn')) + '")');
  await p.waitForTimeout(1300);
  ok((await lbl('#save-note-btn')) === '저장', 'switch: save label after the flash ends ("' + (await lbl('#save-note-btn')) + '")');
  ok(errs.length === 0, 'switch: no page errors ' + JSON.stringify(errs));
  await b.close();
}

(async () => {
  await run('en', 'en-US');
  await run('ko', 'ko-KR');
  await switchTest();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
