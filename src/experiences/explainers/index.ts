import { gsap } from 'gsap';
import { C, H, W, makeKit, type Kit } from './kit';
import { droneExplainer } from './drone';
import { postureExplainer } from './posture';
import { mailExplainer } from './mail';
import { robotExplainer } from './robot';
import { armExplainer } from './arm';

/**
 * The explainer videos: each experience told in about twenty seconds of
 * motion design, one short line per scene, looping. The player shows the
 * caption of the scene on screen, one dot per scene (a click jumps to it),
 * and pauses on a click on the picture.
 */

const EXPLAINERS: Record<string, (k: Kit) => void> = {
  palletlens: droneExplainer,
  'phantom-posture': postureExplainer,
  'the-classifier': mailExplainer,
  'first-contact': robotExplainer,
  convergence: armExplainer,
};

export const hasExplainer = (slug: string) => slug in EXPLAINERS;

/** Mounts the experience's explainer in `host` (800 px wide); returns its stop function. */
export function mountExplainer(slug: string, host: HTMLElement): (() => void) | null {
  const build = EXPLAINERS[slug];
  if (!build) return null;

  const root = document.createElement('div');
  root.className = 'xpx';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'xpx__stage');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ width: W, height: H, fill: C.bg }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
  svg.append(bg);
  const say = document.createElement('p');
  say.className = 'xpx__say';
  const dots = document.createElement('div');
  dots.className = 'xpx__dots';
  const bar = document.createElement('i');
  bar.className = 'xpx__bar';
  root.append(svg, say, dots, bar);
  host.append(root);

  const tl = gsap.timeline({ paused: true });
  const scenes: { at: number; say: string }[] = [];
  const loops: (gsap.core.Tween | gsap.core.Timeline)[] = [];
  const frames: (() => void)[] = [];
  build(makeKit(svg, tl, scenes, loops, frames));
  tl.to({}, { duration: 0.6 }); // a beat before it starts over

  // the caption and the dots follow the playhead, whichever way it moves
  let shown = -1;
  const dotEls = scenes.map((s) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'xpx__dot';
    d.setAttribute('aria-label', s.say);
    d.addEventListener('click', (e) => {
      e.stopPropagation();
      tl.seek(s.at + 0.01);
      tl.play();
      sync();
    });
    dots.append(d);
    return d;
  });
  const sync = () => {
    frames.forEach((f) => f());
    const now = tl.time();
    let i = 0;
    while (i + 1 < scenes.length && scenes[i + 1].at <= now) i++;
    bar.style.transform = `scaleX(${tl.progress()})`;
    if (i === shown) return;
    shown = i;
    say.classList.remove('is-in');
    void say.offsetWidth; // restart the caption's entrance
    say.textContent = scenes[i]?.say ?? '';
    say.classList.add('is-in');
    dotEls.forEach((d, j) => d.classList.toggle('is-on', j === i));
  };
  tl.eventCallback('onUpdate', sync);
  tl.eventCallback('onComplete', () => {
    tl.seek(0);
    tl.play();
    sync();
  });
  root.addEventListener('click', () => (tl.paused() ? tl.play() : tl.pause()));
  tl.play(0);
  sync();

  return () => {
    tl.kill();
    loops.forEach((l) => l.kill());
    root.remove();
  };
}
