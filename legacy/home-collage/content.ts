export interface Print {
  /** Stable id, also sent in the `print:select` event. */
  slug: string;
  /** The photo. Leave it out for an empty print (a blank grey frame) until the picture is ready. */
  src?: string;
  alt?: string;
  /** Position/size on the collage, in % of its width (x, w) and height (y, h); `r` = resting tilt (deg), `z` = depth (px). */
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  z: number;
  /** Written on the back of the print (shown when it's clicked and flips over). */
  title: string;
  note: string;
  /** Page (section id) the back's "see more" goes to — omit while that page doesn't exist yet. */
  target?: string;
}

// ★ Edit this list to change the collage — the page builds itself from it.
//
// The nine frames reproduce the reference layout: each rectangle was measured
// off it (position, size, tilt), so the gaps and overlaps match. They are EMPTY
// for now — to fill one, import the image at the top of this file and add
// `src: thatImport, alt: '…'` to its line. Titles/notes are placeholders too.
//
// Listed back-to-front: later prints overlap earlier ones.
export const prints: readonly Print[] = [
  { slug: 'photo-1', x: 4.9, y: 1.4, w: 18.5, h: 26.6, r: 3, z: 10, title: 'Photo 01', note: 'Your note goes here.' },
  { slug: 'photo-5', x: 66.6, y: 13.5, w: 11.8, h: 32.4, r: 1, z: 14, title: 'Photo 05', note: 'Your note goes here.' },
  { slug: 'photo-6', x: 77.4, y: 24.2, w: 22.6, h: 21.7, r: -4, z: 18, title: 'Photo 06', note: 'Your note goes here.' },
  { slug: 'photo-2', x: 0, y: 29, w: 22.6, h: 41, r: -3, z: 22, title: 'Photo 02', note: 'Your note goes here.' },
  { slug: 'photo-3', x: 22.6, y: 17.9, w: 19.9, h: 45.9, r: 1, z: 26, title: 'Photo 03', note: 'Your note goes here.' },
  { slug: 'photo-7', x: 69.3, y: 47.3, w: 22.3, h: 36.2, r: 2, z: 30, title: 'Photo 07', note: 'Your note goes here.' },
  { slug: 'photo-8', x: 26.1, y: 64.3, w: 22.3, h: 21.3, r: -1, z: 34, title: 'Photo 08', note: 'Your note goes here.' },
  { slug: 'photo-4', x: 43.2, y: 5.8, w: 23, h: 57, r: 0, z: 40, title: 'Photo 04', note: 'Your note goes here.' },
  { slug: 'photo-9', x: 48.8, y: 58, w: 24, h: 42, r: 0, z: 46, title: 'Photo 09', note: 'Your note goes here.' },
];
