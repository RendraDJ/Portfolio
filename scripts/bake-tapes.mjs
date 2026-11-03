/**
 * Converts the tape artwork (multi-MB PNGs) into web-sized WebP.
 *
 *   <source dir>/{Name}_spine.png     485×2941   → src/assets/tapes/{slug}-spine.webp     (½ size, shown ≈70px wide)
 *   <source dir>/{Name}_cassette.png  1024×1536  → src/assets/tapes/{slug}-cassette.webp  (full size, shown ≈300–560px tall)
 *
 * Usage:  npm run assets:tapes [-- path/to/source/dir]
 * Default source dir: ../Images/select (next to the Site folder).
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] ?? path.join(root, '..', 'Images', 'select'));
const OUT = path.join(root, 'src', 'assets', 'tapes');

/** slug → prefix used by the source files */
const TAPES = {
  esco: 'ESCO',
  lirmm: 'LIRMM',
  palletlens: 'PalletLens',
  qt: 'QT',
  ur10: 'UR10',
};

const WEBP = { quality: 86, alphaQuality: 95, effort: 6 };

await mkdir(OUT, { recursive: true });

await Promise.all(
  Object.entries(TAPES).flatMap(([slug, name]) => [
    sharp(path.join(SRC, `${name}_spine.png`))
      .resize({ width: 242 })
      .webp(WEBP)
      .toFile(path.join(OUT, `${slug}-spine.webp`)),
    sharp(path.join(SRC, `${name}_cassette.png`))
      .webp(WEBP)
      .toFile(path.join(OUT, `${slug}-cassette.webp`)),
  ]),
);

console.log('✓ tapes baked →', path.relative(root, OUT));
