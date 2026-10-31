// 毎週日曜: Google 検索（Gemini のグラウンディング）で関東圏の美術展を調べ、記事にまとめる。
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/data.mjs';
import { generateJson } from './lib/gemini.mjs';

const today = process.env.TARGET_DATE || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const file = join(ROOT, 'content', 'posts', `${today}-exhibitions.json`);
if (existsSync(file) && !process.env.FORCE) { console.log('生成済み'); process.exit(0); }

const { json, sources } = await generateJson(`Google検索で最新情報を確認し、${today}の時点で開催中、または今後2か月以内に始まる、東京・神奈川・千葉・埼玉・茨城・栃木・群馬の美術館・博物館での西洋美術に関する展覧会を調べてください。
公式サイトで会期・会場を確認できたものだけを8〜12件、開幕が近い順に。確認できない情報は書かないこと。
次のJSONのみを出力（コードブロック可）:
{"title":"記事タイトル(例: 今週の関東の西洋美術展)","lede":"80字程度の紹介","paragraphs":["注目の展覧会についての解説段落(2〜3段落)"],
"items":[{"title":"展覧会名","venue":"会場","period":"会期","url":"公式サイトURL","note":"一言"}]}`, { search: true });

mkdirSync(join(ROOT, 'content', 'posts'), { recursive: true });
writeFileSync(file, JSON.stringify({
  kind: 'exhibitions', date: today, slug: `${today}-exhibitions`, theme: '展覧会情報', ...json,
  sources: sources.slice(0, 8).map((s) => ({ title: s.title, url: s.uri })),
}, null, 1));
console.log(`生成: ${json.title}（${json.items?.length ?? 0}件）`);
