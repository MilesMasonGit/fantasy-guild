// Puts the sprites in `sprites/` (copies of the game's art, never the originals) into index.html as
// data URLs, between the ASSETS-BEGIN and ASSETS-END lines, so the page is one file that opens
// anywhere and can read its sprites' colours. Run again after changing a sprite:
//   node build_page.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, 'index.html');
const dir = path.join(here, 'sprites');
const assets = {};
for (const f of readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
    assets[f.replace(/\.png$/, '')] = 'data:image/png;base64,' + readFileSync(path.join(dir, f)).toString('base64');
}
const html = readFileSync(page, 'utf8');
const next = html.replace(/\/\/ ASSETS-BEGIN\r?\n[\s\S]*?\/\/ ASSETS-END/,
    `// ASSETS-BEGIN\nconst ASSETS = ${JSON.stringify(assets, null, 0).replace(/","/g, '",\n"')};\n// ASSETS-END`);
if (next === html) console.log('index.html unchanged');
else { writeFileSync(page, next); console.log(`index.html: ${Object.keys(assets).length} sprites inlined`); }
