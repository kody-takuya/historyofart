import { loadArtists, REGIONS, MOVEMENTS } from './lib/data.mjs';
const artists = loadArtists();
const ids = new Set(artists.map((a) => a.id));
const errs = [];
for (const a of artists) {
  const e = (m) => errs.push(`${a._file}: ${m}`);
  if (a._file !== `${a.id}.json`) e('ファイル名とidが不一致');
  for (const k of ['name_ja', 'name_en', 'summary', 'region', 'movement']) if (!a[k]) e(`${k} がありません`);
  if (!Number.isFinite(a.born)) e('born が数値でありません');
  if (a.region && !REGIONS[a.region]) e(`未知の region: ${a.region}`);
  if (a.movement && !MOVEMENTS[a.movement]) e(`未知の movement: ${a.movement}`);
  for (const r of a.related || []) if (!ids.has(r)) e(`related が存在しません: ${r}`);
  if ((a.died ?? 0) > 1955 && (a.works || []).length) e('没後70年未満の可能性があるため works は空にしてください');
}
console.log(`${artists.length} artists`);
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
