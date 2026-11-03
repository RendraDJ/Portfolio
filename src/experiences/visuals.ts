import { gsap } from 'gsap';
import { t, isReducedMotion } from '../motion';
import { mountDemo } from '../signs/demos';
import type { Project } from './content';
import type { Visual } from './story';
import { mountApp } from './apps';
import { hasExplainer, mountExplainer } from './explainers';

/**
 * Small pieces of the experience page (sheet.ts): DOM helpers, a number that
 * counts up, and the live visuals — the explainer video, the hands-on demo,
 * the app replica — each scaled to whatever box holds it.
 */

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

export function button(className: string, children: (Node | string)[], onClick: () => void, label?: string) {
  const b = h('button', className, children);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

/** Counts `strong` up to the first number of `value`, keeping the rest as written. */
export function countUp(strong: HTMLElement, value: string, delay = 0) {
  const m = value.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/s);
  if (!m || isReducedMotion()) return;
  const [, pre, num, post] = m;
  const decimals = (num.split(/[.,]/)[1] ?? '').length;
  const sep = num.includes(',') ? ',' : '.';
  const o = { v: 0 };
  gsap.to(o, {
    v: Number(num.replace(',', '.')),
    duration: t(1.4),
    delay,
    ease: 'power2.out',
    onUpdate: () => (strong.textContent = `${pre}${o.v.toFixed(decimals).replace('.', sep)}${post}`),
  });
}

/** A live visual, scaled to fit its box. */
export interface Live {
  /** Put it in a box: it fills it and scales to fit. */
  el: HTMLElement;
  stop(): void;
}

/** `inner` laid out at `width` px, scaled down (or a little up) to fit its box; `stop` stops what runs in it. */
export function fitted(inner: HTMLElement, width: number, stop: () => void): Live {
  const box = h('div', 'xp-fit', [inner]);
  inner.classList.add('xp-fit__inner');
  inner.style.width = `${width}px`;
  const ro = new ResizeObserver(() => {
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const ih = inner.offsetHeight || 1;
    if (!bw || !bh) return;
    const s = Math.min(bw / width, bh / ih, 1.3);
    inner.style.transform = `translate(${(bw - width * s) / 2}px, ${(bh - ih * s) / 2}px) scale(${s})`;
  });
  ro.observe(box);
  ro.observe(inner);
  return {
    el: box,
    stop() {
      ro.disconnect();
      stop();
    },
  };
}

/** The live visual of a demo or app chapter: the explainer video when the
 *  experience has one (else the hands-on demo), or the app replica. */
export function live(v: Visual, p: Project): Live | null {
  if (v.type === 'demo' && hasExplainer(p.slug)) {
    const inner = h('div', 'xp-live-video');
    return fitted(inner, 800, mountExplainer(p.slug, inner)!);
  }
  if (v.type === 'demo') return interactiveDemo(p);
  if (v.type !== 'app') return null;
  const inner = h('div', 'xp-live-app');
  const stop = mountApp(p.slug, inner);
  return stop ? fitted(inner, 1000, stop) : null;
}

/** The hands-on demo (signs/demos.ts). */
export function interactiveDemo(p: Project): Live {
  const inner = h('div', 'xp-live-demo');
  return fitted(inner, 640, mountDemo(p.kind, inner));
}
