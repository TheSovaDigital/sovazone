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
    const sideMenu = header.querySelector(".site-side-menu");
    const backdrop = header.querySelector(".site-side-menu__backdrop");
    const links = header.querySelectorAll(".site-side-menu__link");

    if (!burger || !sideMenu || !backdrop) return;

    function openMenu() {
      sideMenu.classList.add("is-open");
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add("is-visible"));
      burger.setAttribute("aria-expanded", "true");
      sideMenu.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("side-menu-open");
      document.body.classList.add("side-menu-open");
    }

    function closeMenu() {
      sideMenu.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
      burger.setAttribute("aria-expanded", "false");
      sideMenu.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("side-menu-open");
      document.body.classList.remove("side-menu-open");

      window.setTimeout(() => {
        if (!sideMenu.classList.contains("is-open")) {
          backdrop.hidden = true;
        }
      }, 220);
    }

    burger.addEventListener("click", function () {
      if (sideMenu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    backdrop.addEventListener("click", closeMenu);

    links.forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sideMenu.classList.contains("is-open")) {
        closeMenu();
      }
    });
  }

  Promise.all([
    inject("header-placeholder", "/header.html"),
    inject("footer-placeholder", "/footer.html")
  ]).then(initHeader);
})();
