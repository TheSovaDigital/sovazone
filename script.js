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
    const nav = header.querySelector(".site-header__nav");
    const dropdown = header.querySelector(".site-header__dropdown");
    const toggle = header.querySelector(".site-header__dropdown-toggle");

    if (burger && nav) {
      burger.addEventListener("click", function () {
        const opened = nav.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", String(opened));
      });
    }

    if (dropdown && toggle) {
      toggle.addEventListener("click", function (e) {
        if (window.innerWidth <= 980) {
          e.preventDefault();
        }
        const opened = dropdown.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(opened));
      });

      document.addEventListener("click", function (e) {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  Promise.all([
    inject("header-placeholder", "/header.html"),
    inject("footer-placeholder", "/footer.html")
  ]).then(initHeader);
})();
