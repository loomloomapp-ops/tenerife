/* Каталог: фільтри, сітка карток і синхронізована з нею карта. */

const SORTS = [
  ['rec', 'Спочатку рекомендовані'],
  ['asc', 'Спочатку дешевші'],
  ['desc', 'Спочатку дорожчі'],
  ['cap', 'За кількістю гостей']
];

/* Швидкі фільтри. test отримує обʼєкт і повертає true, якщо він підходить. */
const CHIPS = [
  { id: 'sea',     label: 'До 5 хв до океану', test: a => a.sea <= 5 },
  { id: 'pool',    label: 'Басейн',            test: a => has(a, 'басейн') },
  { id: 'terrace', label: 'Тераса',            test: a => has(a, 'тераса') },
  { id: 'view',    label: 'Вид на океан',      test: a => has(a, 'вид на океан') },
  { id: 'parking', label: 'Паркінг',           test: a => has(a, 'паркінг') }
];
const has = (a, word) => a.features.some(f => f.toLowerCase().includes(word));
const active = new Set();

function filtered(){
  let r = items().filter(a =>
    a.guests >= S.guests &&
    (!S.area || a.area === S.area) &&
    free(a) &&
    [...active].every(id => CHIPS.find(c => c.id === id).test(a))
  );
  const by = { asc: (x, y) => x.price - y.price, desc: (x, y) => y.price - x.price, cap: (x, y) => y.guests - x.guests };
  if (by[S.sort]) r = [...r].sort(by[S.sort]);
  return r;
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
  $('#reset').hidden = isDefault() && !active.size;

  g.innerHTML = list.length
    ? list.map(a => cardHTML(a, `<span class="sea-badge">${icon('waves')}${a.sea} хв</span>`)).join('')
    : `<div class="empty">
         <h3>На ці дати вільного не лишилось</h3>
         <p>Спробуйте зсунути дати на кілька днів або зніміть фільтр району. Якщо дати незмінні, зателефонуйте: у нас є варіанти, яких ще немає на сайті.</p>
         <a class="btn btn-blue" href="tel:+380984776927">Зателефонувати 098 477 69 27</a>
       </div>`;

  $$('.card').forEach(c => {
    c.onmouseenter = () => hot(c.dataset.id, true);
    c.onmouseleave = () => hot(c.dataset.id, false);
  });
  drawMap(list);
}

/* ================= фільтри ================= */
$('#chips').innerHTML = CHIPS.map(c =>
  `<button class="chip" type="button" data-chip="${c.id}" aria-pressed="false">${c.label}</button>`).join('');
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('[data-chip]');
  if (!b) return;
  const id = b.dataset.chip;
  active.has(id) ? active.delete(id) : active.add(id);
  b.setAttribute('aria-pressed', String(active.has(id)));
  render();
});

$('#sort').dataset.value = S.sort;
dressSelect($('#sort'), SORTS, v => { S.sort = v; saveState(); render(); });

initSearchbar({ onSearch: render, onChange: render });

$('#reset').onclick = () => {
  S.in = ''; S.out = ''; S.guests = 2; S.area = ''; S.sort = 'rec';
  active.clear();
  saveState();
  $$('[data-chip]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  setSelect($('#sort'), 'rec', SORTS);
  $('#fArea').dataset.value = '';
  initSearchbar({ onSearch: render, onChange: render });
  render();
};

/* карта на мобільному відкривається шторкою */
$('#mapToggle').onclick = () => {
  const open = $('#mapwrap').classList.toggle('open');
  $('#mapToggle').querySelector('span').textContent = open ? 'Списком' : 'На карті';
  if (open) setTimeout(() => map.invalidateSize(), 380);
};

render();
