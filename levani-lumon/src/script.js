/* ============================================================
   Tom McCartney · Ray White Manurewa — interactions
   ------------------------------------------------------------
   Deliberately small. The animated stat counters from the first
   version are gone: they drew attention to the numbers in a way
   that read as a gimmick, and the numbers are strong enough set
   plainly. What's left is navigation, a sticky-header hairline,
   and a single quiet reveal.
   ============================================================ */
(function () {
  "use strict";

  /* ---- Mobile navigation ---- */
  var toggle = document.getElementById("navToggle");
  var list = document.getElementById("navList");

  if (toggle && list) {
    toggle.addEventListener("click", function () {
      var open = list.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });

    list.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        list.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Sticky header hairline ---- */
  var header = document.getElementById("header");
  function onScroll() {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll(".reveal");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---- Footer year ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
