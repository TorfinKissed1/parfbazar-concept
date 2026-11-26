/* Подбор аромата: три вопроса и три аромата в ответ. */
(function (PB) {
  const { cardHtml, mountDialog, dialogHead, openDialog, closeDialog } = PB.ui;
  const RESULT_SIZE = 3;

  const OCCASIONS = [
    { id: 'daily', label: 'На каждый день', trait: 'На работу' },
    { id: 'date', label: 'На свидание', trait: 'На свидание' },
    { id: 'any', label: 'Не важно', trait: '' },
  ];

  const STEPS = [
    { title: 'Какой аромат ближе?', options: () => PB.moods },
    { title: 'Что к нему добавить?', options: (answers) => [...PB.moods.filter((mood) => mood.id !== answers[0]), { id: 'none', label: 'Ничего' }] },
    { title: 'Для какого случая?', options: () => OCCASIONS },
  ];

  let dialog;
  let answers = [];

  function pick([main, extra, occasionId]) {
    const occasion = OCCASIONS.find((item) => item.id === occasionId);
    const score = (product) =>
      (product.moods.includes(extra) ? 2 : 0) +
      (occasion.trait && (product.traits['Повод'] || '').startsWith(occasion.trait) ? 1 : 0) +
      (product.sections.includes('Хиты') ? 1 : 0);
    return PB.store.products
      .filter((product) => product.moods.includes(main))
      .map((product, index) => ({ product, index, score: score(product) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, RESULT_SIZE)
      .map((entry) => entry.product);
  }

  function optionHtml(option) {
    const image = option.image ? `<img class="quiz__image" src="${option.image}" alt="" width="500" height="500">` : '';
    return `<button class="quiz__option${option.image ? ' quiz__option--image' : ''}" type="button" data-answer="${option.id}">
      ${image}<span class="quiz__label">${option.label}</span></button>`;
  }

  function render() {
    const body = dialog.querySelector('[data-quiz-body]');
    const step = STEPS[answers.length];
    if (step) {
      const back = answers.length ? '<button class="link quiz__back" type="button" data-back>Назад</button>' : '';
      body.innerHTML = `
        <div class="quiz__top"><span class="muted">${answers.length + 1} из ${STEPS.length}</span>${back}</div>
        <h3 class="title title--size_h2 quiz__title">${step.title}</h3>
        <div class="quiz__options">${step.options(answers).map(optionHtml).join('')}</div>`;
      return;
    }
    const result = pick(answers);
    body.innerHTML = `
      <div class="quiz__top"><span class="muted">Вам подойдут</span><button class="link quiz__back" type="button" data-restart>Пройти заново</button></div>
      <div class="quiz__result">${result.map((product) => cardHtml(product)).join('')}</div>
      <button class="button button--wide quiz__set" type="button" data-take>Все три по ${PB.SET_VOLUME}&nbsp;мл за ${PB.money(PB.SET_PRICE)}</button>`;
    body.querySelector('[data-take]').addEventListener('click', () => {
      result.forEach((product) => PB.store.add(product.slug, PB.SET_VOLUME));
      closeDialog(dialog);
      openDialog(document.getElementById('cart'));
    });
  }

  function handleClick(event) {
    const option = event.target.closest('[data-answer]');
    if (option) answers.push(option.dataset.answer);
    else if (event.target.closest('[data-back]')) answers.pop();
    else if (event.target.closest('[data-restart]')) answers = [];
    else return;
    render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    dialog = mountDialog(`
      <dialog class="dialog dialog--wide" id="quiz" aria-labelledby="quiz-title">
        ${dialogHead('Подбор аромата', 'quiz-title')}
        <div class="dialog__body quiz" data-quiz-body></div>
      </dialog>`);
    dialog.addEventListener('click', handleClick);
    dialog.addEventListener('close', () => {
      answers = [];
      render();
    });
    render();
  });
})(window.PB);
