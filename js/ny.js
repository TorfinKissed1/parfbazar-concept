/* Новогодняя тема: ?ny=1 включает, ?ny=0 выключает, выбор живёт в sessionStorage до конца сеанса.
   Подключается в <head> без defer: класс на <html> ставится до первой отрисовки, без мигания. */
(function () {
  const STORAGE_KEY = 'parf-ny';
  const param = new URLSearchParams(window.location.search).get('ny');

  // sessionStorage бывает недоступен (приватный режим, запрет cookies): тогда тема держится только по параметру.
  let enabled = param === '1';
  try {
    if (param === '1') {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } else if (param === '0') {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      enabled = sessionStorage.getItem(STORAGE_KEY) === '1';
    }
  } catch (error) {
    // без хранилища тема просто не переживёт переход на другую страницу
  }

  if (!enabled) {
    return;
  }

  document.documentElement.classList.add('theme-ny');

  const TEXTS = {
    ticker: ['Новогодние сеты: 3 по 10 мл за 3 700 ₽', 'Подарки к Новому году'],
    lead: 'Соберите подарочный сет к Новому году',
  };
  const SET_IMAGE = 'img/gen/ny-set.webp';
  const BULB_COLORS = ['red', 'amber', 'green', 'milk'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Гирлянда рисуется горизонтальной; вертикальная получается заменой осей x и y.
  const SPAN = 110;
  const WIRE_Y = 3;
  const SAG = 16;
  const DEPTH = 36;

  function bulb(x, y, angle, index) {
    const color = BULB_COLORS[index % BULB_COLORS.length];
    const group = index % 3 + 1;
    // Отрицательная задержка: лампочки одной группы стартуют с разной фазы, мерцание идёт вразнобой.
    const delay = (Math.random() * 5).toFixed(2);
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})">
      <g class="ny-garland__bulb ny-garland__bulb--${color} ny-garland__bulb--group_${group}" style="animation-delay:-${delay}s">
        <rect class="ny-garland__cap" x="-2" y="0" width="4" height="4.5" rx="1"/>
        <path class="ny-garland__glass" d="M0 3.5C4.6 3.5 5 9 4.2 12C3.4 15.4 1.6 17 0 17C-1.6 17-3.4 15.4-4.2 12C-5 9-4.6 3.5 0 3.5Z"/>
        <ellipse class="ny-garland__shine" cx="-1.6" cy="8.5" rx="1" ry="2.6"/>
      </g>
    </g>`;
  }

  function garlandSvg(length, vertical) {
    const spans = Math.ceil(length / SPAN);
    let wire = `M0 ${WIRE_Y}`;
    let bulbs = '';
    let index = 0;

    for (let i = 0; i < spans; i++) {
      const start = i * SPAN;
      wire += ` Q${start + SPAN / 2} ${WIRE_Y + 2 * SAG} ${start + SPAN} ${WIRE_Y}`;
      // Точки на квадратичной кривой провода; лампочка висит поперёк провода, по касательной.
      [0.22, 0.5, 0.78].forEach((t) => {
        const y = WIRE_Y + 4 * SAG * t * (1 - t);
        const angle = Math.atan2(4 * SAG * (1 - 2 * t), SPAN) * 180 / Math.PI;
        bulbs += bulb(start + t * SPAN, y, angle, index);
        index += 1;
      });
    }

    const total = spans * SPAN;
    const inner = `<path class="ny-garland__wire" d="${wire}"/>${bulbs}`;
    const width = vertical ? DEPTH : total;
    const height = vertical ? total : DEPTH;
    const body = vertical ? `<g transform="matrix(0 1 1 0 0 0)">${inner}</g>` : inner;
    return `<svg class="ny-garland__svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function addGarland(parent, modifiers, length, vertical) {
    const garland = document.createElement('div');
    garland.className = ['ny-garland', ...modifiers.map((modifier) => `ny-garland--${modifier}`)].join(' ');
    garland.setAttribute('aria-hidden', 'true');
    garland.innerHTML = garlandSvg(length, vertical);
    parent.append(garland);
  }

  function addGarlands() {
    // Длина с запасом на самый большой экран: лишнее обрезает overflow, перерисовка при ресайзе не нужна.
    const maxWidth = Math.max(window.screen.width, window.innerWidth, 1920);
    const maxHeight = Math.max(window.screen.height, window.innerHeight, 1200) * 1.5;

    const header = document.querySelector('.header');
    if (header) {
      addGarland(header, ['top'], maxWidth, false);
    }
    addGarland(document.body, ['side', 'left'], maxHeight, true);
    addGarland(document.body, ['side', 'right'], maxHeight, true);
  }

  function replaceTexts() {
    document.querySelectorAll('.ticker__item').forEach((item, index) => {
      item.textContent = TEXTS.ticker[index % TEXTS.ticker.length];
    });

    const lead = document.querySelector('.hero__lead');
    if (lead) {
      lead.textContent = TEXTS.lead;
    }

    const setImage = document.querySelector('.set__image');
    if (setImage) {
      setImage.src = SET_IMAGE;
    }
  }

  function addBranches() {
    const hero = document.querySelector('.hero');
    if (!hero) {
      return;
    }
    const branches = document.createElement('div');
    branches.className = 'ny-branches';
    branches.setAttribute('aria-hidden', 'true');
    ['left', 'right'].forEach((side) => {
      const corner = document.createElement('span');
      corner.className = `ny-branches__corner ny-branches__corner--${side}`;
      branches.append(corner);
    });
    hero.prepend(branches);
  }

  function startSnow() {
    if (reducedMotion.matches) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'ny-snow';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);

    const context = canvas.getContext('2d');
    const styles = getComputedStyle(document.documentElement);
    const fill = styles.getPropertyValue('--color-ny-snow').trim();
    const edge = styles.getPropertyValue('--color-ny-snow-edge').trim();
    const flakes = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;

    function makeFlake(anywhere) {
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -6,
        radius: 1 + Math.random() * 1.6,
        speed: 14 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        sway: 6 + Math.random() * 10,
      };
    }

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      // Редкий снег: около 36 снежинок на экран, на телефоне вдвое меньше.
      const count = width < 768 ? 18 : 36;
      while (flakes.length < count) {
        flakes.push(makeFlake(true));
      }
      flakes.length = count;
    }

    function draw(now) {
      const seconds = Math.min((now - last) / 1000, 0.05);
      last = now;
      context.clearRect(0, 0, width, height);
      context.fillStyle = fill;
      context.strokeStyle = edge;
      context.lineWidth = 0.75;

      flakes.forEach((flake, index) => {
        flake.y += flake.speed * seconds;
        flake.phase += seconds * 0.6;
        if (flake.y > height + 6) {
          flakes[index] = makeFlake(false);
          return;
        }
        context.beginPath();
        context.arc(flake.x + Math.sin(flake.phase) * flake.sway, flake.y, flake.radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });

      frame = requestAnimationFrame(draw);
    }

    function play() {
      if (frame || document.hidden || reducedMotion.matches) {
        return;
      }
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    resize();
    play();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        stop();
        context.clearRect(0, 0, width, height);
      } else {
        play();
      }
    });
  }

  function init() {
    replaceTexts();
    addBranches();
    addGarlands();
    startSnow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
