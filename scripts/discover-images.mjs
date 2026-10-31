// commons_file が未設定の作品について、Wikimedia Commons を検索して候補を data/artists/*.json に書き込む。
// 作者の姓が候補のファイル名／カテゴリに含まれるものだけを採用する。結果は PR で目視確認すること。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadArtists } from './lib/data.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'historyofart-portal/1.0 (https://github.com/kody-takuya/historyofart)';
const get = async (params) => {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return res.json();
};
const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
let found = 0;
for (const a of loadArtists()) {
  if ((a.died ?? 0) > 1955) continue;
  const surname = norm(a.name_en.replace(/\(.*?\)/g, '').trim().split(/\s+/).pop());
  let changed = false;
  for (const w of a.works || []) {
    if (w.commons_file || !w.title_en) continue;
    const j = await get({ action: 'query', list: 'search', srnamespace: '6', srlimit: '5', srsearch: `${w.title_en} ${a.name_en} filetype:bitmap` });
    const hit = (j.query?.search || []).map((s) => s.title.replace(/^File:/, ''))
      .find((t) => /\.(jpe?g|png)$/i.test(t) && norm(t).includes(surname) && !/detail|crop|frame|sketch|copy after/i.test(t));
    if (hit) { w.commons_file = hit; changed = true; found++; }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (changed) {
    const { _file, ...rest } = a;
    writeFileSync(join(ROOT, 'data', 'artists', _file), JSON.stringify(rest, null, 2) + '\n');
  }
}
console.log(`candidates added: ${found}`);
