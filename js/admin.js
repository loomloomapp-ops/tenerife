/* SVOYI Tenerife: адмінка (admin.html).

   Як це працює
   - Увесь контент сайту лежить у js/data.js як const SITE = {...}.
   - Адмінка завантажує цей файл із GitHub, дає його редагувати і під час публікації
     робить один коміт: новий js/data.js плюс завантажені фото й відео
     (images/uploads, media/uploads). Vercel помічає коміт і сам оновлює сайт.
   - Входи:
       server  пароль, запити до GitHub іде через api/admin.js, токен лишається на сервері;
       token   GitHub-токен прямо в браузері, якщо серверну частину ще не налаштовано;
       local   без публікації: редагування, перегляд і експорт data.js.
   - Незбережені зміни пишуться в localStorage, нові файли в IndexedDB, тож після
     перезавантаження сторінки нічого не губиться. */

'use strict';

/* ================= помічники ================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const SITE_ICONS = [...ICON_SPRITE.matchAll(/id=\\?"i-([\w-]+)\\?"/g)].map(m => m[1]);
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
/* службові лінійні іконки адмінки, 24×24 */
const UI = {
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4',
  gear: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM19.4 13.5l1.6 1.3-2 3.4-1.9-.8a7.4 7.4 0 0 1-2.2 1.3L14.6 21h-4l-.4-2.3A7.4 7.4 0 0 1 8 17.4l-1.9.8-2-3.4 1.6-1.3a7.6 7.6 0 0 1 0-3L4.1 9.2l2-3.4 1.9.8a7.4 7.4 0 0 1 2.2-1.3L10.6 3h4l.4 2.3a7.4 7.4 0 0 1 2.2 1.3l1.9-.8 2 3.4-1.6 1.3a7.6 7.6 0 0 1 0 3z',
  house: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01'
};
const ui = n => `<svg class="ui" viewBox="0 0 24 24" aria-hidden="true"><path d="${UI[n]}"/></svg>`;

/* кирилиця в латиницю для адрес сторінок: "Вілла Мар" -> "villa-mar" */
const TR = { а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ʼ:'','\'':'',ы:'y',э:'e',ё:'io',ъ:'' };
const slug = s => String(s || '').toLowerCase().split('').map(c => TR[c] ?? c).join('')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const uniqueId = (base, taken) => { let id = base || 'item', n = 2; while (taken.includes(id)) id = `${base}-${n++}`; return id; };

/* ================= стан ================= */
const A = {
  mode: null,        // server | token | local
  auth: '',          // токен сесії або GitHub-токен
  repo: 'loomloomapp-ops/tenerife',
  branch: 'main',
  data: null,        // робоча копія SITE
  published: '',     // JSON останньої опублікованої версії, щоб знати, чи є зміни
  base: null,        // sha файлу js/data.js, з якого почали редагування
  pending: {},       // нові файли: path -> { b64, type, size, url }
  busy: false
};
const LS = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del: k => { try { localStorage.removeItem(k); } catch {} }
};
const K_SESSION = 'svoyi_admin_session', K_DRAFT = 'svoyi_admin_draft';

/* ================= файли в IndexedDB ================= */
const idb = (() => {
  let db;
  const open = () => db || (db = new Promise((ok, fail) => {
    const r = indexedDB.open('svoyi_admin', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  }));
  const tx = async (mode, fn) => {
    const d = await open();
    return new Promise((ok, fail) => {
      const t = d.transaction('files', mode), s = t.objectStore('files');
      const res = fn(s);
      t.oncomplete = () => ok(res && res.result);
      t.onerror = () => fail(t.error);
    });
  };
  return {
    put: (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => {}),
    del: k => tx('readwrite', s => s.delete(k)).catch(() => {}),
    clear: () => tx('readwrite', s => s.clear()).catch(() => {}),
    all: async () => {
      try {
        const d = await open();
        return await new Promise(ok => {
          const out = {}, c = d.transaction('files').objectStore('files').openCursor();
          c.onsuccess = () => { const cur = c.result; if (cur){ out[cur.key] = cur.value; cur.continue(); } else ok(out); };
          c.onerror = () => ok(out);
        });
      } catch { return {}; }
    }
  };
})();

/* ================= GitHub ================= */
async function api(body, withAuth = true){
  const r = await fetch('api/admin', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(withAuth && A.auth ? { Authorization: 'Bearer ' + A.auth } : {}) },
    body: JSON.stringify(body)
  });
  let j = {};
  try { j = await r.json(); } catch {}
  if (r.status === 401 && withAuth && body.action !== 'login') sessionExpired();
  if (!r.ok) throw Object.assign(new Error(j.error || j.message || `Помилка сервера ${r.status}`), { status: r.status });
  return j;
}

function ghError(status, j){
  if (status === 401) return 'GitHub не прийняв токен. Перевірте, що він не прострочений.';
  if (status === 403 || status === 404) return 'У токена немає доступу до репозиторію або репозиторій указано неправильно.';
  if (status === 409 || status === 422) return 'На GitHub зʼявились новіші зміни. Спробуйте ще раз.';
  return (j && j.message) || `GitHub відповів помилкою ${status}`;
}

async function gh(method, path, body){
  if (A.mode === 'server'){
    try { return await api({ action: 'github', method, path, body }); }
    catch (e){ throw Object.assign(new Error(e.status && e.status !== 401 && e.status !== 403 && e.status !== 503 ? ghError(e.status, { message: e.message }) : e.message), { status: e.status }); }
  }
  if (A.mode === 'token'){
    const r = await fetch(`https://api.github.com/repos/${A.repo}${path}`, {
      method, cache: 'no-store',
      headers: {
        Authorization: `Bearer ${A.auth}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let j = {};
    try { j = await r.json(); } catch {}
    if (!r.ok) throw Object.assign(new Error(ghError(r.status, j)), { status: r.status });
    return j;
  }
  throw new Error('Це локальний режим без публікації.');
}

const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g, '')), c => c.charCodeAt(0)));
function bufToB64(buf){
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const DATA_HEAD = '/* SVOYI Tenerife: весь контент сайту в одному обʼєкті.\n   Файл перезаписує адмінка (admin.html) під час публікації. Правити вручну можна,\n   але формат має лишатися тим самим: const SITE = {JSON}; */\n';
const buildDataJs = d => `${DATA_HEAD}const SITE = ${JSON.stringify(d, null, 2)};\n`;
function parseDataJs(text){
  /* шукаємо саме рядок коду, бо в коментарі на початку файлу теж згадано const SITE */
  const m = /^const SITE\s*=\s*/m.exec(text);
  const a = m ? m.index + m[0].length : -1, b = text.lastIndexOf('}');
  if (a < 0 || text[a] !== '{' || b < a) throw new Error('Файл js/data.js має неочікуваний формат');
  return JSON.parse(text.slice(a, b + 1));
}

async function loadRemote(){
  const f = await gh('GET', `/contents/js/data.js?ref=${encodeURIComponent(A.branch)}`);
  const content = f.content ? f.content : (await gh('GET', `/git/blobs/${f.sha}`)).content;
  return { data: parseDataJs(b64ToText(content)), sha: f.sha };
}

/* Один коміт: data.js і всі нові файли, на які є посилання в даних */
async function publish(){
  if (A.busy) return;
  const errs = validate(A.data);
  if (errs.length) return showErrors(errs);
  if (A.mode === 'local') return exportData();
  if (!isDirty()) return toast('Змін для публікації немає');

  A.busy = true;
  const btn = $('#btnPublish');
  const step = t => { btn.textContent = t; };
  btn.disabled = true;
  try {
    step('Перевіряю…');
    const cur = await gh('GET', `/contents/js/data.js?ref=${encodeURIComponent(A.branch)}`);
    if (A.base && cur.sha !== A.base){
      const go = await confirmDlg('Хтось уже опублікував інші зміни',
        'Після того як ви відкрили адмінку, дані на сайті змінились (можливо, з іншого пристрою). Якщо опублікувати зараз, ті зміни буде перезаписано вашою версією.',
        'Все одно опублікувати', 'Скасувати');
      if (!go) return;
    }

    /* знімок даних на момент натискання: поки йде завантаження, правки можна продовжувати */
    const snap = clone(A.data);
    const json = JSON.stringify(snap);
    const text = buildDataJs(snap);
    const files = Object.entries(A.pending).filter(([p]) => json.includes(JSON.stringify(p)));
    const ref = await gh('GET', `/git/ref/heads/${A.branch}`);
    const head = ref.object.sha;
    const commit = await gh('GET', `/git/commits/${head}`);

    const tree = [];
    let n = 0;
    for (const [path, f] of files){
      step(`Завантажую файли ${++n}/${files.length}…`);
      const blob = await gh('POST', '/git/blobs', { content: f.b64, encoding: 'base64' });
      tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    step('Зберігаю…');
    const dataBlob = await gh('POST', '/git/blobs', { content: text, encoding: 'utf-8' });
    tree.push({ path: 'js/data.js', mode: '100644', type: 'blob', sha: dataBlob.sha });
    const newTree = await gh('POST', '/git/trees', { base_tree: commit.tree.sha, tree });
    const newCommit = await gh('POST', '/git/commits', {
      message: `Адмінка: оновлено контент${files.length ? `, файлів: ${files.length}` : ''}`,
      tree: newTree.sha, parents: [head]
    });
    await gh('PATCH', `/git/refs/heads/${A.branch}`, { sha: newCommit.sha });

    A.base = dataBlob.sha;
    A.published = json;
    for (const [path] of files){ delete A.pending[path]; await idb.del(path); }
    if (isDirty()) saveDraft(); else LS.del(K_DRAFT);
    LS.del('svoyi_preview');
    renderState('deploying');
    toast('Опубліковано. Сайт оновиться приблизно за хвилину.');
    watchDeploy(text);
    rerender();
  } catch (e){
    renderState();
    alertDlg('Не вдалося опублікувати', e.message);
  } finally {
    A.busy = false;
    btn.disabled = false;
    btn.textContent = A.mode === 'local' ? 'Завантажити data.js' : 'Опублікувати';
  }
}

/* після коміту Vercel збирає сайт. Перевіряємо, коли новий data.js реально зʼявиться */
function watchDeploy(text){
  if (!/^https?:/.test(location.protocol)) return;
  const want = JSON.stringify(parseDataJs(text));
  const started = Date.now();
  const tick = async () => {
    try {
      const r = await fetch(`js/data.js?check=${Date.now()}`, { cache: 'no-store' });
      if (r.ok && JSON.stringify(parseDataJs(await r.text())) === want) return isDirty() || renderState('live');
    } catch {}
    if (Date.now() - started < 4 * 60 * 1000) setTimeout(tick, 6000);
    else if (!isDirty()) renderState('slow');
  };
  setTimeout(tick, 8000);
  /* у фоновій вкладці браузер пригальмовує таймери, тож перевіряємо ще й при поверненні */
  const onShow = () => { if (!document.hidden){ document.removeEventListener('visibilitychange', onShow); tick(); } };
  document.addEventListener('visibilitychange', onShow);
}

function exportData(){
  const blob = new Blob([buildDataJs(A.data)], { type: 'text/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.js';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  if (Object.keys(A.pending).length) alertDlg('Нові фото не експортуються', 'У локальному режимі експортується лише js/data.js. Щоб завантажити фото на сайт, увійдіть з паролем або токеном і опублікуйте.');
}

/* ================= чернетка ================= */
const isDirty = () => !!A.data && JSON.stringify(A.data) !== A.published;
const saveDraft = debounce(() => {
  if (!A.data) return;
  if (isDirty()) LS.set(K_DRAFT, { data: A.data, base: A.base, mode: A.mode, at: Date.now() });
  else LS.del(K_DRAFT);
}, 400);
function touch(){
  saveDraft();
  renderState();
}

/* ================= нормалізація даних ================= */
/* Добудовує відсутні поля, щоб і форми, і сайт працювали навіть зі старими або неповними даними */
function normalize(d){
  const obj = (o, k, def) => { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k]) !== Array.isArray(def)) o[k] = def; return o[k]; };
  obj(d, 'settings', {});
  const home = obj(d, 'home', {});
  ['lead', 'sea', 'reviews', 'work'].forEach(k => obj(home, k, {}));
  obj(home.work, 'steps', []);
  const cat = obj(d, 'catalog', {});
  const cl = obj(cat, 'climate', {});
  ['north', 'south'].forEach(k => obj(obj(cl, k, {}), 'items', []));
  ['services', 'apartments', 'cars', 'reviews', 'basics', 'types', 'places'].forEach(k => obj(d, k, []));
  d.services.forEach(normService);
  d.apartments.forEach(a => {
    ['photos', 'features', 'booked', 'videos'].forEach(k => obj(a, k, []));
    obj(a, 'rules', {});
  });
  return d;
}
function normService(s){
  ['facts'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
  ['tiles', 'steps', 'lead'].forEach(k => { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
  if (!Array.isArray(s.tiles.items)) s.tiles.items = [];
  if (!Array.isArray(s.steps.items)) s.steps.items = [];
  if (!s.cars || typeof s.cars !== 'object') s.cars = { label: 'Автопарк', title: 'Оберіть клас авто', text: '', show: false };
  return s;
}

/* ================= перевірка перед публікацією ================= */
function validate(d){
  const e = [];
  const slugOk = s => /^[a-z0-9][a-z0-9-]*$/.test(s || '');
  const seen = new Set();
  d.apartments.forEach((a, i) => {
    const at = `apartments/${i}`, nm = a.name || `№${i + 1}`;
    if (!String(a.name || '').trim()) e.push([`Апартаменти №${i + 1}: немає назви`, at]);
    if (!slugOk(a.id)) e.push([`«${nm}»: адреса сторінки може містити лише малі латинські літери, цифри й дефіс`, at]);
    else if (seen.has(a.id)) e.push([`«${nm}»: адреса сторінки «${a.id}» уже зайнята іншим обʼєктом`, at]);
    seen.add(a.id);
    if (!a.photos.length) e.push([`«${nm}»: додайте хоча б одне фото`, at]);
    if (!(+a.price > 0)) e.push([`«${nm}»: вкажіть ціну за ніч`, at]);
    if (!(+a.guests > 0)) e.push([`«${nm}»: вкажіть кількість гостей`, at]);
    if (!isFinite(parseFloat(a.lat)) || !isFinite(parseFloat(a.lng))) e.push([`«${nm}»: вкажіть точку на карті`, at]);
    if (!String(a.area || '').trim()) e.push([`«${nm}»: вкажіть район`, at]);
    (a.booked || []).forEach(([b, x]) => { if (!b || !x || b >= x) e.push([`«${nm}»: у зайнятих датах дата виїзду має бути пізніше за дату заїзду`, at]); });
  });
  const sIds = new Set();
  d.services.forEach((s, i) => {
    const at = `services/${i}`, nm = s.name || `№${i + 1}`;
    if (!String(s.name || '').trim()) e.push([`Послуга №${i + 1}: немає назви`, at]);
    if (!slugOk(s.id)) e.push([`«${nm}»: адреса сторінки може містити лише малі латинські літери, цифри й дефіс`, at]);
    else if (sIds.has(s.id)) e.push([`«${nm}»: адреса «${s.id}» уже зайнята`, at]);
    sIds.add(s.id);
  });
  d.cars.forEach((c, i) => {
    if (!String(c.name || '').trim()) e.push([`Авто №${i + 1}: немає назви`, `cars/${i}`]);
    if (!c.photo) e.push([`«${c.name || `Авто №${i + 1}`}»: додайте фото`, `cars/${i}`]);
  });
  d.reviews.forEach((r, i) => {
    if (!String(r.author || '').trim()) e.push([`Відгук №${i + 1}: вкажіть автора`, `reviews/${i}`]);
  });
  const tIds = new Set();
  d.types.forEach((t, i) => {
    if (!t.id || !t.label) e.push([`Типи житла, рядок ${i + 1}: заповніть ключ і назву`, 'lists']);
    if (tIds.has(t.id)) e.push([`Типи житла: ключ «${t.id}» повторюється`, 'lists']);
    tIds.add(t.id);
  });
  if (!String(d.settings.phone || '').replace(/[^\d]/g, '')) e.push(['Контакти: вкажіть телефон', 'settings']);
  return e;
}

function showErrors(errs){
  dialog(`
    <h2>Перед публікацією виправте</h2>
    <ul class="errs">${errs.map(([t, at]) => `<li><button type="button" class="linkbtn" data-go="${esc(at)}">${esc(t)}</button></li>`).join('')}</ul>
    <div class="dlg-acts"><button class="b b-ghost" type="button" data-close>Зрозуміло</button></div>`, box => {
    box.onclick = ev => {
      const g = ev.target.closest('[data-go]');
      if (g){ closeDlg(); location.hash = g.dataset.go; }
      if (ev.target.closest('[data-close]')) closeDlg();
    };
  });
}

/* ================= діалоги й повідомлення ================= */
function dialog(html, wire){
  const d = $('#dlg');
  $('#dlgIn').innerHTML = html;
  wire && wire($('#dlgIn'));
  if (!d.open) d.showModal();
}
const closeDlg = () => $('#dlg').open && $('#dlg').close();
function confirmDlg(title, text, yes = 'Так', no = 'Скасувати', danger = false){
  return new Promise(ok => {
    dialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="dlg-acts"><button class="b b-ghost" type="button" data-no>${esc(no)}</button>
      <button class="b ${danger ? 'b-danger' : 'b-acc'}" type="button" data-yes>${esc(yes)}</button></div>`, box => {
      box.querySelector('[data-yes]').onclick = () => { closeDlg(); ok(true); };
      box.querySelector('[data-no]').onclick = () => { closeDlg(); ok(false); };
    });
    $('#dlg').addEventListener('cancel', () => ok(false), { once: true });
  });
}
const alertDlg = (title, text) => dialog(`<h2>${esc(title)}</h2><p>${esc(text)}</p>
  <div class="dlg-acts"><button class="b b-acc" type="button" onclick="document.getElementById('dlg').close()">Добре</button></div>`);

let toastT;
function toast(t){
  const x = $('#toast');
  x.textContent = t;
  x.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { x.hidden = true; }, 3800);
}

/* ================= файли ================= */
const srcOf = p => (p && A.pending[p]) ? A.pending[p].url : p;
const FILE_LIMIT = () => A.mode === 'server' ? 3.2 * 1024 * 1024 : 40 * 1024 * 1024;

function pickFiles(accept, multiple){
  return new Promise(ok => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept, multiple });
    inp.onchange = () => ok([...inp.files]);
    inp.click();
  });
}

/* фото стискаємо в браузері: довга сторона до 1920px, webp, щоб сайт не важчав */
async function compressImage(file){
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, ext: (file.name.split('.').pop() || 'img').toLowerCase() };
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = URL.createObjectURL(file); });
  }
  const w = src.width, h = src.height, k = Math.min(1, 1920 / Math.max(w, h));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(w * k), height: Math.round(h * k) });
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  const toBlob = (type, q) => new Promise(ok => c.toBlob(ok, type, q));
  let blob = await toBlob('image/webp', .84), ext = 'webp';
  if (!blob || blob.type !== 'image/webp'){ blob = await toBlob('image/jpeg', .86); ext = 'jpg'; }
  return blob.size < file.size || file.type !== 'image/' + ext ? { blob, ext } : { blob: file, ext };
}

async function addFile(blob, dir, name, ext){
  if (blob.size > FILE_LIMIT()){
    const mb = (FILE_LIMIT() / 1048576).toFixed(1);
    throw new Error(`Файл «${name}» завеликий (${(blob.size / 1048576).toFixed(1)} МБ). Максимум ${mb} МБ. Для великих відео вставте посилання на файл замість завантаження.`);
  }
  const path = `${dir}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}-${slug(name.replace(/\.[^.]+$/, '')) || 'file'}.${ext}`;
  const b64 = bufToB64(await blob.arrayBuffer());
  const rec = { b64, type: blob.type || 'application/octet-stream', size: blob.size };
  A.pending[path] = { ...rec, url: URL.createObjectURL(blob) };
  await idb.put(path, rec);
  return path;
}

async function uploadImages(multiple){
  const files = await pickFiles('image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml', multiple);
  const out = [];
  for (const f of files){
    try {
      toast(`Обробляю ${f.name}…`);
      const { blob, ext } = await compressImage(f);
      out.push(await addFile(blob, 'images/uploads', f.name, ext));
    } catch (e){ alertDlg('Фото не додано', e.message || String(e)); }
  }
  if (out.length) toast(out.length > 1 ? `Додано фото: ${out.length}` : 'Фото додано');
  return out;
}
async function uploadVideo(){
  const [f] = await pickFiles('video/mp4,video/webm,video/quicktime', false);
  if (!f) return null;
  try { return await addFile(f, 'media/uploads', f.name, (f.name.split('.').pop() || 'mp4').toLowerCase()); }
  catch (e){ alertDlg('Відео не додано', e.message); return null; }
}

/* ================= конструктор форм ================= */
/* Опис поля: { k: ключ, t: тип, l: підпис, hint, ph, ...}. Типи нижче у FIELDS. */
const RICH_HINT = 'Enter переносить рядок. **Так** виділяє жирним, [текст](https://адреса) робить посилання.';

function renderFields(box, obj, defs){
  defs.forEach(def => {
    if (def.when && !def.when(obj)) return;
    const node = (FIELDS[def.t || 'text'])(obj, def);
    if (node) box.appendChild(node);
  });
  return box;
}
const hintHTML = def => def.hint ? `<small class="hint">${esc(def.hint)}</small>` : '';
const changed = (def, obj) => { touch(); def.onChange && def.onChange(obj); };

const FIELDS = {
  text(obj, def){
    const n = el(`<label class="f${def.wide ? ' f-wide' : ''}"><span>${esc(def.l)}${def.req ? ' <i>*</i>' : ''}</span>
      <input type="${def.input || 'text'}" value="${esc(obj[def.k] ?? '')}" placeholder="${esc(def.ph || '')}"${def.list ? ` list="dl-${def.k}"` : ''}${def.readonly ? ' readonly' : ''}>
      ${def.list ? `<datalist id="dl-${def.k}">${def.list().map(v => `<option value="${esc(v)}">`).join('')}</datalist>` : ''}
      ${hintHTML(def)}</label>`);
    const inp = n.querySelector('input');
    inp.oninput = () => { obj[def.k] = inp.value; changed(def, obj); };
    if (def.onBlur) inp.onblur = () => def.onBlur(obj, inp);
    return n;
  },
  time: (obj, def) => FIELDS.text(obj, { ...def, input: 'time' }),
  textarea(obj, def){
    const n = el(`<label class="f f-wide"><span>${esc(def.l)}</span>
      <textarea rows="${def.rows || 3}" placeholder="${esc(def.ph || '')}">${esc(obj[def.k] ?? '')}</textarea>
      ${hintHTML(def.rich ? { hint: (def.hint ? def.hint + ' ' : '') + RICH_HINT } : def)}</label>`);
    const ta = n.querySelector('textarea');
    const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 520) + 'px'; };
    ta.oninput = () => { obj[def.k] = ta.value; fit(); changed(def, obj); };
    requestAnimationFrame(fit);
    return n;
  },
  number(obj, def){
    const n = el(`<label class="f f-num"><span>${esc(def.l)}${def.req ? ' <i>*</i>' : ''}</span>
      <input type="number" inputmode="decimal" step="${def.step || 1}" ${def.min != null ? `min="${def.min}"` : ''} value="${esc(obj[def.k] ?? '')}">
      ${hintHTML(def)}</label>`);
    const inp = n.querySelector('input');
    inp.oninput = () => { obj[def.k] = inp.value === '' ? null : +inp.value; changed(def, obj); };
    return n;
  },
  toggle(obj, def){
    const n = el(`<label class="tg f-wide"><input type="checkbox"${obj[def.k] ? ' checked' : ''}><i></i><span>${esc(def.l)}${hintHTML(def)}</span></label>`);
    const inp = n.querySelector('input');
    inp.onchange = () => { obj[def.k] = inp.checked; changed(def, obj); if (def.rerender) rerender(); };
    return n;
  },
  select(obj, def){
    const opts = typeof def.opts === 'function' ? def.opts() : def.opts;
    const n = el(`<label class="f"><span>${esc(def.l)}</span><select>${opts.map(([v, t]) =>
      `<option value="${esc(v)}"${String(obj[def.k] ?? '') === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${hintHTML(def)}</label>`);
    const s = n.querySelector('select');
    s.onchange = () => { obj[def.k] = s.value; changed(def, obj); };
    return n;
  },
  lines(obj, def){
    const n = el(`<label class="f f-wide"><span>${esc(def.l)}</span>
      <textarea rows="${Math.max(2, (obj[def.k] || []).length + 1)}">${esc((obj[def.k] || []).join('\n'))}</textarea>
      <small class="hint">Кожен пункт з нового рядка.${def.hint ? ' ' + esc(def.hint) : ''}</small></label>`);
    const ta = n.querySelector('textarea');
    ta.oninput = () => { obj[def.k] = ta.value.split('\n').map(s => s.trim()).filter(Boolean); changed(def, obj); };
    return n;
  },
  row(obj, def){
    const n = el(`<div class="row"></div>`);
    return renderFields(n, obj, def.fields);
  },
  group(obj, def){
    const target = def.k ? (obj[def.k] = obj[def.k] && typeof obj[def.k] === 'object' ? obj[def.k] : {}) : obj;
    const n = el(`<section class="grp"><header><h3>${esc(def.l)}</h3>${def.hint ? `<p>${esc(def.hint)}</p>` : ''}</header><div class="grp-b"></div></section>`);
    renderFields(n.querySelector('.grp-b'), target, def.fields);
    return n;
  },
  icon(obj, def){
    const n = el(`<div class="f"><span>${esc(def.l || 'Іконка')}</span>
      <button type="button" class="icbtn">${ic(obj[def.k] || 'check')}<em>${esc(obj[def.k] || 'не обрано')}</em>${ui('down')}</button></div>`);
    const btn = n.querySelector('button');
    btn.onclick = () => dialog(`<h2>Оберіть іконку</h2><div class="icgrid">${SITE_ICONS.map(name =>
      `<button type="button" data-ic="${name}"${name === obj[def.k] ? ' aria-pressed="true"' : ''} title="${name}">${ic(name)}</button>`).join('')}</div>
      <div class="dlg-acts"><button class="b b-ghost" type="button" data-close>Закрити</button></div>`, box => {
      box.onclick = ev => {
        const b = ev.target.closest('[data-ic]');
        if (b){
          obj[def.k] = b.dataset.ic;
          btn.innerHTML = `${ic(b.dataset.ic)}<em>${esc(b.dataset.ic)}</em>${ui('down')}`;
          changed(def, obj);
          closeDlg();
        }
        if (ev.target.closest('[data-close]')) closeDlg();
      };
    });
    return n;
  },
  image(obj, def){
    const n = el(`<div class="f f-img"><span>${esc(def.l)}${def.req ? ' <i>*</i>' : ''}</span><div class="img1"></div>${hintHTML(def)}</div>`);
    const box = n.querySelector('.img1');
    const paint = () => {
      const p = obj[def.k];
      box.innerHTML = `
        <div class="img1-ph">${p ? `<img src="${esc(srcOf(p))}" alt="">` : `<span>${ui('upload')}Немає фото</span>`}</div>
        <div class="img1-acts">
          <button class="b b-ghost b-sm" type="button" data-up>${ui('upload')}${p ? 'Замінити' : 'Завантажити'}</button>
          ${p && !def.req ? `<button class="b b-ghost b-sm" type="button" data-del>${ui('trash')}Прибрати</button>` : ''}
          <details class="path"><summary>Шлях до файлу</summary><input value="${esc(p || '')}" placeholder="images/..."></details>
        </div>`;
      box.querySelector('[data-up]').onclick = async () => {
        const [path] = await uploadImages(false);
        if (path){ obj[def.k] = path; changed(def, obj); paint(); }
      };
      const del = box.querySelector('[data-del]');
      if (del) del.onclick = () => { obj[def.k] = ''; changed(def, obj); paint(); };
      const inp = box.querySelector('.path input');
      inp.onchange = () => { obj[def.k] = inp.value.trim(); changed(def, obj); paint(); };
    };
    paint();
    return n;
  },
  images(obj, def){
    if (!Array.isArray(obj[def.k])) obj[def.k] = [];
    const n = el(`<div class="f f-wide"><span>${esc(def.l)}</span><div class="gal"></div>${hintHTML(def)}</div>`);
    const box = n.querySelector('.gal');
    const paint = () => {
      const list = obj[def.k];
      box.innerHTML = list.map((p, i) => `
        <figure class="gal-i">
          <img src="${esc(srcOf(p))}" alt="">
          ${i === 0 ? '<b class="badge">Головне</b>' : ''}
          <figcaption>
            <button type="button" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="Лівіше">${ui('left')}</button>
            <button type="button" data-mv="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} title="Правіше">${ui('right')}</button>
            <button type="button" data-rm="${i}" title="Видалити">${ui('trash')}</button>
          </figcaption>
        </figure>`).join('') + `<button class="gal-add" type="button">${ui('plus')}<span>Додати фото</span></button>`;
      box.querySelector('.gal-add').onclick = async () => {
        const paths = await uploadImages(true);
        if (paths.length){ list.push(...paths); changed(def, obj); paint(); }
      };
      box.onclick = ev => {
        const mv = ev.target.closest('[data-mv]'), rm = ev.target.closest('[data-rm]');
        if (mv){
          const [i, d] = mv.dataset.mv.split(':').map(Number);
          [list[i], list[i + d]] = [list[i + d], list[i]];
          changed(def, obj); paint();
        }
        if (rm){ list.splice(+rm.dataset.rm, 1); changed(def, obj); paint(); }
      };
    };
    paint();
    return n;
  },
  video(obj, def){
    const n = el(`<label class="f f-wide"><span>${esc(def.l)}</span>
      <div class="inrow"><input value="${esc(obj[def.k] || '')}" placeholder="media/... або https://...mp4">
      <button class="b b-ghost b-sm" type="button">${ui('upload')}Завантажити відео</button></div>
      <small class="hint">Формат mp4. ${A.mode === 'server' ? 'Через пароль можна завантажити файл до 3 МБ, більші відео вкажіть посиланням.' : 'Файл до 40 МБ.'}${def.hint ? ' ' + esc(def.hint) : ''}</small></label>`);
    const inp = n.querySelector('input');
    inp.oninput = () => { obj[def.k] = inp.value.trim(); changed(def, obj); };
    n.querySelector('button').onclick = async ev => {
      ev.preventDefault();
      const p = await uploadVideo();
      if (p){ obj[def.k] = p; inp.value = p; changed(def, obj); toast('Відео додано'); }
    };
    return n;
  },
  tags(obj, def){
    if (!Array.isArray(obj[def.k])) obj[def.k] = [];
    const n = el(`<div class="f f-wide"><span>${esc(def.l)}</span><div class="tags"></div>${hintHTML(def)}</div>`);
    const box = n.querySelector('.tags');
    const paint = () => {
      const list = obj[def.k];
      const sugg = (def.suggest ? def.suggest() : []).filter(s => !list.includes(s));
      box.innerHTML = list.map((t, i) => `<span class="tag">${esc(t)}<button type="button" data-rm="${i}" aria-label="Прибрати">${ui('x')}</button></span>`).join('') +
        `<input placeholder="Додати і натиснути Enter" list="dl-tags-${def.k}"><datalist id="dl-tags-${def.k}">${sugg.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
      const inp = box.querySelector('input');
      const add = () => {
        const v = inp.value.trim();
        if (v && !list.includes(v)){ list.push(v); changed(def, obj); }
        paint();
        box.querySelector('input').focus();
      };
      inp.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ','){ ev.preventDefault(); add(); } };
      inp.onchange = () => { if (sugg.includes(inp.value)) add(); };
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { list.splice(+b.dataset.rm, 1); changed(def, obj); paint(); });
    };
    paint();
    return n;
  },
  list(obj, def){
    if (!Array.isArray(obj[def.k])) obj[def.k] = [];
    const n = el(`<div class="f f-wide lst"><span>${esc(def.l)}</span><div class="lst-b"></div>
      <button class="b b-ghost b-sm lst-add" type="button">${ui('plus')}${esc(def.add || 'Додати')}</button>${hintHTML(def)}</div>`);
    const box = n.querySelector('.lst-b');
    const paint = () => {
      const list = obj[def.k];
      box.innerHTML = '';
      list.forEach((item, i) => {
        const card = el(`<div class="lst-i">
          <div class="lst-h"><b>${esc(def.title ? def.title(item, i) : `№${i + 1}`)}</b>
            <span>
              <button type="button" data-mv="-1" ${i === 0 ? 'disabled' : ''} title="Вище">${ui('up')}</button>
              <button type="button" data-mv="1" ${i === list.length - 1 ? 'disabled' : ''} title="Нижче">${ui('down')}</button>
              <button type="button" data-rm title="Видалити">${ui('trash')}</button>
            </span>
          </div>
          <div class="lst-f"></div></div>`);
        renderFields(card.querySelector('.lst-f'), item, def.fields);
        card.addEventListener('input', () => {
          card.querySelector('.lst-h b').textContent = def.title ? def.title(item, i) : `№${i + 1}`;
        });
        card.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
          const j = i + (+b.dataset.mv);
          [list[i], list[j]] = [list[j], list[i]];
          touch(); paint();
        });
        card.querySelector('[data-rm]').onclick = async () => {
          if (await confirmDlg('Видалити пункт?', `«${def.title ? def.title(item, i) : `№${i + 1}`}» зникне з цього блоку.`, 'Видалити', 'Скасувати', true)){
            list.splice(i, 1); touch(); paint();
          }
        };
        box.appendChild(card);
      });
    };
    n.querySelector('.lst-add').onclick = () => { obj[def.k].push(def.make ? def.make() : {}); touch(); paint(); };
    paint();
    return n;
  },
  ranges(obj, def){
    if (!Array.isArray(obj[def.k])) obj[def.k] = [];
    const n = el(`<div class="f f-wide"><span>${esc(def.l)}</span><div class="rng"></div>
      <button class="b b-ghost b-sm" type="button" data-add>${ui('plus')}Додати період</button>${hintHTML(def)}</div>`);
    const box = n.querySelector('.rng');
    const paint = () => {
      const list = obj[def.k];
      box.innerHTML = list.length ? list.map(([a, b], i) => `
        <div class="rng-i${a && b && a >= b ? ' bad' : ''}">
          <label><small>Заїзд</small><input type="date" value="${esc(a || '')}" data-i="${i}" data-p="0"></label>
          <label><small>Виїзд</small><input type="date" value="${esc(b || '')}" data-i="${i}" data-p="1"></label>
          <button type="button" data-rm="${i}" title="Видалити">${ui('trash')}</button>
        </div>`).join('') : '<p class="muted small">Усі дати вільні.</p>';
      box.querySelectorAll('input').forEach(inp => inp.onchange = () => {
        list[+inp.dataset.i][+inp.dataset.p] = inp.value;
        list.sort((x, y) => String(x[0]).localeCompare(String(y[0])));
        changed(def, obj); paint();
      });
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { list.splice(+b.dataset.rm, 1); changed(def, obj); paint(); });
    };
    n.querySelector('[data-add]').onclick = () => {
      const t = new Date(), iso = d => d.toISOString().slice(0, 10);
      const b = new Date(t.getTime() + 7 * 864e5);
      obj[def.k].push([iso(t), iso(b)]);
      changed(def, obj); paint();
    };
    paint();
    return n;
  },
  latlng(obj, def){
    const n = el(`<div class="f f-wide"><span>${esc(def.l)}</span>
      <div class="row"><label class="f f-num"><span>Широта</span><input type="number" step="any" data-k="lat" value="${esc(obj.lat ?? '')}"></label>
      <label class="f f-num"><span>Довгота</span><input type="number" step="any" data-k="lng" value="${esc(obj.lng ?? '')}"></label></div>
      <div class="pick"></div><small class="hint">Клікніть на карті, щоб поставити точку, або перетягніть маркер.</small></div>`);
    const inputs = $$('input', n);
    let map, marker;
    const set = (lat, lng, pan) => {
      obj.lat = +(+lat).toFixed(5); obj.lng = +(+lng).toFixed(5);
      inputs[0].value = obj.lat; inputs[1].value = obj.lng;
      if (marker) marker.setLatLng([obj.lat, obj.lng]);
      else if (map) marker = L.marker([obj.lat, obj.lng], { draggable: true }).addTo(map).on('dragend', e => { const p = e.target.getLatLng(); set(p.lat, p.lng); });
      if (pan && map) map.panTo([obj.lat, obj.lng]);
      changed(def, obj);
    };
    inputs.forEach(inp => inp.oninput = () => {
      obj[inp.dataset.k] = inp.value === '' ? null : +inp.value;
      if (marker && isFinite(obj.lat) && isFinite(obj.lng)) marker.setLatLng([obj.lat, obj.lng]);
      changed(def, obj);
    });
    requestAnimationFrame(() => {
      if (!window.L) return;
      const has = isFinite(parseFloat(obj.lat)) && isFinite(parseFloat(obj.lng));
      map = L.map(n.querySelector('.pick'), { scrollWheelZoom: false }).setView(has ? [obj.lat, obj.lng] : [28.28, -16.62], has ? 13 : 9);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      if (has) marker = L.marker([obj.lat, obj.lng], { draggable: true }).addTo(map).on('dragend', e => { const p = e.target.getLatLng(); set(p.lat, p.lng); });
      map.on('click', e => set(e.latlng.lat, e.latlng.lng));
      setTimeout(() => map.invalidateSize(), 200);
    });
    return n;
  },
  info(obj, def){
    return el(`<p class="info f-wide">${def.html(obj)}</p>`);
  }
};

/* ================= описи форм ================= */
const aptTypes = () => A.data.types.map(t => [t.id, t.label]);
const allAreas = () => [...new Set(A.data.apartments.map(a => a.area).filter(Boolean))].sort();
const allFeatures = () => [...new Set(A.data.apartments.flatMap(a => a.features))].sort();
const seoGroup = { t: 'group', l: 'Пошукові системи й соцмережі', hint: 'Назва вкладки браузера й опис у результатах Google та в прев’ю посилань.', fields: [
  { k: 'seoTitle', l: 'Заголовок сторінки', wide: true },
  { k: 'seoDescription', t: 'textarea', l: 'Опис', rows: 2 }
] };
const stepFields = [
  { t: 'row', fields: [{ k: 'label', l: 'Підпис над кроком', ph: 'онлайн' }, { k: 'title', l: 'Назва кроку' }] },
  { k: 'text', t: 'textarea', l: 'Опис', rows: 2, rich: true }
];
const headFields = (withText = true) => [
  { k: 'label', l: 'Підпис над заголовком', ph: 'Процес' },
  { k: 'title', t: 'textarea', l: 'Заголовок', rows: 1, rich: true },
  ...(withText ? [{ k: 'text', t: 'textarea', l: 'Підзаголовок', rows: 2, rich: true }] : [])
];

const F_SETTINGS = [
  { t: 'group', l: 'Контакти', hint: 'Використовуються в шапці, футері, нижньому меню на телефоні й кнопках звʼязку по всьому сайту.', fields: [
    { t: 'row', fields: [
      { k: 'phone', l: 'Телефон для дзвінка', ph: '+380984776927', req: true, hint: 'У міжнародному форматі, без пробілів' },
      { k: 'phoneLabel', l: 'Як показувати номер', ph: '098 477 69 27' }
    ] },
    { k: 'telegram', l: 'Telegram', ph: 'https://t.me/...', wide: true },
    { t: 'row', fields: [
      { k: 'instagram', l: 'Instagram', ph: 'https://www.instagram.com/...' },
      { k: 'tiktok', l: 'TikTok', ph: 'https://www.tiktok.com/@...', hint: 'Порожнє поле ховає кнопку на сайті' }
    ] }
  ] },
  { t: 'group', l: 'Форми заявок', fields: [
    { k: 'formIntro', l: 'Текст над полями форми', wide: true },
    { k: 'formNote', t: 'textarea', l: 'Примітка під кнопкою', rows: 2 }
  ] },
  { t: 'group', l: 'Ціни', fields: [
    { k: 'cleaning', t: 'number', l: 'Генеральне прибирання, EUR', min: 0, hint: 'Одноразовий платіж при виселенні, додається до вартості проживання' }
  ] },
  { t: 'group', l: 'Футер', fields: [
    { k: 'tagline', l: 'Підпис під логотипом', wide: true },
    { t: 'row', fields: [{ k: 'footerNote', l: 'Текст після ©' }, { k: 'footerPlace', l: 'Місце' }] }
  ] }
];

const F_HOME = [
  seoGroup,
  { t: 'group', l: 'Перший екран', fields: [
    { t: 'row', fields: [{ k: 'heroTitle', l: 'Заголовок' }, { k: 'heroAccent', l: 'Другий рядок заголовка' }] },
    { k: 'heroLede', t: 'textarea', l: 'Текст над заголовком', rows: 2, rich: true },
    { k: 'heroPoster', t: 'image', l: 'Кадр-заставка', hint: 'Показується, поки вантажиться відео, і на слабкому інтернеті' },
    { k: 'heroVideo', t: 'video', l: 'Фонове відео' },
    { k: 'heroCredit', l: 'Підпис під банером', wide: true, hint: 'Автор і ліцензія, якщо відео чуже. Порожнє поле ховає підпис. ' + RICH_HINT }
  ] },
  { t: 'group', k: 'lead', l: 'Блок «Підбір житла»', fields: [
    ...headFields(),
    { t: 'row', fields: [{ k: 'noteLabel', l: 'Назва поля побажань' }, { k: 'notePlaceholder', l: 'Приклад у полі' }] }
  ] },
  { t: 'group', k: 'sea', l: 'Блок «Вид на океан»', hint: 'Апартаменти сюди потрапляють автоматично: у зручностях є «Вид на океан» або «Панорамний вид», спершу рекомендовані.', fields: [
    ...headFields(), { k: 'link', l: 'Текст посилання на каталог' }
  ] },
  { t: 'group', k: 'reviews', l: 'Блок «Відгуки гостей»', hint: 'Самі відгуки редагуються в розділі «Відгуки».', fields: headFields() },
  { t: 'group', k: 'work', l: 'Блок «Як ми працюємо»', fields: [
    ...headFields(false),
    { k: 'steps', t: 'list', l: 'Кроки', add: 'Додати крок', title: s => s.title || 'Новий крок', make: () => ({ label: '', title: '', text: '' }), fields: stepFields }
  ] }
];

const F_APT = [
  { t: 'group', l: 'Основне', fields: [
    { t: 'row', fields: [
      { k: 'name', l: 'Назва', req: true },
      { k: 'id', l: 'Адреса сторінки', req: true, hint: 'apartment.html?id=… Латиниця, цифри, дефіс', onBlur: renameApt }
    ] },
    { t: 'row', fields: [
      { k: 'type', t: 'select', l: 'Тип житла', opts: aptTypes },
      { k: 'area', l: 'Район', req: true, list: allAreas, hint: 'Потрапляє у фільтр «Район» на сайті' }
    ] },
    { t: 'row', fields: [
      { k: 'price', t: 'number', l: 'Ціна за ніч, EUR', min: 0, req: true },
      { k: 'guests', t: 'number', l: 'Гостей', min: 1, req: true },
      { k: 'bedrooms', t: 'number', l: 'Спалень', min: 0 },
      { k: 'baths', t: 'number', l: 'Санвузлів', min: 0 },
      { k: 'sea', t: 'number', l: 'Хв до океану', min: 0 }
    ] },
    { k: 'top', t: 'toggle', l: 'Рекомендований', hint: 'Показується першим у каталозі й у блоках на головній' },
    { k: 'hidden', t: 'toggle', l: 'Приховати з сайту', hint: 'Обʼєкт зникне з каталогу, карти й головної, але дані збережуться' }
  ] },
  { t: 'group', l: 'Фото', fields: [
    { k: 'photos', t: 'images', l: 'Галерея', hint: 'Перше фото йде в картку й на карту. Фото стискаються автоматично.' }
  ] },
  { t: 'group', l: 'Опис', fields: [
    { k: 'desc', t: 'textarea', l: 'Коротко', rows: 3, hint: 'У картці на сторінці й в описі для Google' },
    { k: 'long', t: 'textarea', l: 'Докладно', rows: 6 }
  ] },
  { t: 'group', l: 'Зручності', hint: 'Рушники, білизна та інше базове додаються автоматично, їх список у «Довідниках».', fields: [
    { k: 'features', t: 'tags', l: 'Зручності обʼєкта', suggest: allFeatures, hint: '«Вид на океан» або «Панорамний вид» додає обʼєкт у блок на головній' }
  ] },
  { t: 'group', k: 'rules', l: 'Умови заселення', fields: [
    { t: 'row', fields: [
      { k: 'in', t: 'time', l: 'Заїзд з' }, { k: 'out', t: 'time', l: 'Виїзд до' },
      { k: 'min', t: 'number', l: 'Мінімум ночей', min: 1 }
    ] },
    { t: 'row', fields: [{ k: 'pets', l: 'Тварини', ph: 'За домовленістю' }, { k: 'smoke', l: 'Паління', ph: 'Не палити' }] }
  ] },
  { t: 'group', l: 'Розташування', fields: [{ t: 'latlng', l: 'Точка на карті' }] },
  { t: 'group', l: 'Зайняті дати', hint: 'Ці дні в календарі на сайті будуть закреслені. День виїзду вважається вільним.', fields: [
    { k: 'booked', t: 'ranges', l: 'Періоди бронювання' }
  ] }
];

const F_CAR = [
  { t: 'row', fields: [{ k: 'name', l: 'Клас', req: true, ph: 'Кросовер' }, { k: 'model', l: 'Модель або опис', ph: 'Комфортний SUV' }] },
  { t: 'row', fields: [
    { k: 'price', t: 'number', l: 'Ціна за добу, EUR', min: 0 },
    { k: 'seats', t: 'number', l: 'Місць', min: 1 },
    { k: 'gear', t: 'select', l: 'Коробка', opts: [['Механіка', 'Механіка'], ['Автомат', 'Автомат']] },
    { k: 'bags', l: 'Багаж', ph: '2 валізи' }
  ] },
  { k: 'photo', t: 'image', l: 'Фото', req: true },
  { k: 'note', t: 'textarea', l: 'Для чого підходить', rows: 2 },
  { k: 'hidden', t: 'toggle', l: 'Приховати з сайту' }
];

const F_REVIEW = [
  { t: 'row', fields: [{ k: 'author', l: 'Імʼя гостя', req: true }, { k: 'city', l: 'Місто' }] },
  { k: 'quote', t: 'textarea', l: 'Цитата', rows: 3, hint: 'На картці показуються перші три рядки' },
  { k: 'apt', t: 'select', l: 'Про які апартаменти', opts: () => [['', 'Без привʼязки'], ...A.data.apartments.map(a => [a.id, a.name])] },
  { k: 'poster', t: 'image', l: 'Обкладинка', hint: 'Вертикальний кадр 9:16' },
  { k: 'src', t: 'video', l: 'Відео' },
  { k: 'hidden', t: 'toggle', l: 'Приховати з сайту' }
];

const F_SERVICE = [
  { t: 'group', l: 'Кнопка послуги', hint: 'Кнопки послуг стоять під банером на головній і внизу кожної сторінки послуги.', fields: [
    { t: 'row', fields: [
      { k: 'name', l: 'Назва', req: true },
      { k: 'id', l: 'Адреса сторінки', req: true, readonlyIf: s => !!s.href, hint: 'Латиниця, цифри, дефіс' }
    ] },
    { k: 'short', l: 'Короткий опис на кнопці', wide: true },
    { k: 'icon', t: 'icon', l: 'Іконка' },
    { k: 'hidden', t: 'toggle', l: 'Не показувати серед кнопок послуг', hint: 'Сторінка лишиться доступною за прямим посиланням' },
    { t: 'info', html: s => `Сторінка: <a href="${esc(s.href || `service.html?id=${s.id}`)}" target="_blank" rel="noopener">${esc(s.href || `service.html?id=${s.id}`)}</a>` }
  ] },
  seoGroup,
  { t: 'group', l: 'Перший екран', fields: [
    { t: 'row', fields: [{ k: 'title', l: 'Заголовок' }, { k: 'accent', l: 'Другий рядок заголовка' }] },
    { k: 'lede', t: 'textarea', l: 'Текст', rows: 3, rich: true },
    { k: 'facts', t: 'list', l: 'Короткі факти з іконками', add: 'Додати факт', title: f => f.text || 'Новий факт', make: () => ({ icon: 'check', text: '' }),
      fields: [{ t: 'row', fields: [{ k: 'icon', t: 'icon' }, { k: 'text', l: 'Текст' }] }] },
    { k: 'cta', l: 'Текст головної кнопки', ph: 'Замовити' },
    { k: 'image', t: 'image', l: 'Фото праворуч', hint: 'Без фото показуються декоративні кільця з іконкою послуги' },
    { t: 'row', fields: [{ k: 'imageAlt', l: 'Опис фото для незрячих і Google' }, { k: 'imageCredit', l: 'Підпис до фото', hint: 'Автор і ліцензія, якщо фото чуже' }] }
  ] },
  { t: 'group', k: 'tiles', l: 'Блок з картками', hint: 'Що входить у послугу: екскурсії, маршрути, переваги. Без карток блок ховається.', fields: [
    ...headFields(),
    { k: 'items', t: 'list', l: 'Картки', add: 'Додати картку', title: t => t.title || 'Нова картка', make: () => ({ icon: 'check', title: '', text: '' }),
      fields: [{ k: 'icon', t: 'icon' }, { k: 'title', l: 'Заголовок', wide: true }, { k: 'text', t: 'textarea', l: 'Текст', rows: 2, rich: true }] }
  ] },
  { t: 'group', k: 'cars', l: 'Автопарк', hint: 'Список авто редагується в розділі «Авто».', fields: [
    { k: 'show', t: 'toggle', l: 'Показувати автопарк на цій сторінці' },
    ...headFields()
  ] },
  { t: 'group', k: 'steps', l: 'Блок «Як це працює»', hint: 'Без кроків блок ховається.', fields: [
    ...headFields(),
    { k: 'items', t: 'list', l: 'Кроки', add: 'Додати крок', title: s => s.title || 'Новий крок', make: () => ({ label: '', title: '', text: '' }), fields: stepFields }
  ] },
  { t: 'group', k: 'lead', l: 'Заявка', fields: [
    ...headFields(),
    { t: 'row', fields: [{ k: 'noteLabel', l: 'Назва поля побажань' }, { k: 'notePlaceholder', l: 'Приклад у полі' }] }
  ] }
];

const F_CATALOG = [
  seoGroup,
  { t: 'group', l: 'Вступ', fields: [
    { k: 'introTitle', t: 'textarea', l: 'Заголовок', rows: 2, rich: true },
    { k: 'introText', t: 'textarea', l: 'Текст', rows: 3, rich: true }
  ] },
  { t: 'group', k: 'climate', l: 'Блок «Клімат узимку»', fields: [
    ...headFields(),
    { t: 'group', k: 'north', l: 'Ліва картка', fields: [
      { t: 'row', fields: [{ k: 'title', l: 'Заголовок' }, { k: 'note', l: 'Підпис над температурою' }, { k: 'temp', l: 'Температура' }] },
      { k: 'items', t: 'lines', l: 'Пункти' }
    ] },
    { t: 'group', k: 'south', l: 'Права картка', fields: [
      { t: 'row', fields: [{ k: 'title', l: 'Заголовок' }, { k: 'note', l: 'Підпис над температурою' }, { k: 'temp', l: 'Температура' }] },
      { k: 'items', t: 'lines', l: 'Пункти' }
    ] },
    { k: 'tip', t: 'textarea', l: 'Порада внизу', rows: 2, rich: true }
  ] }
];

const F_LISTS = [
  { t: 'group', l: 'Типи житла', hint: 'Використовуються в пошуку на сайті й у картці апартаментів. Ключ типу, який уже стоїть в апартаментах, краще не змінювати.', fields: [
    { k: 'types', t: 'list', l: 'Типи', add: 'Додати тип', title: t => t.label || 'Новий тип', make: () => ({ id: '', label: '' }),
      fields: [{ t: 'row', fields: [{ k: 'label', l: 'Назва' }, { k: 'id', l: 'Ключ (латиницею)' }] }] }
  ] },
  { t: 'group', l: 'Базові зручності', hint: 'Є в кожному обʼєкті й автоматично додаються до зручностей на сторінці апартаментів.', fields: [
    { k: 'basics', t: 'lines', l: 'Список' }
  ] }
];

/* зміна адреси сторінки апартаментів оновлює привʼязку відгуків */
function renameApt(a, inp){
  const old = inp.dataset.was ?? inp.defaultValue;
  const now = slug(inp.value);
  if (inp.value !== now){ inp.value = now; a.id = now; touch(); }
  if (old && now && old !== now){
    let n = 0;
    A.data.reviews.forEach(r => { if (r.apt === old){ r.apt = now; n++; } });
    if (n) toast(`Оновлено привʼязку відгуків: ${n}`);
  }
  inp.dataset.was = now;
}

/* ================= колекції ================= */
const COLLECTIONS = {
  apartments: {
    title: 'Апартаменти', add: 'Додати апартаменти', fields: F_APT, search: true,
    name: a => a.name || 'Без назви',
    sub: a => [a.area, a.price ? `${a.price} EUR / ніч` : '', a.guests ? `${a.guests} гост.` : ''].filter(Boolean).join(' · '),
    thumb: a => a.photos[0],
    badges: a => [a.hidden && 'прихований', a.top && 'рекомендований'],
    link: a => `apartment.html?id=${a.id}`,
    make: () => ({ id: '', type: (A.data.types[0] || {}).id || '', name: '', area: '', lat: null, lng: null, price: null, guests: 2, bedrooms: 1, baths: 1,
      sea: null, top: false, photos: [], features: [], desc: '', long: '', rules: { in: '15:00', out: '11:00', min: 3, pets: 'За домовленістю', smoke: 'Не палити' },
      videos: [], booked: [] }),
    idFrom: 'name'
  },
  services: {
    title: 'Послуги й тури', add: 'Додати послугу', fields: F_SERVICE,
    name: s => s.name || 'Без назви', sub: s => s.short || '',
    icon: s => s.icon, badges: s => [s.hidden && 'прихована', !s.href && 'нова сторінка'],
    link: s => s.href || `service.html?id=${s.id}`,
    make: () => normService({ id: '', icon: 'compass', name: '', short: '', seoTitle: '', seoDescription: '', title: '', accent: 'на Тенеріфе', lede: '',
      facts: [], cta: 'Залишити заявку', image: '', imageAlt: '', imageCredit: '',
      tiles: { label: 'Що входить', title: '', text: '', items: [] },
      steps: { label: 'Процес', title: 'Як це працює', text: '', items: [] },
      lead: { label: 'Заявка', title: '', text: '', noteLabel: 'Коли летите і скільки вас', notePlaceholder: '' } }),
    idFrom: 'name',
    dupe: s => { delete s.href; return s; }
  },
  cars: {
    title: 'Авто', add: 'Додати авто', fields: F_CAR,
    name: c => c.name || 'Без назви', sub: c => [c.model, c.price ? `${c.price} EUR / день` : ''].filter(Boolean).join(' · '),
    thumb: c => c.photo, badges: c => [c.hidden && 'приховане'],
    make: () => ({ id: '', name: '', model: '', price: null, seats: 5, gear: 'Автомат', bags: '', photo: '', note: '' }),
    idAuto: 'c'
  },
  reviews: {
    title: 'Відгуки', add: 'Додати відгук', fields: F_REVIEW,
    name: r => r.author || 'Без імені', sub: r => r.quote || '',
    thumb: r => r.poster, badges: r => [r.hidden && 'прихований'],
    make: () => ({ id: '', author: '', city: '', apt: '', src: '', poster: '', quote: '' }),
    idAuto: 'r'
  }
};

const SECTIONS = [
  { id: 'settings', title: 'Контакти й загальне', icon: 'phone', form: () => [A.data.settings, F_SETTINGS] },
  { id: 'home', title: 'Головна сторінка', ui: 'house', form: () => [A.data.home, F_HOME] },
  { id: 'apartments', title: 'Апартаменти', icon: 'bed', coll: 'apartments' },
  { id: 'services', title: 'Послуги й тури', icon: 'compass', coll: 'services' },
  { id: 'cars', title: 'Авто', icon: 'car', coll: 'cars' },
  { id: 'reviews', title: 'Відгуки', icon: 'play', coll: 'reviews' },
  { id: 'catalog', title: 'Сторінка каталогу', icon: 'map-trifold', form: () => [A.data.catalog, F_CATALOG] },
  { id: 'lists', title: 'Довідники', ui: 'list', form: () => [A.data, F_LISTS] }
];

/* ================= відмальовка ================= */
function renderNav(){
  const cur = (location.hash.slice(1).split('/')[0]) || 'apartments';
  $('#sideNav').innerHTML = SECTIONS.map(s => {
    const count = s.coll ? `<em>${A.data[s.coll].length}</em>` : '';
    return `<a href="#${s.id}"${s.id === cur ? ' aria-current="page"' : ''}>${s.icon ? ic(s.icon) : ui(s.ui)}<span>${esc(s.title)}</span>${count}</a>`;
  }).join('');
}

function renderState(kind){
  const s = $('#state');
  const dirty = isDirty();
  $('#btnDiscard').hidden = !dirty || A.mode === 'local';
  if (dirty){ s.className = 'state is-dirty'; s.textContent = 'Є неопубліковані зміни'; return; }
  const map = {
    deploying: ['is-wait', 'Опубліковано, сайт оновлюється…'],
    live: ['is-ok', 'Сайт оновлено'],
    slow: ['is-wait', 'Опубліковано. Якщо сайт не оновився, перевірте Vercel']
  };
  const [cls, text] = map[kind] || (A.mode === 'local' ? ['', 'Локальний режим'] : ['is-ok', 'Усе опубліковано']);
  s.className = 'state ' + cls;
  s.textContent = text;
}

function rerender(){
  const y = scrollY;
  route();
  requestAnimationFrame(() => scrollTo(0, y));
}

function route(){
  if (!A.data) return;
  const [sid, idx] = location.hash.slice(1).split('/');
  const sec = SECTIONS.find(s => s.id === sid) || SECTIONS.find(s => s.id === 'apartments');
  renderNav();
  const view = $('#view');
  view.innerHTML = '';
  if (sec.coll){
    const list = A.data[sec.coll];
    if (idx != null && list[+idx]) return renderItem(sec, +idx);
    return renderCollection(sec);
  }
  $('#pageTitle').textContent = sec.title;
  const [obj, defs] = sec.form();
  view.appendChild(renderFields(el('<div class="form"></div>'), obj, defs));
}

function renderCollection(sec){
  const C = COLLECTIONS[sec.coll], list = A.data[sec.coll];
  $('#pageTitle').textContent = C.title;
  const box = el(`<div class="coll">
    <div class="coll-bar">
      ${C.search ? `<label class="search">${ui('search')}<input type="search" placeholder="Пошук за назвою або районом"></label>` : '<span></span>'}
      <button class="b b-acc" type="button" data-new>${ui('plus')}${esc(C.add)}</button>
    </div>
    <div class="coll-list"></div>
  </div>`);
  const paint = (q = '') => {
    const ql = q.trim().toLowerCase();
    box.querySelector('.coll-list').innerHTML = list.map((it, i) => {
      if (ql && !(C.name(it) + ' ' + C.sub(it)).toLowerCase().includes(ql)) return '';
      const th = C.thumb ? C.thumb(it) : '';
      const badges = (C.badges ? C.badges(it) : []).filter(Boolean);
      return `<div class="ci${it.hidden ? ' is-off' : ''}">
        <a class="ci-main" href="#${sec.id}/${i}">
          <span class="ci-th">${th ? `<img src="${esc(srcOf(th))}" alt="" loading="lazy">` : C.icon ? ic(C.icon(it) || 'check') : ui('upload')}</span>
          <span class="ci-t"><b>${esc(C.name(it))}</b><small>${esc(C.sub(it))}</small>
            ${badges.length ? `<span class="ci-badges">${badges.map(b => `<i>${esc(b)}</i>`).join('')}</span>` : ''}</span>
        </a>
        <span class="ci-acts">
          ${ql ? '' : `<button type="button" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="Вище">${ui('up')}</button>
          <button type="button" data-mv="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} title="Нижче">${ui('down')}</button>`}
          <button type="button" data-dup="${i}" title="Дублювати">${ui('copy')}</button>
          <button type="button" data-rm="${i}" title="Видалити">${ui('trash')}</button>
        </span>
      </div>`;
    }).join('') || '<p class="empty">Нічого не знайдено.</p>';
  };
  paint();
  const s = box.querySelector('.search input');
  if (s) s.oninput = () => paint(s.value);

  box.querySelector('[data-new]').onclick = () => {
    const item = C.make();
    if (C.idAuto) item.id = uniqueId(C.idAuto + Date.now().toString(36).slice(-4), list.map(x => x.id));
    NEW_ITEMS.add(item);
    list.push(item);
    touch();
    location.hash = `${sec.id}/${list.length - 1}`;
  };
  box.onclick = async ev => {
    const mv = ev.target.closest('[data-mv]'), dup = ev.target.closest('[data-dup]'), rm = ev.target.closest('[data-rm]');
    if (mv){
      const [i, d] = mv.dataset.mv.split(':').map(Number);
      [list[i], list[i + d]] = [list[i + d], list[i]];
      touch(); paint(s ? s.value : '');
    }
    if (dup) duplicate(sec, +dup.dataset.dup);
    if (rm) removeItem(sec, +rm.dataset.rm);
  };
  $('#view').appendChild(box);
}
const NEW_ITEMS = new WeakSet();

function duplicate(sec, i){
  const C = COLLECTIONS[sec.coll], list = A.data[sec.coll];
  let copy = clone(list[i]);
  if (C.dupe) copy = C.dupe(copy);
  const nameKey = sec.coll === 'reviews' ? 'author' : 'name';
  copy[nameKey] = `${copy[nameKey] || ''} (копія)`;
  if ('id' in copy) copy.id = uniqueId(`${copy.id || 'item'}-copy`, list.map(x => x.id));
  copy.hidden = true;
  list.splice(i + 1, 0, copy);
  touch();
  toast('Копію створено й приховано з сайту, поки ви її не відредагуєте');
  location.hash = `${sec.id}/${i + 1}`;
}

async function removeItem(sec, i){
  const C = COLLECTIONS[sec.coll], list = A.data[sec.coll], it = list[i];
  let text = `«${C.name(it)}» буде видалено після публікації.`;
  if (sec.coll === 'apartments'){
    const n = A.data.reviews.filter(r => r.apt === it.id).length;
    if (n) text += ` Привʼязку до нього мають відгуки: ${n}, вони лишаться без привʼязки.`;
    text += ' Якщо обʼєкт тимчасово недоступний, краще ввімкнути «Приховати з сайту».';
  }
  if (sec.coll === 'services' && it.href) text += ` Сторінка ${it.href} стане порожньою і перенаправлятиме на головну.`;
  if (!await confirmDlg('Видалити?', text, 'Видалити', 'Скасувати', true)) return;
  list.splice(i, 1);
  if (sec.coll === 'apartments') A.data.reviews.forEach(r => { if (r.apt === it.id) r.apt = ''; });
  touch();
  location.hash = sec.id;
  rerender();
}

function renderItem(sec, i){
  const C = COLLECTIONS[sec.coll], item = A.data[sec.coll][i];
  $('#pageTitle').textContent = C.name(item);
  const isNew = NEW_ITEMS.has(item);
  const head = el(`<div class="item-bar">
    <a class="b b-ghost b-sm" href="#${sec.id}">${ui('back')}${esc(C.title)}</a>
    <span class="item-acts">
      ${C.link && !isNew ? `<a class="b b-ghost b-sm" href="${esc(C.link(item))}" target="_blank" rel="noopener" title="Відкрити на сайті">${ui('ext')}<span class="t">На сайті</span></a>` : ''}
      <button class="b b-ghost b-sm" type="button" data-dup title="Дублювати">${ui('copy')}<span class="t">Дублювати</span></button>
      <button class="b b-ghost b-sm b-danger-t" type="button" data-rm title="Видалити">${ui('trash')}<span class="t">Видалити</span></button>
    </span>
  </div>`);
  head.querySelector('[data-dup]').onclick = () => duplicate(sec, i);
  head.querySelector('[data-rm]').onclick = () => removeItem(sec, i);

  /* назва оновлює заголовок, а для нових записів ще й адресу сторінки */
  const defs = C.fields.map(function wrap(d){
    if (d.fields) return { ...d, fields: d.fields.map(wrap) };
    if (d.readonlyIf) return { ...d, readonly: d.readonlyIf(item) };
    if (d.k === (sec.coll === 'reviews' ? 'author' : 'name')){
      return { ...d, onChange: obj => {
        $('#pageTitle').textContent = C.name(obj);
        if (C.idFrom && isNew){
          obj.id = uniqueId(slug(obj.name) || 'item', A.data[sec.coll].filter(x => x !== obj).map(x => x.id));
          const idInp = $$('#view .f input').find(x => x.closest('.f').querySelector('span').textContent.startsWith('Адреса сторінки'));
          if (idInp){ idInp.value = obj.id; idInp.dataset.was = obj.id; }
        }
      } };
    }
    return d;
  });
  $('#view').append(head, renderFields(el('<div class="form"></div>'), item, defs));
}

/* ================= вхід ================= */
function readSession(){
  const s = LS.get(K_SESSION) || (() => { try { return JSON.parse(sessionStorage.getItem(K_SESSION)); } catch { return null; } })();
  if (!s) return null;
  if (s.mode === 'server' && !(s.exp > Date.now())) return null;
  return s;
}
function saveSession(s, remember = true){
  LS.del(K_SESSION);
  try { sessionStorage.removeItem(K_SESSION); } catch {}
  if (remember) LS.set(K_SESSION, s);
  else try { sessionStorage.setItem(K_SESSION, JSON.stringify(s)); } catch {}
}
function sessionExpired(){
  LS.del(K_SESSION);
  try { sessionStorage.removeItem(K_SESSION); } catch {}
  if (A.mode === 'server'){
    A.mode = null;
    toast('Сесія завершилась. Незбережені зміни збережено в чернетці.');
    showLogin();
  }
}

async function showLogin(){
  $('#app').hidden = true;
  $('#login').hidden = false;
  const err = $('#loginErr');
  err.hidden = true;
  const note = $('#loginNote');
  if (location.protocol === 'file:'){
    $('#loginPass').hidden = true;
    $('#loginToken').open = true;
    note.textContent = 'Сайт відкрито з файлу, тому вхід за паролем недоступний. Увійдіть з GitHub-токеном або відкрийте без публікації.';
    return;
  }
  try {
    const st = await api({ action: 'status' }, false);
    if (!st.configured){
      $('#loginPass').hidden = true;
      $('#loginToken').open = true;
      note.textContent = 'Вхід за паролем ще не налаштовано у Vercel (ADMIN_PASSWORD і GITHUB_TOKEN). Поки можна увійти з GitHub-токеном.';
    } else {
      $('#loginPass').hidden = false;
      note.textContent = 'Увійдіть, щоб змінювати контент сайту.';
      $('#lpPass').focus();
    }
  } catch {
    $('#loginPass').hidden = true;
    $('#loginToken').open = true;
    note.textContent = 'Серверна частина адмінки недоступна. Увійдіть з GitHub-токеном.';
  }
}

function loginError(t){ const e = $('#loginErr'); e.textContent = t; e.hidden = false; }

$('#loginForm').onsubmit = async ev => {
  ev.preventDefault();
  if ($('#loginPass').hidden) return $('#ltGo').click();
  const btn = ev.submitter || $('#loginForm button[type=submit]');
  btn.disabled = true;
  try {
    const r = await api({ action: 'login', password: $('#lpPass').value }, false);
    Object.assign(A, { mode: 'server', auth: r.token, repo: r.repo, branch: r.branch });
    saveSession({ mode: 'server', auth: r.token, exp: r.exp, repo: r.repo, branch: r.branch });
    $('#lpPass').value = '';
    start();
  } catch (e){ loginError(e.message); }
  finally { btn.disabled = false; }
};

$('#ltGo').onclick = async () => {
  const token = $('#ltToken').value.trim(), repo = $('#ltRepo').value.trim(), branch = $('#ltBranch').value.trim() || 'main';
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return loginError('Вкажіть токен і репозиторій у форматі власник/назва');
  Object.assign(A, { mode: 'token', auth: token, repo, branch });
  const btn = $('#ltGo');
  btn.disabled = true;
  try {
    await gh('GET', `/contents/js/data.js?ref=${encodeURIComponent(branch)}`);
    saveSession({ mode: 'token', auth: token, repo, branch }, $('#ltRemember').checked);
    $('#ltToken').value = '';
    start();
  } catch (e){ A.mode = null; loginError(e.message); }
  finally { btn.disabled = false; }
};

$('#localGo').onclick = () => { Object.assign(A, { mode: 'local', auth: '' }); start(); };

$('#logout').onclick = async () => {
  if (isDirty() && !await confirmDlg('Вийти?', 'Неопубліковані зміни лишаться в чернетці на цьому пристрої й відновляться при наступному вході.', 'Вийти', 'Залишитись')) return;
  LS.del(K_SESSION);
  try { sessionStorage.removeItem(K_SESSION); } catch {}
  Object.assign(A, { mode: null, auth: '', data: null });
  location.hash = '';
  showLogin();
};

/* ================= старт робочої області ================= */
async function start(){
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#view').innerHTML = '<p class="loading">Завантажую дані…</p>';
  $('#modeLbl').textContent = { server: 'Вхід за паролем', token: `GitHub: ${A.repo}`, local: 'Без публікації' }[A.mode];
  $('#btnPublish').textContent = A.mode === 'local' ? 'Завантажити data.js' : 'Опублікувати';

  try {
    if (A.mode === 'local'){
      A.data = normalize(clone(SITE));
      A.base = null;
    } else {
      const r = await loadRemote();
      A.data = normalize(r.data);
      A.base = r.sha;
    }
  } catch (e){
    if (e.status === 401 || A.mode === null) return;
    $('#view').innerHTML = `<div class="fail"><h2>Не вдалося завантажити дані</h2><p>${esc(e.message)}</p>
      <button class="b b-acc" type="button" onclick="start()">Спробувати ще раз</button></div>`;
    return;
  }
  A.published = JSON.stringify(A.data);

  /* незбережені файли з минулого разу */
  const files = await idb.all();
  A.pending = {};
  Object.entries(files).forEach(([p, f]) => {
    const bytes = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0));
    A.pending[p] = { ...f, url: URL.createObjectURL(new Blob([bytes], { type: f.type })) };
  });

  const draft = LS.get(K_DRAFT);
  if (draft && draft.data && JSON.stringify(draft.data) !== A.published){
    if (draft.base === A.base || A.mode === 'local'){
      A.data = normalize(draft.data);
      toast('Відновлено неопубліковані зміни з минулого разу');
    } else if (await confirmDlg('Знайдено стару чернетку',
      `На цьому пристрої лишились неопубліковані зміни від ${new Date(draft.at).toLocaleString('uk-UA')}. Відтоді сайт уже оновлювали. Відновити чернетку? Тоді під час публікації вона замінить новіші дані.`,
      'Відновити чернетку', 'Почати з опублікованого')){
      A.data = normalize(draft.data);
    } else {
      LS.del(K_DRAFT);
    }
  }
  if (!location.hash) location.hash = 'apartments';
  renderState();
  route();
}

$('#btnPublish').onclick = publish;
$('#btnDiscard').onclick = async () => {
  if (!await confirmDlg('Скасувати всі зміни?', 'Усі неопубліковані правки буде втрачено, дані повернуться до опублікованої версії.', 'Скасувати зміни', 'Залишити', true)) return;
  A.data = normalize(JSON.parse(A.published));
  A.pending = {};
  await idb.clear();
  LS.del(K_DRAFT);
  renderState();
  rerender();
};
$('#btnPreview').onclick = () => {
  const withFiles = JSON.stringify(A.data, (k, v) => (typeof v === 'string' && A.pending[v]) ? `data:${A.pending[v].type};base64,${A.pending[v].b64}` : v);
  let ok = LS.set('svoyi_draft', JSON.parse(withFiles));
  if (!ok){
    ok = LS.set('svoyi_draft', A.data);
    if (ok) toast('Нові фото завеликі для перегляду, вони зʼявляться після публікації');
  }
  if (!ok) return alertDlg('Не вдалося відкрити перегляд', 'Браузер не дав зберегти чернетку. Спробуйте опублікувати зміни.');
  LS.set('svoyi_preview', 1);
  window.open('index.html', '_blank');
};

addEventListener('hashchange', () => { route(); scrollTo(0, 0); });
addEventListener('beforeunload', ev => { if (isDirty() && A.mode !== 'local'){ saveDraft(); } });
$('#dlg').addEventListener('click', ev => { if (ev.target === $('#dlg')) closeDlg(); });

(function boot(){
  const s = readSession();
  if (s){
    Object.assign(A, { mode: s.mode, auth: s.auth, repo: s.repo || A.repo, branch: s.branch || A.branch });
    start();
  } else showLogin();
})();
