/* Каталог: разделы, фильтр, поиск из шапки, сортировка, показ порциями. */
(function (PB) {
  const { cardHtml, plural, reveal, reduceMotion, esc, icon, mountDialog, dialogHead } = PB.ui;
  const store = PB.store;
  const PAGE_SIZE = 24;
  const SWIPE_CLOSE = 60;
  const PRICE_STEP = 50;
  const QUERY_MAX = 60;
  const BAR_THRESHOLD = 6;
  const VOLUMES = [50, 10];
  const narrow = matchMedia('(max-width: 1024px)');

  const SECTIONS = [
    { id: 'all', label: 'Все', test: () => true },
    { id: 'hits', label: 'Хиты', test: (product) => product.sections.includes('Хиты') },
    { id: 'winter', label: 'Зимняя коллекция', test: (product) => product.sections.includes('Зимняя коллекция') },
    { id: 'men', label: 'Мужские', test: (product) => product.sections.includes('Мужские') },
    { id: 'unisex', label: 'Унисекс', test: (product) => product.traits['Кому подойдут'] === 'Унисекс' },
    { id: 'fav', label: 'Избранное', test: (product) => store.isFav(product.slug) },
  ];

  const OCCASIONS = [
    { id: 'daily', label: 'На каждый день', prefix: 'На работу' },
    { id: 'date', label: 'На свидание', prefix: 'На свидание' },
  ];

  const price = (product, ml) => store.volume(product, ml).price;
  const SORTS = {
    popular: () => () => 0,
    cheap: (ml) => (a, b) => price(a, ml) - price(b, ml),
    expensive: (ml) => (a, b) => price(b, ml) - price(a, ml),
    title: () => (a, b) => a.title.localeCompare(b.title),
  };

  // Границы ползунка по ценам выбранного объёма, с округлением до шага.
  const BOUNDS = Object.fromEntries(VOLUMES.map((ml) => {
    const prices = store.products.filter((product) => store.volume(product, ml)).map((product) => price(product, ml));
    return [ml, {
      min: Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP,
      max: Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP,
    }];
  }));

  const cleanQuery = (value) => String(value || '').trim().slice(0, QUERY_MAX);

  function listParam(value, allowed) {
    return [...new Set((value || '').split(',').filter((item) => allowed.includes(item)))];
  }

  // Цена на границе или за ней ничего не ограничивает, поэтому превращается в «не задано».
  function priceParam(value, bounds) {
    if (!/^\d{1,7}$/.test(value || '')) return null;
    const number = Number(value);
    return number > bounds.min && number < bounds.max ? number : null;
  }

  // Состояние приходит из адреса страницы: всё неизвестное отбрасывается.
  function readState() {
    const params = new URLSearchParams(location.search);
    const moodIds = PB.moods.map((mood) => mood.id);
    const filter = params.get('fav') === '1' ? 'fav' : params.get('filter');
    // Старые ссылки: ?mood=sweet и ?filter=sweet, когда характеры были разделами.
    const moods = listParam([params.get('moods'), params.get('mood'), params.get('filter')].filter(Boolean).join(','), moodIds);
    const ml = params.get('ml') === '10' ? 10 : 50;
    let min = priceParam(params.get('min'), BOUNDS[ml]);
    let max = priceParam(params.get('max'), BOUNDS[ml]);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    const sort = params.get('sort');
    return {
      filter: SECTIONS.some((item) => item.id === filter) ? filter : 'all',
      moods,
      notes: listParam(params.get('notes'), PB.notes.map((note) => note.id)),
      occasion: listParam(params.get('occasion'), OCCASIONS.map((item) => item.id)),
      ml,
      min,
      max,
      sort: Object.hasOwn(SORTS, sort) ? sort : 'popular',
      query: cleanQuery(params.get('q')),
      shown: PAGE_SIZE,
    };
  }

  function optionHtml(group, value, label, count = '') {
    const tail = count ? `<span class="filter__amount">${count}</span>` : '';
    return `<label class="check filter__option">
      <input class="check__input" type="checkbox" value="${esc(value)}" data-group="${group}">
      <span class="check__box">${icon('check', 'icon--size_s')}</span>
      <span class="filter__label">${esc(label)}</span>${tail}
    </label>`;
  }

  function groupHtml(title, body) {
    return `<fieldset class="filter__group"><legend class="filter__title">${title}</legend><div class="filter__options">${body}</div></fieldset>`;
  }

  // Разметка фильтра одна: на широком экране она в колонке, на узком переезжает в окно.
  function filterHtml() {
    const volumes = VOLUMES.map((ml) => `<label class="filter__volume">
      <input class="filter__radio" type="radio" name="catalog-ml" value="${ml}">
      <span class="filter__volume-text">${ml}&nbsp;мл</span>
    </label>`).join('');
    const field = (edge, label) => `<label class="price-range__field">
      <span class="price-range__prefix">${label}</span>
      <input class="price-range__number" type="text" inputmode="numeric" autocomplete="off" aria-label="Цена ${label}" data-price-field="${edge}">
    </label>`;
    return `<div class="filter">
      <div class="filter__head">
        <p class="filter__count" data-filter-count></p>
        <button class="filter__reset" type="button" data-filter-reset>Сбросить</button>
      </div>
      <fieldset class="filter__group"><legend class="filter__title">Объём</legend><div class="filter__volumes">${volumes}</div></fieldset>
      <fieldset class="filter__group">
        <legend class="filter__title">Цена</legend>
        <div class="price-range">
          <div class="price-range__track" data-range-track>
            <input class="price-range__input" type="range" step="${PRICE_STEP}" aria-label="Цена от" data-range="min">
            <input class="price-range__input" type="range" step="${PRICE_STEP}" aria-label="Цена до" data-range="max">
          </div>
          <div class="price-range__fields">${field('min', 'от')}${field('max', 'до')}</div>
        </div>
      </fieldset>
      ${groupHtml('Характер', PB.moods.map((mood) => optionHtml('moods', mood.id, mood.many)).join(''))}
      ${groupHtml('Повод', OCCASIONS.map((item) => optionHtml('occasion', item.id, item.label)).join(''))}
      ${groupHtml('Ноты', PB.notes.map((note) => optionHtml('notes', note.id, note.id, note.count)).join(''))}
    </div>`;
  }

  function init() {
    const state = readState();
    const grid = document.querySelector('[data-grid]');
    const chips = document.querySelector('[data-chips]');
    const count = document.querySelector('[data-count]');
    const empty = document.querySelector('[data-empty]');
    const more = document.querySelector('[data-more]');
    const select = document.querySelector('[data-select]');
    const aside = document.querySelector('[data-filter-aside]');
    const badge = document.querySelector('[data-filter-badge]');
    const queryTag = document.querySelector('[data-query]');

    aside.innerHTML = filterHtml();
    const panel = aside.firstElementChild;
    const track = panel.querySelector('[data-range-track]');
    const ranges = { min: panel.querySelector('[data-range="min"]'), max: panel.querySelector('[data-range="max"]') };
    const fields = { min: panel.querySelector('[data-price-field="min"]'), max: panel.querySelector('[data-price-field="max"]') };

    const dialog = mountDialog(`
      <dialog class="dialog filter-dialog" id="catalog-filter" aria-labelledby="catalog-filter-title">
        ${dialogHead('Фильтры', 'catalog-filter-title')}
        <div class="dialog__body" data-filter-slot></div>
        <div class="dialog__foot"><button class="button button--wide" type="button" data-close data-filter-show></button></div>
      </dialog>`);
    const slot = dialog.querySelector('[data-filter-slot]');
    const showButton = dialog.querySelector('[data-filter-show]');

    function place() {
      panel.classList.toggle('filter--sheet', narrow.matches);
      if (narrow.matches) return slot.append(panel);
      if (dialog.open) dialog.close();
      aside.append(panel);
    }

    function priceEdges() {
      const bounds = BOUNDS[state.ml];
      return { min: state.min ?? bounds.min, max: state.max ?? bounds.max };
    }

    function found() {
      const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
      const section = SECTIONS.find((item) => item.id === state.filter);
      const occasions = OCCASIONS.filter((item) => state.occasion.includes(item.id));
      const edges = priceEdges();
      return store.products
        .filter((product) => store.volume(product, state.ml))
        .filter(section.test)
        .filter((product) => !state.moods.length || state.moods.some((mood) => product.moods.includes(mood)))
        .filter((product) => !state.notes.length || state.notes.some((note) => product.noteTags.includes(note)))
        .filter((product) => !occasions.length || occasions.some((item) => (product.traits['Повод'] || '').startsWith(item.prefix)))
        .filter((product) => price(product, state.ml) >= edges.min && price(product, state.ml) <= edges.max)
        .filter((product) => {
          const text = `${product.title} ${product.short} ${product.notes} ${product.direction}`.toLowerCase();
          return words.every((word) => text.includes(word));
        })
        .sort(SORTS[state.sort](state.ml));
    }

    // Условия колонки фильтра; раздел и запрос живут отдельно, над сеткой.
    function chosenCount() {
      const priceSet = state.min !== null || state.max !== null ? 1 : 0;
      return state.moods.length + state.notes.length + state.occasion.length + (state.ml !== 50 ? 1 : 0) + priceSet;
    }

    function saveState() {
      const params = new URLSearchParams();
      if (state.filter !== 'all') params.set('filter', state.filter);
      ['moods', 'notes', 'occasion'].forEach((name) => {
        if (state[name].length) params.set(name, state[name].join(','));
      });
      if (state.ml !== 50) params.set('ml', state.ml);
      if (state.min !== null) params.set('min', state.min);
      if (state.max !== null) params.set('max', state.max);
      if (state.sort !== 'popular') params.set('sort', state.sort);
      if (state.query) params.set('q', state.query);
      const query = params.toString();
      history.replaceState(null, '', query ? `?${query}` : location.pathname);
    }

    function syncFilter(total) {
      panel.querySelectorAll('[data-group]').forEach((input) => {
        input.checked = state[input.dataset.group].includes(input.value);
      });
      panel.querySelectorAll('.filter__radio').forEach((input) => {
        input.checked = Number(input.value) === state.ml;
      });
      const bounds = BOUNDS[state.ml];
      const edges = priceEdges();
      const span = bounds.max - bounds.min;
      // Запись в ползунок, который сейчас тянут, обрывает перетаскивание: пишем только изменившееся.
      ['min', 'max'].forEach((edge) => {
        const range = ranges[edge];
        if (Number(range.min) !== bounds.min || Number(range.max) !== bounds.max) Object.assign(range, { min: bounds.min, max: bounds.max });
        if (Number(range.value) !== edges[edge]) range.value = edges[edge];
        if (document.activeElement !== fields[edge]) fields[edge].value = edges[edge];
      });
      track.style.setProperty('--from', (edges.min - bounds.min) / span);
      track.style.setProperty('--to', (edges.max - bounds.min) / span);
      // Оба края у верхней границы: нижний поднимается наверх, иначе его не стащить из-под верхнего.
      ranges.min.classList.toggle('price-range__input--front', edges.min - bounds.min > span / 2);

      const chosen = chosenCount();
      const words = `${total} ${plural(total, 'аромат', 'аромата', 'ароматов')}`;
      panel.querySelector('[data-filter-count]').textContent = `Найдено ${words}`;
      panel.querySelector('[data-filter-reset]').disabled = chosen === 0;
      showButton.textContent = `Показать ${words}`;
      badge.textContent = chosen;
      badge.hidden = chosen === 0;
    }

    // Пока тянут ползунок, меняются только счётчики: сетка перестраивается при отпускании,
    // иначе страница на каждом шаге меняет высоту и ручка уезжает из-под пальца.
    function render({ preview = false } = {}) {
      const list = found();
      syncFilter(list.length);
      if (preview) return;
      chips.innerHTML = SECTIONS.map((item) => {
        const active = item.id === state.filter;
        return `<button class="chips__item${active ? ' chips__item--active' : ''}" type="button" data-filter="${item.id}" aria-pressed="${active}">${item.label}</button>`;
      }).join('');
      grid.innerHTML = list.slice(0, state.shown).map((product, index) =>
        `<div class="grid__item" data-reveal="${index % 3}">${cardHtml(product, state.ml)}</div>`).join('');
      count.textContent = `${list.length} ${plural(list.length, 'аромат', 'аромата', 'ароматов')}`;
      queryTag.hidden = !state.query;
      queryTag.querySelector('[data-query-text]').textContent = `По запросу: ${state.query}`;
      empty.hidden = list.length > 0;
      more.hidden = list.length <= state.shown;
      reveal(grid);
      saveState();
    }

    function update(change, options) {
      Object.assign(state, { shown: PAGE_SIZE }, change);
      render(options);
    }

    function setSearchField(value) {
      const field = document.querySelector('[data-site-search]');
      if (field) field.value = value;
    }

    const NO_FILTER = { moods: [], notes: [], occasion: [], ml: 50, min: null, max: null };

    chips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-filter]');
      if (chip) update({ filter: chip.dataset.filter });
    });

    panel.addEventListener('change', (event) => {
      const input = event.target;
      if (input.dataset.group) {
        const checked = panel.querySelectorAll(`[data-group="${input.dataset.group}"]:checked`);
        update({ [input.dataset.group]: [...checked].map((node) => node.value) });
      } else if (input.classList.contains('filter__radio')) {
        // Цены объёмов не пересекаются, прежний диапазон для другого объёма смысла не имеет.
        update({ ml: Number(input.value), min: null, max: null });
      } else if (input.dataset.range) {
        render();
      } else if (input.dataset.priceField) {
        const digits = input.value.replace(/\D/g, '').slice(0, 7);
        setPrice(input.dataset.priceField, digits ? Number(digits) : null);
        input.value = priceEdges()[input.dataset.priceField];
      }
    });

    panel.addEventListener('input', (event) => {
      const range = event.target.closest('[data-range]');
      if (range) setPrice(range.dataset.range, Number(range.value), { preview: true });
    });

    // Края не заходят друг за друга, значение на границе снимает ограничение.
    function setPrice(edge, value, options) {
      const bounds = BOUNDS[state.ml];
      const edges = priceEdges();
      if (edge === 'min') {
        const min = value === null ? bounds.min : Math.min(Math.max(value, bounds.min), edges.max);
        update({ min: min > bounds.min ? min : null }, options);
      } else {
        const max = value === null ? bounds.max : Math.max(Math.min(value, bounds.max), edges.min);
        update({ max: max < bounds.max ? max : null }, options);
      }
    }

    panel.querySelector('[data-filter-reset]').addEventListener('click', () => update(NO_FILTER));

    document.querySelector('[data-reset]').addEventListener('click', () => {
      setSearchField('');
      update({ ...NO_FILTER, filter: 'all', query: '' });
    });

    queryTag.querySelector('[data-query-clear]').addEventListener('click', () => {
      setSearchField('');
      update({ query: '' });
    });

    // Поле поиска в шапке шлёт запрос событием, каталог фильтрует сразу.
    document.addEventListener('pb:search', (event) => {
      const query = event.detail && event.detail.query;
      if (typeof query === 'string') update({ query: cleanQuery(query) });
    });

    more.addEventListener('click', () => {
      state.shown += PAGE_SIZE;
      render();
    });

    // Сердечко сняли в разделе «Избранное»: карточка уходит из списка.
    document.addEventListener('pb:fav', () => {
      if (state.filter === 'fav') render();
    });

    narrow.addEventListener('change', place);
    initSelect(select, state.sort, (sort) => update({ sort }));
    initBar(document.querySelector('[data-catalog-bar]'), document.querySelector('.catalog__head'),
      () => select.classList.contains('select--open') || dialog.open);
    place();
    render();

    const siteSearch = document.querySelector('[data-site-search]');
    if (siteSearch && state.query && !siteSearch.value) siteSearch.value = state.query;
    if (siteSearch && new URLSearchParams(location.search).get('focus') === 'search') siteSearch.focus();
  }

  /* Липкая полоса на узком экране: при прокрутке вниз уезжает под шапку, при движении вверх возвращается.
     Порог в несколько пикселей гасит дрожание от инерции пальца. */
  function initBar(bar, head, isPinned) {
    let lastY = scrollY;
    let queued = false;

    function update() {
      queued = false;
      const y = scrollY;
      // Пока полоса не прилипла, над ней заголовок: спрятанная, она наехала бы на него.
      const stuck = head.getBoundingClientRect().bottom < parseFloat(getComputedStyle(bar).top);
      if (!narrow.matches || !stuck || isPinned()) {
        bar.classList.remove('catalog__top--hidden');
        lastY = y;
        return;
      }
      if (Math.abs(y - lastY) < BAR_THRESHOLD) return;
      bar.classList.toggle('catalog__top--hidden', y > lastY);
      lastY = y;
    }

    addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });

    // Переход с клавиатуры в спрятанную полосу должен её показать.
    bar.addEventListener('focusin', () => bar.classList.remove('catalog__top--hidden'));
  }

  /* Список сортировки: под кнопкой на компьютере, листом снизу на телефоне. */
  function initSelect(select, value, onChange) {
    const button = select.querySelector('[data-select-button]');
    const label = select.querySelector('[data-select-label]');
    const short = select.querySelector('[data-select-short]');
    const panel = select.querySelector('.select__panel');
    const handle = select.querySelector('[data-select-handle]');
    const options = [...select.querySelectorAll('[data-value]')];

    function mark(current) {
      options.forEach((option) => {
        const active = option.dataset.value === current;
        option.classList.toggle('select__option--active', active);
        option.setAttribute('aria-selected', active);
        if (!active) return;
        label.textContent = option.textContent;
        short.textContent = option.dataset.short;
      });
    }

    // Сдвиг от свайпа снимается только после анимации: уезжать лист начинает с того места, где его отпустили.
    function close() {
      if (!select.classList.contains('select--open') || select.classList.contains('select--closing')) return;
      button.setAttribute('aria-expanded', 'false');
      const finish = () => {
        select.classList.remove('select--open', 'select--closing');
        panel.style.transform = '';
      };
      if (reduceMotion.matches) return finish();
      select.classList.add('select--closing');
      panel.addEventListener('animationend', finish, { once: true });
    }

    button.addEventListener('click', () => {
      if (select.classList.contains('select--open')) return close();
      select.classList.add('select--open');
      button.setAttribute('aria-expanded', 'true');
    });

    select.addEventListener('click', (event) => {
      const option = event.target.closest('[data-value]');
      if (option) {
        mark(option.dataset.value);
        onChange(option.dataset.value);
        close();
      } else if (event.target.closest('[data-select-close]')) {
        close();
      }
    });

    document.addEventListener('click', (event) => {
      if (!select.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    let startY = null;

    function settle() {
      panel.style.transition = 'transform 0.25s var(--ease-out)';
      panel.style.transform = '';
      panel.addEventListener('transitionend', () => { panel.style.transition = ''; }, { once: true });
    }

    handle.addEventListener('pointerdown', (event) => {
      startY = event.clientY;
      panel.style.transition = '';
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (startY === null) return;
      panel.style.transform = `translateY(${Math.max(0, event.clientY - startY)}px)`;
    });
    handle.addEventListener('pointerup', (event) => {
      if (startY === null) return;
      const moved = event.clientY - startY;
      startY = null;
      if (moved > SWIPE_CLOSE) close();
      else settle();
    });
    // Жест перехватила система (прокрутка, уведомление): лист возвращается на место.
    handle.addEventListener('pointercancel', () => {
      if (startY === null) return;
      startY = null;
      settle();
    });

    mark(value);
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
