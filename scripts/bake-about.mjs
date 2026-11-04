/**
 * Bakes the About me section's photos from the source JPGs into web-sized WebP.
 *
 *   assets-src/about/{name}.jpg → src/assets/about/{name}.webp  (cropped to the frame it sits in)
 *
 * Each photo is cut to its frame on the page: the portrait to 4:5, the
 * polaroids to 1:1, so the CSS never has to guess where the face is.
 *
 * Usage:  npm run assets:about
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets-src', 'about');
const OUT = path.join(root, 'src', 'assets', 'about');

const WEBP = { quality: 84, effort: 6 };

/** name → crop in source pixels, and the output width */
const PHOTOS = {
  mirror: { left: 120, top: 330, width: 600, height: 750, out: 720 }, // the portrait, 4:5
  face: { left: 330, top: 40, width: 920, height: 920, out: 520 }, // above the camera's x1 button
  forest: { left: 180, top: 520, width: 700, height: 700, out: 520 },
  kayak: { left: 120, top: 520, width: 780, height: 780, out: 520 },
  pond: { left: 0, top: 220, width: 1200, height: 1200, out: 520 },
  singapore: { left: 0, top: 40, width: 900, height: 900, out: 520 },
};

await mkdir(OUT, { recursive: true });
for (const [name, { out, ...crop }] of Object.entries(PHOTOS)) {
  await sharp(path.join(SRC, `${name}.jpg`))
    .rotate()
    .extract(crop)
    .resize({ width: out })
    .webp(WEBP)
    .toFile(path.join(OUT, `${name}.webp`));
  console.log(`about/${name}.webp`);
}
