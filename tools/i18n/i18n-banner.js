// Banner lines are written with tx() when shown: switching the language (selector
// or a backup carrying another lang) must rewrite the visible ones, and must not
// re-show a banner the user hid with "later".
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const REPO = process.env.REPO || path.resolve(__dirname, '../..'), NEW = 'https://amber-studydesk.netlify.app/', K = 'study-notes-app-chalkboard-v2';
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
  await ctx.route(NEW + '**', r => { let rel = r.request().url().slice(NEW.length).split('?')[0] || 'index.html'; const f = path.join(REPO, rel); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(NEW); await p.waitForTimeout(400);
  // first visit on the new address: the move banner (load backup) is shown, in Korean
  const mv = () => p.textContent('#move-banner-text');
  ok(/[가-힣]/.test(await mv()), 'move banner starts in Korean: ' + (await mv()));
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=display]'); await p.selectOption('#lang-select', 'en'); await p.waitForTimeout(500);
  ok(!/[가-힣]/.test(await mv()) && /[A-Za-z]{3}/.test(await mv()), 'move banner rewritten in English: ' + (await mv()));
  // a returning visit with no backup: the reminder banner
  await p.fill('#adhoc-task-input', 'seed').catch(() => {}); await p.evaluate(() => showPage('notes'));
  await p.fill('#adhoc-task-input', 'seed'); await p.click('#adhoc-task-add'); await p.waitForTimeout(600);
  await p.reload(); await p.waitForTimeout(500);
  const bk = () => p.textContent('#backup-banner-text');
  ok(await p.locator('#backup-banner').isVisible(), 'backup reminder shown on a returning visit');
  ok(/^[A-Za-z]/.test((await bk()).trim()), 'reminder in English: ' + (await bk()));
  const dock0 = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dock-h'));
  await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=display]'); await p.selectOption('#lang-select', 'ko'); await p.waitForTimeout(500);
  ok(/[가-힣]/.test(await bk()), 'reminder rewritten in Korean: ' + (await bk()));
  const dock1 = await p.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue('--dock-h'), document.getElementById('banner-dock').offsetHeight]);
  ok(parseInt(dock1[0], 10) === dock1[1], 'dock height re-measured after the switch (' + dock0 + ' -> ' + dock1[0] + ', dock ' + dock1[1] + ')');
  // "later" hides it; a language switch must not bring it back
  await p.click('#backup-banner-later'); await p.waitForTimeout(200);
  await p.selectOption('#lang-select', 'en'); await p.waitForTimeout(500);
  ok(!(await p.locator('#backup-banner').isVisible()), 'a banner hidden with "later" stays hidden after a switch');
  // a backup that switches the language and has a recent backup date (or reminders
  // off): the reminder is no longer due, so it goes away instead of staying in the old language
  const os = require('os');
  for (const [label, mut, sameLang] of [['recent lastBackupAt', s => { s.lastBackupAt = new Date().toISOString(); }], ['reminders off', s => { s.backupReminderDays = 0; }],
                                        ['same language, recent lastBackupAt', s => { s.lastBackupAt = new Date().toISOString(); }, true]]) {
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.locator('#backup-banner').isVisible(), label + ': reminder visible before the import');
    const data = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), K);
    if (!sameLang) data.settings.lang = data.settings.lang === 'ko' ? 'en' : 'ko';
    mut(data.settings);
    const f = path.join(os.tmpdir(), 'studydesk-banner-' + label.replace(/\W/g, '') + '.json');
    fs.writeFileSync(f, JSON.stringify({ app: 'studydesk', backupVersion: 1, exportedAt: new Date().toISOString(), data }));
    p.once('dialog', d => d.accept());
    await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=backup]');
    await p.setInputFiles('#import-file-input', f); await p.waitForTimeout(900);
    ok(!(await p.locator('#backup-banner').isVisible()), label + ': a reminder no longer due is hidden after the import');
    const dock = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dock-h').trim());
    ok(dock === '0px', label + ': dock height back to 0 (' + dock + ')');
    // restore: no backup date, reminders on, so the next round starts with a visible reminder
    await p.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.settings.lastBackupAt = null; d.settings.backupReminderDays = 7; localStorage.setItem(k, JSON.stringify(d)); }, K);
  }
  // a backup that fails while rendering (a null subject after a valid one) rolls back:
  // the reminder that was on screen must still be there, in the language that is in effect
  {
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.locator('#backup-banner').isVisible(), 'rollback: reminder visible before the import');
    const before = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), K);
    const data = JSON.parse(JSON.stringify(before));
    data.settings.lang = data.settings.lang === 'ko' ? 'en' : 'ko'; data.settings.backupReminderDays = 0;
    data.subjects = [data.subjects[0], null];
    const f = path.join(os.tmpdir(), 'studydesk-banner-broken.json');
    fs.writeFileSync(f, JSON.stringify({ app: 'studydesk', backupVersion: 1, exportedAt: new Date().toISOString(), data }));
    p.once('dialog', d => d.accept());
    await p.evaluate(() => showPage('settings')); await p.click('.stab[data-stab=backup]');
    await p.setInputFiles('#import-file-input', f); await p.waitForTimeout(900);
    const st = (await p.textContent('#backup-status')).trim();
    const failed = /could not be loaded|불러오지 못했습니다/.test(st);
    console.log('     (import result: "' + st + '")');
    if (failed) {
      ok(await p.locator('#backup-banner').isVisible(), 'rollback: the reminder is back after a failed import');
      const lang = await p.evaluate(() => document.documentElement.lang), txt = await p.textContent('#backup-banner-text');
      ok(lang === before.settings.lang && (lang === 'ko' ? /[가-힣]/.test(txt) : !/[가-힣]/.test(txt)), 'rollback: language and reminder text are the original ones (' + lang + ': ' + txt + ')');
      const dock = await p.evaluate(() => [parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dock-h'), 10), document.getElementById('banner-dock').offsetHeight]);
      ok(dock[0] === dock[1] && dock[0] > 0, 'rollback: dock height matches the visible reminder (' + dock + ')');
    } else console.log('SKIP rollback: this file did not make the import fail');
  }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
