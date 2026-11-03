import { mountDroneApp } from './drone-app';
import { mountPostureApp } from './posture-app';

/** The replicas of the projects' own applications, by experience slug. */
const APPS: Record<string, (host: HTMLElement) => () => void> = {
  palletlens: mountDroneApp,
  'phantom-posture': mountPostureApp,
};

/** Whether the experience has an app replica. */
export const hasApp = (slug: string) => slug in APPS;

/** Mounts the experience's app replica in `host`; returns its stop function (null when it has none). */
export function mountApp(slug: string, host: HTMLElement): (() => void) | null {
  return APPS[slug]?.(host) ?? null;
}
