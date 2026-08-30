/* ============================================================
   Levani Lum-On · Ray White Manukau — interactions
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

  /* ---- Sticky header shadow ---- */
  var header = document.getElementById('header');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
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

  /* ---- Animated stat counters ---- */
  var counters = document.querySelectorAll('.stat__num[data-count]');
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var start = 0, dur = 1400, t0 = null;
    function tick(now) {
      if (!t0) t0 = now;
      var p = Math.min((now - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(start + (target - start) * eased);
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateCount(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---- Contact form (front-end only demo) ---- */
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var name = get('name'), email = get('email'), phone = get('phone');
      var interest = get('interest'), message = get('message');

      // Deliver the enquiry to Levani, cc Rachel, via the visitor's email client.
      var to = 'levani.lumon@raywhite.com';
      var cc = 'rachel.lumon@raywhite.com';
      var subject = 'Website enquiry: ' + (interest || 'General') + (name ? ' — ' + name : '');
      var body =
        'New enquiry from levanilumonrealestate.co.nz\n\n' +
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        'Phone: ' + phone + '\n' +
        'Interested in: ' + interest + '\n\n' +
        'Message:\n' + message + '\n';

      var href = 'mailto:' + to +
        '?cc=' + encodeURIComponent(cc) +
        '&subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      if (note) { note.hidden = false; }
      window.location.href = href;
      // To send server-side instead (no email client needed), POST these fields to a
      // serverless route or a form service (Formspree/Resend) and keep the To/Cc above.
    });
  }

  /* ---- Current year in footer ---- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
