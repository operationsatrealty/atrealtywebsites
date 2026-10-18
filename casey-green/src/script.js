/* ============================================================
   Casey Green · Ray White Auckland Central — interactions
   ------------------------------------------------------------
   Kept small: mobile navigation, the sticky-header hairline, a
   quiet reveal on scroll, the testimonial slider and mounting the
   appraisal form. The content works without it; .reveal only hides
   anything once the inline head script has marked the page as .js.
   ============================================================ */
(function () {
  "use strict";

  /* ---- Mobile navigation ---- */
  var toggle = document.getElementById("navToggle");
  var list = document.getElementById("navList");

  function setNav(open) {
    list.classList.toggle("is-open", open);
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  if (toggle && list) {
    toggle.addEventListener("click", function () {
      setNav(!list.classList.contains("is-open"));
    });
    list.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setNav(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && list.classList.contains("is-open")) {
        setNav(false);
        toggle.focus();
      }
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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---- Testimonial slider ----
     Every quote is in the HTML; this only shows one at a time and
     advances every 9 seconds until someone picks a dot. */
  document.querySelectorAll("[data-slider]").forEach(function (slider) {
    var slides = slider.querySelectorAll(".slide");
    var dots = slider.querySelectorAll(".slider__dot");
    if (slides.length < 2) return;
    var current = 0;
    var timer = null;

    function show(i) {
      current = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.hidden = n !== current;
      });
      dots.forEach(function (d, n) {
        d.setAttribute("aria-current", n === current ? "true" : "false");
      });
    }

    dots.forEach(function (dot, n) {
      dot.addEventListener("click", function () {
        if (timer) window.clearInterval(timer);
        timer = null;
        show(n);
      });
    });

    show(0);
    if (!reduced) {
      timer = window.setInterval(function () {
        show(current + 1);
      }, 9000);
    }
  });

  /* ---- Appraisal form ----
     The form is A T Realty's marketing form, embedded by
     mkt-forms-embed.js (loaded on every page for the popup buttons).
     Its iframe is a whole app with its own tracking, so the inline
     form is only handed to the loader — by giving it the
     data-atr-form attribute and calling the loader's public scan() —
     once it comes within a couple of screens. If the loader hasn't
     arrived yet, its own first scan picks the form up. */
  var forms = document.querySelectorAll("[data-atr-form-lazy]");

  function mountForm(el) {
    el.setAttribute("data-atr-form", el.getAttribute("data-atr-form-lazy"));
    el.removeAttribute("data-atr-form-lazy");
    if (window.ATRForms && window.ATRForms.scan) window.ATRForms.scan();
  }

  if (!("IntersectionObserver" in window)) {
    forms.forEach(mountForm);
  } else {
    var formIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          formIo.unobserve(entry.target);
          mountForm(entry.target);
        });
      },
      { rootMargin: "1200px 0px" }
    );
    forms.forEach(function (el) {
      formIo.observe(el);
    });
  }

  /* ---- Footer year ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
