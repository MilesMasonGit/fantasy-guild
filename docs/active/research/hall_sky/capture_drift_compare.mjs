// Linear drift against whole-art-pixel steps (today) and whole-screen-pixel steps, for the owner's phone review and a shimmer check:
// node capture_drift_compare.mjs <url> <outDir>
// Per glide: a strip of 8 stills of one patch of plain sky ~250 ms apart (2 s, about 3.4 screen
// px of star drift) at 3x, and per still the patch's brightest pixel, how many pixels are lit
// part-way (a blurred star) and the brightness-weighted centre, so shimmer shows as numbers too.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5211', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const GLIDES = { linear: 'linear', art_px_steps: 'steps(512, end)', screen_px_steps: 'steps(1024, end)' };

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME').click()`);
    await sleep(6000);
    const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(orb.x, orb.y);
    await sleep(2500);
    await page.mouse('mouseMoved', 5, H - 5);

    // The clouds hidden for the measurement, so only the star layer moves in the patch.
    const patch = { x: 520, y: 40, width: 120, height: 90 };
    await page.evaluate(`document.querySelector('[data-hall-sky-layer="clouds"]').style.visibility = 'hidden'`);
    for (const [name, ease] of Object.entries(GLIDES)) {
        await page.evaluate(`document.querySelector('[data-hall-sky]').style.setProperty('--gi-sky-ease', ${JSON.stringify(ease)})`);
        await sleep(500);
        const shots = [];
        const tx = [];
        for (let n = 0; n < 8; n++) {
            shots.push((await page.send('Page.captureScreenshot', { format: 'png', clip: { ...patch, scale: 1 } })).data);
            tx.push(await page.evaluate(`getComputedStyle(document.querySelector('[data-hall-sky-layer="stars"]')).transform.split(',')[4].trim()`));
            await sleep(250);
        }
        const res = await page.evaluate(`(async () => {
            const srcs = ${JSON.stringify(shots)};
            const imgs = [];
            for (const s of srcs) { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); imgs.push(i); }
            const stats = imgs.map(im => {
                const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
                const g = c.getContext('2d'); g.drawImage(im, 0, 0);
                const d = g.getImageData(0, 0, c.width, c.height).data;
                let max = 0, partial = 0, sx = 0, sw = 0;
                for (let p = 0; p < d.length; p += 4) {
                    const v = (d[p] + d[p + 1] + d[p + 2]) / 3;
                    max = Math.max(max, v);
                    if (v > 40 && v < 150) partial++;
                    if (v > 40) { sx += ((p / 4) % c.width) * v; sw += v; }
                }
                return { max: Math.round(max), partial, cx: +(sx / sw).toFixed(2) };
            });
            const k = 3, gap = 4, w = imgs[0].width * k, h = imgs[0].height * k;
            const c = document.createElement('canvas'); c.width = imgs.length * w + (imgs.length - 1) * gap; c.height = h;
            const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
            g.imageSmoothingEnabled = false;
            imgs.forEach((im, n) => g.drawImage(im, n * (w + gap), 0, w, h));
            // An 8x close-up of a 24 x 14 px corner around the patch's big star, per still.
            const z = 8, zw = 24 * z, zh = 14 * z;
            const c2 = document.createElement('canvas'); c2.width = imgs.length * zw + (imgs.length - 1) * gap; c2.height = zh;
            const g2 = c2.getContext('2d'); g2.fillStyle = '#ff00ff'; g2.fillRect(0, 0, c2.width, c2.height);
            g2.imageSmoothingEnabled = false;
            imgs.forEach((im, n) => g2.drawImage(im, 50, 36, 24, 14, n * (zw + gap), 0, zw, zh));
            return { stats, png: c.toDataURL('image/png').split(',')[1], zoom: c2.toDataURL('image/png').split(',')[1] };
        })()`);
        writeFileSync(path.join(out, `drift_${name}_strip_3x.png`), Buffer.from(res.png, 'base64'));
        writeFileSync(path.join(out, `drift_${name}_closeup_8x.png`), Buffer.from(res.zoom, 'base64'));
        console.log(name, 'layer x', tx.join(' '));
        console.log(name, JSON.stringify(res.stats));
    }
    await page.evaluate(`document.querySelector('[data-hall-sky]').style.removeProperty('--gi-sky-ease')`);
} finally {
    await chrome.close();
}
