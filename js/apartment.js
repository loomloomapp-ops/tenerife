/* Сторінка одного обʼєкта: apartment.html?id=sb-01
   Блоки: фото і головне, деталі, відеовідгуки, бронювання, інші варіанти. */

const apt = byId(new URLSearchParams(location.search).get('id'));

if (!apt){
  $('#apt').innerHTML = `
    <div class="wrap sec">
      <div class="empty">
        <h3>Такого обʼєкта немає</h3>
        <p>Схоже, посилання застаріло або обʼєкт зняли з публікації. Подивіться, що вільне зараз.</p>
        <a class="btn btn-gold" href="catalog.html">Відкрити каталог</a>
      </div>
    </div>`;
} else {
  document.title = `${apt.name}, ${apt.area} | SVOYI Tenerife`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = apt.desc;
  render();
}

/* ---------- підрахунок вартості ---------- */
function calcHTML(){
  const n = nights();
  if (!n) return `<div class="warn">Оберіть дати, щоб побачити повну вартість.</div>`;
  const sum = n * apt.price;
  return `<div class="calc">
    <div><span>${apt.price} EUR × ${n} ${plural(n, ['ніч', 'ночі', 'ночей'])}</span><span>${sum} EUR</span></div>
    <div><span>Прибирання</span><span>${CLEANING} EUR</span></div>
    <div class="total"><span>Разом</span><span>${sum + CLEANING} EUR</span></div>
  </div>`;
}

/* ---------- інші варіанти: спершу той самий район ---------- */
function similar(){
  const pool = items().filter(x => x.id !== apt.id && x.guests >= S.guests && free(x));
  const near = pool.filter(x => x.area === apt.area);
  const rest = pool.filter(x => x.area !== apt.area)
                   .sort((x, y) => Math.abs(x.price - apt.price) - Math.abs(y.price - apt.price));
  return [...near, ...rest].slice(0, 3);
}

/* ---------- відеовідгуки саме про цей обʼєкт ---------- */
function reviewsHTML(){
  const list = (apt.videos && apt.videos.length ? apt.videos : REVIEWS.filter(r => r.apt === apt.id));
  if (!list.length) return '';
  return `<div class="blk">
    <h2>Відгуки про ці апартаменти</h2>
    <div class="vids vids-few" id="aptVids">${list.map(r => `
      <button class="vid" type="button" data-src="${r.src}" aria-label="Відгук: ${esc(r.author)}">
        <img src="${r.poster}" alt="" loading="lazy">
        <span class="vid-play">${icon('play')}</span>
        <span class="vid-cap">
          <q>${esc(r.quote)}</q><b>${esc(r.author)}</b><span>${esc(r.city || '')}</span>
        </span>
      </button>`).join('')}</div>
  </div>`;
}

function render(){
  const n = nights();
  const total = n ? n * apt.price + CLEANING : 0;

  $('#apt').innerHTML = `
  <!-- 1. Головне: фото і максимум інформації -->
  <div class="wrap apt-head">
    <nav class="crumbs" aria-label="Навігація">
      <a href="index.html">Головна</a>${icon('caret-right')}
      <a href="catalog.html">Апартаменти</a>${icon('caret-right')}
      <span>${esc(apt.area)}</span>
    </nav>
    <div class="apt-title">
      <div>
        <h1>${esc(apt.name)}</h1>
        <p class="apt-loc">${icon('map-pin')}${esc(apt.area)}, Тенеріфе</p>
      </div>
    </div>
    <div class="gal" id="gal">
      ${apt.photos.map((p, i) => `
        <button type="button" data-i="${i}" aria-label="Фото ${i + 1} з ${apt.photos.length}">
          <img src="${p}" alt="${esc(apt.name)}, фото ${i + 1}">
          ${i === apt.photos.length - 1 ? `<span class="gal-more">${icon('frame-corners')} Усі фото</span>` : ''}
        </button>`).join('')}
    </div>
  </div>

  <div class="wrap apt-main">
    <div>
      <div class="facts">
        <span>${icon('users')}${apt.guests} ${plural(apt.guests, ['гість', 'гості', 'гостей'])}</span>
        <span>${icon('bed')}${apt.bedrooms} ${plural(apt.bedrooms, ['спальня', 'спальні', 'спалень'])}</span>
        <span>${icon('bath')}${apt.baths} ${plural(apt.baths, ['санвузол', 'санвузли', 'санвузлів'])}</span>
        <span>${icon('waves')}${apt.sea} хв до океану</span>
      </div>
      <div class="apt-desc"><p>${esc(apt.desc)}</p></div>

      <!-- 2. Більше інформації -->
      <div class="blk">
        <h2>Про житло докладніше</h2>
        <div class="apt-desc"><p>${esc(apt.long || apt.desc)}</p></div>
      </div>

      <div class="blk">
        <h2>Зручності</h2>
        <ul class="feats">${apt.features.map(f => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
      </div>

      <div class="blk">
        <h2>Умови заселення</h2>
        <div class="rules">
          <div class="rule"><span>Заїзд</span><b>з ${apt.rules.in}</b></div>
          <div class="rule"><span>Виїзд</span><b>до ${apt.rules.out}</b></div>
          <div class="rule"><span>Мінімум</span><b>${apt.rules.min} ${plural(apt.rules.min, ['ніч', 'ночі', 'ночей'])}</b></div>
          <div class="rule"><span>Тварини</span><b>${esc(apt.rules.pets)}</b></div>
          <div class="rule"><span>Паління</span><b>${esc(apt.rules.smoke)}</b></div>
        </div>
      </div>

      <div class="blk">
        <h2>Де це на карті</h2>
        <div class="minimap" id="minimap"></div>
      </div>

      <!-- 3. Відеовідгуки -->
      ${reviewsHTML()}
    </div>

    <!-- 4. Бронювання: праворуч на компʼютері, знизу екрана на телефоні -->
    <aside class="bookbox" id="bookbox">
      <p class="pr"><b>${apt.price} EUR</b><span>/ ніч</span></p>
      <div class="bb-dates" id="bbDates">
        <div id="cIn" role="button" tabindex="0"><label>Заїзд</label><div class="dfield${S.in ? '' : ' ph'}" id="sIn">${S.in ? fmt(S.in) : 'Оберіть дату'}</div></div>
        <div id="cOut" role="button" tabindex="0"><label>Виїзд</label><div class="dfield${S.out ? '' : ' ph'}" id="sOut">${S.out ? fmt(S.out) : 'Оберіть дату'}</div></div>
      </div>
      ${calcHTML()}
      <button class="btn btn-gold btn-sq btn-block" type="button" id="toBook" style="margin-top:16px"${n ? '' : ' disabled'}>Забронювати</button>
      <p class="bb-note">Оплата лише після підтвердження бронювання</p>
    </aside>
  </div>

  <!-- 5. Інші апартаменти -->
  <div class="sec sec-sand2">
    <div class="wrap">
      <div class="sec-h sec-top">
        <div>
          <h2>Інші вільні варіанти</h2>
          <p>${(S.in && S.out) ? `На ${fmt(S.in)} - ${fmt(S.out)}.` : 'На найближчі дати.'} Спершу той самий район.</p>
        </div>
        <a class="link-more" href="catalog.html">Весь каталог ${icon('arrow-right')}</a>
      </div>
      <div class="more-g">${similar().map(miniHTML).join('') || '<p>Зараз усе інше зайняте на ці дати.</p>'}</div>
    </div>
  </div>

  <!-- панель бронювання для телефона -->
  <div class="bookbar">
    <div class="pr">
      <b>${n ? `${total} EUR` : `${apt.price} EUR`}</b>
      <span>${n ? `${fmt(S.in)} - ${fmt(S.out)}, ${n} ${plural(n, ['ніч', 'ночі', 'ночей'])}` : 'за ніч, оберіть дати'}</span>
    </div>
    <button class="btn btn-gold btn-sq" type="button" id="barBook">${n ? 'Забронювати' : 'Обрати дати'}</button>
  </div>`;

  wireGallery();
  wireBooking();
  wireVideos();
  drawMini();
}

/* ---------- дати в блоці бронювання ---------- */
function wireBooking(){
  const open = e => {
    e.stopPropagation();
    openCal($('#bbDates'), apt.booked, complete => {
      if (complete) render();
      else {
        labelDate($('#sIn'), S.in);
        labelDate($('#sOut'), S.out);
      }
    }, { right: true });
  };
  $('#cIn').onclick = open;
  $('#cOut').onclick = open;
  $('#toBook').onclick = () => openBooking(apt);
  $('#barBook').onclick = () => nights()
    ? openBooking(apt)
    : ($('#bookbox').scrollIntoView({ behavior: 'smooth', block: 'center' }), setTimeout(() => $('#cIn').click(), 420));
}

/* ---------- галерея і лайтбокс ---------- */
function wireGallery(){
  const dlg = $('#lb'), img = $('#lbImg'), thumbs = $('#lbThumbs');
  let i = 0;
  const show = k => {
    i = (k + apt.photos.length) % apt.photos.length;
    img.src = apt.photos[i];
    img.alt = `${apt.name}, фото ${i + 1}`;
    $$('#lbThumbs button').forEach((b, n) => b.setAttribute('aria-current', String(n === i)));
  };
  thumbs.innerHTML = apt.photos.map((p, n) =>
    `<button type="button" data-i="${n}" aria-current="${n === 0}"><img src="${p}" alt=""></button>`).join('');
  thumbs.onclick = e => { const b = e.target.closest('[data-i]'); if (b) show(+b.dataset.i); };
  $('#gal').onclick = e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    show(+b.dataset.i);
    dlg.showModal();
  };
  $('#lbClose').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft')  show(i - 1);
  });
}

/* ---------- відео підвантажується тільки після кліку ---------- */
function wireVideos(){
  const box = $('#aptVids');
  if (!box) return;
  box.addEventListener('click', e => {
    const btn = e.target.closest('.vid');
    if (!btn || btn.classList.contains('playing')) return;
    const im = btn.querySelector('img');
    const v = document.createElement('video');
    v.src = btn.dataset.src; v.poster = im.src;
    v.controls = true; v.playsInline = true; v.autoplay = true;
    im.replaceWith(v);
    btn.classList.add('playing');
  });
}

/* ---------- міні-карта ---------- */
function drawMini(){
  const el = $('#minimap');
  if (!el || !window.L) return;
  const m = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([apt.lat, apt.lng], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(m);
  L.marker([apt.lat, apt.lng], {
    icon: L.divIcon({ className: '', html: `<div class="pin on">${esc(apt.name)}</div>`, iconSize: [120, 26], iconAnchor: [60, 26] })
  }).addTo(m);
}
