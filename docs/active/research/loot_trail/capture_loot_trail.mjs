// Records every tile of the loot trail page (index.html) as an animated GIF beside it, so a tile can
// be sent as a file: Today.gif, A.gif .. R.gif. Each GIF is one pass per item of the page's item run,
// drawn frame by frame by the page itself (window.__gif), so it matches the page exactly.
// A headless Chrome of its own, closed at the end; no dev server needed:
//   node capture_loot_trail.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { launchChrome } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);

const browser = await launchChrome({ width: 1400, height: 900 });
try {
    const page = await browser.newPage();
    await page.navigate(pathToFileURL(path.join(here, 'index.html')).href);
    await page.waitFor('window.__ready === true', { what: 'the page to load its sprites' });
    const timing = await page.evaluate('window.__timing');
    console.log(`flight ${timing.dist} px, ${timing.DUR} ms; loop ${timing.LOOP_MS} ms; ${timing.frames} frames a GIF`);
    const tiles = await page.evaluate('window.__tiles');
    for (const { letter, desc } of tiles) {
        const b64 = await page.evaluate(`window.__gif(${JSON.stringify(letter)})`, { timeoutMs: 180000 });
        const buf = Buffer.from(b64, 'base64');
        writeFileSync(path.join(here, `${letter}.gif`), buf);
        console.log(`${letter}.gif  ${(buf.length / 1024).toFixed(0)} KB  ${desc}`);
    }
    if (page.consoleErrors.length) console.warn('page errors:', page.consoleErrors);
} finally {
    console.log('chrome closed:', JSON.stringify(await browser.close()));
}
