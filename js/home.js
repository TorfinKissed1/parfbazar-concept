/* Главная: хиты, сет «три по 10 мл», характеры, истории, движение первого экрана. */
(function (PB) {
  const { esc, icon, plural, cardHtml, productImage, productUrl, mountDialog, dialogHead, openDialog, closeDialog, reveal, reduceMotion } = PB.ui;
  const store = PB.store;
  const STORY_COUNT = 5;
  const STORY_MIN_LENGTH = 60;

  function renderHits() {
    const hits = store.products.filter((product) => product.sections.includes('Хиты'));
    document.querySelector('[data-hits]').innerHTML = hits
      .map((product, index) => `<div class="rail__item" data-reveal="${Math.min(index, 4)}">${cardHtml(product)}</div>`)
      .join('');
  }

  function renderMoods() {
    document.querySelector('[data-moods]').innerHTML = PB.moods.map((mood, index) => {
      const count = store.products.filter((product) => product.moods.includes(mood.id)).length;
      return `
        <a class="mood" href="catalog.html?mood=${mood.id}" data-reveal="${index}">
          <span class="mood__media"><img class="mood__image" src="${mood.image}" alt="" width="1000" height="1000" loading="lazy"></span>
          <span class="title title--size_h3 mood__label">${mood.many}</span>
          <span class="muted">${count} ${plural(count, 'аромат', 'аромата', 'ароматов')}</span>
        </a>`;
    }).join('');
  }

  function renderStories() {
    const rail = document.querySelector('[data-stories]');
    const stories = store.products
      .filter((product) => product.story.length && product.story[0].length >= STORY_MIN_LENGTH)
      .slice(0, STORY_COUNT);
    rail.innerHTML = stories.map((product) => `
      <article class="story">
        <span class="bottle story__media"><img class="bottle__image" src="${productImage(product)}" alt="Флакон ${esc(product.title)}" width="720" height="900" loading="lazy"></span>
        <div class="story__body">
          <p class="story__quote">${esc(product.story[0])}</p>
          <h3 class="title title--size_h2">${esc(product.title)}</h3>
          <p class="story__notes">${esc(product.notes)}</p>
          <a class="button button--light" href="${productUrl(product)}">К аромату</a>
        </div>
      </article>`).join('');
    const scroll = (direction) => rail.scrollBy({ left: direction * rail.clientWidth, behavior: 'smooth' });
    document.querySelector('[data-stories-prev]').addEventListener('click', () => scroll(-1));
    document.querySelector('[data-stories-next]').addEventListener('click', () => scroll(1));
  }

  /* Сет: три ячейки, аромат в ячейку выбирается в окне со списком. */

  function initSet() {
    const slots = document.querySelector('[data-set-slots]');
    const addButton = document.querySelector('[data-set-add]');
    const picks = Array(PB.SET_SIZE).fill(null);
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

    function renderSlots() {
      slots.innerHTML = picks.map((slug, index) => {
        const product = slug && store.get(slug);
        if (!product) {
          return `<li class="slot"><button class="slot__pick" type="button" data-slot="${index}" aria-label="Выбрать аромат ${index + 1}">
            ${icon('plus')}<span class="slot__label">Аромат ${index + 1}</span></button></li>`;
        }
        return `<li class="slot slot--filled">
          <button class="slot__pick" type="button" data-slot="${index}" aria-label="Заменить ${esc(product.title)}">
            <img class="slot__image" src="${productImage(product)}" alt="" width="240" height="300">
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
      renderSlots();
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

  // Фото первого экрана уезжает медленнее страницы, текст уходит вверх и гаснет.
  function initHero() {
    const hero = document.querySelector('[data-hero]');
    if (reduceMotion.matches) return;
    let queued = false;
    const update = () => {
      queued = false;
      const height = hero.offsetHeight;
      const shift = Math.min(window.scrollY, height);
      hero.style.setProperty('--hero-shift', shift);
      hero.style.setProperty('--hero-fade', Math.max(0, 1 - shift / (height * 0.7)).toFixed(3));
    };
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHits();
    renderMoods();
    renderStories();
    initSet();
    initHero();
    reveal();
  });
})(window.PB);
