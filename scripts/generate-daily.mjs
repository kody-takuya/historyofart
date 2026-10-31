// 毎朝6時(JST)に実行: 今週のテーマで5分程度の男女対話ポッドキャストと紹介記事を生成する。
import { writeFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadArtists, loadPosts, loadThemes } from './lib/data.mjs';
import { generateJson, synthesize, pcmToWav, usage } from './lib/gemini.mjs';

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
const past = loadPosts().filter((p) => p.kind !== 'exhibitions' && p.theme === theme.title).map((p) => p.title);
const catalog = artists.map((a) => `${a.id}|${a.name_ja}|${a.born}-${a.died ?? ''}|${(a.works || []).filter((w) => w.commons_file).map((w) => w.title_ja).slice(0, 4).join('/')}`).join('\n');

const prompt = `あなたは西洋美術史の教養ポッドキャストの構成作家です。
今週のテーマ「${theme.title}」（${theme.note}）について、今日は週の${dayOfWeek}日目です。
今週すでに扱った回: ${past.join(' / ') || 'なし'}。これらと重ならない、別の時代・地域から切り口を選んでください。
現代の私たちの生活や社会ともつながる視点を入れてください。

出演者は女性の「アヤ」と男性の「ケン」。二人の掛け合いで進行します（講義調にせず、質問や相づち、軽い驚きを交える）。
- 台本は日本語で合計およそ1500〜1800字（約5分）
- 確かな事実のみ。年代・作者・所蔵先に自信がない内容は断定しない
- 作品は下の登録済み芸術家から2〜4人選んで必ず登場させる（IDは一覧のものだけ）
- 冒頭の挨拶は短く。キャッチフレーズや決まり文句は付けない

登録済み芸術家（id|名前|生没年|主な作品）:
${catalog}

次のJSONのみを出力:
{"title":"記事タイトル(30字以内)","lede":"一覧に表示する紹介文(80字程度)",
"transcript":[{"speaker":"アヤ","text":"…"},{"speaker":"ケン","text":"…"}],
"paragraphs":["追加コメント段落。芸術家名は [[id|表示名]] 形式でリンクにする","…(3〜4段落、合計600字程度)"],
"artists":["登場させた芸術家のid"]}`;

const { json: draft } = await generateJson(prompt);
if (!draft.transcript?.length) throw new Error('台本が空です');
const valid = new Set(artists.map((a) => a.id));
const used = (draft.artists || []).filter((id) => valid.has(id));
// 記事に載せる画像: 登場芸術家の検証済み作品から1点ずつ
const cache = existsSync(join(ROOT, 'data', 'commons-cache.json')) ? JSON.parse(readFileSync(join(ROOT, 'data', 'commons-cache.json'), 'utf8')) : {};
const works = used.flatMap((id) => {
  const w = artists.find((a) => a.id === id).works?.find((w) => w.commons_file && cache[w.commons_file]?.ok);
  return w ? [{ artist: id, commons_file: w.commons_file }] : [];
});

// 音声
const pcm = await synthesize(draft.transcript, { 'アヤ': process.env.VOICE_FEMALE || 'Kore', 'ケン': process.env.VOICE_MALE || 'Puck' });
const tmp = join(ROOT, 'tmp'); mkdirSync(tmp, { recursive: true });
const wav = join(tmp, `${today}.wav`), mp3 = join(tmp, `${today}.mp3`);
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
writeFileSync(file, JSON.stringify(post, null, 1));
console.log(`生成: ${post.title}（${Math.round(seconds)}秒）`);
