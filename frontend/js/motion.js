/* ==========================================================================
   EduPulse — Site-Wide GSAP Motion System
   Includes ScrollTrigger reveals, magnetic CTAs, custom cursor, page transitions.
   ========================================================================== */

export function initMotionSystem() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (!gsap) return;

  if (ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------
  // 1. Custom Cursor Follower (Desktop only)
  // ------------------------------------------------------------------
  if (!reduceMotion && window.innerWidth >= 768 && !('ontouchstart' in window)) {
    createCustomCursor(gsap);
  }

  // ------------------------------------------------------------------
  // 2. Magnetic Buttons
  // ------------------------------------------------------------------
  if (!reduceMotion) {
    setupMagneticButtons(gsap);
  }

  // ------------------------------------------------------------------
  // 3. GSAP ScrollTrigger Reveals
  // ------------------------------------------------------------------
  if (!reduceMotion && ScrollTrigger) {
    setupScrollReveals(gsap, ScrollTrigger);
  }

  // ------------------------------------------------------------------
  // 4. Page Transitions
  // ------------------------------------------------------------------
  if (!reduceMotion) {
    setupPageTransitions(gsap);
  }
}

function createCustomCursor(gsap) {
  if (document.getElementById('customCursor')) return;

  const cursor = document.createElement('div');
  cursor.id = 'customCursor';
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);

  let mouseX = -100;
  let mouseY = -100;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.to(cursor, {
      x: mouseX,
      y: mouseY,
      duration: 0.15,
      ease: 'power2.out',
    });
  });

  // Scale up on interactive hover
  const interactiveSelector = 'a, button, input, select, .choice-card, .subject-card, .upload-dropzone';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(interactiveSelector)) {
      cursor.classList.add('cursor-active');
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(interactiveSelector)) {
      cursor.classList.remove('cursor-active');
    }
  });
}

function setupMagneticButtons(gsap) {
  const magneticEls = document.querySelectorAll('.choice-card, .btn-primary, .theme-toggle-btn, .nav-item');

  magneticEls.forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left - rect.width / 2;
      const relY = e.clientY - rect.top - rect.height / 2;

      gsap.to(el, {
        x: relX * 0.18,
        y: relY * 0.18,
        duration: 0.3,
        ease: 'power2.out',
      });
    });

    el.addEventListener('mouseleave', () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.4)',
      });
    });
  });
}

function setupScrollReveals(gsap, ScrollTrigger) {
  const elements = document.querySelectorAll('.page-hero, .home-choice-grid, .nba-card, .section-block, .summary-banner, .intervention-banner');

  elements.forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });
}

function setupPageTransitions(gsap) {
  // Create overlay if not present
  let overlay = document.getElementById('pageTransitionOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pageTransitionOverlay';
    overlay.className = 'page-transition-overlay';
    document.body.appendChild(overlay);
  }

  // Intercept nav links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank') {
      return;
    }

    // Ignore if same URL
    if (link.href === window.location.href) return;

    e.preventDefault();

    gsap.to(overlay, {
      opacity: 1,
      duration: 0.28,
      ease: 'power2.inOut',
      onComplete: () => {
        window.location.href = href;
      },
    });
  });

  // Fade overlay out on page load
  gsap.fromTo(overlay, { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.out' });
}
