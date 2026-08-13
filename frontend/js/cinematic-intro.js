/* ==========================================================================
   EduPulse — Cinematic Intro Sequence (First load of index.html only)
   1.8s particle assembly sequence resolving into the hero, with skip trigger.
   ========================================================================== */

export function initCinematicIntro() {
  const introContainer = document.getElementById('cinematicIntro');
  if (!introContainer) return;

  // Check if intro was already played in this session
  if (sessionStorage.getItem('edupulse-intro-played')) {
    introContainer.style.display = 'none';
    return;
  }

  const gsap = window.gsap;
  if (!gsap) {
    introContainer.style.display = 'none';
    return;
  }

  let skipped = false;

  const finishIntro = () => {
    if (skipped) return;
    skipped = true;
    sessionStorage.setItem('edupulse-intro-played', 'true');

    gsap.to(introContainer, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        introContainer.style.display = 'none';
      },
    });
  };

  // Skip handlers
  introContainer.addEventListener('click', finishIntro);
  window.addEventListener('scroll', finishIntro, { once: true });
  const skipBtn = document.getElementById('skipIntroBtn');
  if (skipBtn) skipBtn.addEventListener('click', finishIntro);

  // Timeline animation
  const tl = gsap.timeline({
    onComplete: finishIntro,
  });

  tl.fromTo(
    '#introLogoIcon',
    { scale: 0.3, opacity: 0, rotation: -45 },
    { scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.7)' }
  )
    .fromTo(
      '#introLogoText',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      '-=0.3'
    )
    .fromTo(
      '#introSubtitle',
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' },
      '-=0.2'
    )
    .to({}, { duration: 0.6 }); // Pause brief moment before fadeout
}
