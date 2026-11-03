import { gsap } from 'gsap';
import { isReducedMotion, t } from '../motion';

// Occasional dust motes drifting across the scene — depth is faked with
// size/blur/speed (far = small, blurred, slow; near = big, sharp, fast),
// same trick as a shallow-DOF camera rack focus. Fires every few seconds
// while the page is active, never a constant stream ("de temps en temps").
const SPAWN_MIN = 1400;
const SPAWN_MAX = 3600;

export function initParticles(section: HTMLElement, container: HTMLElement): void {
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function spawnOne() {
    const el = document.createElement('div');
    el.className = 'brand__particle';
    container.appendChild(el);

    const depth = Math.random(); // 0 = far, 1 = near
    const size = gsap.utils.mapRange(0, 1, 4, 15, depth);
    const travel = gsap.utils.mapRange(0, 1, 35, 90, depth); // distance covered, as a % of viewport
    const duration = t(gsap.utils.mapRange(0, 1, 7.5, 3.2, depth));
    const blur = gsap.utils.mapRange(0, 1, 3, 0, depth);

    // Any direction — not just crossing left-to-right — so it reads as dust
    // drifting through 3D space rather than a scripted horizontal pass.
    const angle = Math.random() * Math.PI * 2;
    const startX = 5 + Math.random() * 90;
    const startY = 8 + Math.random() * 84;
    const endX = startX + Math.cos(angle) * travel;
    const endY = startY + Math.sin(angle) * travel;

    gsap.set(el, {
      width: size,
      height: size,
      left: `${startX}vw`,
      top: `${startY}vh`,
      opacity: 0,
      scale: 0.4,
      filter: `blur(${blur}px)`,
    });

    const tl = gsap.timeline({ onComplete: () => el.remove() });
    if (duration === 0) {
      el.remove();
      return;
    }
    tl.to(el, { opacity: 0.85, scale: 1, duration: duration * 0.22, ease: 'sine.out' }, 0);
    tl.to(el, { left: `${endX}vw`, top: `${endY}vh`, duration, ease: 'none' }, 0);
    tl.to(el, { opacity: 0, scale: 0.5, duration: duration * 0.3, ease: 'sine.in' }, duration * 0.7);
  }

  function loop() {
    if (!active) return;
    if (!isReducedMotion()) {
      const burst = Math.random() < 0.4 ? 3 : Math.random() < 0.7 ? 2 : 1;
      for (let i = 0; i < burst; i++) spawnOne();
    }
    timer = setTimeout(loop, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN));
  }

  function clearAll() {
    const motes = Array.from(container.children);
    gsap.killTweensOf(motes);
    container.replaceChildren();
  }

  function start() {
    clearTimeout(timer);
    loop();
  }

  function stop() {
    clearTimeout(timer);
    clearAll();
  }

  section.addEventListener('pageenter', () => {
    if (active) return;
    active = true;
    if (!document.hidden) start();
  });
  section.addEventListener('pageleave', () => {
    active = false;
    stop();
  });

  // In a background tab, timers keep firing (throttled) but GSAP's ticker is
  // paused, so motes would be spawned without ever animating — then all burst
  // in at once on return. Stop spawning while hidden and start fresh after.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (active) start();
  });
}
