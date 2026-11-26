/* Формы: маска телефона, проверка полей, покупка в 1 клик. */
(function (PB) {
  const { esc, icon, productImage, mountDialog, dialogHead, openDialog } = PB.ui;
  const PHONE_LENGTH = 11;

  function phoneDigits(value) {
    let digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits[0] === '8') digits = `7${digits.slice(1)}`;
    else if (digits[0] !== '7') digits = `7${digits}`;
    return digits.slice(0, PHONE_LENGTH);
  }

  // Маска растёт вместе с цифрами: скобки и дефисы появляются, когда до них дошли.
  function formatPhone(digits) {
    if (!digits) return '';
    const number = digits.slice(1);
    let text = `+7 (${number.slice(0, 3)}`;
    if (number.length >= 3) text += `) ${number.slice(3, 6)}`;
    if (number.length > 6) text += `-${number.slice(6, 8)}`;
    if (number.length > 8) text += `-${number.slice(8, 10)}`;
    return text;
  }

  function maskPhone(input) {
    let previous = '';
    // Вставка заменяет поле целиком: иначе «+7 (» перед вставленным номером дало бы лишнюю семёрку.
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      previous = formatPhone(phoneDigits(event.clipboardData.getData('text')));
      input.value = previous;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', (event) => {
      let digits = phoneDigits(input.value);
      const erased = (event.inputType || '').startsWith('delete');
      // Стёрли скобку, пробел или дефис: цифры те же, значит убираем последнюю цифру.
      if (erased && digits === phoneDigits(previous)) digits = digits.slice(0, -1);
      // Осталось одно «+7»: чистим поле, иначе его не стереть.
      previous = erased && digits.length <= 1 ? '' : formatPhone(digits);
      input.value = previous;
    });
  }

  const RULES = {
    name: (value) => (value.trim().length >= 2 ? '' : 'Укажите имя'),
    phone: (value) => (phoneDigits(value).length === PHONE_LENGTH ? '' : 'Укажите корректный номер телефона'),
    email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? '' : 'Введите корректный email'),
    address: (value) => (value.trim().length >= 5 ? '' : 'Укажите город и пункт выдачи'),
  };

  function checkField(input) {
    const field = input.closest('.field');
    const message = RULES[input.dataset.rule](input.value);
    field.classList.toggle('field--error', Boolean(message));
    if (message) field.querySelector('.field__error-text').textContent = message;
    return !message;
  }

  function checkConsent(input) {
    input.closest('.check').classList.toggle('check--error', !input.checked);
    return input.checked;
  }

  function validate(form) {
    const inputs = [...form.querySelectorAll('[data-rule]:not(:disabled)')];
    const consents = [...form.querySelectorAll('[data-consent]')];
    const badInputs = inputs.filter((input) => !checkField(input));
    const badConsents = consents.filter((input) => !checkConsent(input));
    const first = badInputs[0] || badConsents[0];
    if (first) first.focus();
    return !first;
  }

  function bind(form) {
    form.noValidate = true;
    form.querySelectorAll('[data-rule="phone"]').forEach(maskPhone);
    form.addEventListener('input', (event) => {
      if (event.target.matches('[data-rule]')) event.target.closest('.field').classList.remove('field--error');
    });
    form.addEventListener('change', (event) => {
      if (event.target.matches('[data-consent]')) checkConsent(event.target);
    });
  }

  function fieldHtml({ name, label, rule, type = 'text', autocomplete = 'off', inputmode = 'text' }) {
    return `<label class="field">
      <span class="field__label">${label}</span>
      <input class="field__input" name="${name}" type="${type}" data-rule="${rule}" autocomplete="${autocomplete}" inputmode="${inputmode}">
      <span class="field__error" aria-live="polite"><span class="field__error-text"></span></span>
    </label>`;
  }

  function consentHtml() {
    return `<label class="check">
      <input class="check__input" type="checkbox" data-consent>
      <span class="check__box">${icon('check', 'icon--size_s')}</span>
      <span>Даю согласие на обработку <span class="check__link">персональных данных</span></span>
    </label>`;
  }

  function orderNumber() {
    return 1000 + Math.floor(Math.random() * 9000);
  }

  function successHtml(text) {
    return `<div class="order-done">
      <span class="order-done__mark">${icon('check')}</span>
      <h2 class="title title--size_h2">Заказ №&nbsp;${orderNumber()} принят</h2>
      <p class="order-done__text">${text}</p>
    </div>`;
  }

  /* Покупка в 1 клик */

  /* Варианты получения и оплаты повторяют форму оформления заказа (tools/pages/checkout.html):
     при правке менять в обоих местах. */
  const DELIVERY = [
    { id: 'cdek', title: 'СДЭК до пункта выдачи', note: '290&nbsp;₽', cost: 290, address: true },
    { id: 'spb', title: 'Самовывоз в Санкт-Петербурге', note: 'ТЦ «Европолис», 1&nbsp;этаж. Бесплатно', cost: 0 },
    { id: 'vn', title: 'Самовывоз в Великом Новгороде', note: 'ТЦ «Волна», 1&nbsp;этаж. Бесплатно', cost: 0 },
  ];
  const PAYMENT = [
    { id: 'online', title: 'Картой онлайн' },
    { id: 'receipt', title: 'При получении' },
  ];

  function choicesHtml(name, options) {
    return options.map((option, index) => `
      <label class="choice">
        <input class="choice__input" type="radio" name="${name}" value="${option.id}"${index ? '' : ' checked'}>
        <span class="choice__body">
          <span class="choice__title">${option.title}</span>
          ${option.note ? `<span class="choice__note">${option.note}</span>` : ''}
        </span>
      </label>`).join('');
  }

  let quickBuy;

  function openQuickBuy(product, ml) {
    quickBuy = quickBuy || mountDialog(`
      <dialog class="dialog" id="quick-buy" aria-labelledby="quick-buy-title">
        ${dialogHead('Купить в 1 клик', 'quick-buy-title')}
        <div class="dialog__body" data-quick-body></div>
      </dialog>`);
    const item = PB.store.volume(product, ml);
    const body = quickBuy.querySelector('[data-quick-body]');
    body.innerHTML = `
      <form class="quick-buy" data-quick-form>
        <div class="quick-buy__product">
          <span class="bottle quick-buy__media"><img class="bottle__image" src="${productImage(product)}" alt="" width="88" height="110"></span>
          <div class="quick-buy__info">
            <span class="title title--size_h3">${esc(product.title)}</span>
            <span class="muted">${ml}&nbsp;мл</span>
            ${PB.ui.priceHtml(item, '')}
          </div>
        </div>
        ${fieldHtml({ name: 'name', label: 'Имя', rule: 'name', autocomplete: 'name' })}
        ${fieldHtml({ name: 'phone', label: 'Телефон', rule: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel' })}
        ${fieldHtml({ name: 'email', label: 'Электронная почта', rule: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        <fieldset class="quick-buy__group">
          <legend class="quick-buy__legend">Получение</legend>
          ${choicesHtml('delivery', DELIVERY)}
          <div class="quick-buy__address quick-buy__address--open" data-quick-address>
            <div class="quick-buy__address-inner">
              ${fieldHtml({ name: 'address', label: 'Город и пункт выдачи', rule: 'address', autocomplete: 'street-address' })}
            </div>
          </div>
        </fieldset>
        <fieldset class="quick-buy__group">
          <legend class="quick-buy__legend">Оплата</legend>
          ${choicesHtml('payment', PAYMENT)}
        </fieldset>
        <button class="button button--wide" type="submit" data-quick-submit></button>
        ${consentHtml()}
      </form>`;
    const form = body.querySelector('[data-quick-form]');
    const address = form.querySelector('[data-quick-address]');
    const submit = form.querySelector('[data-quick-submit]');

    // Поле адреса нужно только для СДЭК; итог на кнопке считается вместе с доставкой.
    function syncDelivery() {
      const chosen = DELIVERY.find((option) => option.id === form.elements.delivery.value);
      address.classList.toggle('quick-buy__address--open', Boolean(chosen.address));
      form.elements.address.disabled = !chosen.address;
      if (!chosen.address) form.elements.address.closest('.field').classList.remove('field--error');
      submit.textContent = `Оформить заказ · ${PB.money(item.price + chosen.cost)}`;
    }

    bind(form);
    syncDelivery();
    form.addEventListener('change', (event) => {
      if (event.target.name === 'delivery') syncDelivery();
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validate(form)) return;
      const phone = esc(form.elements.phone.value);
      body.innerHTML = `${successHtml(`Менеджер позвонит по номеру ${phone}, чтобы подтвердить заказ.`)}
        <button class="button button--wide" type="button" data-close>Продолжить покупки</button>`;
    });
    openDialog(quickBuy);
  }

  PB.forms = { bind, validate, fieldHtml, consentHtml, successHtml, openQuickBuy };
})(window.PB);
