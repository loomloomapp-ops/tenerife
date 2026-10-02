/* Сторінки послуг: оренда авто, трансфер, екскурсії, організація турів.
   Спільна частина (шапка, форма заявки) живе в core.js. */

/* ---------- класи авто на сторінці оренди ----------
   Список береться з CARS у js/data.js. Клік відкриває той самий флоу
   бронювання, що й на сторінці апартаментів, одразу з обраним авто. */
(function carList(){
  const box = $('#carList');
  if (!box) return;
  box.innerHTML = CARS.map(c => `
    <button class="car" type="button" data-car="${c.id}">
      <span class="car-ph"><img src="${c.photo}" alt="${esc(c.name)}" loading="lazy"></span>
      <span class="car-b">
        <h4>${esc(c.name)}</h4><em>${esc(c.model)}</em>
        <p>${esc(c.note)}</p>
        <p class="spec">${c.seats} ${plural(c.seats, ['місце', 'місця', 'місць'])} · ${esc(c.bags)} · ${c.gear.toLowerCase()}</p>
        <span class="pr"><b>${c.price} EUR <i>/ день</i></b><small>Забронювати</small></span>
      </span>
    </button>`).join('');
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
  const CAR_OPTS = [['', 'Будь-яке'], ...CARS.map(c => [c.id, `${c.name} · ${c.price} EUR / день`])];
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
