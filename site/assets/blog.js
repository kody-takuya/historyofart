(() => {
  const q = document.getElementById('q'), res = document.getElementById('res'), list = document.getElementById('list'), dj = document.getElementById('dj');
  let data = null, loading = null;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ja = (d) => { const [y, m, n] = d.split('-').map(Number); return `${y}年${m}月${n}日`; };
  const load = () => (loading ||= fetch(window.POSTS_URL).then((r) => r.json()).then((d) => (data = d.map((p) => ({ ...p, s: `${p.t} ${p.l} ${p.k} ${p.x}`.toLowerCase() })))));

  function snippet(p, terms) {
    const hay = p.x; const low = hay.toLowerCase();
    const i = terms.map((t) => low.indexOf(t)).filter((n) => n >= 0).sort((a, b) => a - b)[0];
    if (i === undefined) return p.l;
    return (i > 30 ? '…' : '') + hay.slice(Math.max(0, i - 30), i + 90) + '…';
  }
  async function run() {
    const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { res.hidden = true; list.hidden = false; return; }
    await load();
    const hits = data.filter((p) => terms.every((t) => p.s.includes(t)));
    list.hidden = true; res.hidden = false;
    res.innerHTML = `<p class="meta">${hits.length}件</p>` + hits.map((p) => `<article class="card"><div><div class="meta">${ja(p.d)}${p.k ? ' · ' + esc(p.k) : ''}</div>
<h2><a href="${esc(p.u)}">${esc(p.t)}</a></h2><p>${esc(snippet(p, terms))}</p></div></article>`).join('');
  }
  q.addEventListener('input', run);
  q.addEventListener('focus', load, { once: true });
  dj.addEventListener('change', () => {
    if (!dj.value) return;
    const s = window.POST_DATES[dj.value];
    location.href = s ? `/posts/${s}.html` : `/archive/${dj.value.slice(0, 7)}.html`;
  });
})();
