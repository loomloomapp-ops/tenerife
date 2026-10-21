/* Сторінка групового туру (tour-tenerife.html).
   Дані з TOUR (js/tour-data.js), спільні помічники ($, esc, icon, rich, plural, CONTACTS, SET) з core.js.
   Скрипт стоїть у кінці <body>, тож усе малюємо одразу, до DOMContentLoaded:
   тоді initReveal із core.js підхоплює й намальовані тут .rv */

/* ?draft показує заглушки для даних, яких ще немає. Відвідувачі їх не бачать */
const DRAFT = new URLSearchParams(location.search).has('draft');
const pending = what => DRAFT ? `<span class="tr-todo">Чекаємо від клієнта: ${esc(what)}</span>` : '';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const period = d => `${d.from}–${d.to}${d.year ? `.${d.year}` : ''}`;
const dateLabel = d => `${d.from}–${d.to}`;

/* картинка з варіантом для телефона. Розміри задані в CSS через aspect-ratio, тож макет не стрибає */
function pic(p, { sizes = '(max-width: 900px) 100vw, 50vw', eager = false, cls = '' } = {}){
  if (!p) return '';
  const srcset = p.sm ? ` srcset="${esc(p.sm)} 720w, ${esc(p.src)} 1400w" sizes="${sizes}"` : '';
  return `<img class="${cls}" src="${esc(p.src)}"${srcset} alt="${esc(p.alt || '')}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}${p.pos ? ` style="object-position:${esc(p.pos)}"` : ''}>`;
}
const fig = (p, cls = '', opts) => `<figure class="tr-ph tr-rv ${cls}">${pic(p, opts)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}${p.temp ? pending('фото для цього дня') : ''}</figure>`;

/* ================= перший екран ================= */
(function hero(){
  const h = TOUR.hero;
  $('#trLede').textContent = h.lede;
  $('#trHeroCredit').innerHTML = rich(h.credit);
  const facts = [
    [`${TOUR.days}`, 'днів'],
    [`до ${TOUR.groupMax}`, 'учасників'],
    [`від ${TOUR.price} €`, `з особи · двомісне розміщення`]
  ];
  $('#trHeroFacts').innerHTML = facts.map(([b, s], i) =>
    `<li class="tr-h-a" style="--i:${5 + i * .6}"><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('');

  const v = $('#trVideo');
  /* без руху або з економією трафіку лишаємо заставку, відео не вантажимо */
  const save = navigator.connection && navigator.connection.saveData;
  if (RM || save){ v.removeAttribute('autoplay'); v.preload = 'none'; v.pause(); return; }
  /* якщо відео не стартувало (iOS у режимі енергозбереження), лишається заставка, не чорний екран */
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
})();

/* ================= про острів ================= */
(function about(){
  const a = TOUR.about;
  $('#trAboutTitle').textContent = a.title;
  $('#trAboutText').textContent = a.text;
  $('#trAboutPh').innerHTML = `
    <div class="tr-ph tr-rv tr-about-main">${pic(a.image, { sizes: '(max-width: 900px) 100vw, 46vw' })}</div>
    ${a.image2 ? `<div class="tr-ph tr-rv tr-about-sm">${pic(a.image2, { sizes: '(max-width: 900px) 40vw, 18vw' })}</div>` : ''}`;
  $('#trFeats').innerHTML = a.features.map((f, i) =>
    `<li class="tr-rv" style="--d:${i * .08}s"><em>${String(i + 1).padStart(2, '0')}</em><span>${esc(f)}</span></li>`).join('');
})();

/* ================= коротко про тур ================= */
(function overview(){
  const stats = [
    ['Тривалість', TOUR.days, plural(TOUR.days, ['день', 'дні', 'днів'])],
    ['Учасники', `до ${TOUR.groupMax}`, 'осіб'],
    ['Вартість', `${TOUR.price} €`, 'з особи'],
    ['Розміщення', 'Двомісне', '']
  ];
  $('#trStats').innerHTML = stats.map(([k, v, u], i) =>
    `<div class="tr-rv${/\d/.test(String(v)) ? '' : ' is-word'}" style="--d:${i * .08}s"><dt>${esc(k)}</dt><dd><b>${esc(String(v))}</b>${u ? ` <span>${esc(u)}</span>` : ''}</dd></div>`).join('');
  $('#trOverText').textContent = TOUR.overview.text;
  $('#trOverText2').textContent = TOUR.overview.text2;
})();

/* ================= дати ================= */
(function dates(){
  $('#trDatesNote').innerHTML = `<b>${TOUR.price} €</b> ${esc(TOUR.priceNote)}`;
  const row = (d, i) => `
    <article class="tr-drow tr-rv" style="--d:${i * .08}s">
      <span class="tr-dnum">${String(i + 1).padStart(2, '0')}</span>
      <div class="tr-dper">
        <small>${esc(d.label)}${d.year ? ` ${esc(d.year)}` : ''}</small>
        <b>${esc(d.from)}<i>—</i>${esc(d.to)}</b>
        ${!d.year ? pending('рік проведення') : ''}
      </div>
      <ul class="tr-dmeta">
        <li>${icon('calendar')}${TOUR.days} ${plural(TOUR.days, ['день', 'дні', 'днів'])}</li>
        <li>${icon('wallet')}${TOUR.price} € з особи</li>
        <li>${icon('users')}до ${TOUR.groupMax} учасників</li>
      </ul>
      ${d.available ? '<span class="tr-dstat">Є місця</span>' : ''}
      <a class="btn btn-accent tr-dbtn" href="#book" data-tr-book="${esc(d.id)}">Уточнити наявність місць ${icon('arrow-right')}</a>
    </article>`;
  $('#trDates').innerHTML = TOUR.dates.map(row).join('') + `
    <article class="tr-drow tr-drow-other tr-rv" style="--d:${TOUR.dates.length * .08}s">
      <span class="tr-dnum">${icon('compass')}</span>
      <div class="tr-dper"><small>Свої дати</small><b>${esc(TOUR.otherDates)}</b></div>
      <p class="tr-dmeta-p">Збираєте свою компанію або не підходять дати групи? Напишіть, коли зручно</p>
      <a class="btn btn-ghost tr-dbtn" href="#book" data-tr-book="other">Запитати іншу дату ${icon('arrow-right')}</a>
    </article>`;
})();

/* ================= програма ================= */
function dayHTML(d, i){
  const n = String(d.number).padStart(2, '0');
  const text = [
    d.intro ? `<p class="tr-day-intro">${esc(d.intro)}</p>` : '',
    ...(d.description || []).map((p, j) => `<p class="${j === 0 ? 'tr-day-lead' : ''}">${esc(p)}</p>`),
    (d.sections || []).length ? `<dl class="tr-day-secs">${d.sections.map(s =>
      `<div><dt>${esc(s.title)}</dt><dd>${esc(s.text)}</dd></div>`).join('')}</dl>` : '',
    d.list ? `<div class="tr-day-list"><b>${esc(d.list.title)}</b><ul>${d.list.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '',
    d.after ? `<p>${esc(d.after)}</p>` : ''
  ].join('');
  const extra = d.extraInfo ? `<aside class="tr-day-extra"><b>${esc(d.extraInfo.title)}</b><span>${esc(d.extraInfo.text)}</span></aside>` : '';
  const sched = d.schedule ? `<p class="tr-day-time">${icon('clock')}<span>${esc(d.schedule[0])}</span><b>${esc(d.schedule[1])}</b></p>` : '';
  const imgs = d.images || [];
  const media = imgs.length
    ? `<div class="tr-day-media tr-m${Math.min(imgs.length, 3)}">${imgs.slice(0, 3).map((p, j) =>
        fig(p, j === 0 ? 'tr-ph-main' : 'tr-ph-sub', { sizes: j === 0 ? '(max-width: 900px) 100vw, 52vw' : '(max-width: 900px) 50vw, 24vw' })).join('')}</div>`
    : `<div class="tr-day-media tr-m0">${pending('фото для цього дня')}</div>`;
  return `
  <article class="tr-day${i % 2 ? ' is-flip' : ''}" id="${esc(d.id)}" aria-labelledby="${esc(d.id)}-h">
    <header class="tr-day-h">
      <span class="tr-day-n" aria-hidden="true"><small>День</small>${n}</span>
      <h3 id="${esc(d.id)}-h"><span class="sr">День ${d.number}: </span>${esc(d.title).replace(/\n/g, '<br>')}</h3>
      ${sched}
    </header>
    ${media}
    <div class="tr-day-txt">${text}${extra}</div>
  </article>`;
}

(function program(){
  const P = TOUR.program;
  $('#trProgTitle').textContent = P.title;
  $('#trProgText').textContent = P.text;
  $('#trDays').innerHTML = P.items.map(dayHTML).join('');
  $('#trDayNav').insertAdjacentHTML('afterbegin', `<div class="tr-daynav-in">${P.items.map(d =>
    `<a href="#${esc(d.id)}"><b>${String(d.number).padStart(2, '0')}</b><span>${esc(d.title.split(/[\n.:—!]/)[0].trim())}</span></a>`).join('')}</div>`);
})();

/* ================= панорама ================= */
(function brk(){
  const b = TOUR.break;
  $('#trBreakH').textContent = b.title;
  $('#trBreakPh').innerHTML = `<img src="${esc(b.image.src)}" srcset="${esc(b.image.sm)} 1000w, ${esc(b.image.src)} 1920w" sizes="100vw" alt="${esc(b.image.alt)}" loading="lazy" decoding="async">`;
  $('#trBreakCredit').innerHTML = rich(b.credit);
})();

/* ================= проживання ================= */
(function stay(){
  const s = TOUR.stay;
  const t = $('#trStayText');
  t.innerHTML = [s.lede, s.text].filter(Boolean).map(rich).join('<br><br>') + (s.text ? '' : pending('опис апартаментів'));
  t.hidden = !t.innerHTML;
  $('#trStayFacts').innerHTML = s.facts.map((f, i) =>
    `<div class="tr-rv" style="--d:${i * .08}s">${icon(f.icon)}<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')
    + (DRAFT ? s.pendingFacts.map(f => `<div class="is-todo">${icon('check')}<dt>${esc(f)}</dt><dd>${pending('дані')}</dd></div>`).join('') : '');
  const g = $('#trStayGal');
  if (s.gallery.length) g.innerHTML = s.gallery.slice(0, 4).map(p => fig(p, '', { sizes: '(max-width: 900px) 50vw, 25vw' })).join('');
  else if (DRAFT) g.innerHTML = [1, 2, 3].map(() => `<div class="tr-ph tr-ph-empty">${pending('фото апартаментів')}</div>`).join('');
  g.hidden = !g.innerHTML;
})();

/* ================= що входить ================= */
(function included(){
  const c = TOUR.included;
  const col = (title, cls, ic, list, empty) => `
    <div class="tr-incl-col ${cls} tr-rv">
      <h3>${esc(title)}</h3>
      ${list.length ? `<ul>${list.map(x => `<li>${icon(ic)}<span>${esc(x)}</span></li>`).join('')}</ul>`
                    : `<p class="tr-incl-empty">${esc(empty)}</p>${pending('повний перелік послуг')}`}
    </div>`;
  $('#trIncl').innerHTML = col('Входить у вартість', 'is-in', 'check', c.in, c.inEmpty)
    + col('Оплачується окремо', 'is-out', 'wallet', c.out, '');
})();

/* ================= умови бронювання ================= */
(function terms(){
  const items = TOUR.terms.items.filter(t => t.text || DRAFT);
  $('#terms').hidden = !items.length;
  $('#trTerms').innerHTML = items.map((t, i) => `
    <li class="tr-rv" style="--d:${(i % 3) * .08}s"><em class="num">${String(i + 1).padStart(2, '0')}</em><h3>${esc(t.title)}</h3>
      ${t.text ? `<p>${rich(t.text)}</p>` : pending('умови')}</li>`).join('');
})();

/* ================= FAQ =================
   Висота відкриття анімується через grid-template-rows 0fr → 1fr: без вимірювань і стрибків */
(function faq(){
  const items = TOUR.faq.items.filter(f => f.a || DRAFT);
  $('#faq').hidden = !items.length;
  const box = $('#trFaq');
  box.innerHTML = items.map((f, i) => `
    <div class="tr-acc-i tr-rv" style="--d:${Math.min(i, 5) * .05}s">
      <h3><button type="button" id="faq-b${i}" aria-expanded="false" aria-controls="faq-p${i}">
        <span>${esc(f.q)}</span><i aria-hidden="true"></i></button></h3>
      <div class="tr-acc-p" id="faq-p${i}" role="region" aria-labelledby="faq-b${i}" inert>
        <div><p>${f.a ? rich(f.a) : pending('відповідь')}</p></div>
      </div>
    </div>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button[aria-controls]');
    if (!b) return;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    const p = document.getElementById(b.getAttribute('aria-controls'));
    p.classList.toggle('open', open);
    p.inert = !open;
  });
})();

/* ================= заявка ================= */
(function bookForm(){
  const f = $('#trForm');
  $('#trFormText').textContent = TOUR.form.text;
  $('#trBookSum').innerHTML = [
    ['Тривалість', `${TOUR.days} ${plural(TOUR.days, ['день', 'дні', 'днів'])}`],
    ['Група', `до ${TOUR.groupMax} осіб`],
    ['Вартість', `${TOUR.price} € ${TOUR.priceNote}`]
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  const opts = [...TOUR.dates.map(d => [d.id, dateLabel(d)]), ['other', 'Інші дати']];
  $('#tDates').innerHTML = opts.map(([v, t]) =>
    `<label><input type="radio" name="date" value="${esc(v)}"><span>${esc(t)}</span></label>`).join('');
  const otherW = $('#tOtherW');
  const pickDate = v => {
    const r = f.querySelector(`[name="date"][value="${CSS.escape(v)}"]`);
    if (r) r.checked = true;
    otherW.hidden = v !== 'other';
    clearErr($('#tDateF'));
  };
  f.addEventListener('change', e => { if (e.target.name === 'date') pickDate(e.target.value); });

  /* кнопки біля дат і заклики «Забронювати» відкривають заявку у вікні й підставляють дату.
     Сторінка під вікном не прокручується, після закриття людина там, де й була */
  const dlg = $('#book');
  const openDlg = date => {
    if (date) pickDate(date);
    if (!dlg.open){ dlg.showModal(); document.documentElement.classList.add('tr-lock'); }
    $('.tr-dlg-in', dlg).scrollTop = 0;
    $('#tName').focus({ preventScroll: true });
  };
  dlg.addEventListener('close', () => document.documentElement.classList.remove('tr-lock'));
  $$('[data-dlg-close]', dlg).forEach(b => b.onclick = () => dlg.close());
  /* клік по затемненню поза вікном закриває його */
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-tr-book]');
    if (!a) return;
    e.preventDefault();
    openDlg(a.dataset.trBook);
  });
  /* вікно відкривається лише кнопкою. Старий #book в адресі (його ставила попередня версія сторінки)
     прибираємо, щоб не заважав */
  if (location.hash === '#book') history.replaceState(null, '', location.pathname + location.search);

  let guests = 2;
  const gOut = $('#tGuests');
  const syncG = () => { gOut.textContent = `${guests} ${plural(guests, ['учасник', 'учасники', 'учасників'])}`; };
  f.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => {
    guests = Math.min(TOUR.groupMax, Math.max(1, guests + (+b.dataset.tg)));
    syncG();
  });
  syncG();

  function setErr(w, msg){
    w.classList.add('bad');
    if (!w.querySelector('.err')) w.insertAdjacentHTML('beforeend', `<span class="err">${esc(msg)}</span>`);
  }
  function clearErr(w){ w.classList.remove('bad'); w.querySelectorAll('.err').forEach(x => x.remove()); }
  ['tName', 'tPhone', 'tOther'].forEach(id => $('#' + id).addEventListener('input', e => clearErr(e.target.closest('.fld'))));

  function validate(){
    let first = null;
    const fail = (w, msg, focusEl) => { setErr(w, msg); first = first || focusEl; };
    [...f.querySelectorAll('.fld')].forEach(clearErr);
    const name = $('#tName'), phone = $('#tPhone');
    if (!name.value.trim()) fail(name.closest('.fld'), 'Вкажи, як до тебе звертатися', name);
    const digits = phone.value.replace(/\D/g, '');
    if (!digits) fail(phone.closest('.fld'), 'Вкажи номер телефону', phone);
    else if (digits.length < 9 || digits.length > 15) fail(phone.closest('.fld'), 'Перевір номер: бракує цифр', phone);
    const date = f.querySelector('[name="date"]:checked');
    if (!date) fail($('#tDateF'), 'Обери дату туру', f.querySelector('[name="date"]'));
    else if (date.value === 'other' && !$('#tOther').value.trim()) fail(otherW, 'Напиши, які дати зручні', $('#tOther'));
    if (first) first.focus();
    return !first;
  }

  function payload(){
    const d = f.querySelector('[name="date"]:checked').value;
    const dt = TOUR.dates.find(x => x.id === d);
    const tg = $('#tTg').value.trim();
    return {
      service: 'Груповий тур', tour: TOUR.name,
      date: dt ? period(dt) : `Інші дати: ${$('#tOther').value.trim()}`,
      guests, name: $('#tName').value.trim(), phone: $('#tPhone').value.trim(),
      telegram: tg ? (tg.startsWith('@') || /^https?:/.test(tg) ? tg : '@' + tg) : '',
      note: $('#tNote').value.trim(), at: new Date().toISOString()
    };
  }
  const message = p => [
    `Заявка на тур «${p.tour}»`,
    `Дата: ${p.date}`, `Учасників: ${p.guests}`,
    `Імʼя: ${p.name}`, `Телефон: ${p.phone}`,
    p.telegram ? `Telegram: ${p.telegram}` : '', p.note ? `Коментар: ${p.note}` : ''
  ].filter(Boolean).join('\n');

  const msg = $('#tMsg'), btn = $('#tSubmit');
  const tgLink = p => `${SET.telegram || 'https://t.me/SVOYI_Tenerife'}?text=${encodeURIComponent(message(p))}`;
  const phoneLink = () => `<a href="${CONTACTS.phone()[0]}">${esc(SET.phoneLabel)}</a>`;
  let busy = false;

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !validate()) return;
    const p = payload();
    /* копія заявки лишається в браузері, як і на інших сторінках сайту */
    try {
      const all = JSON.parse(localStorage.getItem('svoyi_leads') || '[]');
      all.push(p); localStorage.setItem('svoyi_leads', JSON.stringify(all));
    } catch {}

    /* Сервера заявок поки немає, тож не вдаємо, що заявка вже в нас:
       людина бачить готовий текст і надсилає його в Telegram одним натиском */
    if (!TOUR.form.endpoint){
      f.classList.add('is-ready');
      msg.className = 'tr-form-msg is-ready';
      msg.innerHTML = `
        <b>Заявка готова, лишився один крок</b>
        <p>Натисни кнопку нижче: відкриється Telegram з уже заповненим повідомленням, його залишиться лише надіслати.</p>
        <pre>${esc(message(p))}</pre>
        <a class="btn btn-accent btn-block" href="${esc(tgLink(p))}" target="_blank" rel="noopener">${icon('telegram')}Надіслати в Telegram</a>
        <p class="form-note">Немає Telegram? Подзвони: ${phoneLink()}</p>
        <button class="tr-edit" type="button">Змінити дані</button>`;
      msg.querySelector('.tr-edit').onclick = () => { f.classList.remove('is-ready'); msg.className = 'tr-form-msg'; msg.innerHTML = ''; $('#tName').focus(); };
      msg.querySelector('a.btn').focus({ preventScroll: true });
      $('.tr-dlg-in', dlg).scrollTop = 0;
      return;
    }

    busy = true;
    btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = 'Надсилаємо…';
    msg.className = 'tr-form-msg'; msg.innerHTML = '';
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(TOUR.form.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p), signal: ctl.signal
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error(r.status);
      f.classList.add('is-ready');
      msg.className = 'tr-form-msg is-ok';
      msg.innerHTML = `<b>Заявку надіслано</b><p>Ми зв’яжемося з тобою, щоб розповісти всі деталі туру. Якщо питання термінове, телефонуй: ${phoneLink()}</p>`;
    } catch {
      msg.className = 'tr-form-msg is-err';
      msg.innerHTML = `<b>Не вдалося надіслати заявку</b><p>Спробуй ще раз або надішли її в <a href="${esc(tgLink(p))}" target="_blank" rel="noopener">Telegram</a> чи подзвони: ${phoneLink()}</p>`;
    } finally {
      busy = false;
      btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = 'Надіслати заявку';
    }
  });
})();

/* ================= фінал ================= */
(function finale(){
  const c = TOUR.final;
  $('#trFinalTitle').textContent = c.title;
  $('#trFinalText').textContent = c.text;
  $('#trFinalPh').innerHTML = pic(c.image, { sizes: '(max-width: 900px) 100vw, 1400px' });
})();

/* ================= рух ================= */
/* заголовки розбиваємо на слова, кожне виїжджає з-під маски з невеликою затримкою */
$$('.tr-split').forEach(h => {
  const lines = h.textContent.trim().split('\n').map(l => l.trim().split(/\s+/));
  h.setAttribute('aria-label', lines.map(l => l.join(' ')).join(' '));
  let i = 0;
  h.innerHTML = lines.map(l => l.map(w => `<span class="tr-w" aria-hidden="true"><span style="--w:${Math.min(i++, 10) * .045}s">${esc(w)}</span></span>`).join(' ')).join('<br>');
  h.classList.add('tr-rv');
});

document.addEventListener('DOMContentLoaded', () => {
  /* перший екран: класом запускаємо всю послідовність з CSS */
  requestAnimationFrame(() => $('#trHero').classList.add('is-in'));

  /* поява при скролі: кожен елемент анімується, коли сам заходить в екран */
  const els = $$('.tr-rv, .tr-day');
  if (!('IntersectionObserver' in window) || RM) els.forEach(e => e.classList.add('in'));
  else {
    /* фото до появи повністю закрите clip-path, і для IntersectionObserver воно нульової площі,
       тож за фото стежимо через батьківський блок */
    const groups = new Map();
    els.forEach(el => {
      const t = el.classList.contains('tr-ph') ? el.parentElement : el;
      groups.has(t) ? groups.get(t).push(el) : groups.set(t, [el]);
    });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      groups.get(e.target).forEach(el => el.classList.add('in'));
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: .08 });
    groups.forEach((_, t) => io.observe(t));
  }

  /* навігація по днях: підсвічуємо день, який зараз на екрані, і докручуємо смужку до нього */
  const nav = $('#trDayNav');
  if (nav && 'IntersectionObserver' in window){
    const links = $$('a', nav);
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => {
        const on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        $(a.getAttribute('href')).classList.toggle('is-cur', on);
        if (on){
          const box = a.parentElement;
          box.scrollTo({ left: a.offsetLeft - (box.clientWidth - a.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' });
        }
      });
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('.tr-day').forEach(d => spy.observe(d));

    /* тонка лінія під смужкою днів показує, яку частину програми вже прогорнуто */
    const days = $('#trDays');
    let praf = 0;
    const progress = () => {
      praf = 0;
      const r = days.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * .5 - r.top) / r.height));
      nav.style.setProperty('--p', p.toFixed(4));
    };
    addEventListener('scroll', () => { if (!praf) praf = requestAnimationFrame(progress); }, { passive: true });
    progress();
  }

  /* легкий паралакс фото: лише миша, широкий екран і без «зменшення руху».
     Рахуємо тільки видимі кадри, пишемо в CSS-змінну через requestAnimationFrame */
  if (RM || !matchMedia('(min-width: 901px) and (pointer: fine)').matches || !('IntersectionObserver' in window)) return;
  const live = new Set();
  const vis = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? live.add(e.target) : live.delete(e.target)));
  $$('.tr-par').forEach(el => vis.observe(el));
  let raf = 0;
  const tick = () => {
    raf = 0;
    const vh = innerHeight;
    live.forEach(el => {
      const r = el.getBoundingClientRect();
      const k = ((r.top + r.height / 2) - vh / 2) / vh;   /* -1…1 відносно центру екрана */
      el.style.setProperty('--py', (k * -40).toFixed(1) + 'px');
    });
  };
  addEventListener('scroll', () => { if (!raf && live.size) raf = requestAnimationFrame(tick); }, { passive: true });
  tick();
});
