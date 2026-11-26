/* Главная: первый экран со сменой флаконов, хиты, сет «три по 10 мл», характеры. */
(function (PB) {
  const { esc, icon, cardHtml, productImage, productUrl, mountDialog, dialogHead, openDialog, closeDialog, reveal, reduceMotion } = PB.ui;
  const store = PB.store;

  // Флаконы без фона сняты отдельно, поэтому список первого экрана задан вручную.
  const SWIPE_DISTANCE = 40;
  const HERO_SLIDES = [
    { slug: 'sigarets-and-love', image: 'img/gen/cut-sigarets.webp' },
    { slug: 'pink-addiction', image: 'img/gen/cut-pink.webp' },
    { slug: 'angels-drink-too', image: 'img/gen/cut-angels.webp' },
    { slug: 'africa', image: 'img/gen/cut-africa.webp' },
  ];

  function initHero() {
    const hero = document.querySelector('[data-hero]');
    const bottles = hero.querySelector('[data-hero-bottles]');
    const dots = hero.querySelector('[data-hero-dots]');
    const swap = hero.querySelector('[data-hero-swap]');
    const slides = HERO_SLIDES.map((slide) => ({ ...slide, product: store.get(slide.slug) })).filter((slide) => slide.product);
    let current = 0;

    slides.slice(1).forEach((slide) => {
      bottles.insertAdjacentHTML('beforeend',
        `<img class="hero__bottle" src="${slide.image}" alt="Флакон ${esc(slide.product.title)}" width="751" height="1200">`);
    });
    dots.innerHTML = slides.map((slide, index) =>
      `<button class="hero__dot${index ? '' : ' hero__dot--active'}" type="button" data-hero-dot="${index}" aria-label="${esc(slide.product.title)}"></button>`).join('');
    const images = [...bottles.children];
    const buttons = [...dots.children];

    function show(next) {
      if (next === current) return;
      const { product } = slides[next];
      images.forEach((image, index) => {
        image.classList.toggle('hero__bottle--active', index === next);
        image.classList.toggle('hero__bottle--leaving', index === current);
      });
      buttons.forEach((button, index) => button.classList.toggle('hero__dot--active', index === next));
      const leaving = images[current];
      setTimeout(() => leaving.classList.remove('hero__bottle--leaving'), 900);
      current = next;

      hero.querySelector('[data-hero-count]').textContent = `${String(next + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      const name = hero.querySelector('[data-hero-name]');
      name.textContent = product.title;
      name.href = productUrl(product);
      hero.querySelector('[data-hero-notes]').textContent = product.notes || product.short;
      hero.querySelector('[data-hero-price]').textContent = `от ${PB.money(store.volume(product, PB.SET_VOLUME).price)}`;
      hero.querySelector('[data-hero-link]').href = productUrl(product);
      swap.classList.remove('hero__swap--run');
      void swap.offsetWidth; // перезапуск анимации подписи
      swap.classList.add('hero__swap--run');
    }

    const step = (direction) => show((current + direction + slides.length) % slides.length);

    dots.addEventListener('click', (event) => {
      const dot = event.target.closest('[data-hero-dot]');
      if (dot) show(Number(dot.dataset.heroDot));
    });
    hero.addEventListener('click', (event) => {
      const arrow = event.target.closest('[data-hero-step]');
      if (arrow) step(Number(arrow.dataset.heroStep));
    });

    // Флаконы листаются перетаскиванием: мышью или пальцем вбок по первому экрану.
    let dragStart = null;
    const endDrag = () => {
      dragStart = null;
      hero.classList.remove('hero--dragging');
    };
    hero.addEventListener('pointerdown', (event) => {
      if (event.target.closest('a, button')) return;
      dragStart = event.clientX;
      hero.classList.add('hero--dragging');
    });
    hero.addEventListener('pointerup', (event) => {
      if (dragStart === null) return;
      const moved = event.clientX - dragStart;
      endDrag();
      if (Math.abs(moved) >= SWIPE_DISTANCE) step(moved < 0 ? 1 : -1);
    });
    hero.addEventListener('pointercancel', endDrag);
    hero.addEventListener('pointerleave', endDrag);
    // Автосмена идёт от анимации полоски: полоска заполнилась, показываем следующий флакон.
    dots.addEventListener('animationend', () => step(1));

    if (reduceMotion.matches) return;

    let queued = false;
    let pointerX = 0;
    let pointerY = 0;
    const update = () => {
      queued = false;
      hero.style.setProperty('--hero-shift', Math.min(window.scrollY, hero.offsetHeight));
      hero.style.setProperty('--hero-mx', pointerX.toFixed(3));
      hero.style.setProperty('--hero-my', pointerY.toFixed(3));
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', queue, { passive: true });
    if (matchMedia('(hover: hover)').matches) {
      hero.addEventListener('pointermove', (event) => {
        const box = hero.getBoundingClientRect();
        pointerX = (event.clientX - box.left) / box.width - 0.5;
        pointerY = (event.clientY - box.top) / box.height - 0.5;
        queue();
      });
    }
  }

  function renderHits() {
    const hits = store.products.filter((product) => product.sections.includes('Хиты'));
    document.querySelector('[data-hits]').innerHTML = hits
      .map((product) => `<div class="rail__item">${cardHtml(product)}</div>`)
      .join('');
  }

  function renderMoods() {
    document.querySelector('[data-moods]').innerHTML = PB.moods.map((mood, index) => {
      return `
        <a class="mood" href="catalog.html?mood=${mood.id}" data-reveal="${index}">
          <span class="mood__media"><img class="mood__image" src="${mood.image}" alt="" width="1000" height="1000" loading="lazy"></span>
          <span class="title title--size_h3 mood__label">${mood.many}</span>
        </a>`;
    }).join('');
  }

  /* Сет: три ячейки, аромат в ячейку выбирается в окне со списком. */

  function initSet() {
    const slots = document.querySelector('[data-set-slots]');
    const addButton = document.querySelector('[data-set-add]');
    // Ячейки сразу заняты хитами: блок выглядит готовым предложением, каждый аромат можно заменить.
    const picks = store.products.filter((product) => product.sections.includes('Хиты')).slice(0, PB.SET_SIZE).map((product) => product.slug);
    let activeSlot = 0;

    const picker = mountDialog(`
      <dialog class="dialog" id="picker" aria-labelledby="picker-title">
        ${dialogHead('Выберите аромат', 'picker-title')}
        <div class="dialog__body">
          <label class="field picker__search">
            <span class="visually-hidden">Поиск</span>
            <input class="field__input" type="search" placeholder="Название или нота" data-picker-search>
          </label>
          <ul class="picker__list" data-picker-list></ul>
        </div>
      </dialog>`);
    const search = picker.querySelector('[data-picker-search]');
    const list = picker.querySelector('[data-picker-list]');

    function renderList() {
      const query = search.value.trim().toLowerCase();
      const found = store.products.filter((product) =>
        `${product.title} ${product.short} ${product.notes} ${product.direction}`.toLowerCase().includes(query));
      list.innerHTML = found.length
        ? found.map((product) => `
          <li class="picker-item">
            <span class="bottle picker-item__media"><img class="bottle__image" src="${productImage(product)}" alt="" width="56" height="70" loading="lazy"></span>
            <div class="picker-item__info">
              <span class="title title--size_h3">${esc(product.title)}</span>
              <span class="picker-item__text">${esc(product.short)}</span>
            </div>
            <button class="button button--ghost button--size_s" type="button" data-pick="${esc(product.slug)}">Выбрать</button>
          </li>`).join('')
        : '<li class="picker__empty">Ничего не нашлось</li>';
    }

    // freshIndex: ячейка, в которую флакон попал только что. Запрыгивает только он.
    function renderSlots(freshIndex = -1) {
      slots.innerHTML = picks.map((slug, index) => {
        const product = slug && store.get(slug);
        if (!product) {
          return `<li class="slot"><button class="slot__pick" type="button" data-slot="${index}" aria-label="Выбрать аромат ${index + 1}">
            ${icon('plus')}<span class="slot__label">Аромат ${index + 1}</span></button></li>`;
        }
        return `<li class="slot slot--filled">
          <button class="slot__pick" type="button" data-slot="${index}" aria-label="Заменить ${esc(product.title)}">
            <img class="slot__image${index === freshIndex ? ' slot__image--fresh' : ''}" src="${productImage(product)}" alt="" width="240" height="300">
            <span class="slot__label">${esc(product.title)}</span>
          </button>
          <button class="icon-button slot__remove" type="button" data-slot-remove="${index}" aria-label="Убрать ${esc(product.title)}">${icon('close', 'icon--size_s')}</button>
        </li>`;
      }).join('');

      const left = picks.filter((slug) => !slug).length;
      const sum = picks.filter(Boolean).reduce((total, slug) => total + store.volume(store.get(slug), PB.SET_VOLUME).price, 0);
      addButton.disabled = left > 0;
      if (left === PB.SET_SIZE) addButton.textContent = 'Выберите три аромата';
      else if (left > 0) addButton.textContent = `Выберите ещё ${left}`;
      else addButton.textContent = `В корзину за ${PB.money(Math.min(sum, PB.SET_PRICE))}`;
    }

    slots.addEventListener('click', (event) => {
      const removal = event.target.closest('[data-slot-remove]');
      if (removal) {
        picks[Number(removal.dataset.slotRemove)] = null;
        renderSlots();
        return;
      }
      const slot = event.target.closest('[data-slot]');
      if (!slot) return;
      activeSlot = Number(slot.dataset.slot);
      search.value = '';
      renderList();
      openDialog(picker);
    });

    search.addEventListener('input', renderList);
    list.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-pick]');
      if (!pick) return;
      picks[activeSlot] = pick.dataset.pick;
      renderSlots(activeSlot);
      closeDialog(picker);
    });

    addButton.addEventListener('click', () => {
      picks.forEach((slug) => store.add(slug, PB.SET_VOLUME));
      picks.fill(null);
      renderSlots();
      openDialog(document.getElementById('cart'));
    });

    renderSlots();
  }

  /* Карта магазинов на JS API Яндекс.Карт: из элементов управления только масштаб и «моё местоположение».
     Скрипт карт подгружается, когда секция подходит к экрану, чтобы не тормозить загрузку страницы. */
  const STORES = [
    { title: 'Санкт-Петербург', address: 'ТЦ «Европолис», 1 этаж', coords: [59.9875646, 30.3537971] },
    { title: 'Великий Новгород', address: 'ТЦ «Волна», 1 этаж', coords: [58.5387276, 31.2621979] },
  ];
  const STORE_ZOOM = 16;

  function initStores() {
    const container = document.querySelector('[data-map]');
    const buttons = [...document.querySelectorAll('[data-map-store]')];
    let map = null;
    let shown = -1;

    function showAll() {
      map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 60, duration: 400 });
    }

    function build() {
      map = new window.ymaps.Map(container, { center: [59.27, 30.81], zoom: 7, controls: [] }, { suppressMapOpenBlock: true });
      map.controls.add('zoomControl', { size: 'small' });
      map.controls.add('geolocationControl');
      STORES.forEach((store) => {
        map.geoObjects.add(new window.ymaps.Placemark(store.coords,
          { balloonContentHeader: store.title, balloonContentBody: store.address, hintContent: store.address },
          { preset: 'islands#dotIcon', iconColor: '#5e3820' }));
      });
      showAll();
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const script = document.createElement('script');
      script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
      script.onload = () => window.ymaps.ready(build);
      document.head.append(script);
    }, { rootMargin: '600px' });
    observer.observe(container);

    // Кнопка у магазина приближает карту к нему, повторное нажатие возвращает обе точки.
    buttons.forEach((button, index) => button.addEventListener('click', () => {
      if (!map) return;
      shown = shown === index ? -1 : index;
      if (shown === -1) showAll();
      else map.setCenter(STORES[shown].coords, STORE_ZOOM, { duration: 400 });
      buttons.forEach((node, position) => {
        node.textContent = position === shown ? 'Показать оба магазина' : 'Показать на карте';
      });
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHero();
    initStores();
    renderHits();
    renderMoods();
    initSet();
    reveal();
  });
})(window.PB);
