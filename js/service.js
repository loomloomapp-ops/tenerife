/* Сторінки послуг: оренда авто, трансфер, екскурсії, організація турів.
   Спільна частина (шапка, форма заявки) живе в core.js. */

/* ---------- автопарк на сторінці оренди ----------
   Горизонтальний слайдер, як апартаменти на головній. Список береться з CARS у js/data.js. Клік відкриває той самий флоу
   бронювання, що й на сторінці апартаментів, одразу з обраним авто. */
(function carList(){
  const box = $('#carList');
  if (!box) return;
  box.innerHTML = CARS.map(carCardHTML).join('');
  initSlider(box);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-car]');
    if (b) openBooking(null, CARS.find(c => c.id === b.dataset.car));
  });
})();

/* ---------- форма бронювання авто ----------
   Як пошук на головній, але під оренду: дати (один календар), авто, кількість людей,
   місце подачі. Кнопка відкриває той самий флоу бронювання з уже обраним авто. */
(function carBooking(){
  const box = $('#carIn'), sec = $('#carBook');
  if (!box || !sec || sec.hidden) return;
  const PLACES = [['', 'Узгодимо з менеджером'], ['Аеропорт Тенеріфе-Південь', 'Аеропорт Тенеріфе-Південь'],
                  ['Аеропорт Тенеріфе-Північ', 'Аеропорт Тенеріфе-Північ'], ['За адресою житла', 'За адресою житла']];
  const sync = () => {
    labelRange($('#cDates'));
    $('#cGuests').textContent = guestWord(S.guests);
  };
  const dates = $('#cDates');
  dates.onclick = e => { e.stopPropagation(); openCal(box, [], sync); };
  dates.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); dates.click(); } };
  $$('[data-cg]', box).forEach(b => b.onclick = () => {
    S.guests = Math.min(10, Math.max(1, S.guests + (+b.dataset.cg)));
    saveState(); sync();
  });
  const car = $('#cCar'), place = $('#cPlace');
  const CAR_OPTS = [['', 'Будь-яке'], ...CARS.map(c => [c.id, `${c.name}${c.year ? `, ${c.year}` : ''} · ${carPrice(c)} EUR / доба`])];
  dressSelect(car, CAR_OPTS, () => {});
  dressSelect(place, PLACES, () => {});
  /* клік по авто в автопарку вище підставляє його у форму */
  const list = $('#carList');
  if (list) list.addEventListener('click', e => {
    const b = e.target.closest('[data-car]');
    if (b) setSelect(car, b.dataset.car, CAR_OPTS);
  });
  $('#carGo').onclick = () => {
    S.carPlace = place.dataset.value || '';
    openBooking(null, CARS.find(c => c.id === car.dataset.value) || null);
  };
  /* головна кнопка першого екрана веде до цієї форми */
  const cta = $('.svc-acts [data-c="svc.cta"]');
  if (cta) cta.setAttribute('href', '#carBook');
  sync();
})();

/* ---------- наявні екскурсії ----------
   Слайдер карток з EXCURSIONS у js/data.js. Клік відкриває вікно з галереєю й повним описом,
   кнопка «Замовити» веде до заявки й підставляє назву екскурсії в поле побажань. */
(function excursions(){
  const box = $('#excList'), dlg = $('#excDlg');
  if (!box) return;
  const meta = e => [e.duration && `${icon('clock')}${esc(e.duration)}`, e.people && `${icon('users')}${esc(e.people)}`]
    .filter(Boolean).map(x => `<span>${x}</span>`).join('');
  box.innerHTML = EXCURSIONS.map(e => `
    <article class="card exc-card" data-exc="${e.id}">
      <div class="card-ph">
        <img src="${e.photos[0] || ''}" alt="${esc(e.title)}" loading="lazy">
        ${e.duration ? `<span class="card-badge">${esc(e.duration)}</span>` : ''}
      </div>
      <div class="card-body">
        <h3>${esc(e.title)}</h3>
        ${e.sub ? `<p class="card-loc">${icon('map-pin')}${esc(e.sub)}</p>` : ''}
        <p class="exc-intro">${esc(e.intro)}</p>
        <div class="card-foot">
          <p class="card-price">${e.price ? `<b>${esc(e.price)}</b>` : '<span>Ціну назве менеджер</span>'}</p>
          <button class="card-cta" type="button">Детальніше</button>
        </div>
      </div>
    </article>`).join('');
  initSlider(box);
  if (!dlg) return;

  const body = $('.exc-body', dlg);
  let cur = null;
  const show = (e, i = 0) => {
    const ph = e.photos;
    body.innerHTML = `
      <div class="exc-gal">
        <img class="exc-main" src="${ph[i]}" alt="${esc(e.title)}">
        ${ph.length > 1 ? `<div class="exc-thumbs">${ph.map((p, k) => `<button type="button" data-i="${k}"${k === i ? ' aria-current="true"' : ''} aria-label="Фото ${k + 1}"><img src="${p}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div class="exc-txt">
        <h2>${esc(e.title)}</h2>
        ${e.sub ? `<p class="exc-sub">${esc(e.sub)}</p>` : ''}
        <div class="exc-meta">${meta(e)}${e.price ? `<span>${icon('wallet')}${esc(e.price)}</span>` : ''}</div>
        <div class="exc-desc"><p class="exc-lead">${rich(e.intro)}</p>${richBlocks(e.body)}</div>
        <div class="exc-acts">
          <button class="btn btn-accent" type="button" data-exc-order>Замовити екскурсію</button>
          <a class="btn btn-ghost" href="${esc(SET.telegram || '#')}" target="_blank" rel="noopener">${icon('telegram')}Написати в Telegram</a>
        </div>
      </div>`;
  };
  const open = id => {
    cur = EXCURSIONS.find(e => e.id === id);
    if (!cur) return;
    show(cur); dlg.showModal(); $('.exc-in', dlg).scrollTop = 0;
  };
  box.addEventListener('click', e => {
    const c = e.target.closest('[data-exc]');
    if (c) open(c.dataset.exc);
  });
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('[data-exc-close]')) return dlg.close();
    const t = e.target.closest('[data-i]');
    if (t){
      const i = +t.dataset.i;
      $('.exc-main', dlg).src = cur.photos[i];
      $$('[data-i]', dlg).forEach(b => b.toggleAttribute('aria-current', b === t));
      return;
    }
    if (e.target.closest('[data-exc-order]')){
      dlg.close();
      const note = $('#lNote');
      if (note && !note.value.includes(cur.title)) note.value = `Екскурсія: ${cur.title}\n` + note.value;
      $('#order').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => note && note.focus({ preventScroll: true }), 600);
    }
  });
})();
