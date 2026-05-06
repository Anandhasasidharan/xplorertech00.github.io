/**
 * SHADOW PROTOCOL — Main JS
 * Handles nav interactions, scroll effects, terminal animation
 */
(function() {
  'use strict';

  // ── Terminal subtitle typewriter ────────────────────────
  const terminalPrompt = document.querySelector('.terminal-prompt');
  if (terminalPrompt) {
    const phrases = ['$ _', '$ ./scan_target', '$ nmap -sV localhost', '$ ssh root@matrix', '$ _'];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % phrases.length;
      terminalPrompt.textContent = phrases[i];
    }, 3000);
  }

  // ── Scroll reveal ────────────────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .post-card, .project-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

})();