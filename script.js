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

    const burger = document.getElementById("burgerBtn");
    const closeBtn = document.getElementById("closeMenuBtn");
    const sideMenu = document.getElementById("site-side-menu");
    const backdrop = document.getElementById("site-side-menu-backdrop");
    const links = sideMenu.querySelectorAll("a");

    if (!burger || !sideMenu || !backdrop) return;

    function toggleMenu(forceClose = false) {
      const isOpen = forceClose ? true : burger.getAttribute("aria-expanded") === "true";
      
      const newState = !isOpen;
      
      // Атрибуты и видимость
      burger.setAttribute("aria-expanded", newState);
      sideMenu.setAttribute("aria-hidden", !newState);
      sideMenu.classList.toggle("is-open", newState);
      
      // Работа с бэкдропом (фоном)
      backdrop.hidden = !newState;
      setTimeout(() => backdrop.classList.toggle("is-visible", newState), 10);

      // Блокировка скролла (чтобы не прыгало)
      if (newState) {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    }

    // Слушатели событий
    burger.addEventListener("click", () => toggleMenu());
    if (closeBtn) closeBtn.addEventListener("click", () => toggleMenu(true));
    backdrop.addEventListener("click", () => toggleMenu(true));

    // Закрытие при клике на любую ссылку
    links.forEach(link => {
      link.addEventListener("click", () => toggleMenu(true));
    });

    // Закрытие по ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
        toggleMenu(true);
      }
    });
  }

  // Загружаем компоненты и инициализируем
  Promise.all([
    inject("header-placeholder", "/header.html"),
    inject("footer-placeholder", "/footer.html")
  ]).then(() => {
    // Небольшая задержка, чтобы DOM успел обновиться после вставки HTML
    setTimeout(initHeader, 50);
  });
})();
