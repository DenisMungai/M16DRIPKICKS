/**
 * Converts all product JPEGs in public/products/ to WebP.
 * Run: node scripts/convert-images.mjs
 * Requires: npm install -D sharp
 */
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'products');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\.(jpg|jpeg|png)$/i.test(e.name)) files.push(full);
  }
  return files;
}

const files = await walk(PRODUCTS_DIR);
console.log(`Converting ${files.length} images to WebP…`);

let saved = 0;
for (const src of files) {
  const dest = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  const { size: before } = await stat(src);
  await sharp(src)
    .webp({ quality: 82, effort: 4 })
    .toFile(dest);
  const { size: after } = await stat(dest);
  const pct = Math.round((1 - after / before) * 100);
  saved += before - after;
  console.log(`  ✓ ${path.relative(ROOT, dest)}  (${pct}% smaller)`);
}

console.log(`\nDone. Total saved: ${(saved / 1024).toFixed(0)} KB`);
