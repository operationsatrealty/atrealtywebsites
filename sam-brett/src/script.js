// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle (optional, if needed)
const nav = document.querySelector('.nav');
const navLinks = document.querySelectorAll('.nav__link');

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    // Smooth scroll already handled by CSS scroll-behavior
  });
});
