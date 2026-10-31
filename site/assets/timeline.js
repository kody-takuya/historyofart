(() => {
  const { artists, regions, movements } = window.TL;
  const ctl = document.getElementById('tl-ctl'), root = document.getElementById('tl');
  const state = { group: 'region', zoom: 4, region: '', q: '' };
  const KNEE = 1250, MIN = Math.floor((Math.min(...artists.map((a) => a.b)) - 20) / 50) * 50, MAX = new Date().getFullYear() + 5, COMPRESS = 0.08;
  const X = (y) => 20 + (y < KNEE ? (Math.max(y, MIN) - MIN) * state.zoom * COMPRESS : (KNEE - MIN) * state.zoom * COMPRESS + (y - KNEE) * state.zoom);
  const opts = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');
  ctl.innerHTML = `<label>区分 <select id="g"><option value="region">地域</option><option value="movement">様式</option></select></label>
  <label>地域 <select id="r"><option value="">すべて</option>${opts(regions)}</select></label>
  <label>拡大 <input id="z" type="range" min="2" max="12" step="0.5" value="${state.zoom}"></label>
  <input id="s" type="search" placeholder="名前で検索">`;
  root.insertAdjacentHTML('afterend', `<div id="leg">${Object.values(movements).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div><div id="tip"></div>`);
  const tip = document.getElementById('tip');
  const label = (a) => `${a.n}（${a.b < 0 ? '前' + -a.b : a.b}–${a.d < 0 ? '前' + -a.d : a.d}）`;

  function draw() {
    const list = artists.filter((a) => (!state.region || a.r === state.region) && (!state.q || (a.n + a.e).toLowerCase().includes(state.q)));
    const keys = state.group === 'region' ? Object.keys(regions) : Object.keys(movements);
    const lo = Math.min(...list.map((a) => a.b), 1250) - 20, hi = MAX;
    const from = Math.max(MIN, Math.min(lo, 1250)), W = X(hi) + 40;
    let y = 30, html = '';
    const ticks = [];
    for (let t = Math.ceil(MIN / 250) * 250; t <= 2000; t += t < 1250 ? 250 : 50) if (t >= from - 50) ticks.push(t);
    for (const k of keys) {
      const items = list.filter((a) => a[state.group === 'region' ? 'r' : 'm'] === k).sort((a, b) => a.b - b.b);
      if (!items.length) continue;
      html += `<div class="grow" style="top:${y}px">${state.group === 'region' ? regions[k] : movements[k][0]}</div>`; y += 26;
      const lanes = [];
      for (const a of items) {
        const x1 = X(a.b), w = Math.max(X(a.d) - x1, 6), need = x1 + Math.max(w, a.n.length * 12 + 12) + 6;
        let l = lanes.findIndex((e) => e < x1); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = need;
        const c = movements[a.m]?.[1] || '#666', top = y + l * 24;
        html += w > a.n.length * 11 + 12
          ? `<a class="bar" id="${a.id}" data-t="${label(a)}" href="/artists/${a.id}.html" style="left:${x1}px;width:${w}px;top:${top}px;background:${c}">${a.n}</a>`
          : `<a class="bar" id="${a.id}" data-t="${label(a)}" href="/artists/${a.id}.html" style="left:${x1}px;width:${w}px;top:${top}px;background:${c}"></a><a class="lbl" href="/artists/${a.id}.html" style="left:${x1 + w + 4}px;top:${top}px">${a.n}</a>`;
      }
      y += lanes.length * 24 + 10;
    }
    const grid = ticks.map((t) => `<div class="gl" style="left:${X(t)}px"></div>`).join('');
    const axis = `<div class="axis" style="width:${W}px">${ticks.map((t) => `<div class="tick" style="left:${X(t)}px">${t < 0 ? '前' + -t : t}</div>`).join('')}</div>`;
    root.innerHTML = `<div style="position:relative;width:${W}px;height:${y + 10}px">${axis}${grid}${html}</div>`;
    if (!list.length) root.innerHTML = '<p style="padding:20px">該当する芸術家がいません。</p>';
    const h = location.hash.slice(1), el = h && document.getElementById(h);
    if (el) root.scrollLeft = Math.max(0, el.offsetLeft - 200); else if (!draw.done) { draw.done = 1; root.scrollLeft = Math.max(0, X(1250) - 120); }
  }
  root.addEventListener('mousemove', (e) => { const b = e.target.closest('a.bar'); if (!b) return (tip.style.display = 'none'); tip.textContent = b.dataset.t; tip.style.display = 'block'; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY + 14 + 'px'; });
  root.addEventListener('mouseleave', () => (tip.style.display = 'none'));
  g.onchange = (e) => { state.group = e.target.value; draw(); };
  r.onchange = (e) => { state.region = e.target.value; draw(); };
  z.oninput = (e) => { const c = root.scrollLeft / root.scrollWidth; state.zoom = +e.target.value; draw(); root.scrollLeft = c * root.scrollWidth; };
  s.oninput = (e) => { state.q = e.target.value.toLowerCase(); draw(); };
  draw();
})();
