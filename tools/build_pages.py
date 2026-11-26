"""Собирает страницы концепта: шапка и подвал берутся из index.html, середина из tools/pages/.

index.html это образец: всё до <main> и после </main> переносится в остальные страницы.
Запуск из корня проекта: python -X utf8 tools/build_pages.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PARTS = ROOT / "tools" / "pages"

PAGES = {
    "catalog": "Каталог ароматов Parf Bazar",
    "product": "Аромат Parf Bazar",
    "checkout": "Оформление заказа Parf Bazar",
}


def main():
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    head, rest = source.split("<main>", 1)
    tail = rest.split("</main>", 1)[1]
    for name, title in PAGES.items():
        page_head = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", head)
        page_head = page_head.replace("css/home.css", f"css/{name}.css").replace("js/home.js", f"js/{name}.js")
        if page_head == head:
            raise SystemExit("в index.html не нашлись ссылки на home.css и home.js")
        body = (PARTS / f"{name}.html").read_text(encoding="utf-8").strip("\n")
        (ROOT / f"{name}.html").write_text(f"{page_head}<main>\n{body}\n  </main>{tail}", encoding="utf-8", newline="\n")
        print(f"{name}.html собран")


if __name__ == "__main__":
    main()
