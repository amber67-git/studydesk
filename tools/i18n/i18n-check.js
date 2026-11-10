// Static cross-check of the string table: same keys in en and ko, no empty
// values, same {placeholders}, every key used by app.js/index.html exists,
// every table key is used somewhere (as a t() key, a data-i18n attribute,
// or as English text / attribute in index.html).
const fs = require('fs'), vm = require('vm'), path = require('path');
const REPO = process.env.REPO || path.resolve(__dirname, '../..');   // repo root (or REPO=<another checkout>)
const app = fs.readFileSync(REPO + '/app.js', 'utf8'), html = fs.readFileSync(REPO + '/index.html', 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

const m = app.match(/var I18N = (\{[\s\S]*?\n  \});/);
ok(!!m, 'I18N table found in app.js');
const I18N = vm.runInNewContext('(' + m[1] + ')');
const en = Object.keys(I18N.en), ko = Object.keys(I18N.ko);
const onlyEn = en.filter(k => !(k in I18N.ko)), onlyKo = ko.filter(k => !(k in I18N.en));
ok(onlyEn.length === 0, 'every en key exists in ko ' + JSON.stringify(onlyEn));
ok(onlyKo.length === 0, 'every ko key exists in en ' + JSON.stringify(onlyKo));
const empty = [].concat(en.filter(k => !String(I18N.en[k]).trim()), ko.filter(k => !String(I18N.ko[k]).trim()));
ok(empty.length === 0, 'no empty values ' + JSON.stringify(empty));
const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const badPh = en.filter(k => k in I18N.ko && ph(I18N.en[k]) !== ph(I18N.ko[k]));
ok(badPh.length === 0, 'same {placeholders} in both languages ' + JSON.stringify(badPh));
const badPlural = en.filter(k => /\(s\)/.test(I18N.en[k]) !== /\{n\}/.test(I18N.en[k]) && /\(s\)/.test(I18N.en[k]));
ok(badPlural.length === 0, '"(s)" only in count templates ' + JSON.stringify(badPlural));
const dupEn = Object.entries(en.reduce((a, k) => { (a[I18N.en[k]] = a[I18N.en[k]] || []).push(k); return a; }, {})).filter(([, ks]) => ks.length > 1);
const dupDiffer = dupEn.filter(([, ks]) => new Set(ks.map(k => I18N.ko[k])).size > 1);
ok(dupDiffer.length === 0, 'keys sharing one English text also share the Korean text (the walker cannot tell them apart) ' + JSON.stringify(dupDiffer));
// Korean column should not just repeat English (except brand/acronym-only strings)
const untranslated = en.filter(k => I18N.ko[k] === I18N.en[k] && /[a-z]{4,}/i.test(I18N.en[k]) && !/^(URL|ISBN \/ DOI|CUE|MAIN NOTES|SUMMARY|English|TMDB)/.test(I18N.en[k]));
ok(untranslated.length === 0, 'Korean column differs from English ' + JSON.stringify(untranslated));

// keys referenced by code
const used = new Set();
for (const mm of app.matchAll(/\b(?:tx|I18n\.t|I18n\.tn)\(\s*'([^']+)'/g)) { if (mm[1].endsWith('.')) used.add(mm[1] + '*'); else if (mm[1] !== 'key') used.add(mm[1]); }
for (const mm of app.matchAll(/'([a-z]+\.[a-zA-Z.-]+)'\s*:\s*'([^']*)'/g)) if (mm[1].startsWith('nav.')) used.add(mm[1]); // PAGE_TITLES map
for (const mm of app.matchAll(/'(lists\.n\.|type\.|lt\.|day\.|status\.|lists\.noun\.|lang\.)' \+/g)) used.add(mm[1] + '*');
for (const mm of app.matchAll(/'(lists\.(?:renameX|addX))'/g)) used.add(mm[1]);
for (const mm of app.matchAll(/'(lib\.f\.(?:category|genre))'/g)) used.add(mm[1]);
for (const mm of app.matchAll(/\bbtnLabel\(\s*'[^']*'\s*,\s*'([^']+)'/g)) used.add(mm[1]);   // NotesModule.btnLabel(icon, key)
for (const mm of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(mm[1]);
const missing = [...used].filter(k => !k.endsWith('*') && !(k in I18N.en));
ok(missing.length === 0, 'every key the code references exists ' + JSON.stringify(missing));
// dynamic prefixes: all enum values present
const needPrefix = { 'type.': ['lecture', 'book', 'movie', 'project', 'self-study', 'other'], 'lt.': ['book', 'movie', 'series', 'lecture', 'video', 'paper', 'article', 'music', 'other'],
  'day.': ['0', '1', '2', '3', '4', '5', '6'], 'status.': ['want', 'inProgress', 'done'], 'lists.n.': ['notebook', 'task', 'card', 'item', 'libItem'], 'lists.noun.': ['subject', 'category', 'genre'], 'lang.': ['en', 'ko'] };
const missEnum = [];
Object.entries(needPrefix).forEach(([p, vals]) => vals.forEach(v => { if (!((p + v) in I18N.en)) missEnum.push(p + v); }));
ok(missEnum.length === 0, 'dynamic enum keys all present ' + JSON.stringify(missEnum));

// unused keys: not referenced in code and English text absent from index.html (text or attribute)
const htmlText = html.replace(/<script[\s\S]*?<\/script>/g, '');
const decode = s => s.replace(/&amp;/g, '&').replace(/&deg;/g, '°').replace(/&middot;/g, '·').replace(/&hellip;/g, '…');
const htmlStrings = new Set();
for (const mm of htmlText.matchAll(/>([^<>{}]+)</g)) htmlStrings.add(decode(mm[1]).trim());
for (const mm of htmlText.matchAll(/(?<![-\w])(?:placeholder|title|aria-label)=(?:"([^"]+)"|'([^']+)')/g)) htmlStrings.add(decode(mm[1] || mm[2]).trim());
const usedPrefixes = [...used].filter(k => k.endsWith('*')).map(k => k.slice(0, -1));
const unused = en.filter(k => !used.has(k) && !usedPrefixes.some(p => k.startsWith(p)) && !htmlStrings.has(I18N.en[k]));
ok(unused.length === 0, 'every table key is used (t() / data-i18n / English text in index.html) ' + JSON.stringify(unused));

// English UI strings left in index.html that are NOT in the table (outside the guides) → would stay English in Korean mode
const guideStripped = htmlText.replace(/<div class="guide-body"[\s\S]*?<p class="guide-foot">[\s\S]*?<\/p>\s*<\/div>/g, '');
const enValues = new Set(en.map(k => I18N.en[k]));
const skipText = new Set(['StudyDesk', '16px', 'https://...', 'URL', 'ISBN / DOI', 'CUE', 'MAIN NOTES', 'SUMMARY', 'English', '한국어', 'TMDB API key']);
const leftovers = [];
const keyed = new Set(); for (const mm of guideStripped.matchAll(/data-i18n="[^"]+"[^>]*>([^<]+)</g)) keyed.add(decode(mm[1]).trim());
for (const mm of guideStripped.matchAll(/>([^<>{}]+)</g)) { const v = decode(mm[1]).trim(); if (v && /[A-Za-z]{2,}/.test(v) && !enValues.has(v) && !skipText.has(v) && !keyed.has(v)) leftovers.push(v); }
for (const mm of guideStripped.matchAll(/(?<![-\w])(?:placeholder|title|aria-label)=(?:"([^"]+)"|'([^']+)')/g)) { const v = decode(mm[1] || mm[2]).trim(); if (v && /[A-Za-z]{2,}/.test(v) && !enValues.has(v) && !skipText.has(v) && !/^https?:/.test(v)) leftovers.push(v); }
ok(leftovers.length === 0, 'no static English UI text in index.html outside the table ' + JSON.stringify([...new Set(leftovers)]));

console.log('keys:', en.length);
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
