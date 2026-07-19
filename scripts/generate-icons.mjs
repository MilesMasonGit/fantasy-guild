/**
 * Regenerate the Tauri app icons from the source pixel-art sprite.
 *
 * Why this exists: `npx tauri icon` resamples smoothly, which blurs pixel art.
 * This script scales with nearest-neighbour instead, so every source pixel
 * becomes a hard-edged block and the icon stays crisp at every size.
 *
 * Run `npx tauri icon <big-png>` first if you need the full set (Windows Store
 * logos, .icns, Android/iOS); then run this to overwrite the ones the Windows
 * bundle actually ships. Sizes that are integer multiples of the 32px source
 * (64, 128, 256, 512) come out pixel-perfect; 16 and 48 are unavoidably uneven
 * but stay crisp rather than smudged.
 *
 * Usage: node scripts/generate-icons.mjs [path/to/source.png]
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs/promises';
import path from 'path';

const SOURCE = process.argv[2] || 'public/assets/items/food/pie/f_pie_cherry.png';
const ICON_DIR = 'src-tauri/icons';

// Only the entries listed under `bundle.icon` in tauri.conf.json ship in the
// Windows installers; icon.png is the runtime window icon.
const PNG_TARGETS = [
    ['32x32.png', 32],
    ['64x64.png', 64],
    ['128x128.png', 128],
    ['128x128@2x.png', 256],
    ['icon.png', 512]
];

// Sizes Windows picks between for the taskbar, Explorer and Alt-Tab.
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const scale = (size) =>
    sharp(SOURCE).resize(size, size, { kernel: 'nearest' }).png().toBuffer();

const meta = await sharp(SOURCE).metadata();
console.log(`source: ${SOURCE} (${meta.width}x${meta.height})`);

for (const [name, size] of PNG_TARGETS) {
    await fs.writeFile(path.join(ICON_DIR, name), await scale(size));
    const mult = size % meta.width === 0 ? `${size / meta.width}x exact` : 'non-integer';
    console.log(`  ${name.padEnd(16)} ${String(size).padStart(4)}px  (${mult})`);
}

const ico = await pngToIco(await Promise.all(ICO_SIZES.map(scale)));
await fs.writeFile(path.join(ICON_DIR, 'icon.ico'), ico);
console.log(`  icon.ico         ${ICO_SIZES.join(', ')}px  (${ico.length} bytes)`);
