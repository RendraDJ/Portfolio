// Blueprints → WebP pages for the tablet in the Xandvar studio (brand/room.ts).
// Renders each PDF in public/blueprints/ with macOS PDFKit (scripts/pdf-pages.swift),
// then writes src/assets/blueprints/<slug>-NN.webp.  Run: npm run assets:blueprints
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/blueprints';
const OUT = 'src/assets/blueprints';
const FILES = {
  'T-SHIRTS.pdf': 'tshirts',
  'Techpack-Zip-Hoodie.pdf': 'techpack',
  'Full-Zip-Hoodie.pdf': 'fullzip',
};

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'blueprints-'));
try {
  for (const [file, slug] of Object.entries(FILES)) {
    execFileSync('swift', ['scripts/pdf-pages.swift', join(SRC, file), tmp, slug, '1400'], { stdio: 'inherit' });
  }
  for (const png of readdirSync(tmp).filter((f) => f.endsWith('.png')).sort()) {
    await sharp(join(tmp, png)).resize({ width: 1100 }).webp({ quality: 78 }).toFile(join(OUT, png.replace('.png', '.webp')));
  }
  console.log(`→ ${OUT}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
