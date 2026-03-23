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

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

function initDropdownToggle() {
  const toggle = document.getElementById("infoDropdownToggle");
  const dropdown = document.querySelector(".nav-dropdown");
  if (!toggle || !dropdown) return;

  toggle.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      dropdown.classList.toggle("open");
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
