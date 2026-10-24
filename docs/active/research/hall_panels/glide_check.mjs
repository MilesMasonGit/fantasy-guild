// Checks the camera glide with the Hall panels in place: frames ~120 ms apart after opening the
// Hall from its orb and after Return to Playmat, laid side by side at a quarter size.
// node glide_check.mjs <url> <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5212', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;

async function strip(page, shots, k) {
    return page.evaluate(`(async () => {
        const srcs = ${JSON.stringify(shots)};
        const imgs = [];
        for (const s of srcs) { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); imgs.push(i); }
        const w = Math.round(imgs[0].width * ${k}), h = Math.round(imgs[0].height * ${k});
        const c = document.createElement('canvas'); c.width = imgs.length * (w + 4) - 4; c.height = h;
        const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingQuality = 'high';
        imgs.forEach((im, n) => g.drawImage(im, n * (w + 4), 0, w, h));
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}
const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
const frames = async (page, n, gapMs) => {
    const shots = [];
    for (let i = 0; i < n; i++) { shots.push((await page.send('Page.captureScreenshot', { format: 'png' })).data); await sleep(gapMs); }
    return shots;
};

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); b.click(); })()`);
    await sleep(6000);
    const orb = await centreOf(page, '#guild-bubble-target button');
    await page.click(orb.x, orb.y);
    const up = await frames(page, 6, 60);
    await sleep(1500);
    console.log('open: board', await page.evaluate(`!!document.querySelector('[data-guild-hall-board]')`),
        'details', await page.evaluate(`!!document.querySelector('[data-hall-details] [data-hall-return]')`),
        'effects column', await page.evaluate(`!!document.querySelector('aside[data-hall-effects]')`));
    writeFileSync(path.join(out, 'after2_glide_up_strip.png'), Buffer.from(await strip(page, up, 0.2), 'base64'));
    const back = await centreOf(page, '[data-hall-return]');
    await page.click(back.x, back.y);
    const down = await frames(page, 6, 60);
    await sleep(1500);
    console.log('closed: board', await page.evaluate(`!!document.querySelector('[data-guild-hall-board]')`));
    writeFileSync(path.join(out, 'after2_glide_down_strip.png'), Buffer.from(await strip(page, down, 0.2), 'base64'));
    if (page.consoleErrors.length) console.log('page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
