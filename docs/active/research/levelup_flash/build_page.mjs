// Puts the sprites in `sprites/` and the fonts in `fonts/` (copies of the game's, never the originals)
// into index.html as data URLs, between the ASSETS-BEGIN and ASSETS-END lines, so the page is one file
// that opens anywhere by double-click. Run again after changing a sprite:
//   node build_page.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, 'index.html');
const read = (dir, ext, mime) => {
    const out = {};
    for (const f of readdirSync(path.join(here, dir)).filter(f => f.endsWith(ext)).sort()) {
        out[f.slice(0, -ext.length)] = `data:${mime};base64,` + readFileSync(path.join(here, dir, f)).toString('base64');
    }
    return out;
};
const assets = read('sprites', '.png', 'image/png');
const fonts = read('fonts', '.woff2', 'font/woff2');
const json = (o) => JSON.stringify(o, null, 0).replace(/","/g, '",\n"');
const html = readFileSync(page, 'utf8');
const next = html.replace(/\/\/ ASSETS-BEGIN\r?\n[\s\S]*?\/\/ ASSETS-END/,
    `// ASSETS-BEGIN\nconst ASSETS = ${json(assets)};\nconst FONTS = ${json(fonts)};\n// ASSETS-END`);
if (next === html) console.log('index.html unchanged');
else { writeFileSync(page, next); console.log(`index.html: ${Object.keys(assets).length} sprites, ${Object.keys(fonts).length} fonts inlined`); }
