(function () {
  /* Year */
  document.getElementById('year').textContent = new Date().getFullYear();

  /* Header scroll state */
  var header = document.getElementById('header');
  var hero = document.getElementById('hero');
  function onScroll() {
    if (!hero) return;
    header.classList.toggle('scrolled', window.scrollY > hero.offsetHeight - 100);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile nav */
  var burger = document.getElementById('burger');
  var mnav = document.getElementById('mnav');
  var mclose = document.getElementById('mclose');
  burger.addEventListener('click', function () { mnav.classList.add('open') });
  mclose.addEventListener('click', function () { mnav.classList.remove('open') });
  mnav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { mnav.classList.remove('open') });
  });

  /* Reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el) });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible') });
  }
})();
