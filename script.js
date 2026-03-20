/* =============================================
   SIX FEET UNDER - JavaScript
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Particle System ----------
  const particlesContainer = document.getElementById('particles');
  const particleCount = 30;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.animationDuration = (6 + Math.random() * 6) + 's';
    particlesContainer.appendChild(particle);
  }

  // ---------- Navigation Scroll Effect ----------
  const nav = document.getElementById('nav');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // ---------- Mobile Navigation Toggle ----------
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // Close mobile nav when clicking a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
    });
  });

  // ---------- Scroll Reveal Animations ----------
  const revealElements = document.querySelectorAll(
    '.about-card, .rules-scroll, .member-card, .gallery-placeholder, .join-requirements, .join-form-wrapper'
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger the animation for grid items
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach((el, index) => {
    // Assign stagger delay based on sibling position
    const parent = el.parentElement;
    const siblings = Array.from(parent.children).filter(child =>
      child.classList.contains(el.classList[0])
    );
    const siblingIndex = siblings.indexOf(el);
    el.dataset.delay = siblingIndex * 100;

    revealObserver.observe(el);
  });

  // ---------- Active Navigation Highlighting ----------
  const sections = document.querySelectorAll('.section, .hero');
  const navItems = document.querySelectorAll('.nav-links a');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('href') === '#' + id) {
            item.classList.add('active');
          }
        });
      }
    });
  }, {
    threshold: 0.3
  });

  sections.forEach(section => {
    sectionObserver.observe(section);
  });

  // ---------- Form Handling ----------
  const joinForm = document.getElementById('joinForm');

  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(joinForm);
    const data = Object.fromEntries(formData.entries());

    // Show a themed confirmation
    const wrapper = document.querySelector('.join-form-wrapper');
    wrapper.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">&#9876;</div>
        <h3 style="font-family: 'Cinzel', serif; color: #c9a84c; letter-spacing: 2px; margin-bottom: 1rem;">
          Bewerbung erhalten!
        </h3>
        <p style="color: #8a8578; font-size: 1.05rem; line-height: 1.8;">
          Willkommen in der Dunkelheit, <strong style="color: #d4cfc4;">${data.charName}</strong>.<br>
          Wir werden deine Bewerbung prufen und dich uber Discord kontaktieren.
        </p>
        <p style="color: #5a5650; margin-top: 1.5rem; font-style: italic;">
          Die Schatten werden dich finden...
        </p>
      </div>
    `;
  });

  // ---------- Smooth scroll for Safari ----------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});
