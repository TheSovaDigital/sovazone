async function loadPartial(targetId, file) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Failed to load ${file}`);
    target.innerHTML = await response.text();
  } catch (error) {
    console.error(error);
  }
}

function markActiveLink() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path) link.classList.add("is-active");
  });
}

function initMenuToggle() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("siteNav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPartial("header-placeholder", "header.html");
  await loadPartial("footer-placeholder", "footer.html");
  markActiveLink();
  initMenuToggle();
});
