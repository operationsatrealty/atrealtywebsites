document.getElementById('year').textContent = new Date().getFullYear();

var toggle = document.getElementById('nav-toggle');
var nav = document.getElementById('nav');
toggle.addEventListener('click', function () {
  nav.classList.toggle('open');
  toggle.classList.toggle('open');
});

document.querySelectorAll('.nav a').forEach(function (link) {
  link.addEventListener('click', function () {
    nav.classList.remove('open');
    toggle.classList.remove('open');
  });
});
