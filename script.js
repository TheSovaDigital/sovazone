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

  document.querySelectorAll(".site-nav a, .nav-dropdown-menu a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path) {
      link.classList.add("is-active");
    }
  });

  const infoPages = ["info.html", "about.html", "guarantees.html", "faq.html", "contact.html"];
  if (infoPages.includes(path)) {
    const dropdown = document.querySelector(".nav-dropdown");
    if (dropdown) dropdown.classList.add("open");
  }
}

function initMenuToggle() {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("siteNav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    nav.classList.toggle("open");
  });
}

function initDropdownToggle() {
  const toggle = document.getElementById("infoDropdownToggle");
  const dropdown = document.getElementById("infoDropdown");
  const menu = document.getElementById("infoDropdownMenu");

  if (!toggle || !dropdown || !menu) return;

  // Открытие/закрытие по клику на всех устройствах
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  // Клик внутри меню не закрывает его мгновенно
  menu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Закрытие по клику вне dropdown
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  // Закрытие по Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.classList.remove("open");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPartial("header-placeholder", "header.html");
  await loadPartial("footer-placeholder", "footer.html");
  markActiveLink();
  initMenuToggle();
  initDropdownToggle();
});
