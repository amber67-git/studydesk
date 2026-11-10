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
const DATA = '#note-list, #today-task-list, #lib-grid, #cal-grid, #card-grid, #notes-body, #cues, #summary, #day-events-list, #page-list-body, #recurring-list, #manager-task-list, #lib-results, #study-card, #sb-foot-ver, #header-date, #today-date-label, #cal-month-label, .guide-body, select, #note-title, #note-chapter, #note-tags, #lists-subjects, #lists-categories, #lists-genres, #lib-search-input, #sync-status, #storage-usage, #subject-delete-target, #lib-notebook-link';

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
    d.library = [{ id: 'l1', title: 'SPQR', author: 'Mary Beard', illustrator: '', publisher: '', isbn: '', coverUrl: '', coverRotation: 0, type: 'book', category: 'Non-fiction', genre: 'History', callNo: '', levelInput: '', status: 'in progress', progress: 40, rating: 4, notes: '', noteId: '', createdAt: now, updatedAt: now }];
    localStorage.setItem('study-notes-app-chalkboard-v2', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(500);

  const scan = async (label) => {
    const r = await p.evaluate((DATA) => {
      const out = [];
      const dataEls = Array.from(document.querySelectorAll(DATA));
      const inData = el => dataEls.some(d => d === el || d.contains(el));
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
  await p.evaluate(() => showPage('library')); await p.click('#lib-add-btn'); await p.waitForTimeout(300); await scan('modal/library'); await p.click('#lib-modal-close');
  await p.evaluate(() => showPage('notes')); await p.click('#new-note-btn'); await p.waitForTimeout(200); await scan('modal/new-notebook'); await p.evaluate(() => document.querySelectorAll('.mo.show').forEach(m => m.classList.remove('show')));
  await p.click('#new-subject-btn'); await p.waitForTimeout(200); await scan('modal/subject'); await p.evaluate(() => document.querySelectorAll('.mo.show').forEach(m => m.classList.remove('show')));
  await p.evaluate(() => showPage('cards')); await p.click('#add-card-btn, button:has-text("card")').catch(() => {}); await p.waitForTimeout(200); await scan('modal/card'); await p.evaluate(() => document.querySelectorAll('.mo.show').forEach(m => m.classList.remove('show')));
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
  ok(errs.length === 0, 'switch: no page errors ' + JSON.stringify(errs));
  await b.close();
}

(async () => {
  await run('en', 'en-US');
  await run('ko', 'ko-KR');
  await switchTest();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
