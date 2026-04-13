(function () {
  async function inject(id, path) {
    const el = document.getElementById(id);
    if (!el) return;

    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return;
      el.innerHTML = await res.text();
    } catch (err) {
      console.error("Failed to load fragment:", path, err);
    }
  }

  function initHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;

    const burger = header.querySelector(".site-header__burger");
    const moreMenu = header.querySelector(".site-header__more-menu");

    if (!burger || !moreMenu) return;

    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      const opened = moreMenu.classList.toggle("is-open");
      burger.classList.toggle("is-open", opened);
      burger.setAttribute("aria-expanded", String(opened));
    });

    moreMenu.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    document.addEventListener("click", function (e) {
      if (!header.contains(e.target)) {
        moreMenu.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        moreMenu.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  Promise.all([
    inject("header-placeholder", "/header.html"),
    inject("footer-placeholder", "/footer.html")
  ]).then(initHeader);
})();
