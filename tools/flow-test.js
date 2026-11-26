/* Сквозной сценарий покупателя: подбор, сет, карточка, товар, корзина, оформление, заказ принят.
   Запуск из корня проекта: NODE_PATH=<глобальные модули npm> node tools/flow-test.js
   Каждая проверка печатает строку «ок» или «СБОЙ» с тем, что увидела на странице. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8137';
let failed = 0;

// Цены на странице набраны с неразрывным пробелом, заголовки в верхнем регистре: сравниваем без этого.
const plain = (text) => text.replace(/\s+/g, ' ').toLowerCase();

function check(name, ok, seen) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ок  ' : 'СБОЙ'} ${name}: ${seen}`);
}

async function run(browser, width, height) {
  console.log(`\n== ${width}x${height}`);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const mobile = width <= 768;

  // Подбор аромата: три ответа, три карточки, «все три» кладёт сет в корзину.
  await page.goto(`${BASE}/index.html`);
  await page.waitForTimeout(1500);
  // Первый экран: перетаскивание вбок и стрелка листают флаконы.
  const heroName = () => page.locator('[data-hero-name]').innerText();
  const firstName = await heroName();
  await page.mouse.move(width / 2 + 80, 320);
  await page.mouse.down();
  await page.mouse.move(width / 2 - 80, 320, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const draggedName = await heroName();
  check('перетаскивание листает флакон', draggedName !== firstName, `${firstName} -> ${draggedName}`);
  await page.locator('[data-hero-step="-1"]').click();
  await page.waitForTimeout(300);
  check('стрелка возвращает прежний флакон', (await heroName()) === firstName, await heroName());

  await page.locator('.hero [data-open="quiz"]').click();
  for (let step = 0; step < 3; step += 1) {
    await page.locator('#quiz [data-answer]').first().click();
    await page.waitForTimeout(150);
  }
  const quizCards = await page.locator('#quiz .card').count();
  check('подбор выдаёт три аромата', quizCards === 3, `карточек ${quizCards}`);
  await page.locator('#quiz [data-take]').click();
  await page.waitForTimeout(700);
  const cartOpen = await page.locator('#cart').evaluate((node) => node.open);
  const totalAfterQuiz = await page.locator('#cart .totals__row--total').innerText();
  check('сет из подбора в корзине за 3 700', cartOpen && plain(totalAfterQuiz).includes('3 700'), totalAfterQuiz.replace(/\s+/g, ' '));
  await page.locator('#cart [data-close]').click();
  await page.waitForTimeout(500);

  // Сет на главной: ячейки заняты хитами, кнопка активна.
  const setButton = page.locator('[data-set-add]');
  check('сет на главной готов к покупке', !(await setButton.isDisabled()), await setButton.innerText());

  // Каталог: фильтр характера и переключение объёма.
  await page.goto(`${BASE}/catalog.html?moods=sweet&ml=10`);
  await page.waitForTimeout(1200);
  const firstPrice = await page.locator('.card [data-price]').first().innerText();
  check('каталог по ссылке показывает цены за 10 мл', /1 690|990|890/.test(plain(firstPrice)), firstPrice.replace(/\s+/g, ' '));

  // Поиск в шапке: подсказки на странице товара.
  await page.goto(`${BASE}/product.html?a=sigarets-and-love`);
  await page.waitForTimeout(1200);
  await page.locator('[data-site-search]').first().fill('ваниль');
  await page.waitForTimeout(500);
  const hints = await page.locator('a[href^="product.html?a="]:visible').count();
  check('поиск показывает подсказки', hints > 0, `видимых ссылок на товары ${hints}`);
  await page.keyboard.press('Escape');

  // Товар: 50 мл в корзину, потом покупка в 1 клик с маской телефона.
  await page.locator('.product [data-product-add]').click();
  await page.waitForTimeout(400);
  const count = await page.locator('[data-cart-count]:visible').first().innerText();
  check('товар добавлен, счётчик вырос', count === '4', `счётчик ${count}`);
  await page.locator('[data-quick]').click();
  await page.waitForTimeout(400);
  await page.locator('#quick-buy button[type="submit"]').click();
  const quickErrors = await page.locator('#quick-buy .field--error').count();
  check('пустая заявка показывает ошибки', quickErrors === 4, `полей с ошибкой ${quickErrors}`);
  const quickSubmit = page.locator('#quick-buy button[type="submit"]');
  check('итог заявки со СДЭК', plain(await quickSubmit.innerText()).includes('5 190'), plain(await quickSubmit.innerText()));
  await page.locator('#quick-buy input[value="spb"]').check({ force: true });
  check('итог заявки при самовывозе', plain(await quickSubmit.innerText()).includes('4 900'), plain(await quickSubmit.innerText()));
  const phone = page.locator('#quick-buy input[name="phone"]');
  await phone.pressSequentially('89991234567');
  check('маска телефона', (await phone.inputValue()) === '+7 (999) 123-45-67', await phone.inputValue());
  await phone.press('Backspace');
  await phone.press('Backspace');
  await phone.press('Backspace');
  check('стирание через дефис убирает цифры', (await phone.inputValue()) === '+7 (999) 123-4', await phone.inputValue());
  await phone.pressSequentially('567');
  await page.locator('#quick-buy input[name="name"]').fill('Анна');
  await page.locator('#quick-buy input[name="email"]').fill('anna@example.com');
  await page.locator('#quick-buy .check').click();
  await page.locator('#quick-buy button[type="submit"]').click();
  await page.waitForTimeout(300);
  const quickDone = await page.locator('#quick-buy .order-done').innerText();
  check('заявка в 1 клик принята', plain(quickDone).includes('принят'), quickDone.replace(/\s+/g, ' ').slice(0, 60));
  await page.locator('#quick-buy [data-close]').last().click();
  await page.waitForTimeout(500);

  // Оформление: самовывоз убирает доставку из итога, заказ принимается, корзина пустеет.
  await page.goto(`${BASE}/checkout.html`);
  await page.waitForTimeout(1200);
  const withDelivery = await page.locator('[data-summary] .totals__row--total').innerText();
  check('итог со СДЭК', plain(withDelivery).includes('8 890'), withDelivery.replace(/\s+/g, ' '));
  await page.locator('input[value="spb"]').check({ force: true });
  await page.waitForTimeout(300);
  const pickup = await page.locator('[data-summary] .totals__row--total').innerText();
  check('итог при самовывозе', plain(pickup).includes('8 600'), pickup.replace(/\s+/g, ' '));
  await page.locator('[data-order-form] input[name="name"]').fill('Анна');
  await page.locator('[data-order-form] input[name="phone"]').pressSequentially('9991234567');
  await page.locator('[data-order-form] input[name="email"]').fill('anna@example.com');
  await page.locator('[data-order-form] .check').click();
  await page.locator('[data-submit]').click();
  await page.waitForTimeout(500);
  const done = await page.locator('[data-order-done]').innerText();
  check('заказ принят', plain(done).includes('принят') && plain(done).includes('8 600'), done.replace(/\s+/g, ' ').slice(0, 70));
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('pb-cart')).length);
  check('корзина очищена', left === 0, `строк в корзине ${left}`);

  if (mobile) {
    const tabs = await page.locator('.tabbar a:visible, .tabbar button:visible').count();
    check('нижняя навигация на телефоне', tabs === 5, `пунктов ${tabs}`);
  }
  check('консоль без ошибок', errors.length === 0, errors.slice(0, 3).join(' | ') || 'чисто');
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 1440, 900);
  await run(browser, 390, 844);
  await browser.close();
  console.log(failed ? `\nСбоев: ${failed}` : '\nВсе проверки прошли');
  process.exit(failed ? 1 : 0);
})();
