/* Головна сторінка: рейка топових обʼєктів, добірка біля визначних місць,
   бенто "до океану пішки" і відеовідгуки. */

/* ---------- пошук у герої ---------- */
initSearchbar({ onSearch: () => { saveState(); location.href = 'catalog.html'; } });

/* ---------- лічильники ----------
   Усі цифри рахуються з масиву апартаментів, вигаданих серед них немає. */
(function stats(){
  const box = $('#stats');
  if (!box) return;
  const all = items();
  const rows = [
    [String(all.length), '', `${plural(all.length, ['апартамент', 'апартаменти', 'апартаментів'])} у добірці, кожен бачили особисто`],
    [String(Math.min(...all.map(a => a.price))), '€', 'найнижча ціна за ніч у добірці'],
    [String(Math.min(...all.map(a => a.sea))), '', `${plural(Math.min(...all.map(a => a.sea)), ['хвилина', 'хвилини', 'хвилин'])} до океану від найближчого обʼєкта`],
    [String(Math.max(...all.map(a => a.guests))), '', `максимум ${plural(Math.max(...all.map(a => a.guests)), ['гість', 'гості', 'гостей'])} в одному обʼєкті`]
  ];
  box.innerHTML = rows.map(([n, suf, label]) => `
    <div class="stat"><b>${n}${suf ? `<i>${suf}</i>` : ''}</b><span>${label}</span></div>`).join('');
})();

/* ---------- топ апартаменти ---------- */
(function topRail(){
  const rail = $('#topRail');
  if (!rail) return;
  const list = items().filter(a => a.top);
  rail.innerHTML = list.map(a => cardHTML(a)).join('');

  const nav = $$('[data-rail]');
  const step = () => Math.max(280, rail.firstElementChild ? rail.firstElementChild.offsetWidth + 20 : 300);
  nav.forEach(b => b.onclick = () => rail.scrollBy({ left: step() * (+b.dataset.rail), behavior: 'smooth' }));
  const syncNav = () => {
    const max = rail.scrollWidth - rail.clientWidth - 2;
    nav.forEach(b => b.disabled = (+b.dataset.rail < 0) ? rail.scrollLeft <= 2 : rail.scrollLeft >= max);
  };
  rail.addEventListener('scroll', syncNav, { passive: true });
  addEventListener('resize', syncNav, { passive: true });
  syncNav();
})();

/* ---------- біля визначного місця ---------- */
(function places(){
  const tabs = $('#placeTabs'), note = $('#placeNote'), grid = $('#placeGrid');
  if (!tabs) return;

  /* найближчі обʼєкти рахуємо з координат, вручну нічого проставляти не треба */
  const nearest = p => items()
    .map(a => ({ a, km: distKm(a.lat, a.lng, p.lat, p.lng) }))
    .sort((x, y) => x.km - y.km)
    .slice(0, 3);

  const kmLabel = km => km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(km < 10 ? 1 : 0)} км`;

  tabs.innerHTML = PLACES.map((p, i) => `
    <button class="place-tab" type="button" role="tab" id="tab-${p.id}"
            aria-selected="${i === 0}" aria-controls="placeGrid" data-place="${p.id}">
      <strong>${esc(p.name)}</strong>
    </button>`).join('');

  function show(id){
    const p = PLACES.find(x => x.id === id);
    $$('.place-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.place === id)));
    note.innerHTML = esc(p.note);
    grid.innerHTML = nearest(p).map(({ a, km }) =>
      cardHTML(a, `<span class="sea-badge">${icon('map-pin')}${kmLabel(km)}</span>`)).join('');
  }

  tabs.addEventListener('click', e => {
    const b = e.target.closest('[data-place]');
    if (b) show(b.dataset.place);
  });
  show(PLACES[0].id);
})();

/* ---------- до океану пішки ---------- */
(function sea(){
  const grid = $('#seaGrid');
  if (!grid) return;
  const list = [...items()].sort((a, b) => a.sea - b.sea).slice(0, 5);
  grid.innerHTML = list.map(a =>
    cardHTML(a, `<span class="sea-badge">${icon('waves')}${a.sea} хв</span>`)).join('');
})();

/* ---------- відеовідгуки ---------- */
(function reviews(){
  const box = $('#vids');
  if (!box) return;
  box.innerHTML = REVIEWS.map(r => `
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
