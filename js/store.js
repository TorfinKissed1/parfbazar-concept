/* Товары, корзина, избранное и расчёт сета «три по 10 мл». */
window.PB = window.PB || {};

(function (PB) {
  const SET_SIZE = 3;
  const SET_PRICE = 3700;
  const SET_VOLUME = 10;
  const MAX_QTY = 99;
  const CART_KEY = 'pb-cart';
  const FAV_KEY = 'pb-fav';

  const products = window.PB_PRODUCTS;
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  function volume(product, ml) {
    return product.volumes.find((item) => item.ml === ml);
  }

  // В хранилище браузера может лежать что угодно: старая версия, чужая правка, товар, которого уже нет.
  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function validLine(line) {
    const product = line && bySlug.get(line.slug);
    return Boolean(product && volume(product, line.ml) && Number.isInteger(line.qty) && line.qty >= 1 && line.qty <= MAX_QTY);
  }

  let cart = readList(CART_KEY).filter(validLine).map(({ slug, ml, qty }) => ({ slug, ml, qty }));
  let favs = readList(FAV_KEY).filter((slug) => bySlug.has(slug));

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent('pb:cart'));
  }

  function findLine(slug, ml) {
    return cart.find((line) => line.slug === slug && line.ml === ml);
  }

  function add(slug, ml, qty = 1) {
    const line = findLine(slug, ml);
    if (line) {
      line.qty = Math.min(MAX_QTY, line.qty + qty);
    } else if (validLine({ slug, ml, qty })) {
      cart.push({ slug, ml, qty });
    }
    saveCart();
  }

  function setQty(slug, ml, qty) {
    if (qty < 1) return remove(slug, ml);
    const line = findLine(slug, ml);
    if (!line) return;
    line.qty = Math.min(MAX_QTY, qty);
    saveCart();
  }

  function remove(slug, ml) {
    cart = cart.filter((line) => !(line.slug === slug && line.ml === ml));
    saveCart();
  }

  function clear() {
    cart = [];
    saveCart();
  }

  function lines() {
    return cart.map((line) => {
      const product = bySlug.get(line.slug);
      const { price, old } = volume(product, line.ml);
      return { product, ml: line.ml, qty: line.qty, price, old };
    });
  }

  function count() {
    return cart.reduce((sum, line) => sum + line.qty, 0);
  }

  /* Каждые три флакона по 10 мл стоят 3 700 ₽. Тройки собираются от дорогих к дешёвым:
     так скидка получается наибольшей, а тройка из уценённых флаконов дороже не становится. */
  function totals() {
    const all = lines();
    const subtotal = all.reduce((sum, line) => sum + line.price * line.qty, 0);
    const small = all
      .filter((line) => line.ml === SET_VOLUME)
      .flatMap((line) => Array(line.qty).fill(line.price))
      .sort((a, b) => b - a);

    let discount = 0;
    for (let start = 0; start + SET_SIZE <= small.length; start += SET_SIZE) {
      const trio = small.slice(start, start + SET_SIZE).reduce((sum, price) => sum + price, 0);
      discount += Math.max(0, trio - SET_PRICE);
    }

    const rest = small.length % SET_SIZE;
    return {
      subtotal,
      discount,
      total: subtotal - discount,
      smallCount: small.length,
      setNeed: rest ? SET_SIZE - rest : 0,
    };
  }

  function toggleFav(slug) {
    favs = favs.includes(slug) ? favs.filter((item) => item !== slug) : [...favs, slug];
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    document.dispatchEvent(new CustomEvent('pb:fav'));
    return favs.includes(slug);
  }

  PB.SET_SIZE = SET_SIZE;
  PB.SET_PRICE = SET_PRICE;
  PB.SET_VOLUME = SET_VOLUME;

  PB.moods = [
    { id: 'sweet', label: 'Сладкий', many: 'Сладкие', image: 'img/gen/mood-sweet.webp' },
    { id: 'fresh', label: 'Свежий', many: 'Свежие', image: 'img/gen/mood-fresh.webp' },
    { id: 'warm', label: 'Тёплый и пряный', many: 'Тёплые и пряные', image: 'img/gen/mood-spicy.webp' },
    { id: 'floral', label: 'Цветочный', many: 'Цветочные', image: 'img/gen/mood-floral.webp' },
  ];

  PB.money = (value) => `${value.toLocaleString('ru-RU')} ₽`;

  PB.store = {
    products,
    get: (slug) => bySlug.get(slug),
    volume,
    add,
    setQty,
    remove,
    clear,
    lines,
    count,
    totals,
    isFav: (slug) => favs.includes(slug),
    favCount: () => favs.length,
    toggleFav,
  };
})(window.PB);
