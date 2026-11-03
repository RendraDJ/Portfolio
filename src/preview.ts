/**
 * Preview mode: `?preview=<section id>` renders that one section alone, live,
 * with no page navigation and no sound. The home page embeds these as the
 * live views inside its cards (see home/home.ts).
 */
export const previewId: string | null = new URLSearchParams(window.location.search).get('preview');

export const isPreview = previewId !== null;

/** URL of the live preview of a section — keeps the current `?motion=` override, if any. */
export function previewUrl(sectionId: string): string {
  const params = new URLSearchParams({ preview: sectionId });
  const motion = new URLSearchParams(window.location.search).get('motion');
  if (motion) params.set('motion', motion);
  return `${window.location.pathname}?${params}`;
}
