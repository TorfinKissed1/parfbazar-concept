/* Поиск в шапке: подсказки под полем, а на странице каталога событие pb:search для его фильтра. */
(function (PB) {
  const { esc, icon, productImage, productUrl, reduceMotion } = PB.ui;
  const MIN_LENGTH = 2;
  const LIMIT = 5;
  const MAX_LENGTH = 60;

  // Те же поля, что ищет каталог: подсказки и «Все результаты» не должны расходиться.
  function find(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (text) => words.every((word) => text.includes(word));
    return PB.store.products
      .map((product) => ({
        product,
        inTitle: matches(product.title.toLowerCase()),
        text: [product.title, product.short, product.notes, product.direction].join(' ').toLowerCase(),
      }))
      .filter((entry) => matches(entry.text))
      .sort((a, b) => Number(b.inTitle) - Number(a.inTitle))
      .slice(0, LIMIT)
      .map((entry) => entry.product);
  }

  function resultsHtml(query, list) {
    if (!list.length) return '<p class="site-search__empty">Ничего не нашлось</p>';
    const items = list.map((product) => {
      const meta = product.direction ? `Направление: ${esc(product.direction)}` : esc(product.short);
      return `<a class="site-search__item" href="${productUrl(product)}">
          <img class="site-search__thumb" src="${esc(productImage(product))}" alt="" width="44" height="56" loading="lazy">
          <span class="site-search__info">
            <span class="site-search__name">${esc(product.title)}</span>
            <span class="site-search__meta">${meta}</span>
          </span>
        </a>`;
    }).join('');
    const all = `<a class="site-search__all" href="catalog.html?q=${encodeURIComponent(query)}">Все результаты${icon('arrow-right', 'icon--size_s')}</a>`;
    return items + all;
  }

  // Каталог фильтрует сам: поле только сообщает ему запрос, страница не перезагружается.
  function initCatalog(form, input) {
    input.value = (new URLSearchParams(location.search).get('q') || '').slice(0, MAX_LENGTH);
    const send = () => document.dispatchEvent(new CustomEvent('pb:search', { detail: { query: input.value.trim() } }));
    input.addEventListener('input', send);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      send();
      input.blur();
    });
  }

  function initSuggest(form, input) {
    const panel = form.querySelector('[data-site-search-panel]');
    let pressing = false;

    const isOpen = () => form.classList.contains('site-search--open') && !form.classList.contains('site-search--closing');

    function open() {
      form.classList.remove('site-search--closing');
      form.classList.add('site-search--open');
    }

    function close() {
      if (!isOpen()) return;
      if (reduceMotion.matches) return form.classList.remove('site-search--open');
      form.classList.add('site-search--closing');
    }

    function suggest() {
      const query = input.value.trim();
      if (query.length < MIN_LENGTH) return close();
      panel.innerHTML = resultsHtml(query, find(query));
      open();
    }

    panel.addEventListener('animationend', (event) => {
      // Список успели открыть заново, пока он закрывался: тогда оставляем.
      if (event.target !== panel || !form.classList.contains('site-search--closing')) return;
      form.classList.remove('site-search--open', 'site-search--closing');
    });

    input.addEventListener('input', suggest);
    input.addEventListener('focus', suggest);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      event.preventDefault(); // иначе поле поиска заодно стирает текст
      close();
    });

    // Safari не переводит фокус на ссылку при нажатии: без этой отметки список закрылся бы до перехода.
    form.addEventListener('pointerdown', () => { pressing = true; });
    document.addEventListener('pointerup', () => { pressing = false; });
    form.addEventListener('focusout', (event) => {
      if (!pressing && !form.contains(event.relatedTarget)) close();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!form.contains(event.target)) close();
    });

    // Возврат кнопкой «Назад» достаёт страницу из кеша вместе с открытым списком.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) form.classList.remove('site-search--open', 'site-search--closing');
    });
  }

  function init() {
    const form = document.querySelector('[data-site-search-form]');
    if (!form) return;
    const input = form.querySelector('[data-site-search]');
    if (/catalog\.html$/.test(location.pathname)) initCatalog(form, input);
    else initSuggest(form, input);
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
