// 週の頭に、その週7日分の内容（時代・切り口・芸術家・思想家・作品）を1回でまとめて決める。
// 同じ週の中で芸術家・思想家・時代が重ならないよう、割り当て自体を計画の段階で済ませる。
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './data.mjs';
import { generateJson } from './gemini.mjs';

const ERAS = [
  ['古代・中世・初期ネーデルラント', ['ancient', 'medieval', 'early-netherlandish']],
  ['ルネサンス・マニエリスム', ['renaissance', 'mannerism']],
  ['バロック・ロココ', ['baroque', 'rococo']],
  ['新古典主義・ロマン主義', ['neoclassicism', 'romanticism']],
  ['写実主義・印象派', ['realism', 'impressionism']],
  ['ポスト印象派・象徴主義', ['post-impressionism', 'symbolism']],
  ['20世紀以降', ['modern', 'contemporary']],
];
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export async function getWeekPlan({ monday, weekIdx, theme, artists, shown, published = [] }) {
  const file = join(ROOT, 'data', 'plans', `${monday}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));

  const days = Array.from({ length: 7 }, (_, i) => {
    const [era, movements] = ERAS[(((i + weekIdx) % 7) + 7) % 7];
    return { date: addDays(monday, i), era, movements };
  });
  const catalogOf = (movements) => artists.filter((a) => movements.includes(a.movement) && shown(a).length)
    .map((a) => `${a.id}|${a.name_ja}|${a.born}-${a.died ?? ''}|${shown(a).map((w) => w.title_ja).join('/')}`).join('\n');

  const prompt = `あなたは西洋美術史の教養ポッドキャスト「今日の美術史」の編成担当です。
今週（${monday}の週）のテーマ「${theme.title}」（${theme.note}）で、月曜から日曜まで7回分の内容を一度に決めてください。
番組の方針は「現代に活きる美術史」。各回は、現代社会の状況や課題とのつながりが見える切り口にし、哲学・思想の考え方を1人の思想家で絡めます。

【週全体の条件】
- 7回で、切り口・芸術家・思想家・作品をいっさい重ねない（同じ芸術家は週に1回まで、同じ思想家も週に1回まで）
- 思想家は実在し、主要な概念を正確に説明できる人だけ（例: アーレント、ベンヤミン、フーコー、ソンタグ、ニーチェ、カント、ヘーゲル、キルケゴール、ボーヴォワール、バトラー、アドルノ、ラスキン、マクルーハン、ブルデュー、ハーバーマス、ヴィトゲンシュタイン、メルロ＝ポンティ、デリダ、ドゥルーズ、ボードリヤール、パノフスキー、ゴンブリッチなど）
- 各回に割り当てた時代の芸術家を2〜3人選ぶ。作品は、その芸術家の「主な作品」に載っているものから、各芸術家1〜2点選ぶ（題は一覧の表記のまま）
- 現代の政治的な争点は、特定の立場を断定しない切り口にする

${published.length ? `【今週すでに公開済みの回（芸術家・思想家・切り口を重ねないこと）】\n${published.map((p) => `- ${p.date} ${p.title}（芸術家: ${(p.artists || []).map((id) => artists.find((a) => a.id === id)?.name_ja || id).join('、')}）${(p.paragraphs || []).join(' ').slice(0, 500)}`).join('\n')}\n\n` : ''}${days.map((d, i) => `■ ${i + 1}回目 ${d.date} 時代: ${d.era}
${catalogOf(d.movements)}`).join('\n\n')}

次のJSONのみを出力:
{"days":[{"angle":"その回の切り口を2文で（現代との接点を含める）","thinker":"思想家の名前（カタカナ）","artists":["id"],"works":[{"artist":"id","title_ja":"作品の日本語題"}]}, …7件、${days.map((d, i) => `${i + 1}回目は${d.era}`).join('、')}の順]}`;

  const { json } = await generateJson(prompt);
  const ids = new Set(artists.map((a) => a.id));
  const seen = new Set();
  const plan = {
    monday, theme: theme.title,
    days: days.map((d, i) => {
      const p = json.days?.[i] || {};
      const own = artists.filter((a) => d.movements.includes(a.movement)).map((a) => a.id);
      // 週をまたいで同じ芸術家が入った場合は、後の回から外す
      const artistIds = (p.artists || []).filter((id) => ids.has(id) && own.includes(id) && !seen.has(id));
      artistIds.forEach((id) => seen.add(id));
      return {
        date: d.date, era: d.era, angle: p.angle || '', thinker: p.thinker || '', artists: artistIds,
        works: (p.works || []).filter((w) => artistIds.includes(w.artist)),
      };
    }),
  };
  mkdirSync(join(ROOT, 'data', 'plans'), { recursive: true });
  writeFileSync(file, JSON.stringify(plan, null, 1));
  console.log(`週の計画を作成: ${monday}`);
  return plan;
}
