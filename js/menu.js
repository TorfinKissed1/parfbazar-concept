/* Окно каталога: слева разделы, из-под них выезжает панель с подразделами выбранной группы.
   Группы повторяют рубрики будущего магазина: коллекции, характер, ноты, для кого, повод, объём. */
(function (PB) {
  const { esc, icon, mountDialog, dialogHead } = PB.ui;

  const capital = (text) => text[0].toUpperCase() + text.slice(1);

  // Ссылки ведут на каталог с готовым условием: схема параметров адреса общая с фильтром каталога.
  const GROUPS = [
    { title: 'Коллекции', links: [['Хиты', 'filter=hits'], ['Зимняя коллекция', 'filter=winter']] },
    { title: 'Характер', links: PB.moods.map((mood) => [mood.many, `moods=${mood.id}`]) },
    { title: 'Ноты', links: PB.notes.map((note) => [capital(note.id), `notes=${encodeURIComponent(note.id)}`]) },
    { title: 'Для кого', links: [['Для него', 'filter=men'], ['Унисекс', 'filter=unisex']] },
    { title: 'Повод', links: [['На каждый день', 'occasion=daily'], ['На свидание', 'occasion=date']] },
    { title: 'Объём', links: [['Тревел-формат 10 мл', 'ml=10'], ['Флакон 50 мл', 'ml=50']] },
  ];

  function groupsHtml() {
    return GROUPS.map((group, index) => `
      <button class="menu__link" type="button" data-menu-group="${index}" aria-expanded="false">
        ${group.title}${icon('chevron-right')}
      </button>`).join('');
  }

  function init() {
    const dialog = mountDialog(`
      <dialog class="dialog dialog--menu" id="menu" aria-labelledby="menu-title">
        <div class="menu" data-menu>
          <div class="menu__panel">
            ${dialogHead('Каталог', 'menu-title')}
            <div class="menu__body">
              <nav class="menu__list" aria-label="Разделы каталога">
                <a class="menu__link" href="catalog.html">Все ароматы</a>
                ${groupsHtml()}
              </nav>
              <div class="menu__extra">
                <a class="menu__more" href="index.html#set" data-close>Собрать сет</a>
                <button class="menu__more" type="button" data-open="quiz">Подбор аромата</button>
                <a class="menu__more" href="index.html#stores" data-close>Магазины</a>
              </div>
              <div class="menu__contacts">
                <a class="menu__contact" href="tel:+79150801691">+7 915 080-16-91</a>
                <a class="menu__contact" href="https://t.me/parfbazar" target="_blank" rel="noopener">Telegram</a>
                <a class="menu__contact" href="https://vk.com/parf_bazar" target="_blank" rel="noopener">ВКонтакте</a>
              </div>
            </div>
          </div>
          <div class="menu__sub" data-menu-sub>
            <button class="menu__back" type="button" data-menu-back>${icon('arrow-left', 'icon--size_s')}Назад</button>
            <p class="title title--size_h3 menu__heading" data-menu-heading></p>
            <nav class="menu__sublist" data-menu-sublist></nav>
          </div>
        </div>
      </dialog>`);
    const menu = dialog.querySelector('[data-menu]');
    const heading = dialog.querySelector('[data-menu-heading]');
    const sublist = dialog.querySelector('[data-menu-sublist]');
    const buttons = [...dialog.querySelectorAll('[data-menu-group]')];
    let opened = -1;

    function show(index) {
      opened = index;
      menu.classList.toggle('menu--sub', index >= 0);
      buttons.forEach((button, position) => {
        button.classList.toggle('menu__link--active', position === index);
        button.setAttribute('aria-expanded', position === index);
      });
      if (index < 0) return;
      const group = GROUPS[index];
      heading.textContent = group.title;
      sublist.innerHTML = group.links
        .map(([label, query]) => `<a class="menu__sublink" href="catalog.html?${query}">${esc(label)}</a>`).join('');
    }

    dialog.addEventListener('click', (event) => {
      const button = event.target.closest('[data-menu-group]');
      if (button) {
        const index = Number(button.dataset.menuGroup);
        show(index === opened ? -1 : index);
      } else if (event.target.closest('[data-menu-back]')) {
        show(-1);
      }
    });
    dialog.addEventListener('close', () => show(-1));
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.PB);
