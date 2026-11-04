/**
 * Single source of truth for "should things move?".
 *
 * Animations are always on, whatever the OS setting (`prefers-reduced-motion`,
 * which Windows exposes as Settings → Accessibility → Visual effects →
 * Animation effects). Add `?motion=off` to the URL to follow the OS setting
 * again, to check the reduced version.
 */
const query = window.matchMedia('(prefers-reduced-motion: reduce)');
const param = new URLSearchParams(window.location.search).get('motion');
const forced = param !== 'off';

export const isReducedMotion = (): boolean => !forced && query.matches;

/** Duration helper: 0 when motion is reduced, so tweens become instant. */
export const t = (seconds: number): number => (isReducedMotion() ? 0 : seconds);

export const onMotionChange = (callback: () => void): void => {
  query.addEventListener('change', callback);
};
