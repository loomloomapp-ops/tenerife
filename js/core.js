/* SVOYI Tenerife - спільна логіка всіх сторінок:
   контент з адмінки, стан пошуку, календар, селекти, картки, форма заявки, флоу бронювання. */

document.documentElement.classList.add('js');

/* ================= дані ================= */
/* Увесь контент лежить у SITE (js/data.js), його пише адмінка. Кнопка
   "Переглянути" в адмінці кладе чернетку в localStorage і вмикає режим перегляду:
   тоді сайт показує чернетку, але лише в цьому браузері. */
const PREVIEW = (() => {
  try { return localStorage.getItem('svoyi_preview') === '1' ? JSON.parse(localStorage.getItem('svoyi_draft')) : null; }
  catch { return null; }
})();
const DATA = PREVIEW || SITE;
const SET = DATA.settings;
const APARTMENTS = DATA.apartments;
const BASICS = DATA.basics;
const CARS = DATA.cars.filter(c => !c.hidden);
const REVIEWS = DATA.reviews;
const APT_TYPES = DATA.types.map(t => [t.id, t.label]);
const AREAS = [...new Set(APARTMENTS.filter(a => !a.hidden).map(a => a.area))].sort();
/* генеральне прибирання: одноразовий платіж при виселенні */
const CLEANING = +SET.cleaning || 0;

/* ================= дрібні помічники ================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = iso(new Date());
const fmt = s => s ? s.split('-').reverse().join('.') : '';
const icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* правильна форма слова після числа: 1 гість, 2 гості, 5 гостей */
const plural = (n, a) => a[
  (n % 10 === 1 && n % 100 !== 11) ? 0
  : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2
];

/* відстань між двома точками в кілометрах */
function distKm(aLat, aLng, bLat, bLng){
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ================= стан ================= */
/* Дати, кількість людей, тип житла й район живуть у sessionStorage, тому пошук із головної
   переноситься в каталог і далі на сторінку апартаментів. */
const DEF = { in: '', out: '', guests: 2, type: '', area: '', sort: 'rec' };
const S = Object.assign({}, DEF, (() => {
  try { return JSON.parse(sessionStorage.getItem('svoyi_search')) || {}; } catch { return {}; }
})(), { apt: null, car: null });

function saveState(){
  const { in: i, out, guests, type, area, sort } = S;
  try { sessionStorage.setItem('svoyi_search', JSON.stringify({ in: i, out, guests, type, area, sort })); } catch {}
}
const isDefault = () => !S.in && !S.out && !S.type && !S.area && S.guests === 2 && S.sort === 'rec';

/* приховані в адмінці обʼєкти не показуються ніде на сайті */
const items = () => APARTMENTS.filter(a => !a.hidden);
const byId = id => items().find(a => a.id === id);

const nights = () => (S.in && S.out) ? Math.max(0, Math.round((new Date(S.out) - new Date(S.in)) / 864e5)) : 0;
/* обʼєкт вільний, якщо обраний діапазон не перетинається з жодним зайнятим */
const free = a => !(S.in && S.out) || !(a.booked || []).some(([b, e]) => S.in < e && b < S.out);

/* ================= тексти сторінок ================= */
/* Розмітка сторінок містить тексти за замовчуванням, а атрибути кажуть, звідки
   брати актуальні з DATA:
     data-c="home.heroLede"            текст елемента (перенос рядка стає <br>)
     data-accent="svc.accent"          другий рядок заголовка у <span>
     data-attr="placeholder:svc.x"     атрибути, через ;
     data-list="svc.tiles.items" data-tpl="tile"   список за шаблоном з TPL
     data-show="svc.cars.show"         ховає блок, якщо значення порожнє
     data-contact="phone"              телефон і соцмережі з налаштувань
   Шлях svc.* веде до поточної послуги: data-svc на <body> або ?id= на service.html.
   У текстах працюють **жирний** і [посилання](https://...). */
const rich = s => esc(s == null ? '' : s)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) =>
    `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\n/g, '<br>');

const svcHref = s => s.href || `service.html?id=${encodeURIComponent(s.id)}`;
function currentSvc(){
  const b = document.body;
  const id = b.dataset.svc || (b.hasAttribute('data-svc-query') ? new URLSearchParams(location.search).get('id') : '');
  return id ? DATA.services.find(s => s.id === id) : null;
}
function getPath(path){
  const parts = path.split('.');
  let v = parts[0] === 'svc' ? currentSvc() : DATA[parts[0]];
  for (const k of parts.slice(1)) v = v == null ? undefined : v[k];
  return v;
}
const filled = v => Array.isArray(v) ? v.length > 0 : !!v;

const TPL = {
  fact: f => `<span>${icon(f.icon)}${esc(f.text)}</span>`,
  tile: t => `<div class="tile">${icon(t.icon)}<h3>${esc(t.title)}</h3><p>${rich(t.text)}</p></div>`,
  step: s => `<div class="step"><em>${esc(s.label)}</em><h3>${esc(s.title)}</h3><p>${rich(s.text)}</p></div>`,
  li: s => `<li>${esc(s)}</li>`,
  svc: s => {
    const here = currentSvc() === s;
    return `<a class="svc-btn" href="${esc(svcHref(s))}"${here ? ' aria-current="page"' : ''}>
      ${icon(s.icon)}<b>${esc(s.name)}</b><span>${esc(s.short)}</span>
      <em>${here ? 'Ви тут' : `Детальніше ${icon('arrow-right')}`}</em>
    </a>`;
  }
};

const CONTACTS = {
  phone:     () => ['tel:' + SET.phone.replace(/[^\d+]/g, ''), SET.phoneLabel],
  telegram:  () => [SET.telegram],
  instagram: () => [SET.instagram],
  tiktok:    () => [SET.tiktok]
};

function applyContent(){
  const svcPage = document.body.hasAttribute('data-svc') || document.body.hasAttribute('data-svc-query');
  if (svcPage && !currentSvc()){ location.replace('index.html'); return; }

  $$('[data-c]').forEach(el => {
    const v = getPath(el.dataset.c);
    if (typeof v !== 'string') return;
    const acc = el.dataset.accent ? getPath(el.dataset.accent) : '';
    el.innerHTML = rich(v) + (acc ? `<br><span>${rich(acc)}</span>` : '');
    el.hidden = !v && !acc;
  });
  $$('[data-attr]').forEach(el => el.dataset.attr.split(';').forEach(pair => {
    const [name, path] = pair.split(':');
    const v = getPath(path);
    if (v != null) el.setAttribute(name, v);
  }));
  $$('[data-list]').forEach(el => {
    const list = getPath(el.dataset.list);
    if (Array.isArray(list)) el.innerHTML = list.filter(x => !(x && x.hidden)).map(TPL[el.dataset.tpl]).join('');
  });
  $$('[data-show]').forEach(el => { el.hidden = !filled(getPath(el.dataset.show)); });
  $$('[data-contact]').forEach(el => {
    const [href, label] = CONTACTS[el.dataset.contact]();
    el.hidden = !href || href === 'tel:';
    el.href = href;
    if (label){
      const t = [...el.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
      t ? (t.textContent = label) : el.append(label);
    }
  });

  /* банер послуги: фото з підписом або декоративні кільця з іконкою */
  const vis = $('[data-vis]'), svc = currentSvc();
  if (vis && svc){
    vis.classList.toggle('has-ph', !!svc.image);
    vis.innerHTML = svc.image
      ? `<img src="${esc(svc.image)}" alt="${esc(svc.imageAlt || svc.name)}"><span class="svc-vis-ic">${icon(svc.icon)}</span>${svc.imageCredit ? `<p class="credit">${rich(svc.imageCredit)}</p>` : ''}`
      : `<i></i><i></i><i></i><span class="svc-vis-ic">${icon(svc.icon)}</span>`;
  }
  const lf = $('#leadForm');
  if (lf && svc) lf.dataset.service = svc.name;

  /* відео в банері головної: якщо в адмінці поставили інший файл, лишаємо тільки його */
  const hv = $('[data-hero-video]');
  if (hv && DATA.home){
    const { heroVideo: src, heroPoster: poster } = DATA.home;
    if (poster) hv.poster = poster;
    const cur = hv.querySelector('source[type="video/mp4"]');
    if (src && (!cur || cur.getAttribute('src') !== src)){
      hv.innerHTML = `<source src="${esc(src)}"${/\.webm$/i.test(src) ? ' type="video/webm"' : ''}>`;
      hv.load();
    }
  }

  const seo = document.body.dataset.seo;
  const seoObj = seo === 'svc' ? svc : seo ? DATA[seo] : null;
  if (seoObj){
    if (seoObj.seoTitle) document.title = seoObj.seoTitle;
    [['meta[name="description"]', seoObj.seoDescription], ['meta[property="og:title"]', seoObj.seoTitle],
     ['meta[property="og:description"]', seoObj.seoDescription]]
      .forEach(([sel, v]) => { const m = $(sel); if (m && v) m.content = v; });
  }

  if (PREVIEW){
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = `<span>Перегляд чернетки з адмінки. Відвідувачі бачать опубліковану версію.</span><button type="button">Вийти з перегляду</button>`;
    bar.querySelector('button').onclick = () => { try { localStorage.removeItem('svoyi_preview'); } catch {} location.reload(); };
    document.body.prepend(bar);
  }
}

/* ================= нижнє меню на телефоні ================= */
function initDock(){
  const page = location.pathname.split('/').pop() || 'index.html';
  const links = [
    ['phone', 'phone', `Подзвонити <small>${esc(SET.phoneLabel)}</small>`],
    ['telegram', 'telegram', 'Telegram'],
    ['instagram', 'instagram', 'Instagram'],
    ['tiktok', 'tiktok', 'TikTok']
  ];
  const dock = document.createElement('nav');
  dock.className = 'dock';
  dock.setAttribute('aria-label', 'Швидкі дії');
  dock.innerHTML = `
    <div class="dock-sheet" id="dockSheet" hidden>${links.map(([k, ic, t]) =>
      `<a href="#" data-contact="${k}"${k === 'phone' ? '' : ' target="_blank" rel="noopener"'}>${icon(ic)}<span>${t}</span></a>`).join('')}
    </div>
    <a class="dock-btn" href="catalog.html"${page === 'catalog.html' ? ' aria-current="page"' : ''}>${icon('bed')}<span>Каталог</span></a>
    <button class="dock-btn dock-call" type="button" aria-expanded="false" aria-controls="dockSheet">${icon('phone')}<span>Звʼязатися</span></button>`;
  document.body.appendChild(dock);
  document.body.classList.add('has-dock');

  /* посилання в шторці заповнюються тими ж контактами, що й по сайту */
  dock.querySelectorAll('[data-contact]').forEach(el => {
    const [href] = CONTACTS[el.dataset.contact]();
    el.href = href || '#';
    el.hidden = !href || href === 'tel:';
  });
  const sheet = dock.querySelector('.dock-sheet'), btn = dock.querySelector('.dock-call');
  btn.onclick = e => {
    e.stopPropagation();
    const open = sheet.hidden;
    closeAllPopovers();
    sheet.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  sheet.onclick = e => e.stopPropagation();
}

/* ================= шапка й футер ================= */
function initChrome(){
  const burger = $('#burger'), nav = $('#topnav');
  if (burger && nav){
    burger.onclick = () => {
      const open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    };
  }
  /* шапка над героєм прозора, після скролу темніє. Слідкуємо через
     IntersectionObserver, а не через обробник прокрутки. */
  const top = $('#top'), sentinel = $('#topSentinel');
  if (top && top.classList.contains('on-hero')){
    /* висота шапки їде разом із брейкпоінтами, тому міряємо, а не хардкодимо */
    const setH = () => document.documentElement.style.setProperty('--top-h', top.offsetHeight + 'px');
    setH();
    if ('ResizeObserver' in window) new ResizeObserver(setH).observe(top);
    else addEventListener('resize', setH, { passive: true });
  }
  if (top && sentinel && 'IntersectionObserver' in window){
    new IntersectionObserver(
      ([e]) => top.classList.toggle('stuck', !e.isIntersecting),
      { threshold: 0 }
    ).observe(sentinel);
  }

  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.top-nav a[href]').forEach(a => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
}

/* ================= дуги в герої ================= */
/* Кільця трохи йдуть за курсором. Значення пишемо в CSS-змінні через
   requestAnimationFrame, щоб не смикати layout на кожен рух миші. */
function initHeroArcs(){
  const hero = $('.hero'), arcs = $('#heroArcs');
  if (!hero || !arcs) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let raf = 0, x = 0, y = 0;
  const apply = () => {
    arcs.style.setProperty('--mx', x.toFixed(1) + 'px');
    arcs.style.setProperty('--my', y.toFixed(1) + 'px');
    raf = 0;
  };
  hero.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = hero.getBoundingClientRect();
    x = ((e.clientX - r.left) / r.width  - .5) * 44;
    y = ((e.clientY - r.top)  / r.height - .5) * 30;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { x = 0; y = 0; if (!raf) raf = requestAnimationFrame(apply); });
}

/* ================= поява при скролі ================= */
function initReveal(){
  const els = $$('.rv, .step');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)){ els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  els.forEach(e => io.observe(e));
}

/* ================= картки ================= */
function cardHTML(a, extra = ''){
  return `
  <a class="card" href="apartment.html?id=${a.id}" data-id="${a.id}">
    <div class="card-ph">
      <img src="${a.photos[0]}" alt="${esc(a.name)}, ${esc(a.area)}" loading="lazy">
      <span class="card-badge">${esc(a.area)}</span>${extra}
    </div>
    <div class="card-body">
      <h3>${esc(a.name)}</h3>
      <p class="card-loc">${icon('map-pin')}${esc(a.area)}</p>
      <p class="card-meta">${a.guests} ${plural(a.guests, ['гість','гості','гостей'])}, ${a.bedrooms} ${plural(a.bedrooms, ['спальня','спальні','спалень'])}</p>
      <div class="card-foot">
        <p class="card-price"><b>${a.price} EUR</b> <span>/ ніч</span></p>
        <span class="card-cta">Детальніше</span>
      </div>
    </div>
  </a>`;
}

function miniHTML(a){
  const n = nights();
  return `
  <a class="mini" href="apartment.html?id=${a.id}">
    <div class="mini-ph"><img src="${a.photos[0]}" alt="${esc(a.name)}" loading="lazy"></div>
    <div class="mini-b">
      <h4>${esc(a.name)}</h4>
      <em>${icon('map-pin')}${esc(a.area)}</em>
      <div class="mini-f">
        <span><b>${a.price} EUR</b> <small>/ ніч</small></span>
        <s>${n ? `${n * a.price + CLEANING} EUR разом` : `${a.guests} ${plural(a.guests, ['гість','гості','гостей'])}`}</s>
      </div>
    </div>
  </a>`;
}

/* ================= селект ================= */
function dressSelect(el, options, onPick){
  if (!el) return;
  const cur = () => (options.find(o => o[0] === el.dataset.value) || options[0])[1];
  el.innerHTML = `
    <button type="button" class="sel-btn"><span class="sel-v">${esc(cur())}</span>${icon('caret-down')}</button>
    <div class="sel-list" hidden>${options.map(o => `
      <button type="button" data-v="${esc(o[0])}" aria-selected="${o[0] === el.dataset.value}">
        <i>${icon('check')}</i>${esc(o[1])}
      </button>`).join('')}</div>`;
  const btn = el.querySelector('.sel-btn'), list = el.querySelector('.sel-list');
  btn.onclick = e => {
    e.stopPropagation();
    const willOpen = list.hidden;
    closeAllPopovers();
    list.hidden = !willOpen;
    el.classList.toggle('open', willOpen);
  };
  list.onclick = e => e.stopPropagation();
  list.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    setSelect(el, b.dataset.v, options);
    list.hidden = true; el.classList.remove('open');
    onPick(b.dataset.v);
  });
}
function setSelect(el, value, options){
  el.dataset.value = value;
  el.querySelector('.sel-v').textContent = (options.find(o => o[0] === value) || options[0])[1];
  el.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.v === value)));
}
function closeAllPopovers(){
  $$('.sel-list').forEach(l => { l.hidden = true; l.parentElement.classList.remove('open'); });
  $$('.dock-sheet').forEach(d => { d.hidden = true; d.parentElement.querySelector('.dock-call').setAttribute('aria-expanded', 'false'); });
  $$('.cal').forEach(c => c.remove());
}
addEventListener('click', () => closeAllPopovers());
addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPopovers(); });

/* ================= календар діапазону ================= */
const MONTHS = ['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'];
const DOW = ['пн','вт','ср','чт','пт','сб','нд'];
const addM = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isBooked = (day, booked) => booked.some(([b, e]) => day >= b && day < e);
/* між обраними датами не має бути жодного зайнятого дня */
const rangeClean = (a, b, booked) => {
  for (let d = new Date(a); iso(d) < b; d.setDate(d.getDate() + 1)) if (isBooked(iso(d), booked)) return false;
  return true;
};

function openCal(host, booked, onChange, opts = {}){
  const already = host.querySelector('.cal');
  closeAllPopovers();
  if (already) return;
  const cal = document.createElement('div');
  cal.className = 'cal' + (opts.right ? ' right' : '') + (opts.up ? ' up' : '');
  cal.onclick = e => e.stopPropagation();
  let base = new Date((S.in || today).slice(0, 7) + '-01');

  const monthHTML = d => {
    const y = d.getFullYear(), m = d.getMonth();
    const shift = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const canPrev = `${y}-${String(m + 1).padStart(2, '0')}` > today.slice(0, 7);
    let cells = '';
    for (let i = 0; i < shift; i++) cells += '<span></span>';
    for (let n = 1; n <= days; n++){
      const day = `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const taken = isBooked(day, booked), off = day < today || taken;
      const isA = day === S.in, isB = day === S.out;
      const mid = S.in && S.out && day > S.in && day < S.out;
      const cls = [(isA || isB) ? 'edge' : '', mid ? 'mid' : '', taken ? 'taken' : '',
                   (isA && S.out) ? 'a' : '', isB ? 'b' : '', (isA && !S.out) ? 'solo' : ''].filter(Boolean).join(' ');
      cells += `<button type="button" class="cal-d ${cls}" data-d="${day}"${off ? ' disabled' : ''}>${n}</button>`;
    }
    return `<div class="cal-m">
      <div class="cal-h">
        <button type="button" class="cal-nav" data-nav="-1"${canPrev ? '' : ' disabled'} aria-label="Попередній місяць">‹</button>
        <b>${MONTHS[m]} ${y}</b>
        <button type="button" class="cal-nav" data-nav="1" aria-label="Наступний місяць">›</button>
      </div>
      <div class="cal-g">${DOW.map(x => `<em>${x}</em>`).join('')}${cells}</div>
    </div>`;
  };

  function paint(){
    cal.innerHTML = monthHTML(base) + monthHTML(addM(base, 1)) +
      `<div class="cal-f">
         <span class="cal-legend"><s></s> закреслені дати зайняті</span>
         <button type="button" class="cal-clear">Очистити</button>
       </div>`;
    cal.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { base = addM(base, +b.dataset.nav); paint(); });
    cal.querySelector('.cal-clear').onclick = () => { S.in = ''; S.out = ''; saveState(); onChange(false); paint(); };
    cal.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
      const d = b.dataset.d;
      if (!S.in || S.out || d <= S.in || !rangeClean(S.in, d, booked)) { S.in = d; S.out = ''; }
      else { S.out = d; }
      saveState();
      const complete = !!(S.in && S.out);
      if (complete) cal.remove();
      onChange(complete);
      if (!complete) paint();
    });
  }
  paint();
  host.appendChild(cal);
}

/* ================= рядок пошуку ================= */
const guestWord = n => `${n} ${plural(n, ['людина','людини','людей'])}`;
function labelDate(el, v){ if (!el) return; el.textContent = v ? fmt(v) : 'Оберіть дату'; el.classList.toggle('ph', !v); }

/* onSearch викликається кнопкою "Знайти"; onChange - будь-якою зміною полів */
function initSearchbar({ onSearch, onChange } = {}){
  const box = $('#sbIn');
  if (!box) return;
  const sync = () => {
    labelDate($('#fIn'), S.in);
    labelDate($('#fOut'), S.out);
    const g = $('#fGuests'); if (g) g.textContent = guestWord(S.guests);
  };
  const openTop = e => {
    e.stopPropagation();
    openCal(box, [], () => { sync(); onChange && onChange(); });
  };
  $('#fIn').onclick = openTop;
  $('#fOut').onclick = openTop;
  $$('[data-g]').forEach(b => b.onclick = () => {
    S.guests = Math.min(10, Math.max(1, S.guests + (+b.dataset.g)));
    saveState(); sync(); onChange && onChange();
  });
  const type = $('#fType');
  if (type){
    type.dataset.value = S.type;
    dressSelect(type, [['', 'Будь-який'], ...APT_TYPES], v => {
      S.type = v; saveState(); onChange && onChange();
    });
  }
  const area = $('#fArea');
  if (area){
    area.dataset.value = S.area;
    dressSelect(area, [['', 'Будь-який'], ...AREAS.map(a => [a, a])], v => {
      S.area = v; saveState(); onChange && onChange();
    });
  }
  const go = $('#btnSearch');
  if (go) go.onclick = () => onSearch ? onSearch() : (location.href = 'catalog.html');
  sync();
}

/* ================= флоу бронювання ================= */
/* Крок 1 контакти, крок 2 авто, крок 3 підтвердження. Живе в <dialog id="dlg">. */
function openBooking(apt, car){
  S.apt = apt || null; S.car = car || null;
  if (!$('#dlg')){
    const d = document.createElement('dialog');
    d.id = 'dlg';
    d.innerHTML = '<div class="sheet" id="sheet"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  }
  stepContacts();
  const dlg = $('#dlg');
  if (!dlg.open) dlg.showModal();
  $('#sheet').scrollTop = 0;
}
const closeBooking = () => $('#dlg') && $('#dlg').close();

function recapRows(){
  const a = S.apt, n = nights();
  const rows = a ? [
    ['Апартаменти', `${a.name}, ${a.area}`],
    ['Дати', n ? `${fmt(S.in)} - ${fmt(S.out)} · ${n} ${plural(n, ['ніч','ночі','ночей'])}` : 'уточнимо в розмові'],
    ['Кількість людей', String(S.guests)]
  ] : [['Послуга', 'Оренда авто']];
  if (a && n) rows.push(['Житло', `${n * a.price + CLEANING} EUR`]);
  return rows;
}
const recapHTML = () => `<div class="recap">${recapRows().map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
const closeBtn = () => `<button class="x" type="button" data-close aria-label="Закрити">✕</button>`;

function wireClose(){ $$('[data-close]').forEach(b => b.onclick = closeBooking); }

function stepContacts(){
  const a = S.apt;
  $('#sheet').innerHTML = `
    ${closeBtn()}
    <div class="flow">
      <div class="flow-steps"><i class="on"></i><i></i><i></i></div>
      <h2>Куди передзвонити?</h2>
      <p class="sub">${a ? 'Менеджер підтвердить, що апартаменти вільні саме на ці дати, і відповість на питання.'
                        : 'Менеджер підтвердить наявність авто на ці дати й узгодить місце подачі.'} Дзвінок протягом години в робочий час.</p>
      ${recapHTML()}
      <div class="f2">
        <div class="fld" id="wName"><label for="bName">Ім'я</label><input id="bName" autocomplete="name" placeholder="Оксана"></div>
        <div class="fld" id="wPhone"><label for="bPhone">Телефон або Telegram</label><input id="bPhone" autocomplete="tel" placeholder="+380 __ ___ __ __"></div>
      </div>
      <div class="fld"><label for="bNote">Побажання (не обовʼязково)</label><textarea id="bNote" placeholder="Летимо з дитиною, потрібне дитяче ліжечко"></textarea></div>
      <div class="row-end">
        <button class="btn btn-ghost" type="button" data-close>Скасувати</button>
        <button class="btn btn-accent" type="button" id="next1">Далі</button>
      </div>
    </div>`;
  wireClose();
  $('#next1').onclick = () => {
    const name = $('#bName').value.trim(), phone = $('#bPhone').value.trim();
    const bad = f => { const w = $('#w' + f); w.classList.add('bad');
      if (!w.querySelector('.err')) w.insertAdjacentHTML('beforeend', '<span class="err">Заповніть це поле</span>');
      w.querySelector('input').focus(); };
    $('#wName').classList.remove('bad'); $('#wPhone').classList.remove('bad');
    if (!name) return bad('Name');
    if (!phone) return bad('Phone');
    S.name = name; S.phone = phone; S.note = $('#bNote').value.trim();
    stepCars();
  };
}

function stepCars(){
  const n = nights();
  $('#sheet').innerHTML = `
    ${closeBtn()}
    <div class="flow">
      <div class="flow-steps"><i class="on"></i><i class="on"></i><i></i></div>
      <h2>${S.apt ? 'Додати авто на ці ж дати?' : 'Яке авто вам потрібне?'}</h2>
      <p class="sub">Машина чекатиме в аеропорту в день прильоту, документи готуємо заздалегідь. Без авто половина острова залишиться недоступною.</p>
      <div class="cars">${CARS.map(c => `
        <button class="car${S.car && S.car.id === c.id ? ' sel' : ''}" type="button" data-car="${c.id}">
          <span class="car-ph"><img src="${c.photo}" alt="${esc(c.name)}" loading="lazy"></span>
          <span class="car-b">
            <h4>${esc(c.name)}</h4><em>${esc(c.model)}</em>
            <p>${esc(c.note)}</p>
            <p class="spec">${esc(c.bags)} · ${c.gear.toLowerCase()}</p>
            <span class="pr"><b>${c.price} EUR <i>/ день</i></b><small>${n ? `${c.price * n} EUR` : ''}</small></span>
          </span>
        </button>`).join('')}</div>
      <div class="row-end">
        <button class="btn btn-ghost" type="button" id="skipCar">${S.apt ? 'Поки без авто' : 'Пропустити'}</button>
        <button class="btn btn-accent" type="button" id="next2">Готово</button>
      </div>
    </div>`;
  wireClose();
  $$('.car').forEach(el => el.onclick = () => {
    $$('.car').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
    S.car = CARS.find(c => c.id === el.dataset.car);
  });
  $('#skipCar').onclick = () => { S.car = null; stepDone(); };
  $('#next2').onclick = stepDone;
}

function stepDone(){
  const a = S.apt, n = nights();
  const rows = recapRows();
  if (S.car) rows.push(['Авто', `${S.car.name}${n ? ` · ${S.car.price * n} EUR` : ''}`]);
  rows.push(['Контакт', `${S.name}, ${S.phone}`]);
  const value = (a && n ? n * a.price + CLEANING : 0) + (S.car && n ? S.car.price * n : 0);
  const id = Date.now().toString().slice(-6);
  const text = ['Заявка з сайту SVOYI', `№ ${id}`, ...rows.map(r => `${r[0]}: ${r[1]}`),
                S.note ? `Побажання: ${S.note}` : ''].filter(Boolean).join('\n');
  try { sessionStorage.setItem('svoyi_order', JSON.stringify({ id, rows, text, value })); } catch {}
  location.href = `thanks.html?id=${id}&value=${value}&type=${a ? 'apartment' : 'car'}`;
}

/* ================= форма заявки на головній ================= */
function initLeadForm(){
  const f = $('#leadForm');
  if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ['lName', 'lPhone'].forEach(id => {
      const inp = $('#' + id), w = inp.closest('.fld');
      w.classList.remove('bad');
      w.querySelectorAll('.err').forEach(x => x.remove());
      if (!inp.value.trim()){
        ok = false;
        w.classList.add('bad');
        w.insertAdjacentHTML('beforeend', '<span class="err">Заповніть це поле</span>');
      }
    });
    if (!ok){ f.querySelector('.bad input').focus(); return; }
    /* Тут місце для відправки на бекенд або в Telegram-бота.
       Зараз заявка лише зберігається локально, щоб нічого не загубилось. */
    const payload = {
      service: f.dataset.service || 'Підбір житла',
      name: $('#lName').value.trim(), phone: $('#lPhone').value.trim(),
      tickets: (f.querySelector('[name="tickets"]:checked') || {}).value || '',
      note: $('#lNote') ? $('#lNote').value.trim() : '', at: new Date().toISOString()
    };
    try {
      const all = JSON.parse(localStorage.getItem('svoyi_leads') || '[]');
      all.push(payload);
      localStorage.setItem('svoyi_leads', JSON.stringify(all));
    } catch {}
    f.innerHTML = `<div class="form-ok"><b>Заявку прийнято.</b> Менеджер передзвонить протягом години в робочий час.</div>
      <p class="form-note">Якщо питання термінове, телефонуйте одразу: <a href="${CONTACTS.phone()[0]}">${esc(SET.phoneLabel)}</a></p>`;
  });
}

/* ================= старт ================= */
/* скрипти стоять у кінці <body>, тож розмітка вже є: тексти ставимо одразу,
   до першого малювання, щоб не блимали */
applyContent();
initDock();
document.addEventListener('DOMContentLoaded', () => {
  initChrome();
  initReveal();
  initHeroArcs();
  initLeadForm();
});
