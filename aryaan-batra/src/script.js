/* ============================================================
   Aryaan Batra · Ray White Manukau — interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---- Mobile navigation ---- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  function closeNav() {
    nav.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
  }

  /* ---- Sticky header shadow + scroll progress ---- */
  var header = document.getElementById('header');
  var progress = document.getElementById('progress');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Lite YouTube embed: swap facade for iframe on click ---- */
  var video = document.getElementById('officeVideo');
  if (video) {
    video.addEventListener('click', function () {
      var id = video.getAttribute('data-video-id');
      var iframe = document.createElement('iframe');
      iframe.setAttribute('src', 'https://www.youtube.com/embed/' + id + '?autoplay=1');
      iframe.setAttribute('title', 'Ray White Manukau video');
      iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      video.innerHTML = '';
      video.appendChild(iframe);
      video.classList.add('video--playing');
    }, { once: true });
  }

  /* ---- FAQ: close other items when one opens ---- */
  var faqs = document.querySelectorAll('.faq__item');
  faqs.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        faqs.forEach(function (other) { if (other !== item) other.open = false; });
      }
    });
  });

  /* ---- Contact form ---- */
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var name = get('name'), email = get('email'), phone = get('phone');
      var interest = get('interest'), message = get('message');

      // Deliver the enquiry to Aryaan via the visitor's email client.
      var to = 'aryaan.batra@raywhite.com';
      var subject = 'Website enquiry: ' + (interest || 'General') + (name ? ' — ' + name : '');
      var body =
        'New enquiry from Aryaan Batra’s website\n\n' +
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        'Phone: ' + phone + '\n' +
        'Interested in: ' + interest + '\n\n' +
        'Message:\n' + message + '\n';

      var href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      if (note) { note.hidden = false; }
      window.location.href = href;
    });
  }

  /* ---- Current year in footer ---- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
