// Language carried by a backup: loading a backup whose settings.lang differs
// re-translates the static UI in place (no reload), moves the selector, shows the
// matching guide. A backup without lang (older file) falls back to the browser
// language instead of forcing English.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), os = require('os');
const REPO = process.env.REPO || path.resolve(__dirname, '../..'), NEW = 'https://amber-studydesk.netlify.app/', K = 'study-notes-app-chalkboard-v2';
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'studydesk-i18n-'));   // backup files written for the test
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

async function load(b, locale) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, locale });
  await ctx.route(NEW + '**', r => { let rel = r.request().url().slice(NEW.length).split('?')[0] || 'index.html'; const f = path.join(REPO, rel); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(NEW); await p.waitForTimeout(500);
  await p.fill('#adhoc-task-input', 'seed'); await p.click('#adhoc-task-add'); await p.waitForTimeout(600);   // persist the sample data
  return { ctx, p, errs };
}
async function importWith(p, mutate, file) {
  const data = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), K);
  mutate(data.settings);
  fs.writeFileSync(file, JSON.stringify({ app: 'studydesk', backupVersion: 1, exportedAt: new Date().toISOString(), data }));
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=backup]');
  await p.setInputFiles('#import-file-input', file); await p.waitForTimeout(900);
}
const sidebar = p => p.evaluate(() => document.querySelector('.ni[data-page=notes]').textContent.trim());

(async () => {
  const b = await chromium.launch();
  // 1) English page, backup says Korean
  let { ctx, p, errs } = await load(b, 'en-US');
  ok((await sidebar(p)) === 'Notebooks', 'starts in English');
  await importWith(p, s => { s.lang = 'ko'; }, TMP + '/bk-ko.json');
  ok((await sidebar(p)) === '노트북', 'backup with lang=ko re-translates the sidebar in place: ' + (await sidebar(p)));
  ok((await p.textContent('#tb-title')) === '설정', 'topbar title re-translated: ' + (await p.textContent('#tb-title')));
  ok((await p.inputValue('#lang-select')) === 'ko', 'language selector moved to ko');
  ok((await p.textContent('.stab[data-stab=backup]')).trim() === '백업', 'settings tabs re-translated');
  const guides = await p.evaluate(() => Array.from(document.querySelectorAll('.guide-body')).map(g => g.getAttribute('lang') + ':' + g.hidden).join(','));
  ok(guides === 'ko:false,en:true', 'Korean guide shown, English hidden: ' + guides);
  ok((await p.getAttribute('#adhoc-task-input', 'placeholder')) === '오늘 할 일 추가', 'placeholders re-translated');
  const loaded = (await p.textContent('#backup-status')).trim();
  ok(/^백업을 불러왔습니다: 노트북 \d+개, 카드 \d+개, 반복 일정 \d+개$/.test(loaded), 'success line is entirely in the new language: "' + loaded + '"');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await ctx.close();
  // 2) Korean browser, older backup without lang: stays Korean (browser language), not English
  ({ ctx, p, errs } = await load(b, 'ko-KR'));
  ok((await sidebar(p)) === '노트북', 'Korean browser starts in Korean');
  await importWith(p, s => { delete s.lang; }, TMP + '/bk-nolang.json');
  ok((await sidebar(p)) === '노트북', 'backup without lang keeps the browser language: ' + (await sidebar(p)));
  ok((await p.inputValue('#lang-select')) === 'ko', 'selector still ko');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  // 3) and a backup saying English switches back
  await importWith(p, s => { s.lang = 'en'; }, TMP + '/bk-en.json');
  ok((await sidebar(p)) === 'Notebooks', 'backup with lang=en switches to English in place');
  ok((await p.inputValue('#lang-select')) === 'en', 'selector moved to en');
  // 4) the self-test button label matches the Korean guide wording
  await importWith(p, s => { s.lang = 'ko'; }, TMP + '/bk-ko2.json');
  await p.evaluate(() => showPage('notes'));
  const st = (await p.textContent('#review-mode-btn')).trim();
  ok(st === '셀프 테스트', 'self-test button reads "셀프 테스트": "' + st + '"');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await ctx.close();
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
