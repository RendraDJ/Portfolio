/**
 * Bakes the Xandvar section's assets from the source PNGs into web-sized WebP.
 *
 *   <source dir>/background_xav.png   1920×1080 → src/assets/brand/scene-bg.webp     (grain texture, untouched)
 *   <source dir>/shadow_xav.png       1920×1080 → src/assets/brand/scene-shadow.webp (ground contact shadow)
 *   <source dir>/hero_xav.png         1920×1080 → src/assets/brand/scene-hero.webp   (the hooded figure + environment)
 *   <source dir>/logo_bottom_right.png            → src/assets/brand/logo.webp       (trimmed tight)
 *   <source dir>/{product}.png        → src/assets/brand/{slug}.webp                 (trimmed, framed onto a
 *                                                                                       transparent square so
 *                                                                                       every product tile shares
 *                                                                                       one consistent aspect ratio)
 *   <source dir>/carrousel_{1..15}.{png,webp,mp4} → src/assets/brand/carrousel/carrousel-{n}.{webp,mp4}
 *                                                     (the looping shelf's content — resized only, native
 *                                                     aspect kept; CSS object-fit: cover frames each tile.
 *                                                     Videos are transcoded small, silent and web-ready —
 *                                                     see bakeCarrouselVideo — since they autoplay muted+loop.)
 *
 * Usage:  npm run assets:brand [-- path/to/source/dir]
 * Default source dir: ../Images/brand (next to the Site folder).
 * Requires ffmpeg on PATH for the 3 video slides (skipped with a warning if missing).
 */
import sharp from 'sharp';
import { mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] ?? path.join(root, '..', 'Images', 'brand'));
const OUT = path.join(root, 'src', 'assets', 'brand');
const CAROUSEL_OUT = path.join(OUT, 'carrousel');

const WEBP = { quality: 88, alphaQuality: 95, effort: 6 };
const TILE_SIZE = 900; // product tiles are framed onto a square canvas this large
const CAROUSEL_MAX_DIM = 900; // long-edge cap for carousel photos — these display around 200-350px wide
const CAROUSEL_VIDEO_WIDTH = 480; // videos display at the same size; no need for source resolution

/** slug → source file (without .png) */
const PRODUCTS = {
  'tshirt-outofshell': 'T-shirt_outofshell_xav',
  'tshirt-variables': 't-shirt_xav2', // cleaner flat re-render of the same design — replaces the old textured mockup
  'tshirt-bex': 't-shirt_xav',
  'tshirt-variablebynature': 't-shirt_xav3',
  'hoodie-outoftime': 'hoodie_xav',
  'hoodie-dontfollow': 'hoodie2_xav',
  'hoodie-model': 'MODEL_hoodie_xav',
  'hoodie-zip2': 'zip2',
};

/**
 * hoodie2_xav.png's front and back garments overlap and are drawn at
 * inconsistent scale (unlike every other product source, where the pair
 * matches) — trimming+framing the whole thing makes it read smaller and
 * off-centre next to its siblings. There's no clean way to separate two
 * overlapping garments from a flattened export, so this crops to the back
 * view alone instead (both garments are black, so a hairline sliver of the
 * front one at the left edge is invisible). Region found by inspecting the
 * source directly; revisit if hoodie2_xav.png is ever re-exported.
 */
const PRODUCT_CROPS = {
  'hoodie-dontfollow': { left: 2200, top: 250, width: 2100, height: 3050 },
};

const BLUEPRINT_ICON_MAX = 200; // these display ~44px wide in the Finder grid — plenty of headroom
const BLUEPRINT_ICONS = {
  'icon-tshirt': 'icon_shirt',
  'icon-zip1': 'icon_zip1',
  'icon-zip2': 'icon_zip2',
};

async function exists(p) {
  return access(p).then(() => true, () => false);
}

await mkdir(OUT, { recursive: true });
await mkdir(CAROUSEL_OUT, { recursive: true });

async function bakeScene(name, file) {
  await sharp(path.join(SRC, file)).webp(WEBP).toFile(path.join(OUT, `${name}.webp`));
}

async function bakeLogo() {
  const trimmed = await sharp(path.join(SRC, 'logo_bottom_right.png')).trim({ threshold: 10 }).toBuffer();
  await sharp(trimmed).webp(WEBP).toFile(path.join(OUT, 'logo.webp'));
}

async function bakeProduct(slug, file) {
  let source = path.join(SRC, `${file}.png`);
  const crop = PRODUCT_CROPS[slug];
  if (crop) {
    // sharp/libvips refuses to chain .trim() straight after .extract() in one
    // pipeline ("bad extract area") — round-tripping through a buffer first
    // materializes the crop so trim has a normal image to work with.
    source = await sharp(source).extract(crop).toBuffer();
  }
  const trimmed = await sharp(source).trim({ threshold: 10 }).toBuffer();
  await sharp(trimmed)
    .resize({ width: TILE_SIZE, height: TILE_SIZE, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp(WEBP)
    .toFile(path.join(OUT, `${slug}.webp`));
}

async function bakeBlueprintIcon(slug, file) {
  const trimmed = await sharp(path.join(SRC, `${file}.png`)).trim({ threshold: 10 }).toBuffer();
  await sharp(trimmed)
    .resize({ width: BLUEPRINT_ICON_MAX, height: BLUEPRINT_ICON_MAX, fit: 'inside', withoutEnlargement: true })
    .webp(WEBP)
    .toFile(path.join(OUT, `${slug}.webp`));
}

async function bakeCarrouselImage(n, srcPath) {
  await sharp(srcPath)
    .resize({ width: CAROUSEL_MAX_DIM, height: CAROUSEL_MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .webp(WEBP)
    .toFile(path.join(CAROUSEL_OUT, `carrousel-${n}.webp`));
}

async function bakeCarrouselVideo(n, srcPath) {
  const out = path.join(CAROUSEL_OUT, `carrousel-${n}.mp4`);
  try {
    await run('ffmpeg', [
      '-y',
      '-i', srcPath,
      '-vf', `scale='min(${CAROUSEL_VIDEO_WIDTH},iw)':-2`,
      '-an', // silent — these autoplay muted, no reason to ship an audio track
      '-c:v', 'libx264',
      '-crf', '30',
      '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      out,
    ]);
  } catch (err) {
    console.warn(`⚠ ffmpeg not available or failed on carrousel_${n} — copying the source video untouched (likely much larger than needed).`, err.message);
    const { copyFile } = await import('node:fs/promises');
    await copyFile(srcPath, out);
  }
}

/** Finds carrousel_{n}'s source file regardless of which extension it was supplied with. */
async function findCarrouselSource(n) {
  for (const ext of ['png', 'webp', 'jpg', 'jpeg', 'mp4', 'webm', 'mov']) {
    const p = path.join(SRC, `carrousel_${n}.${ext}`);
    if (await exists(p)) return { path: p, ext };
  }
  return null;
}

const carrouselJobs = [];
for (let n = 1; n <= 15; n++) {
  const found = await findCarrouselSource(n);
  if (!found) {
    console.warn(`⚠ carrousel_${n}.* not found in ${SRC} — skipped.`);
    continue;
  }
  const isVideo = found.ext === 'mp4' || found.ext === 'webm' || found.ext === 'mov';
  carrouselJobs.push(isVideo ? bakeCarrouselVideo(n, found.path) : bakeCarrouselImage(n, found.path));
}

await Promise.all([
  bakeScene('scene-bg', 'background_xav.png'),
  bakeScene('scene-shadow', 'shadow_xav.png'),
  bakeScene('scene-hero', 'hero_xav.png'),
  bakeLogo(),
  ...Object.entries(PRODUCTS).map(([slug, file]) => bakeProduct(slug, file)),
  ...Object.entries(BLUEPRINT_ICONS).map(([slug, file]) => bakeBlueprintIcon(slug, file)),
  ...carrouselJobs,
]);

console.log('✓ brand assets baked →', path.relative(root, OUT));
