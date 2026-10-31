// Wikimedia Commons で作品画像の存在・ライセンスを検証し、data/commons-cache.json に保存する。
// 自由ライセンス（PD/CC0/CC BY/CC BY-SA）以外は ok:false として採用しない。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadArtists, loadCommonsCache } from './lib/data.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'historyofart-portal/1.0 (https://github.com/kody-takuya/historyofart)';
const FREE = /^(pd|public domain|cc0|cc[- ]by(-sa)?|attribution|no restrictions)/i;
const strip = (s = '') => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const cache = loadCommonsCache();
const refresh = process.argv.includes('--refresh');
const files = [...new Set(loadArtists().flatMap((a) => (a.works || []).map((w) => w.commons_file).filter(Boolean)))]
  .filter((f) => refresh || !cache[f]);
console.log(`${files.length} files to resolve`);

for (let i = 0; i < files.length; i += 40) {
  const batch = files.slice(i, i + 40);
  const url = `${API}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900` +
    `&titles=${encodeURIComponent(batch.map((f) => `File:${f}`).join('|'))}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  const json = await res.json();
  const norm = new Map((json.query.normalized || []).map((n) => [n.to, n.from]));
  for (const p of json.query.pages) {
    const key = norm.get(p.title) ?? p.title;
    const name = batch.find((f) => `File:${f}` === key || `File:${f}` === p.title);
    if (!name) continue;
    const info = p.imageinfo?.[0];
    if (p.missing || !info) { cache[name] = { ok: false, reason: 'missing' }; continue; }
    const m = info.extmetadata || {};
    const license = strip(m.LicenseShortName?.value);
    const ok = FREE.test(license) && m.Restrictions?.value !== 'trademarked';
    cache[name] = ok ? {
      ok, thumb: info.thumburl, full: info.url, page: info.descriptionurl, width: info.thumbwidth, height: info.thumbheight,
      author: strip(m.Artist?.value), credit: strip(m.Credit?.value), license, licenseUrl: m.LicenseUrl?.value || '',
    } : { ok: false, reason: `license:${license}` };
  }
  await new Promise((r) => setTimeout(r, 500));
}

writeFileSync(join(ROOT, 'data', 'commons-cache.json'), JSON.stringify(cache, null, 1));
const all = Object.values(cache);
console.log(`ok=${all.filter((c) => c.ok).length} rejected=${all.filter((c) => !c.ok).length}`);
