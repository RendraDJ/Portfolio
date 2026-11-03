/**
 * Pre-computes the hover visuals so the browser only ever animates `opacity`
 * and `transform` (compositor-only, no per-frame filter re-rasterisation).
 *
 *   assets-src/scene/*.webp   (source layers, 1920x1080, alpha)
 *        │
 *        ├─ everyone.webp  → src/assets/scene/everyone.webp       (copy)
 *        │                 → src/assets/scene/everyone-dim.webp   (CSS grayscale(70%) brightness(.55))
 *        └─ p{n}.webp      → src/assets/scene/p{n}.webp           (person + drop-shadow(0 0 42px rgba(255,255,255,.6)), for the hover highlight)
 *                          → src/assets/scene/p{n}-idle.webp      (person only, no glow — sits on `everyone` at rest so each
 *                                                                   person can breathe with a light continuous scale pulse)
 *
 * Run with:  npm run assets
 */
import sharp from 'sharp';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets-src', 'scene');
const OUT = path.join(root, 'src', 'assets', 'scene');

const PEOPLE = [1, 2, 3, 4, 5];
const WEBP = { quality: 90, alphaQuality: 95, effort: 6 };

// Same values the original CSS-filter animation tweened to.
const GRAYSCALE = 0.7;
const BRIGHTNESS = 0.55;
const GLOW_RADIUS = 42; // CSS blur radius → gaussian sigma = radius / 2
const GLOW_ALPHA = 0.6;

/** CSS `grayscale(a)` colour matrix (Rec.709 luma), pre-multiplied by `brightness(b)`. */
function dimMatrix(grayscale, brightness) {
  const s = 1 - grayscale;
  const [r, g, b] = [0.2126, 0.7152, 0.0722];
  return [
    [r + (1 - r) * s, g - g * s, b - b * s],
    [r - r * s, g + (1 - g) * s, b - b * s],
    [r - r * s, g - g * s, b + (1 - b) * s],
  ].map((row) => row.map((v) => v * brightness));
}

async function bakeDim() {
  await sharp(path.join(SRC, 'everyone.webp'))
    .recomb(dimMatrix(GRAYSCALE, BRIGHTNESS))
    .webp(WEBP)
    .toFile(path.join(OUT, 'everyone-dim.webp'));
}

// Untouched: re-encoding an already-lossy WebP would only lose quality.
const copyBase = () => copyFile(path.join(SRC, 'everyone.webp'), path.join(OUT, 'everyone.webp'));

/** Plain re-encode, no glow — the always-visible "idle" layer. */
async function bakeIdle(n) {
  await sharp(path.join(SRC, `p${n}.webp`)).webp(WEBP).toFile(path.join(OUT, `p${n}-idle.webp`));
}

async function bakePerson(n) {
  const input = path.join(SRC, `p${n}.webp`);
  const { width, height } = await sharp(input).metadata();
  const person = await sharp(input).ensureAlpha().png().toBuffer();

  // Blurred, faded copy of the silhouette → single-channel glow alpha.
  const glowAlpha = await sharp(person)
    .extractChannel('alpha')
    .blur(GLOW_RADIUS / 2)
    .linear(GLOW_ALPHA, 0)
    .raw()
    .toBuffer();

  // White RGB + that alpha = the glow layer.
  const white = Buffer.alloc(width * height * 3, 255);
  const glow = await sharp(white, { raw: { width, height, channels: 3 } })
    .joinChannel(glowAlpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  await sharp(glow)
    .composite([{ input: person }])
    .webp(WEBP)
    .toFile(path.join(OUT, `p${n}.webp`));
}

await mkdir(OUT, { recursive: true });
await Promise.all([copyBase(), bakeDim(), ...PEOPLE.map(bakePerson), ...PEOPLE.map(bakeIdle)]);
console.log('✓ layers baked →', path.relative(root, OUT));
