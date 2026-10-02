/* Головна сторінка: пошук, бенто "з видом на океан" і відеовідгуки. */

/* ---------- пошук у герої ---------- */
initSearchbar({ onSearch: () => { saveState(); location.href = 'catalog.html'; } });

/* ---------- апартаменти з видом на океан ----------
   Беремо обʼєкти, у зручностях яких є вид на океан або панорамний вид.
   Спочатку ті, що позначені top (їх бронюють найчастіше), далі ближчі до води.
   Горизонтальний слайдер: свайп на телефоні, перетягування мишею й колесо на компʼютері,
   кожна прокрутка зупиняється рівно на картці (scroll-snap). Поки людина не чіпала
   слайдер, він сам гортає по одній картці справа наліво. */
(function sea(){
  const track = $('#seaGrid');
  if (!track) return;
  const view = a => a.features.some(f => /вид на океан|панорамний вид/i.test(f));
  const list = items().filter(view)
    .sort((a, b) => (b.top - a.top) || (a.sea - b.sea))
    .slice(0, 10);
  track.innerHTML = list.map(a => cardHTML(a)).join('');

  const step = () => {
    const c = track.querySelector('.card');
    return c ? c.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
  };
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const next = () => track.scrollTo({ left: atEnd() ? 0 : track.scrollLeft + step(), behavior: 'smooth' });

  /* автопрокрутка: лише коли слайдер видно і людина ще не взаємодіяла з ним */
  let timer = 0, visible = false, touched = false;
  const stop = () => { clearInterval(timer); timer = 0; };
  const start = () => {
    if (timer || touched || !visible || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(next, 4500);
  };
  const userTook = () => { touched = true; stop(); };
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => track.addEventListener(ev, userTook, { passive: true }));
  track.addEventListener('mouseenter', stop);
  track.addEventListener('mouseleave', start);
  if ('IntersectionObserver' in window){
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: .4 }).observe(track);
  }

  /* перетягування мишею. Після перетягування клік по картці не відкриває її */
  let down = null, moved = false;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = { x: e.clientX, left: track.scrollLeft }; moved = false;
  });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) > 6){ moved = true; track.classList.add('dragging'); }
    if (moved) track.scrollLeft = down.left - dx;
  });
  addEventListener('pointerup', () => {
    if (!down) return;
    down = null;
    if (!moved) return;
    track.classList.remove('dragging');
    /* після відпускання докручуємо до найближчої картки */
    const s = step();
    track.scrollTo({ left: Math.round(track.scrollLeft / s) * s, behavior: 'smooth' });
  });
  track.addEventListener('click', e => { if (moved){ e.preventDefault(); moved = false; } }, true);
  track.addEventListener('dragstart', e => e.preventDefault());
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight'){ e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft'){ e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
  });
})();

/* ---------- договір бронювання: умови у вікні ---------- */
(function terms(){
  const btn = $('#termsBtn'), dlg = $('#terms');
  if (!btn || !dlg) return;
  btn.onclick = () => dlg.showModal();
  $$('[data-terms-close]', dlg).forEach(b => b.onclick = () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();

/* ---------- відеовідгуки ---------- */
(function reviews(){
  const box = $('#vids');
  if (!box) return;
  box.innerHTML = REVIEWS.filter(r => !r.hidden).map(r => `
    <button class="vid" type="button" data-src="${r.src}" aria-label="Відгук: ${esc(r.author)}, ${esc(r.city)}">
      <img src="${r.poster}" alt="" loading="lazy">
      <span class="vid-play">${icon('play')}</span>
      <span class="vid-cap">
        <q>${esc(r.quote)}</q>
        <b>${esc(r.author)}</b><span>${esc(r.city)}</span>
      </span>
    </button>`).join('');

  /* відео підвантажується лише після кліку, щоб не тягнути пʼять файлів одразу */
  box.addEventListener('click', e => {
    const btn = e.target.closest('.vid');
    if (!btn) return;
    if (btn.classList.contains('playing')){
      const v = btn.querySelector('video');
      if (v) v.paused ? v.play() : v.pause();
      return;
    }
    $$('.vid.playing').forEach(other => {
      other.classList.remove('playing');
      const ov = other.querySelector('video');
      if (ov) ov.replaceWith(Object.assign(document.createElement('img'), { src: other.dataset.poster, alt: '' }));
    });
    const img = btn.querySelector('img');
    btn.dataset.poster = img.src;
    const v = document.createElement('video');
    v.src = btn.dataset.src;
    v.poster = img.src;
    v.controls = true;
    v.playsInline = true;
    v.autoplay = true;
    img.replaceWith(v);
    btn.classList.add('playing');
  });
})();
