/**
 * Single source of truth for "should things move?".
 *
 * Follows the OS setting (`prefers-reduced-motion`). Windows exposes it as
 * Settings → Accessibility → Visual effects → Animation effects: when that is
 * off, every animation collapses to an instant change.
 *
 * Add `?motion=on` to the URL to force animations regardless of the OS setting.
 * In development (`npm run dev`) they are always on; `?motion=off` follows the
 * OS setting again, to check the reduced version.
 */
const query = window.matchMedia('(prefers-reduced-motion: reduce)');
const param = new URLSearchParams(window.location.search).get('motion');
const forced = param === 'on' || (import.meta.env.DEV && param !== 'off');

export const isReducedMotion = (): boolean => !forced && query.matches;

/** Duration helper: 0 when motion is reduced, so tweens become instant. */
export const t = (seconds: number): number => (isReducedMotion() ? 0 : seconds);

export const onMotionChange = (callback: () => void): void => {
  query.addEventListener('change', callback);
};
