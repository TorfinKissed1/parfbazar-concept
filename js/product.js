/* Страница товара: галерея, выбор объёма, покупка, похожие ароматы. */
(function (PB) {
  const { esc, icon, productImage, likeHtml, cardHtml, priceHtml, addToCart, reveal } = PB.ui;
  const store = PB.store;
  const DEFAULT_ML = 50;
  const RELATED_COUNT = 8;
  const VOLUME_NOTES = { 10: 'Тревел-формат', 50: 'Флакон с деревянной крышкой' };
  // В галерее магазина первым идёт флакон 50 мл, вторым 10 мл.
  const VOLUME_SLIDES = { 50: 0, 10: 1 };

  function related(product) {
    const shared = (a, b) => a.filter((item) => b.includes(item)).length;
    return store.products
      .filter((other) => other.slug !== product.slug)
      .map((other, index) => ({ other, index, score: shared(other.moods, product.moods) + shared(other.sections, product.sections) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, RELATED_COUNT)
      .map((entry) => entry.other);
  }

  function galleryHtml(product) {
    const slides = product.images.map((_, index) => {
      const bottle = index === 0 ? ' gallery__image--bottle' : '';
      return `<div class="gallery__slide"><img class="gallery__image${bottle}" src="${productImage(product, index)}"
        alt="${esc(product.title)}, фото ${index + 1}" width="1100" height="1375"${index ? ' loading="lazy"' : ''}></div>`;
    }).join('');
    const thumbs = product.images.map((_, index) =>
      `<button class="gallery__thumb${index ? '' : ' gallery__thumb--active'}" type="button" data-thumb="${index}" aria-label="Фото ${index + 1}">
        <img class="gallery__thumb-image" src="${productImage(product, index)}" alt="" width="72" height="90"></button>`).join('');
    return `<div class="gallery"><div class="gallery__track" data-track>${slides}</div><div class="gallery__thumbs">${thumbs}</div></div>`;
  }

  function optionsHtml(product) {
    return product.volumes.map((item) => `
      <button class="option${item.ml === DEFAULT_ML ? ' option--active' : ''}" type="button" data-option="${item.ml}" aria-pressed="${item.ml === DEFAULT_ML}">
        <span class="option__name">${item.ml}&nbsp;мл</span>
        <span class="option__note">${VOLUME_NOTES[item.ml] || ''}</span>
        ${priceHtml(item, 'option__price')}
      </button>`).join('');
  }

  function specsHtml(product) {
    const moods = PB.moods.filter((mood) => product.moods.includes(mood.id)).map((mood) => mood.many.toLowerCase());
    const rows = [
      ['Характер', moods.join(', ')],
      ...Object.entries(product.traits).filter(([name]) => name !== 'Аромат'),
      ['Доставка', 'СДЭК до пункта выдачи, 290 ₽'],
      ['Самовывоз', 'Санкт-Петербург и Великий Новгород'],
    ];
    return rows.filter(([, value]) => value).map(([name, value]) =>
      `<div class="specs__row"><span class="specs__name">${esc(name)}</span><span class="specs__value">${esc(value)}</span></div>`).join('');
  }

  function pageHtml(product) {
    const direction = product.direction ? `<p>Направление: <strong>${esc(product.direction)}</strong></p>` : '';
    const story = product.story.map((text) => `<p>${esc(text)}</p>`).join('');
    return `
      <div class="product">
        <div class="product__gallery">${galleryHtml(product)}</div>
        <div class="product__info">
          <nav class="crumbs" aria-label="Путь по сайту">
            <a class="crumbs__link" href="catalog.html">Каталог</a><span>/</span><span>${esc(product.title)}</span>
          </nav>
          <div class="product__intro">
            <div class="product__head">
              <h1 class="title title--size_h1">${esc(product.title)}</h1>
              ${likeHtml(product)}
            </div>
            <p class="lead">${esc(product.notes || product.short)}</p>
            ${direction}
          </div>
          <div class="options" role="group" aria-label="Объём">${optionsHtml(product)}</div>
          <div class="promo" data-promo>
            <div class="promo__inner">
              <a class="promo__link" href="index.html#set">
                <span>Три аромата по ${PB.SET_VOLUME}&nbsp;мл за ${PB.money(PB.SET_PRICE)}</span>${icon('arrow-right', 'icon--size_s')}
              </a>
            </div>
          </div>
          <div class="product__actions" data-actions>
            <button class="button product__button" type="button" data-product-add>В корзину</button>
            <button class="button button--ghost product__button" type="button" data-quick>Купить в 1 клик</button>
          </div>
          ${story ? `<div class="product__story">${story}</div>` : ''}
          <div class="specs">${specsHtml(product)}</div>
        </div>
      </div>`;
  }

  function initGallery(root) {
    const track = root.querySelector('[data-track]');
    const thumbs = [...root.querySelectorAll('[data-thumb]')];
    const show = (index) => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    thumbs.forEach((thumb) => thumb.addEventListener('click', () => show(Number(thumb.dataset.thumb))));
    track.addEventListener('scroll', () => {
      const current = Math.round(track.scrollLeft / track.clientWidth);
      thumbs.forEach((thumb, index) => thumb.classList.toggle('gallery__thumb--active', index === current));
    }, { passive: true });
    return show;
  }

  function init() {
    const root = document.querySelector('[data-product]');
    const product = store.get(new URLSearchParams(location.search).get('a'));
    if (!product) {
      root.innerHTML = `<div class="product__missing"><h1 class="title title--size_h1">Аромат не найден</h1>
        <a class="button" href="catalog.html">Перейти в каталог</a></div>`;
      return;
    }

    document.title = `${product.title}: Parf Bazar`;
    root.innerHTML = pageHtml(product);
    const showSlide = initGallery(root);
    const promo = root.querySelector('[data-promo]');
    const barInfo = document.querySelector('[data-buy-bar-info]');
    let ml = DEFAULT_ML;

    function selectVolume(next, scrollGallery) {
      ml = next;
      root.querySelectorAll('[data-option]').forEach((option) => {
        const active = Number(option.dataset.option) === ml;
        option.classList.toggle('option--active', active);
        option.setAttribute('aria-pressed', active);
      });
      promo.classList.toggle('promo--open', ml === PB.SET_VOLUME);
      barInfo.innerHTML = `<span class="muted">${ml}&nbsp;мл</span><strong>${PB.money(store.volume(product, ml).price)}</strong>`;
      if (scrollGallery && product.images[VOLUME_SLIDES[ml]]) showSlide(VOLUME_SLIDES[ml]);
    }

    root.addEventListener('click', (event) => {
      const option = event.target.closest('[data-option]');
      if (option) selectVolume(Number(option.dataset.option), true);
      if (event.target.closest('[data-quick]')) PB.forms.openQuickBuy(product, ml);
    });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-product-add]');
      if (button) addToCart(product, ml, root.querySelector('.gallery__image--bottle'), button);
    });

    // Полоса покупки на телефоне показывается, когда основные кнопки ушли вверх за экран.
    const bar = document.querySelector('[data-buy-bar]');
    new IntersectionObserver(([entry]) => {
      bar.classList.toggle('buy-bar--visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(root.querySelector('[data-actions]'));

    const others = related(product);
    document.querySelector('[data-related]').innerHTML = others
      .map((other, index) => `<div class="rail__item" data-reveal="${Math.min(index, 4)}">${cardHtml(other)}</div>`).join('');
    document.querySelector('[data-related-section]').hidden = false;

    selectVolume(DEFAULT_ML, false);
    reveal();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
