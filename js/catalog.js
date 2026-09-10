/* Каталог: панель фільтрів, сітка карток і синхронізована з нею карта. */

const SORTS = [
  ['rec', 'Спочатку рекомендовані'],
  ['asc', 'Спочатку дешевші'],
  ['desc', 'Спочатку дорожчі'],
  ['cap', 'За кількістю гостей']
];

/* Зручності шукаємо за ключовим словом, бо в даних вони названі по-різному:
   "Басейн", "Великий басейн" і "Приватний басейн" мають ловитись одним фільтром. */
const AMENITIES = [
  ['басейн',       'Басейн'],
  ['тераса',       'Тераса'],
  ['балкон',       'Балкон'],
  ['вид на океан', 'Вид на океан'],
  ['кондиціонер',  'Кондиціонер'],
  ['пральна',      'Пральна машина'],
  ['сад',          'Сад'],
  ['паркінг',      'Паркінг'],
  ['барбекю',      'Барбекю']
];
const has = (a, word) => a.features.some(f => f.toLowerCase().includes(word));

/* межі беремо з даних, а не з констант: додали дорожчий обʼєкт - повзунок підріс */
const ALL = items();
const P_MIN = Math.min(...ALL.map(a => a.price));
const P_MAX = Math.max(...ALL.map(a => a.price));

const SEGS = {
  bed:  { label: 'Спальні',    opts: [['', 'Будь-яка'], ['1', '1'], ['2', '2'], ['3', '3 і більше']] },
  bath: { label: 'Санвузли',   opts: [['', 'Будь-яка'], ['1', '1'], ['2', '2 і більше']] },
  sea:  { label: 'До океану',  opts: [['', 'Будь-яка'], ['3', 'до 3 хв'], ['5', 'до 5 хв'], ['8', 'до 8 хв']] }
};

/* стан панелі. Дати, гості й район живуть окремо, в S */
const F = { min: P_MIN, max: P_MAX, bed: '', bath: '', sea: '', amen: new Set() };
const priceTouched = () => F.min > P_MIN || F.max < P_MAX;
const activeCount = () =>
  (priceTouched() ? 1 : 0) + (F.bed ? 1 : 0) + (F.bath ? 1 : 0) + (F.sea ? 1 : 0) + F.amen.size;

function filtered(){
  let r = items().filter(a =>
    a.guests >= S.guests &&
    (!S.area || a.area === S.area) &&
    free(a) &&
    a.price >= F.min && a.price <= F.max &&
    (!F.bed  || (F.bed === '3' ? a.bedrooms >= 3 : a.bedrooms === +F.bed)) &&
    (!F.bath || (F.bath === '2' ? a.baths >= 2 : a.baths === +F.bath)) &&
    (!F.sea  || a.sea <= +F.sea) &&
    [...F.amen].every(k => has(a, k))
  );
  const by = { asc: (x, y) => x.price - y.price, desc: (x, y) => y.price - x.price, cap: (x, y) => y.guests - x.guests };
  if (by[S.sort]) r = [...r].sort(by[S.sort]);
  return r;
}

/* ================= панель ================= */
function buildPanel(){
  const seg = (key, { label, opts }) => `
    <div class="fp-g">
      <span>${label}</span>
      <div class="seg" data-seg="${key}">${opts.map(([v, t]) =>
        `<button type="button" data-v="${v}" aria-pressed="${F[key] === v}">${t}</button>`).join('')}</div>
    </div>`;

  $('#fpanel').innerHTML = `
    <div class="fp-row">
      <div class="fp-g">
        <span id="priceLbl">Ціна за ніч</span>
        <div class="range" id="range">
          <div class="range-bar"><span class="range-fill" id="rFill"></span></div>
          <input type="range" id="rMin" min="${P_MIN}" max="${P_MAX}" value="${F.min}" aria-labelledby="priceLbl" aria-label="Мінімальна ціна">
          <input type="range" id="rMax" min="${P_MIN}" max="${P_MAX}" value="${F.max}" aria-labelledby="priceLbl" aria-label="Максимальна ціна">
        </div>
        <output class="range-val" id="rVal"></output>
      </div>
      ${seg('bed', SEGS.bed)}${seg('bath', SEGS.bath)}${seg('sea', SEGS.sea)}
    </div>
    <div class="fp-amen">
      <span class="fp-g" style="display:block"><span>Зручності</span></span>
      <div class="filters" data-amen>${AMENITIES
        .filter(([k]) => ALL.some(a => has(a, k)))
        .map(([k, t]) => `<button class="chip" type="button" data-k="${k}" aria-pressed="${F.amen.has(k)}">${t}</button>`)
        .join('')}</div>
    </div>`;

  /* повзунок: два інпути ділять одну шкалу, тому не даємо їм перетнутись */
  const lo = $('#rMin'), hi = $('#rMax'), fill = $('#rFill'), val = $('#rVal');
  const paint = () => {
    const span = P_MAX - P_MIN || 1;
    fill.style.left  = ((F.min - P_MIN) / span * 100) + '%';
    fill.style.width = ((F.max - F.min) / span * 100) + '%';
    val.innerHTML = priceTouched()
      ? `${F.min} <i>до</i> ${F.max} EUR`
      : `${F.min} <i>до</i> ${F.max} EUR <i>(усі)</i>`;
  };
  lo.oninput = () => { F.min = Math.min(+lo.value, F.max - 1); lo.value = F.min; paint(); render(); };
  hi.oninput = () => { F.max = Math.max(+hi.value, F.min + 1); hi.value = F.max; paint(); render(); };
  paint();

  $$('[data-seg]').forEach(g => g.onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    F[g.dataset.seg] = b.dataset.v;
    g.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === b.dataset.v)));
    render();
  });

  $('[data-amen]').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    F.amen.has(k) ? F.amen.delete(k) : F.amen.add(k);
    b.setAttribute('aria-pressed', String(F.amen.has(k)));
    render();
  };
}

/* активні фільтри пігулками над панеллю, клік знімає фільтр */
function drawPills(){
  const p = [];
  if (priceTouched()) p.push(['price', `${F.min} - ${F.max} EUR`]);
  ['bed', 'bath', 'sea'].forEach(k => {
    if (!F[k]) return;
    const t = SEGS[k].opts.find(o => o[0] === F[k])[1];
    p.push([k, `${SEGS[k].label}: ${t}`]);
  });
  F.amen.forEach(k => p.push(['a:' + k, AMENITIES.find(a => a[0] === k)[1]]));
  if (S.area) p.push(['area', S.area]);

  $('#fpills').innerHTML = p.map(([k, t]) =>
    `<button class="fpill" type="button" data-drop="${esc(k)}">${esc(t)}</button>`).join('');

  const n = activeCount();
  const c = $('#fcount');
  c.textContent = n;
  c.hidden = !n;
}

function dropFilter(key){
  if (key === 'price'){ F.min = P_MIN; F.max = P_MAX; }
  else if (key === 'area'){ S.area = ''; saveState(); $('#fArea').dataset.value = ''; }
  else if (key.startsWith('a:')) F.amen.delete(key.slice(2));
  else F[key] = '';
  buildPanel();
  initSearchbar({ onSearch: render, onChange: render });
  render();
}

/* ================= карта ================= */
const map = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView([28.28, -16.62], 9);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
let markers = {};

function drawMap(list){
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  if (!list.length) return;
  list.forEach(a => {
    const m = L.marker([a.lat, a.lng], {
      icon: L.divIcon({ className: '', html: `<div class="pin" data-id="${a.id}">${a.price} €</div>`, iconSize: [54, 26], iconAnchor: [27, 26] })
    }).addTo(map);
    m.bindPopup(`<b>${esc(a.name)}</b>${esc(a.area)} · ${a.price} EUR за ніч<br>
      <a href="apartment.html?id=${a.id}">Відкрити сторінку</a>`);
    m.on('mouseover', () => hot(a.id, true));
    m.on('mouseout',  () => hot(a.id, false));
    markers[a.id] = m;
  });
  map.fitBounds(L.latLngBounds(list.map(a => [a.lat, a.lng])).pad(0.25), { animate: false });
}
/* підсвічування пари картка + пін */
function hot(id, on){
  const c = $(`.card[data-id="${id}"]`);
  if (c) c.classList.toggle('hot', on);
  const p = $(`.pin[data-id="${id}"]`);
  if (p) p.classList.toggle('on', on);
}

/* ================= відмальовка ================= */
function render(){
  const list = filtered();
  const g = $('#grid');

  $('#cnt').textContent = `${list.length} ${plural(list.length, ['апартамент', 'апартаменти', 'апартаментів'])}`;
  $('#cntSub').textContent = (S.in && S.out) ? `· вільні ${fmt(S.in)} - ${fmt(S.out)}` : '· усі вільні дати';
  $('#reset').hidden = isDefault() && !activeCount();
  drawPills();

  g.innerHTML = list.length
    ? list.map(a => cardHTML(a, `<span class="sea-badge">${icon('waves')}${a.sea} хв</span>`)).join('')
    : `<div class="empty">
         <h3>Нічого не підійшло</h3>
         <p>Спробуйте зняти частину фільтрів або зсунути дати на кілька днів. Якщо умови незмінні, зателефонуйте: у нас є варіанти, яких ще немає на сайті.</p>
         <a class="btn btn-blue" href="tel:+380984776927">Зателефонувати 098 477 69 27</a>
       </div>`;

  $$('.card').forEach(c => {
    c.onmouseenter = () => hot(c.dataset.id, true);
    c.onmouseleave = () => hot(c.dataset.id, false);
  });
  drawMap(list);
}

/* ================= підключення ================= */
buildPanel();

$('#fbtn').onclick = () => {
  const open = $('#fpanel').hidden;
  $('#fpanel').hidden = !open;
  $('#fbtn').setAttribute('aria-expanded', String(open));
};
$('#fpills').onclick = e => {
  const b = e.target.closest('[data-drop]');
  if (b) dropFilter(b.dataset.drop);
};

$('#sort').dataset.value = S.sort;
dressSelect($('#sort'), SORTS, v => { S.sort = v; saveState(); render(); });

initSearchbar({ onSearch: render, onChange: render });

$('#reset').onclick = () => {
  S.in = ''; S.out = ''; S.guests = 2; S.area = ''; S.sort = 'rec';
  F.min = P_MIN; F.max = P_MAX; F.bed = ''; F.bath = ''; F.sea = ''; F.amen.clear();
  saveState();
  setSelect($('#sort'), 'rec', SORTS);
  $('#fArea').dataset.value = '';
  buildPanel();
  initSearchbar({ onSearch: render, onChange: render });
  render();
};

/* карта на мобільному відкривається шторкою */
$('#mapToggle').onclick = () => {
  const open = $('#mapwrap').classList.toggle('open');
  $('#mapToggle').querySelector('span').textContent = open ? 'Списком' : 'На карті';
  if (open) setTimeout(() => map.invalidateSize(), 400);
};

render();
