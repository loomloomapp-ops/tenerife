/* Заставка на головній: логотип проявляється, по його контуру промальовується
   тонке кільце прогресу, далі кремовий екран піднімається вгору й відкриває банер.

   Показується лише при вході на сайт ззовні (рішення приймає скрипт у <head>
   index.html, він же ставить клас pl-on). Під заставкою сторінка вже
   завантажується як звичайно, тож при відкритті банер готовий.

   Кільце доходить до кінця, тільки коли спрацював window.load. Якщо щось
   вантажиться довго, заставка не тримає довше за MAX_WAIT. */

(function preloader(){
  const root = document.documentElement;
  const el = document.getElementById('preloader');
  if (!el) return;
  if (!root.classList.contains('pl-on') || !el.animate){
    root.classList.remove('pl-on');
    el.remove();
    return;
  }

  const logo = el.querySelector('.pl-logo');
  const mark = el.querySelector('.pl-mark');
  const ring = el.querySelector('.pl-ring circle');
  const cap = el.querySelector('.pl-cap');

  /* кільце в координатах viewBox 0-100, тому лінію 1.25px перераховуємо під його розмір */
  const LINE = 1.25;
  const svg = ring.ownerSVGElement;
  const fitLine = () => { if (svg.clientWidth) ring.style.strokeWidth = String(LINE * 100 / svg.clientWidth); };
  fitLine();
  addEventListener('resize', fitLine, { passive: true });

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const LOGO_DELAY = 300, LOGO_DUR = 900;   // 0.3 - 1.2 с
  const RING_START = 700, RING_DUR = 1600;  // стартує, коли логотип уже майже проявився
  const PAUSE = 180;                        // пауза між повним кільцем і відкриттям
  const REVEAL = 1000;                      // має збігатися з transition у .preloader
  const MAX_WAIT = 6000;

  let loaded = document.readyState === 'complete';
  if (!loaded) addEventListener('load', () => { loaded = true; }, { once: true });
  setTimeout(() => { loaded = true; }, MAX_WAIT);

  const done = () => {
    removeEventListener('resize', fitLine);
    el.remove();
    root.classList.remove('pl-on');
    document.dispatchEvent(new CustomEvent('preloader:done'));
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* стартуємо, коли логотип декодовано, щоб поява не почалась з порожнього кадру */
  const decoded = logo.decode ? logo.decode().catch(() => {}) : Promise.resolve();
  Promise.race([decoded, new Promise(r => setTimeout(r, 700))])
    .then(reduce ? calm : run);

  /* без руху: логотип одразу на місці, після завантаження короткий fade */
  function calm(){
    logo.style.opacity = '1';
    cap.style.opacity = '.55';
    ring.style.strokeDashoffset = '0';
    ring.style.strokeDasharray = 'none';
    const wait = () => loaded
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(done)
      : setTimeout(wait, 100);
    setTimeout(wait, 400);
  }

  function run(){
    const t0 = performance.now();

    logo.animate([
      { opacity: 0, transform: 'scale(0.88)', filter: 'blur(10px)' },
      { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }
    ], { duration: LOGO_DUR, delay: LOGO_DELAY, easing: EASE, fill: 'both' });

    cap.animate([
      { opacity: 0, transform: 'translateY(6px)' },
      { opacity: 0.55, transform: 'translateY(0)' }
    ], { duration: 800, delay: LOGO_DELAY + LOGO_DUR - 200, easing: EASE, fill: 'both' });

    /* Кільце малюємо по кадрах: поки сторінка не готова, воно зупиняється на 90%,
       а після load спокійно дотягується до кінця, без стрибка. */
    const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let shown = 0, last = t0;

    requestAnimationFrame(function frame(now){
      const dt = now - last; last = now;
      const t = Math.min(Math.max((now - t0 - RING_START) / RING_DUR, 0), 1);
      const goal = loaded ? easeInOut(t) : Math.min(easeInOut(t), 0.9);
      const step = dt / 350;
      shown = goal - shown > step ? shown + step : goal;
      ring.style.strokeDashoffset = String(1 - shown);
      /* на стику пунктиру лишається крапка: ховаємо її на старті, а на 100% знімаємо пунктир */
      ring.style.opacity = shown > 0.002 ? '1' : '0';
      if (shown >= 1) ring.style.strokeDasharray = 'none';

      if (t >= 1 && shown >= 1) setTimeout(out, PAUSE);
      else requestAnimationFrame(frame);
    });
  }

  function out(){
    mark.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }],
      { duration: REVEAL + 200, easing: EASE, fill: 'forwards' });
    el.classList.add('is-out');
    setTimeout(done, REVEAL + 60);
  }
})();
