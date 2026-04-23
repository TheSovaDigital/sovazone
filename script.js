(function () {
  function buildCounterpartPath(targetLang) {
    var path = window.location.pathname || "/";
    var search = window.location.search || "";
    var hash = window.location.hash || "";

    function normalizeRoot(p) {
      if (!p || p === "/") return "/index.html";
      return p;
    }

    if (targetLang === "en") {
      if (path === "/" || path === "/index.html") return "/en/index.html" + search + hash;
      if (path.indexOf("/en/") === 0) return path + search + hash;
      return "/en" + normalizeRoot(path) + search + hash;
    }

    if (targetLang === "ru") {
      if (path.indexOf("/en/") === 0) {
        var ruPath = path.replace(/^\/en/, "");
        ruPath = normalizeRoot(ruPath);
        return ruPath + search + hash;
      }
      return normalizeRoot(path) + search + hash;
    }

    return "/";
  }

  function updateLanguageSwitch() {
    document.querySelectorAll("[data-lang-target]").forEach(function (link) {
      var targetLang = link.getAttribute("data-lang-target");
      if (!targetLang) return;
      link.setAttribute("href", buildCounterpartPath(targetLang));
    });
  }

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
    const header = document.querySelector(".sz-header");
    if (!header) return;

    const burger = header.querySelector(".sz-header__burger");
    const side = header.querySelector(".sz-side");
    const overlay = header.querySelector(".sz-overlay");
    const links = header.querySelectorAll(".sz-side__link");

    updateLanguageSwitch();

    if (!burger || !side || !overlay) return;

    function openMenu() {
      side.classList.add("is-open");
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-visible"));
      burger.setAttribute("aria-expanded", "true");
      side.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("sz-lock");
      document.body.classList.add("sz-lock");
    }

    function closeMenu() {
      side.classList.remove("is-open");
      overlay.classList.remove("is-visible");
      burger.setAttribute("aria-expanded", "false");
      side.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("sz-lock");
      document.body.classList.remove("sz-lock");
      window.setTimeout(() => {
        if (!side.classList.contains("is-open")) overlay.hidden = true;
      }, 140);
    }

    burger.addEventListener("click", function () {
      if (side.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    overlay.addEventListener("click", closeMenu);
    links.forEach(function (link) { link.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && side.classList.contains("is-open")) closeMenu();
    });
  }

  Promise.all([
    inject("header-placeholder", "/en/header.html"),
    inject("footer-placeholder", "/en/footer.html")
  ]).then(initHeader);
})();
