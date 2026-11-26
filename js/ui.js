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
    return `<svg class="icon ${modifier}" aria-hidden="true"><use href="img/icons.svg#${name}"></use></svg>`;
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

  function priceHtml(item, modifier = '') {
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

  function cardHtml(product) {
    const item = store.volume(product, DEFAULT_ML);
    const badge = product.sections.includes('Хиты') ? '<span class="card__badge">Хит</span>' : '';
    const direction = product.direction ? `<p class="card__direction">Направление: ${esc(product.direction)}</p>` : '';
    return `
      <article class="card" data-card="${esc(product.slug)}" data-selected-ml="${DEFAULT_ML}">
        <span class="bottle card__media">
          <img class="bottle__image card__image" src="${productImage(product)}" alt="Флакон ${esc(product.title)}" width="720" height="900" loading="lazy">
        </span>
        ${badge}
        ${likeHtml(product, 'card__like')}
        <h3 class="title title--size_h3 card__title"><a class="card__link" href="${productUrl(product)}">${esc(product.title)}</a></h3>
        <p class="card__text">${esc(product.short)}</p>
        ${direction}
        <div class="card__bottom">
          <div class="card__buy">${volumesHtml(product, DEFAULT_ML)}${priceHtml(item)}</div>
          <button class="button button--wide" type="button" data-add>В корзину</button>
        </div>
      </article>`;
  }

  /* Окна */

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog(dialog) {
    if (!dialog.open || dialog.classList.contains('dialog--closing')) return;
    if (reduceMotion.matches) return dialog.close(); // без анимации animationend не придёт
    dialog.classList.add('dialog--closing');
    dialog.addEventListener('animationend', () => {
      dialog.classList.remove('dialog--closing');
      dialog.close();
    }, { once: true });
  }

  function mountDialog(html) {
    document.body.insertAdjacentHTML('beforeend', html);
    const dialog = document.body.lastElementChild;
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-close]')) closeDialog(dialog);
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

  function setProgressHtml(totals) {
    if (!totals.smallCount) return '';
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

  function toast(text, action) {
    document.querySelector('.toast')?.remove();
    clearTimeout(toastTimer);
    const button = action ? `<button class="button button--light button--size_s toast__action" type="button">${action.label}</button>` : '';
    document.body.insertAdjacentHTML('beforeend', `<div class="toast" role="status"><span>${text}</span>${button}</div>`);
    const node = document.body.lastElementChild;
    const hide = () => {
      node.classList.add('toast--closing');
      node.addEventListener('animationend', () => node.remove(), { once: true });
    };
    node.querySelector('.toast__action')?.addEventListener('click', () => {
      node.remove();
      action.run();
    });
    toastTimer = setTimeout(hide, 4500);
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
    document.body.append(flyer);
    requestAnimationFrame(() => {
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      flyer.style.transform = `translate(${dx}px, ${dy}px) scale(0.08)`;
      flyer.style.opacity = '0.2';
    });
    flyer.addEventListener('transitionend', () => flyer.remove(), { once: true });
  }

  function addToCart(product, ml, image, button) {
    store.add(product.slug, ml);
    flyToCart(image);
    if (button) {
      const label = button.textContent;
      button.textContent = 'Добавлено';
      button.classList.add('button--done');
      setTimeout(() => {
        button.textContent = label;
        button.classList.remove('button--done');
      }, 1400);
    }
    if (ml !== PB.SET_VOLUME) return;
    const totals = store.totals();
    const text = totals.setNeed
      ? `Ещё ${totals.setNeed} по ${PB.SET_VOLUME}&nbsp;мл, и три выйдут за ${PB.money(PB.SET_PRICE)}`
      : `Сет собран: три по ${PB.SET_VOLUME}&nbsp;мл за ${PB.money(PB.SET_PRICE)}`;
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
    if (event.target.closest('.card__link')) card.querySelector('.card__image').style.viewTransitionName = 'product-image';
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

  function init() {
    const cart = mountDialog(`
      <dialog class="dialog dialog--side cart" id="cart" aria-labelledby="cart-title">
        ${dialogHead('Корзина', 'cart-title')}
        <div class="dialog__body" data-cart-body></div>
        <div class="dialog__foot" data-cart-foot></div>
      </dialog>`);
    mountDialog(`
      <dialog class="dialog dialog--side dialog--left" id="menu" aria-labelledby="menu-title">
        ${dialogHead('Меню', 'menu-title')}
        <div class="dialog__body">
          <nav class="menu">
            <a class="menu__link" href="catalog.html">Каталог</a>
            <a class="menu__link" href="index.html#set" data-close>Собрать сет</a>
            <button class="menu__link" type="button" data-open="quiz">Подбор аромата</button>
            <a class="menu__link" href="index.html#stores" data-close>Магазины</a>
            <a class="menu__link" href="catalog.html?fav=1">Избранное</a>
          </nav>
          <div class="menu__contacts">
            <a href="tel:+79150801691">+7 915 080-16-91</a>
            <a href="https://t.me/parfbazar" target="_blank" rel="noopener">Telegram</a>
            <a href="https://vk.com/parf_bazar" target="_blank" rel="noopener">ВКонтакте</a>
          </div>
        </div>
      </dialog>`);

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
