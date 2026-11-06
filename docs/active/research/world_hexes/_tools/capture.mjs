// Throwaway (brief 380 M1): render mock.html for each option in headless Chrome and save the pictures.
// node capture.mjs [url] [only]
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'raw');
mkdirSync(outDir, { recursive: true });
const url = process.argv[2] || 'http://localhost:5403/docs/active/research/world_hexes/_tools/mock.html';
const only = process.argv[3] || '';
const jobs = [
    ['A', 'E', 0], ['B', 'E', 0], ['C', 'E', 0], ['A', 'E', 1], ['B', 'E', 1], ['C', 'E', 1],
    ['none', 'D', 0], ['none', 'E', 0], ['none', 'F', 0], ['A', 'D', 0], ['A', 'F', 0]
].filter(([h, w]) => !only || only.split(',').includes(`${h}${w}`));
const chrome = await launchChrome({ width: 1920, height: 1080 });
const timings = {};
try {
    const page = await chrome.newPage();
    await page.setViewport(1920, 1080);
    for (const [hex, world, pulse] of jobs) {
        await page.navigate(`${url}?hex=${hex}&world=${world}&pulse=${pulse}&t=${Date.now()}`);
        await page.waitFor('window.__done === true || !!window.__err', { timeoutMs: 120000 });
        const err = await page.evaluate('window.__err || null'); if (err) { console.log('ERROR', hex, world, err); continue; }
        const data = await page.evaluate(`document.getElementById('screen').toDataURL('image/png')`);
        const name = `${hex}_${world}${pulse ? '_p1' : ''}.png`;
        writeFileSync(path.join(outDir, name), Buffer.from(data.split(',')[1], 'base64'));
        timings[name] = JSON.parse(await page.evaluate('JSON.stringify(window.__timings)'));
        console.log(name, JSON.stringify(timings[name]));
    }
} finally {
    await chrome.close();
}
writeFileSync(path.join(here, 'timings.json'), JSON.stringify(timings, null, 1));
