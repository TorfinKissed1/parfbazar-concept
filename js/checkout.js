/* Оформление заказа: состав, доставка, проверка формы, экран «заказ принят». */
(function (PB) {
  const { cartListHtml, totalsHtml } = PB.ui;
  const store = PB.store;
  const ADDRESS_DELIVERY = 'cdek';

  function init() {
    const checkout = document.querySelector('[data-checkout]');
    const form = document.querySelector('[data-order-form]');
    const summary = document.querySelector('[data-summary]');
    const done = document.querySelector('[data-order-done]');
    const empty = document.querySelector('[data-order-empty]');
    const address = document.querySelector('[data-address]');
    let ordered = false;

    function delivery() {
      const input = form.querySelector('[name="delivery"]:checked');
      return { id: input.value, label: input.dataset.label, value: Number(input.dataset.cost) };
    }

    function orderHtml() {
      return `${cartListHtml(false)}<div class="checkout__totals">${totalsHtml(delivery())}</div>`;
    }

    function render() {
      if (ordered) return;
      const hasItems = store.count() > 0;
      checkout.hidden = !hasItems;
      empty.hidden = hasItems;
      if (hasItems) summary.innerHTML = orderHtml();
    }

    function syncAddress() {
      const needed = delivery().id === ADDRESS_DELIVERY;
      address.classList.toggle('checkout__address--open', needed);
      // Выключенное поле не проверяется и не мешает отправке при самовывозе.
      form.elements.address.disabled = !needed;
      if (!needed) form.elements.address.closest('.field').classList.remove('field--error');
    }

    PB.forms.bind(form);
    form.addEventListener('change', (event) => {
      if (event.target.name !== 'delivery') return;
      syncAddress();
      render();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!PB.forms.validate(form)) return;
      ordered = true;
      done.innerHTML = `
        ${PB.forms.successHtml('Менеджер свяжется с вами, чтобы подтвердить заказ.')}
        <div class="checkout-done__order">${orderHtml()}</div>
        <a class="button" href="catalog.html">Вернуться в каталог</a>`;
      store.clear();
      checkout.hidden = true;
      done.hidden = false;
      window.scrollTo({ top: 0 });
    });

    document.addEventListener('pb:cart', render);
    syncAddress();
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
