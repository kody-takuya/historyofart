// 毎朝6時(JST)に実行: 今週のテーマで5分程度の男女対話ポッドキャストと紹介記事を生成する。
import { writeFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadArtists, loadPosts, loadThemes } from './lib/data.mjs';
import { generateJson, synthesize, pcmToWav, usage } from './lib/gemini.mjs';
import { cleanTail } from './lib/audio.mjs';

const jst = new Date(Date.now() + 9 * 3600e3);
const today = process.env.TARGET_DATE || jst.toISOString().slice(0, 10);
const file = join(ROOT, 'content', 'posts', `${today}.json`);
if (existsSync(file) && !process.env.FORCE) { console.log(`${today} は生成済みです`); process.exit(0); }

// 今週のテーマ（月曜始まり）
const themes = loadThemes();
const mondayOf = (d) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
const weekIdx = Math.round((Date.parse(mondayOf(today)) - Date.parse(themes.start)) / (7 * 864e5));
const theme = themes.weeks[((weekIdx % themes.weeks.length) + themes.weeks.length) % themes.weeks.length];
const dayOfWeek = ((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;

const artists = loadArtists();
const cache = existsSync(join(ROOT, 'data', 'commons-cache.json')) ? JSON.parse(readFileSync(join(ROOT, 'data', 'commons-cache.json'), 'utf8')) : {};
const shown = (a) => (a.works || []).filter((w) => w.commons_file && cache[w.commons_file]?.ok);
const past = loadPosts().filter((p) => p.kind !== 'exhibitions' && p.theme === theme.title).map((p) => p.title);
const catalog = artists.map((a) => `${a.id}|${a.name_ja}|${a.born}-${a.died ?? ''}|${shown(a).map((w) => w.title_ja).join('/')}`).join('\n');

const prompt = `あなたは西洋美術史の教養ポッドキャストの構成作家です。
今週のテーマ「${theme.title}」（${theme.note}）について、今日は週の${dayOfWeek}日目です。
今週すでに扱った回: ${past.join(' / ') || 'なし'}。これらと重ならない、別の時代・地域から切り口を選んでください。
番組の方針は「現代に活きる美術史」です。
- 過去の作品を紹介して終わらず、現代社会の状況や課題（テクノロジー、格差、分断、ジェンダー、環境、情報とメディア、働き方など、テーマに関わるもの）との関係がはっきり見える構成にする
- 作品が当時の社会で担った意味と、今の私たちの問題がどう重なり、どこが違うのかを、具体的に対比させる
- 可能なら哲学・思想の考え方を一つか二つ絡める（例: アーレント、ベンヤミン、フーコー、ソンタグ、ニーチェ、カント、ヘーゲル、キルケゴール、ボーヴォワール、バトラー、アドルノなど、実在する思想家とその主要な概念）。概念は正確に、短く平易に説明する。内容に自信がない引用や概念は使わない
- 現代の政治的な争点には、特定の立場を断定せず、複数の見方を並べて、聴き手が考える余白を残す
- 最後は、今日から作品や身の回りをどう見るかという問いかけで締める

番組名は「今日の美術史」。出演者は女性と男性の二人で、名前はありません（speaker は「女性」「男性」とする）。
互いを名前で呼ばない、自己紹介をしない。冒頭は「今日の美術史です。」のように番組名で始める。
二人の掛け合いで進行します（講義調にせず、質問や相づち、軽い驚きを交える）。
- 台本は日本語で合計およそ1800〜2200字（約5分）
- 確かな事実のみ。年代・作者・所蔵先に自信がない内容は断定しない
- 作品は下の登録済み芸術家から2〜4人選んで必ず登場させる（IDは一覧のものだけ）
- 台本で取り上げる作品は、一覧の「主な作品」に載っている作品から選ぶ。記事にその画像が表示されるため。台本で詳しく語った作品を works に記す
- 冒頭の挨拶は短く。キャッチフレーズや決まり文句は付けない

登録済み芸術家（id|名前|生没年|主な作品）:
${catalog}

次のJSONのみを出力:
{"title":"記事タイトル(30字以内)","lede":"一覧に表示する紹介文(80字程度)",
"transcript":[{"speaker":"女性","text":"…"},{"speaker":"男性","text":"…"}],
"paragraphs":["追加コメント段落。現代との接点と、絡めた思想・哲学の補足を入れる。芸術家名は [[id|表示名]] 形式でリンクにする","…(3〜4段落、合計600字程度)"],
"artists":["登場させた芸術家のid"],
"works":[{"artist":"id","title_ja":"台本で語った作品の日本語題（一覧の表記のまま）"}]}`;

const { json: draft } = await generateJson(prompt);
if (!draft.transcript?.length) throw new Error('台本が空です');
const valid = new Set(artists.map((a) => a.id));
const used = (draft.artists || []).filter((id) => valid.has(id));
// 記事に載せる画像: 台本で語った作品（一覧の題と一致するもの）。一致がなければ登場芸術家の検証済み作品を1点ずつ
const mentioned = (draft.works || []).flatMap((m) => {
  const a = artists.find((x) => x.id === m.artist);
  const w = a && shown(a).find((w) => w.title_ja === m.title_ja);
  return w ? [{ artist: a.id, commons_file: w.commons_file }] : [];
});
const unique = (l) => l.filter((x, i) => l.findIndex((y) => y.commons_file === x.commons_file) === i);
const works = unique(mentioned.length ? mentioned : used.flatMap((id) => {
  const w = shown(artists.find((a) => a.id === id))[0];
  return w ? [{ artist: id, commons_file: w.commons_file }] : [];
})).slice(0, 8);

// 音声
const raw = await synthesize(draft.transcript, { '女性': process.env.VOICE_FEMALE || 'Kore', '男性': process.env.VOICE_MALE || 'Puck' });
const tmp = join(ROOT, 'tmp'); mkdirSync(tmp, { recursive: true });
const wav = join(tmp, `${today}.wav`), mp3 = join(tmp, `${today}.mp3`);
const pcm = cleanTail(raw);
writeFileSync(wav, pcmToWav(pcm));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '64k', mp3]);
const seconds = pcm.length / 2 / 24000;

const bucket = process.env.MEDIA_BUCKET;
if (!bucket) throw new Error('MEDIA_BUCKET が未設定です');
execFileSync('gcloud', ['storage', 'cp', mp3, `gs://${bucket}/podcast/${today}.mp3`, '--cache-control=public,max-age=31536000'], { stdio: 'inherit' });

const post = {
  kind: 'daily', date: today, slug: today, theme: theme.title, title: draft.title, lede: draft.lede,
  audio: { url: `https://storage.googleapis.com/${bucket}/podcast/${today}.mp3`, minutes: Math.round(seconds / 60), bytes: statSync(mp3).size },
  usage, transcript: draft.transcript, paragraphs: draft.paragraphs, artists: used, works,
};
mkdirSync(join(ROOT, 'content', 'posts'), { recursive: true });
writeFileSync(file, JSON.stringify(post, null, 1));
console.log(`生成: ${post.title}（${Math.round(seconds)}秒）`);
