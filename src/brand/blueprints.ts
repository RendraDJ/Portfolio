import { createOsWindow } from '../os/window-manager';
import iconTshirt from '../assets/brand/icon-tshirt.webp';
import iconZip1 from '../assets/brand/icon-zip1.webp';
import iconZip2 from '../assets/brand/icon-zip2.webp';

export interface BlueprintFile {
  name: string;
  file: string;
  icon: string;
  /** Short line under the name in the phone's Files list. */
  detail: string;
  /** Every page as an image, in order — shown on the studio tablet. */
  pages: readonly string[];
}

// Page images rendered from the PDFs by `npm run assets:blueprints` (scripts/bake-blueprints.mjs).
const PAGE_IMAGES = import.meta.glob<string>('../assets/blueprints/*.webp', { eager: true, query: '?url', import: 'default' });
const pagesOf = (slug: string) =>
  Object.keys(PAGE_IMAGES)
    .filter((path) => path.includes(`/${slug}-`))
    .sort()
    .map((path) => PAGE_IMAGES[path]);

// Served as-is from /public — see public/blueprints/.
export const BLUEPRINTS: readonly BlueprintFile[] = [
  { name: 'T-SHIRTS.pdf', file: '/blueprints/T-SHIRTS.pdf', icon: iconTshirt, detail: 'Tee lineup — prints & placements', pages: pagesOf('tshirts') },
  { name: 'Techpack — Zip Hoodie.pdf', file: '/blueprints/Techpack-Zip-Hoodie.pdf', icon: iconZip1, detail: 'Construction, fabrics, measurements', pages: pagesOf('techpack') },
  { name: 'Full Zip Hoodie.pdf', file: '/blueprints/Full-Zip-Hoodie.pdf', icon: iconZip2, detail: 'Artwork & colourways', pages: pagesOf('fullzip') },
];

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const { class: className, ...rest } = props;
  const el = Object.assign(document.createElement(tag), rest);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

// A PDF is unreadable at phone size, so tapping one in the phone's Files app
// "hands it off" to the Mac desktop behind it — a big, draggable window over
// the left/centre of the scene, leaving the phone (right) uncovered. It opens
// inside the section's screen (the studio monitor, see os/studio.ts), never outside it.
const PDF_RECT = { x: 0.1, y: 0.07, w: 0.58, h: 0.88 };

/** Opens a blueprint in a window — at a given page (1-based) if asked. */
export function openPdf(file: BlueprintFile, page?: number): void {
  const iframe = h('iframe', { src: page ? `${file.file}#page=${page}` : file.file, title: file.name, class: 'os-pdf-frame' });
  const screen = document.querySelector<HTMLElement>('#brand .studio__screen') ?? undefined;
  // The screen keeps the page's full size (it's only scaled down into the
  // monitor), so the same fractions of it land in the same place within it.
  const width = screen?.offsetWidth || window.innerWidth;
  const height = screen?.offsetHeight || window.innerHeight;
  createOsWindow({
    title: file.name,
    content: iframe,
    within: screen,
    x: PDF_RECT.x * width,
    y: PDF_RECT.y * height,
    width: PDF_RECT.w * width,
    height: PDF_RECT.h * height,
    minWidth: 320,
    minHeight: 240,
  });
}
