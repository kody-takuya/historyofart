(() => {
  const imgs = document.querySelectorAll('figure img');
  if (!imgs.length) return;
  let box, big, cap, last;
  const build = () => {
    box = document.createElement('div');
    box.className = 'lb'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '画像の拡大表示');
    box.innerHTML = '<button type="button" class="lb-x" aria-label="閉じる">×</button><img alt=""><p class="lb-cap"></p>';
    big = box.querySelector('img'); cap = box.querySelector('.lb-cap');
    box.addEventListener('click', (e) => { if (e.target !== big) close(); });
    document.body.appendChild(box);
  };
  function open(img) {
    if (!box) build();
    last = document.activeElement;
    big.src = img.currentSrc || img.src; big.alt = img.alt;
    const fc = img.closest('figure').querySelector('strong');
    cap.textContent = fc ? fc.textContent : img.alt;
    box.hidden = false; document.documentElement.classList.add('lb-open');
    box.querySelector('.lb-x').focus();
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true; big.removeAttribute('src');
    document.documentElement.classList.remove('lb-open');
    if (last && last.focus) last.focus();
  }
  imgs.forEach((img) => {
    img.classList.add('zoomable');
    img.tabIndex = 0; img.setAttribute('role', 'button');
    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); } });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
