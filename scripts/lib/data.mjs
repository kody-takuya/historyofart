import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const REGIONS = {
  italy: 'イタリア', france: 'フランス', spain: 'スペイン', netherlands: 'ネーデルラント',
  germany: 'ドイツ・中欧', britain: 'イギリス', 'russia-east-europe': 'ロシア・東欧',
  'north-america': '北アメリカ', other: 'その他',
};

export const MOVEMENTS = {
  ancient: ['古代', '#8a7a5c'], medieval: ['中世', '#6b5b95'], 'early-netherlandish': ['初期ネーデルラント', '#3f7d8c'],
  renaissance: ['ルネサンス', '#c0392b'], mannerism: ['マニエリスム', '#a0522d'], baroque: ['バロック', '#7a2e3a'],
  rococo: ['ロココ', '#d98fa8'], neoclassicism: ['新古典主義', '#5d7a99'], romanticism: ['ロマン主義', '#4b6e4b'],
  realism: ['写実主義', '#7d8a45'], impressionism: ['印象派', '#e0a030'], 'post-impressionism': ['ポスト印象派', '#d9702b'],
  symbolism: ['象徴主義', '#7b4f9d'], modern: ['近代', '#2a6f97'], contemporary: ['現代', '#222222'],
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadArtists() {
  const dir = join(ROOT, 'data', 'artists');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ ...readJson(join(dir, f)), _file: f }));
}

export function loadPosts() {
  const dir = join(ROOT, 'content', 'posts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(join(dir, f)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.kind === 'exhibitions' ? -1 : 1)));
}

export function loadCommonsCache() {
  const p = join(ROOT, 'data', 'commons-cache.json');
  return existsSync(p) ? readJson(p) : {};
}

export const loadThemes = () => readJson(join(ROOT, 'data', 'themes.json'));

export const wikiUrl = (lang, title) =>
  `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

export const fmtYear = (y, approx) => (y == null ? '' : `${approx ? '頃 ' : ''}${y < 0 ? `前${-y}` : y}`);
