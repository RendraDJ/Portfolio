/**
 * URL of a file in /public. The site is served under a base path on GitHub
 * Pages (`/Portfolio/`, see vite.config.ts), so `/reports/x.pdf` alone would 404.
 */
export const publicUrl = (path: string): string => import.meta.env.BASE_URL + path.replace(/^\//, '');
