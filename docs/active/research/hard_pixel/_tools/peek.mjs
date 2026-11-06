// Throwaway: crop raw/<names> side by side, zoomed, into raw/peek.png. node peek.mjs l t w h zoom name1 name2 ...
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [l, t, w, h, z, ...names] = process.argv.slice(2);
const [L, T, Wd, Ht, Z] = [l, t, w, h, z].map(Number);
const parts = await Promise.all(names.map(n => sharp(path.join(here, 'raw', n + '.png')).extract({ left: L, top: T, width: Wd, height: Ht }).resize(Wd * Z, Ht * Z, { kernel: 'nearest' }).png().toBuffer()));
await sharp({ create: { width: (Wd * Z + 8) * parts.length, height: Ht * Z, channels: 4, background: '#ff00ff' } })
    .composite(parts.map((input, i) => ({ input, left: i * (Wd * Z + 8), top: 0 }))).png().toFile(path.join(here, 'raw', 'peek.png'));
