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
