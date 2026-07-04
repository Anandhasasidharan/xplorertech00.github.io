(function() {
  'use strict';

  const stage = document.querySelector('.hero-stage');
  const target = document.querySelector('.hero-glass');
  if (!stage || !target) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrowScreen = window.matchMedia('(max-width: 899px)');
  const enabled = !reduceMotion.matches && !narrowScreen.matches &&
    typeof window.liquidGL === 'function' &&
    typeof window.html2canvas === 'function';

  if (!enabled) {
    stage.classList.add('hero-stage--fallback');
    return;
  }

  stage.classList.remove('hero-stage--fallback');

  let instance = null;
  try {
    instance = window.liquidGL({
      snapshot: 'body',
      target: '.hero-glass',
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      refraction: 0.018,
      bevelDepth: 0.07,
      bevelWidth: 0.16,
      frost: 0.35,
      shadow: true,
      specular: true,
      reveal: 'fade',
      tilt: false,
      magnify: 1,
      on: {
        init() {
          document.documentElement.classList.add('liquidgl-ready');
        }
      }
    });
  } catch (error) {
    stage.classList.add('hero-stage--fallback');
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    stage.classList.toggle('hero-stage--hidden', !entry.isIntersecting);
  }, { threshold: 0.12 });

  observer.observe(stage);

  if (instance && typeof instance.destroy === 'function') {
    window.addEventListener('beforeunload', () => {
      instance.destroy();
    });
  }
})();
