import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REGIONS, MOVEMENTS, loadArtists, loadPosts, loadCommonsCache, wikiUrl, fmtYear } from './lib/data.mjs';

const OUT = join(ROOT, 'dist');
const SITE = process.env.SITE_URL || '';
const artists = loadArtists().sort((a, b) => a.born - b.born);
const byId = new Map(artists.map((a) => [a.id, a]));
const posts = loadPosts();
const cache = loadCommonsCache();

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const goodWorks = (a) => (a.works || []).filter((w) => w.commons_file && cache[w.commons_file]?.ok);
const lifespan = (a) => `${fmtYear(a.born, a.born_approx)}–${a.died != null ? fmtYear(a.died, a.died_approx) : ''}`;
const dateJa = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${y}年${m}月${dd}日`; };

// 本文中の [[artist-id|表示名]] を芸術家ページへのリンクに変換
const rich = (s) => esc(s).replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, (m, id, t) =>
  byId.has(id) ? `<a href="/artists/${id}.html">${t}</a>` : t);

function layout({ title, path, body, wide = false, extraHead = '', script = '' }) {
  const full = title ? `${title} | 西洋美術史を学ぶ` : '西洋美術史を学ぶ';
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
${SITE ? `<link rel="canonical" href="${SITE}${path}">` : ''}
<link rel="stylesheet" href="/assets/style.css">${extraHead}
</head><body>
<header class="site"><div class="wrap">
<a class="brand" href="/">西洋美術史を学ぶ</a>
<nav><a href="/">今日の美術史</a><a href="/timeline.html">年表</a><a href="/artists/">芸術家</a><a href="/about.html">このサイトについて</a></nav>
</div></header>
<main class="${wide ? 'wrap wide' : 'wrap'}">${body}</main>
<footer class="site"><div class="wrap">作品画像は Wikimedia Commons のパブリックドメイン／自由ライセンス素材を使用しています。出典は各画像のキャプションをご覧ください。</div></footer>
${script}</body></html>`;
}

function write(path, html) {
  const f = join(OUT, path.endsWith('/') ? path + 'index.html' : path);
  mkdirSync(join(f, '..'), { recursive: true });
  writeFileSync(f, html);
}

function figure(w, a, { link = true } = {}) {
  const c = cache[w.commons_file];
  const cap = `${esc(w.title_ja || w.title_en)}${w.year ? `（${esc(w.year)}）` : ''}`;
  const src = `${c.author ? esc(c.author) + ' / ' : ''}<a href="${esc(c.page)}" rel="noopener">Wikimedia Commons</a>, ${esc(c.license)}`;
  return `<figure><img loading="lazy" src="${esc(c.thumb)}" alt="${esc(w.title_ja || w.title_en)}" width="${c.width}" height="${c.height}">
<figcaption><strong>${cap}</strong>${a && link ? `<br><a href="/artists/${a.id}.html">${esc(a.name_ja)}</a>` : ''}
${w.collection ? `<br>${esc(w.collection)}` : ''}<br><small>${src}</small></figcaption></figure>`;
}

function postCard(p) {
  const url = `/posts/${p.slug}.html`;
  const img = (p.works || []).map((x) => ({ w: byId.get(x.artist)?.works?.find((w) => w.commons_file === x.commons_file), c: cache[x.commons_file] })).find((x) => x.c?.ok);
  return `<article class="card">
${img ? `<a href="${url}" class="thumb"><img loading="lazy" src="${esc(img.c.thumb)}" alt=""></a>` : ''}
<div><div class="meta">${dateJa(p.date)} · ${p.kind === 'exhibitions' ? '関東の美術展' : esc(p.theme || '')}</div>
<h2><a href="${url}">${esc(p.title)}</a></h2><p>${esc(p.lede || '')}</p></div></article>`;
}

function postPage(p) {
  const arts = (p.artists || []).map((id) => byId.get(id)).filter(Boolean);
  const figs = (p.works || []).map((x) => {
    const a = byId.get(x.artist); const w = a?.works?.find((w) => w.commons_file === x.commons_file);
    return w && cache[x.commons_file]?.ok ? figure(w, a) : '';
  }).join('');
  const body = `<article class="post"><div class="meta">${dateJa(p.date)} · ${p.kind === 'exhibitions' ? '関東の美術展' : esc(p.theme || '')}</div>
<h1>${esc(p.title)}</h1>
${p.audio ? `<div class="audio"><audio controls preload="none" src="${esc(p.audio.url)}"></audio></div>` : ''}
${(p.paragraphs || []).map((t) => `<p>${rich(t)}</p>`).join('\n')}
${p.items ? `<h2>展覧会情報</h2><ul class="exh">${p.items.map((i) => `<li><strong>${i.url ? `<a href="${esc(i.url)}" rel="noopener">${esc(i.title)}</a>` : esc(i.title)}</strong><br>${esc(i.venue || '')}${i.period ? ` · ${esc(i.period)}` : ''}${i.note ? `<br><small>${esc(i.note)}</small>` : ''}</li>`).join('')}</ul>` : ''}
${figs ? `<div class="figs">${figs}</div>` : ''}
${arts.length ? `<h2>登場する芸術家</h2><p class="chips">${arts.map((a) => `<a href="/artists/${a.id}.html">${esc(a.name_ja)}</a>`).join('')}</p>` : ''}
${p.transcript?.length ? `<details><summary>音声の書き起こし</summary>${p.transcript.map((l) => `<p><b>${esc(l.speaker)}</b>　${esc(l.text)}</p>`).join('')}</details>` : ''}
${p.sources?.length ? `<h2>参考</h2><ul class="src">${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title || s.url)}</a></li>`).join('')}</ul>` : ''}
</article>`;
  return layout({ title: p.title, path: `/posts/${p.slug}.html`, body });
}

function artistPage(a) {
  const works = goodWorks(a);
  const mentions = posts.filter((p) => (p.artists || []).includes(a.id));
  const rel = (a.related || []).map((id) => byId.get(id)).filter(Boolean);
  const [mvName] = MOVEMENTS[a.movement] || [a.movement];
  const body = `<article class="artist">
<div class="meta">${esc(REGIONS[a.region] || '')} · ${esc(mvName)}</div>
<h1>${esc(a.name_ja)}</h1><div class="sub">${esc(a.name_en)}　${lifespan(a)}</div>
<p>${esc(a.summary)}</p>
${(a.keywords || []).length ? `<p class="chips">${a.keywords.map((k) => `<span>${esc(k)}</span>`).join('')}</p>` : ''}
<ul class="links">
${a.wikipedia_ja ? `<li><a href="${wikiUrl('ja', a.wikipedia_ja)}" rel="noopener">Wikipedia（日本語）</a></li>` : ''}
${a.wikipedia_en ? `<li><a href="${wikiUrl('en', a.wikipedia_en)}" rel="noopener">Wikipedia (English)</a></li>` : ''}
${a.wikidata ? `<li><a href="https://www.wikidata.org/wiki/${esc(a.wikidata)}" rel="noopener">Wikidata</a></li>` : ''}
<li><a href="/timeline.html#${a.id}">年表で見る</a></li></ul>
${works.length ? `<h2>作品</h2><div class="figs">${works.map((w) => figure(w, a, { link: false })).join('')}</div>` : ''}
${(a.works || []).length > works.length || !works.length ? `<h2>主な作品</h2><ul class="plain">${(a.works || []).filter((w) => !works.includes(w)).map((w) => `<li>${esc(w.title_ja || w.title_en)}${w.year ? `（${esc(w.year)}）` : ''}${w.collection ? ` — ${esc(w.collection)}` : ''}</li>`).join('')}</ul>` : ''}
${rel.length ? `<h2>関連する芸術家</h2><p class="chips">${rel.map((r) => `<a href="/artists/${r.id}.html">${esc(r.name_ja)}</a>`).join('')}</p>` : ''}
${mentions.length ? `<h2>この芸術家が登場する記事</h2><ul class="plain">${mentions.map((p) => `<li><a href="/posts/${p.slug}.html">${esc(p.title)}</a> <small>${dateJa(p.date)}</small></li>`).join('')}</ul>` : ''}
</article>`;
  return layout({ title: a.name_ja, path: `/artists/${a.id}.html`, body });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'site'), OUT, { recursive: true });

for (const p of posts) { p.slug ??= p.kind === 'exhibitions' ? `${p.date}-exhibitions` : p.date; write(`posts/${p.slug}.html`, postPage(p)); }

const PER = 20;
const months = [...posts.reduce((m, p) => m.set(p.date.slice(0, 7), (m.get(p.date.slice(0, 7)) || 0) + 1), new Map())];
const monthJa = (k) => `${k.slice(0, 4)}年${Number(k.slice(5))}月`;

// 本文検索用のインデックス（全記事の題・紹介文・本文・登場芸術家名）
const stripLinks = (t) => t.replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1');
write('assets/posts.json', JSON.stringify(posts.map((p) => ({
  u: `/posts/${p.slug}.html`, d: p.date, t: p.title, l: p.lede || '', k: p.kind === 'exhibitions' ? '関東の美術展' : p.theme || '',
  x: [...(p.paragraphs || []).map(stripLinks), ...(p.transcript || []).map((l) => l.text), ...(p.items || []).map((i) => `${i.title} ${i.venue || ''}`),
    ...(p.artists || []).map((id) => byId.get(id)?.name_ja || '')].join(' '),
}))));

const side = (cur) => `<aside class="side">
<form class="search" role="search" onsubmit="return false"><input id="q" type="search" placeholder="記事を検索" aria-label="記事を検索" autocomplete="off"></form>
<h3>日付で探す</h3>
<input id="dj" type="date" aria-label="日付を選んで記事を開く"${posts.length ? ` min="${posts[posts.length - 1].date}" max="${posts[0].date}"` : ''}>
<h3>月別</h3>
<ul class="archive">${months.map(([k, n]) => `<li><a href="/archive/${k}.html"${k === cur ? ' class="on"' : ''}>${monthJa(k)}</a> <small>${n}</small></li>`).join('')}</ul>
</aside>`;
const listScript = `<script>window.POSTS_URL='/assets/posts.json';window.POST_DATES=${JSON.stringify(Object.fromEntries(posts.filter((p) => p.kind !== 'exhibitions').map((p) => [p.date, p.slug])))}</script><script src="/assets/blog.js"></script>`;
const listPage = (inner, cur) => `<div class="blog"><div class="main"><div id="res" hidden></div><div id="list">${inner}</div></div>${side(cur)}</div>`;

const pages = Math.max(1, Math.ceil(posts.length / PER));
for (let i = 0; i < pages; i++) {
  const list = posts.slice(i * PER, (i + 1) * PER);
  const nav = pages > 1 ? `<p class="pager">${Array.from({ length: pages }, (_, n) => `<a href="${n ? `/page/${n + 1}.html` : '/'}"${n === i ? ' class="on"' : ''}>${n + 1}</a>`).join('')}</p>` : '';
  const inner = `${list.length ? list.map(postCard).join('') : '<p class="empty">最初の記事は、毎朝6時に公開されます。</p>'}${nav}`;
  write(i ? `page/${i + 1}.html` : 'index.html', layout({ title: i ? `${i + 1}ページ目` : '', path: i ? `/page/${i + 1}.html` : '/', wide: true, body: listPage(inner), script: listScript }));
}
for (const [k] of months) {
  const list = posts.filter((p) => p.date.startsWith(k));
  write(`archive/${k}.html`, layout({ title: monthJa(k), path: `/archive/${k}.html`, wide: true,
    body: listPage(`<h2 class="mon">${monthJa(k)}</h2>${list.map(postCard).join('')}`, k), script: listScript }));
}

// 芸術家一覧
const groups = Object.keys(MOVEMENTS).map((m) => [m, artists.filter((a) => a.movement === m)]).filter(([, l]) => l.length);
write('artists/index.html', layout({ title: '芸術家', path: '/artists/', body: `<h1 class="page">芸術家</h1>
<input id="q" type="search" placeholder="名前で絞り込み" aria-label="名前で絞り込み">
${groups.map(([m, l]) => `<section class="grp"><h2><i style="background:${MOVEMENTS[m][1]}"></i>${MOVEMENTS[m][0]}</h2><ul class="plain cols">${l.map((a) => `<li data-n="${esc((a.name_ja + a.name_en).toLowerCase())}"><a href="/artists/${a.id}.html">${esc(a.name_ja)}</a> <small>${lifespan(a)}</small></li>`).join('')}</ul></section>`).join('')}`,
  script: `<script>document.getElementById('q').oninput=e=>{const v=e.target.value.toLowerCase();document.querySelectorAll('li[data-n]').forEach(l=>l.hidden=v&&!l.dataset.n.includes(v));document.querySelectorAll('.grp').forEach(g=>g.hidden=![...g.querySelectorAll('li')].some(l=>!l.hidden))}</script>` }));
for (const a of artists) write(`artists/${a.id}.html`, artistPage(a));

// 年表
const tl = artists.map((a) => ({ id: a.id, n: a.name_ja, e: a.name_en, b: a.born, d: a.died ?? Math.min(a.born + 70, new Date().getFullYear()), r: a.region, m: a.movement }));
write('timeline.html', layout({ title: '年表', path: '/timeline.html', wide: true,
  body: `<h1 class="page">年表</h1>
<div id="tl-ctl"></div><div id="tl" aria-label="主要な芸術家の年表"></div>
<p class="note">古代・中世は縮尺を圧縮して表示しています。バーを選ぶと芸術家のページへ移動します。スマートフォンでは横にスクロールしてご覧ください。</p>`,
  script: `<script>window.TL=${JSON.stringify({ artists: tl, regions: REGIONS, movements: Object.fromEntries(Object.entries(MOVEMENTS)) })}</script><script src="/assets/timeline.js"></script>` }));

write('about.html', layout({ title: 'このサイトについて', path: '/about.html', body: `<h1 class="page">このサイトについて</h1>
<p>西洋美術史を学ぶ人のための資料サイトです。芸術家の年表と解説、毎日更新のブログとポッドキャストを掲載しています。</p>
<h2>ポッドキャストについて</h2><p>音声と記事の下書きは生成AIで作成しています。内容には誤りが含まれる可能性があります。学習や引用の際は、必ず一次資料や学術文献でご確認ください。</p>
<h2>画像について</h2><p>作品画像は Wikimedia Commons から、パブリックドメインまたは自由ライセンスのものだけを選び、出典とライセンスを併記しています。</p>
<h2>フィード</h2><p><a href="/feed.xml">ポッドキャスト RSS</a></p>` }));

// ポッドキャスト RSS
const pods = posts.filter((p) => p.audio);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>今日の美術史</title><link>${SITE}/</link><language>ja</language><description>西洋美術史の毎朝のポッドキャスト</description><itunes:explicit>false</itunes:explicit>
${pods.slice(0, 50).map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/posts/${p.slug}.html</link><guid>${SITE}/posts/${p.slug}.html</guid>
<pubDate>${new Date(`${p.date}T06:00:00+09:00`).toUTCString()}</pubDate><description>${esc(p.lede || '')}</description>
<enclosure url="${esc(p.audio.url)}" length="${p.audio.bytes || 0}" type="audio/mpeg"/></item>`).join('\n')}
</channel></rss>`);

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/timeline.html', '/artists/', ...months.map(([k]) => `/archive/${k}.html`), ...artists.map((a) => `/artists/${a.id}.html`), ...posts.map((p) => `/posts/${p.slug}.html`)].map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);
write('404.html', layout({ title: 'ページが見つかりません', path: '/404.html', body: '<h1 class="page">ページが見つかりません</h1><p><a href="/">ブログへ戻る</a></p>' }));

console.log(`built: ${artists.length} artists, ${posts.length} posts, ${Object.values(cache).filter((c) => c.ok).length} images`);
