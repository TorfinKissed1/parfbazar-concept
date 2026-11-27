/* Общий интерфейс всех страниц: карточка товара, окна, корзина, счётчики в шапке. */
(function (PB) {
  const store = PB.store;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const DEFAULT_ML = 50;

  // Тексты товаров приходят из выгрузки магазина, в разметку они попадают только через esc().
  function esc(text) {
    return String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }

  function icon(name, modifier = '') {
    return `<svg class="icon ${modifier}" aria-hidden="true"><use href="#${name}"></use></svg>`;
  }

  function plural(count, one, few, many) {
    const tail = count % 100;
    if (tail >= 11 && tail <= 14) return many;
    return [many, one, few, few, few][count % 10] || many;
  }

  function productImage(product, index = 0) {
    return `img/products/${product.images[index]}`;
  }

  function productUrl(product) {
    return `product.html?a=${encodeURIComponent(product.slug)}`;
  }

  function priceHtml(item, modifier = 'card__price') {
    const old = item.old > item.price ? ` <span class="price__old">${PB.money(item.old)}</span>` : '';
    return `<span class="price ${modifier}" data-price>${PB.money(item.price)}${old}</span>`;
  }

  function volumesHtml(product, activeMl) {
    const options = [...product.volumes].reverse().map((item) => {
      const active = item.ml === activeMl ? ' volumes__option--active' : '';
      return `<button class="volumes__option${active}" type="button" data-ml="${item.ml}" aria-pressed="${item.ml === activeMl}">${item.ml}&nbsp;мл</button>`;
    });
    return `<div class="volumes" role="group" aria-label="Объём">${options.join('')}</div>`;
  }

  function likeHtml(product, modifier = '') {
    const active = store.isFav(product.slug);
    return `<button class="like ${modifier}${active ? ' like--active' : ''}" type="button" data-like="${esc(product.slug)}"
      aria-label="В избранное" aria-pressed="${active}">${icon('heart', 'like__icon')}</button>`;
  }

  function cardHtml(product, ml = DEFAULT_ML) {
    const item = store.volume(product, ml);
    const badge = product.sections.includes('Хиты') ? '<span class="card__badge">Хит</span>' : '';
    return `
      <article class="card" data-card="${esc(product.slug)}" data-selected-ml="${ml}">
        <span class="bottle card__media">
          <img class="bottle__image card__image" src="${productImage(product)}" alt="Флакон ${esc(product.title)}" width="720" height="900" loading="lazy">
        </span>
        ${badge}
        ${likeHtml(product, 'card__like')}
        <h3 class="title title--size_h3 card__title"><a class="card__link" href="${productUrl(product)}">${esc(product.title)}</a></h3>
        <p class="card__text">${esc(product.short)}</p>
        <div class="card__bottom">
          <div class="card__buy">${volumesHtml(product, ml)}${priceHtml(item)}</div>
          <button class="button button--wide" type="button" data-add>В корзину</button>
        </div>
      </article>`;
  }

  /* Окна */

  // Окно открыли, пока оно закрывалось: снятый класс отменяет закрытие в closeDialog.
  function openDialog(dialog) {
    dialog.classList.remove('dialog--closing');
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (!dialog.open || dialog.classList.contains('dialog--closing')) return;
    if (reduceMotion.matches) return dialog.close(); // без анимации animationend не придёт
    dialog.classList.add('dialog--closing');
    const onEnd = (event) => {
      // animationend всплывает от вложенных элементов и приходит от ::backdrop: ждём только само окно.
      if (event.target !== dialog || event.pseudoElement) return;
      dialog.removeEventListener('animationend', onEnd);
      if (!dialog.classList.contains('dialog--closing')) return;
      dialog.classList.remove('dialog--closing');
      dialog.close();
    };
    dialog.addEventListener('animationend', onEnd);
  }

  function openedDialog() {
    return document.querySelector('dialog[open]:not(.dialog--closing)');
  }

  function mountDialog(html) {
    document.body.insertAdjacentHTML('beforeend', html);
    const dialog = document.body.lastElementChild;
    // Выделение текста в поле, отпущенное за краем окна, тоже даёт click по фону: закрываем,
    // только если и нажатие началось на фоне.
    let pressedBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => { pressedBackdrop = event.target === dialog; });
    dialog.addEventListener('click', (event) => {
      if ((event.target === dialog && pressedBackdrop) || event.target.closest('[data-close]')) closeDialog(dialog);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    return dialog;
  }

  function dialogHead(title, id) {
    return `<div class="dialog__head">
      <h2 class="title title--size_h3" id="${id}">${title}</h2>
      <button class="icon-button" type="button" data-close aria-label="Закрыть">${icon('close')}</button>
    </div>`;
  }

  /* Корзина */

  // Подсказки про сет честны, только когда сет дешевле флаконов по отдельности: тройка уценённых
  // и так стоит меньше 3 700 ₽. Для неполной тройки считаем, что докупят самые дорогие флаконы по 10 мл.
  function setPays(totals) {
    if (!totals.setNeed) return totals.discount > 0;
    const prices = store.lines()
      .filter((line) => line.ml === PB.SET_VOLUME)
      .flatMap((line) => Array(line.qty).fill(line.price))
      .sort((a, b) => a - b)
      .slice(0, PB.SET_SIZE - totals.setNeed);
    const topPrice = Math.max(...store.products.map((product) => store.volume(product, PB.SET_VOLUME)?.price || 0));
    const sum = prices.reduce((total, price) => total + price, 0) + totals.setNeed * topPrice;
    return sum > PB.SET_PRICE;
  }

  function setProgressHtml(totals) {
    if (!totals.smallCount || !setPays(totals)) return '';
    const filled = totals.setNeed ? PB.SET_SIZE - totals.setNeed : PB.SET_SIZE;
    const dots = Array.from({ length: PB.SET_SIZE }, (_, index) =>
      `<span class="set-progress__dot${index < filled ? ' set-progress__dot--filled' : ''}"></span>`).join('');
    const text = totals.setNeed
      ? `Ещё ${totals.setNeed} по ${PB.SET_VOLUME}&nbsp;мл, и три выйдут за ${PB.money(PB.SET_PRICE)}`
      : `Три по ${PB.SET_VOLUME}&nbsp;мл за ${PB.money(PB.SET_PRICE)}`;
    return `<div class="set-progress"><span class="set-progress__dots">${dots}</span><span>${text}</span></div>`;
  }

  function cartItemHtml(line, editable) {
    const key = `data-slug="${esc(line.product.slug)}" data-ml="${line.ml}"`;
    const controls = editable
      ? `<span class="stepper">
          <button class="stepper__button" type="button" data-qty="-1" aria-label="Меньше">${icon('minus', 'icon--size_s')}</button>
          <span class="stepper__value">${line.qty}</span>
          <button class="stepper__button" type="button" data-qty="1" aria-label="Больше">${icon('plus', 'icon--size_s')}</button>
        </span>`
      : `<span class="cart-item__meta">${line.qty}&nbsp;шт.</span>`;
    const remove = editable
      ? `<button class="icon-button cart-item__remove" type="button" data-remove aria-label="Удалить">${icon('close', 'icon--size_s')}</button>`
      : '';
    return `
      <li class="cart-item" ${key}>
        <span class="bottle cart-item__media"><img class="bottle__image" src="${productImage(line.product)}" alt="" width="76" height="96"></span>
        <div class="cart-item__info">
          <a class="cart-item__title" href="${productUrl(line.product)}">${esc(line.product.title)}</a>
          <span class="cart-item__meta">${line.ml}&nbsp;мл</span>
          <div class="cart-item__row">${controls}<span class="cart-item__price">${PB.money(line.price * line.qty)}</span></div>
        </div>
        ${remove}
      </li>`;
  }

  function cartListHtml(editable) {
    return `<ul class="cart__list">${store.lines().map((line) => cartItemHtml(line, editable)).join('')}</ul>`;
  }

  function totalsHtml(extra = { label: '', value: 0 }) {
    const totals = store.totals();
    const discount = totals.discount
      ? `<div class="totals__row totals__row--discount"><span>Сет три по ${PB.SET_VOLUME}&nbsp;мл</span><span>−${PB.money(totals.discount)}</span></div>`
      : '';
    const extraRow = extra.label
      ? `<div class="totals__row"><span>${extra.label}</span><span>${extra.value ? PB.money(extra.value) : 'Бесплатно'}</span></div>`
      : '';
    return `<div class="totals">
      <div class="totals__row"><span>Товары</span><span>${PB.money(totals.subtotal)}</span></div>
      ${discount}${extraRow}
      <div class="totals__row totals__row--total"><span>Итого</span><span>${PB.money(totals.total + extra.value)}</span></div>
    </div>`;
  }

  function renderCart(dialog) {
    const body = dialog.querySelector('[data-cart-body]');
    const foot = dialog.querySelector('[data-cart-foot]');
    const empty = store.count() === 0;
    foot.hidden = empty;
    if (empty) {
      body.innerHTML = `<div class="cart__empty"><p>В корзине пока ничего нет</p>
        <a class="button" href="catalog.html">Перейти в каталог</a></div>`;
      return;
    }
    body.innerHTML = setProgressHtml(store.totals()) + cartListHtml(true);
    foot.innerHTML = `${totalsHtml()}<a class="button button--wide" href="checkout.html">Оформить заказ</a>`;
  }

  function handleCartClick(event) {
    const item = event.target.closest('.cart-item');
    if (!item) return;
    const slug = item.dataset.slug;
    const ml = Number(item.dataset.ml);
    const step = event.target.closest('[data-qty]');
    if (step) {
      const line = store.lines().find((entry) => entry.product.slug === slug && entry.ml === ml);
      store.setQty(slug, ml, line.qty + Number(step.dataset.qty));
    } else if (event.target.closest('[data-remove]')) {
      store.remove(slug, ml);
    }
  }

  /* Счётчики, сообщения, полёт товара в корзину */

  function updateCounters() {
    const values = { '[data-cart-count]': store.count(), '[data-fav-count]': store.favCount() };
    Object.entries(values).forEach(([selector, value]) => {
      document.querySelectorAll(selector).forEach((badge) => {
        if (badge.textContent !== String(value)) {
          badge.classList.remove('icon-button__count--bump');
          void badge.offsetWidth; // перезапуск анимации счётчика
          badge.classList.add('icon-button__count--bump');
        }
        badge.textContent = value;
        badge.hidden = value === 0;
      });
    });
  }

  let toastTimer;

  function hideToast(node) {
    if (node.classList.contains('toast--closing')) return;
    if (reduceMotion.matches) return node.remove();
    node.classList.add('toast--closing');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }

  // Открытое окно лежит в верхнем слое: сообщение и летящее фото кладём внутрь него, иначе их не видно.
  function topLayer() {
    return openedDialog() || document.body;
  }

  function toast(text, action) {
    document.querySelectorAll('.toast').forEach(hideToast);
    clearTimeout(toastTimer);
    const button = action ? `<button class="button button--light button--size_s toast__action" type="button">${action.label}</button>` : '';
    const layer = topLayer();
    layer.insertAdjacentHTML('beforeend', `<div class="toast" role="status"><span>${text}</span>${button}</div>`);
    const node = layer.lastElementChild;
    node.querySelector('.toast__action')?.addEventListener('click', () => {
      hideToast(node);
      action.run();
    });
    toastTimer = setTimeout(() => hideToast(node), 4500);
  }

  function flyToCart(image) {
    const target = document.querySelector('[data-open="cart"]');
    if (!image || !target || reduceMotion.matches) return;
    const from = image.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const flyer = image.cloneNode();
    flyer.className = 'flyer';
    flyer.removeAttribute('style');
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    topLayer().append(flyer);
    requestAnimationFrame(() => {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      flyer.style.transform = `translate(${dx}px, ${dy}px) scale(0.08)`;
      flyer.style.opacity = '0.2';
    });
    flyer.addEventListener('transitionend', () => flyer.remove(), { once: true });
    setTimeout(() => flyer.remove(), 1000); // transitionend не приходит, если вкладку свернули
  }

  const doneTimers = new WeakMap();

  function addToCart(product, ml, image, button) {
    store.add(product.slug, ml);
    flyToCart(image);
    if (button) {
      // Исходную подпись запоминаем один раз: второй быстрый клик иначе запомнил бы «Добавлено».
      button.dataset.label ??= button.textContent;
      clearTimeout(doneTimers.get(button));
      button.textContent = 'Добавлено';
      button.classList.add('button--done');
      doneTimers.set(button, setTimeout(() => {
        button.textContent = button.dataset.label;
        button.classList.remove('button--done');
      }, 1400));
    }
    // Сообщение показывается после каждого добавления: одной смены подписи кнопки покупатель не замечает.
    const totals = store.totals();
    let text = `${esc(product.title)}, ${ml}&nbsp;мл в корзине`;
    if (ml === PB.SET_VOLUME && setPays(totals)) {
      text = totals.setNeed
        ? `Ещё ${totals.setNeed} по ${PB.SET_VOLUME}&nbsp;мл, и три выйдут за ${PB.money(PB.SET_PRICE)}`
        : `Сет собран: три по ${PB.SET_VOLUME}&nbsp;мл за ${PB.money(PB.SET_PRICE)}`;
    }
    toast(text, { label: 'Корзина', run: () => openDialog(document.getElementById('cart')) });
  }

  /* Карточки: объём, корзина, избранное */

  function handleCardClick(event) {
    const card = event.target.closest('[data-card]');
    if (!card) return;
    const product = store.get(card.dataset.card);
    const option = event.target.closest('.volumes__option');
    if (option) {
      const ml = Number(option.dataset.ml);
      card.dataset.selectedMl = ml;
      card.querySelectorAll('.volumes__option').forEach((node) => {
        const active = node === option;
        node.classList.toggle('volumes__option--active', active);
        node.setAttribute('aria-pressed', active);
      });
      card.querySelector('[data-price]').outerHTML = priceHtml(store.volume(product, ml));
      return;
    }
    const button = event.target.closest('[data-add]');
    if (button) {
      addToCart(product, Number(card.dataset.selectedMl), card.querySelector('.card__image'), button);
      return;
    }
    // Фото из карточки перелетает на страницу товара: имя перехода получает только нажатая карточка.
    if (event.target.closest('.card__link')) {
      document.querySelectorAll('.gallery__image--bottle').forEach((image) => { image.style.viewTransitionName = 'none'; });
      document.querySelectorAll('.card__image').forEach((image) => { image.style.viewTransitionName = ''; });
      card.querySelector('.card__image').style.viewTransitionName = 'product-image';
    }
  }

  function handleLikeClick(event) {
    const like = event.target.closest('[data-like]');
    if (!like) return;
    const active = store.toggleFav(like.dataset.like);
    document.querySelectorAll(`[data-like="${CSS.escape(like.dataset.like)}"]`).forEach((node) => {
      node.classList.toggle('like--active', active);
      node.setAttribute('aria-pressed', active);
    });
  }

  /* Появление блоков при прокрутке */

  function reveal(root = document) {
    const nodes = root.querySelectorAll('[data-reveal]:not(.reveal)');
    if (reduceMotion.matches || !nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
        entry.target.classList.add('reveal--visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((node) => {
      node.classList.add('reveal');
      node.style.setProperty('--reveal-delay', `${Number(node.dataset.reveal) * 0.08}s`);
      observer.observe(node);
    });
  }

  /* Окно каталога и нижняя навигация */

  // Адреса разделов читает каталог (js/catalog.js), схему менять вместе с ним.
  // Шапка и навигация одинаковы на всех страницах (их копирует сборка), текущий пункт отмечаем здесь.
  function markTab() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const fav = new URLSearchParams(location.search).get('filter') === 'fav';
    const tabs = { 'index.html': 'home', 'catalog.html': fav ? 'fav' : 'catalog', 'product.html': 'catalog', 'checkout.html': 'cart' };
    const item = document.querySelector(`.tabbar [data-tab="${tabs[page]}"]`);
    if (!item) return;
    item.classList.add('tabbar__item--active');
    if (item.tagName === 'A') item.setAttribute('aria-current', 'page');
  }

  function init() {
    const cart = mountDialog(`
      <dialog class="dialog dialog--side cart" id="cart" aria-labelledby="cart-title">
        ${dialogHead('Корзина', 'cart-title')}
        <div class="dialog__body" data-cart-body></div>
        <div class="dialog__foot" data-cart-foot></div>
      </dialog>`);
    markTab();

    renderCart(cart);
    cart.addEventListener('click', handleCartClick);
    document.addEventListener('pb:cart', () => {
      renderCart(cart);
      updateCounters();
    });
    document.addEventListener('pb:fav', updateCounters);
    updateCounters();

    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-open]');
      if (opener) {
        if (opener.closest('dialog')) closeDialog(opener.closest('dialog'));
        const target = document.getElementById(opener.dataset.open);
        if (target) openDialog(target);
        return;
      }
      const arrow = event.target.closest('[data-scroll]');
      if (arrow) {
        const rail = document.querySelector(arrow.dataset.scrollTarget);
        rail.scrollBy({ left: Number(arrow.dataset.scroll) * rail.clientWidth * 0.9, behavior: 'smooth' });
        return;
      }
      handleLikeClick(event);
      handleCardClick(event);
    });

    const header = document.querySelector('.header');
    const onScroll = () => header.classList.toggle('header--stuck', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    reveal();
  }

  PB.ui = {
    esc, icon, plural, productImage, productUrl, priceHtml, volumesHtml, likeHtml, cardHtml,
    openDialog, closeDialog, mountDialog, dialogHead, cartListHtml, totalsHtml,
    addToCart, toast, reveal, reduceMotion,
  };

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
