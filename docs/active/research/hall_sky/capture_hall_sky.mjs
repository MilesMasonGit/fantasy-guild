// Captures the Guild Hall upgrade screen from a running dev server, for the owner's phone review:
// node capture_hall_sky.mjs <url> <outDir> <label>
// At 1920 x 1080: the screen with stars in every state (some made affordable by putting their
// next price in the Bank), a 2x close-up of a few stars, a strip of drift stills ~50 ms apart at
// 2x, and the screen open while loot and a banner arrive, then the mat after closing it.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5211', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

/** Upscale PNGs `k` times with no smoothing and lay them side by side, in the page's canvas. */
async function strip(page, shots, k, gap = 4) {
    return page.evaluate(`(async () => {
        const srcs = ${JSON.stringify(shots)};
        const imgs = [];
        for (const s of srcs) { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); imgs.push(i); }
        const w = imgs[0].width * ${k}, h = imgs[0].height * ${k};
        const c = document.createElement('canvas'); c.width = imgs.length * w + (imgs.length - 1) * ${gap}; c.height = h;
        const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingEnabled = false;
        imgs.forEach((im, n) => g.drawImage(im, n * (w + ${gap}), 0, w, h));
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

/** The Guild Hall orb takes a real click near its middle (it ignores clicks on its corners). */
async function clickHallOrb(page) {
    const c = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(c.x, c.y);
}

const clip = async (page, c) => (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...c, scale: 1 } })).data;

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(6000);

    // Ranks for every state (the QA panel's sample), then the next price of two upgrades in the
    // Bank, through the game's own functions, so those two can be bought now.
    const made = await page.evaluate(`(async () => {
        const dev = await import('/src/ui/dev/GuildHallDevSection.jsx');
        dev.devSetGuildRanks(dev.SKY_SAMPLE_RANKS);
        const { GuildUpgradeManager, InventoryManager } = window.Game;
        const { totalPrice } = await import('/src/config/guildUpgrades.js');
        const give = ['bank_slots', 'token_cap'];
        for (const id of give) for (const p of totalPrice(GuildUpgradeManager.getNextCost(id))) InventoryManager.addItem(p.itemId, p.quantity);
        // Let the stubs from those gifts go, so the first shot is the sky alone.
        const stubs = await import('/src/systems/notifications/itemStubs.js');
        stubs.clearUnpinned?.();
        return give.filter(id => GuildUpgradeManager.canAfford(id));
    })()`);
    console.log(label, 'affordable', made);
    await sleep(800);
    await clickHallOrb(page);
    await sleep(2500);
    // The pointer off the web, so no star shows its hover outline.
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(300);

    const states = await page.evaluate(`[...document.querySelectorAll('[data-hall-node]')].map(b => {
        const r = b.getBoundingClientRect(); const img = b.querySelector('img');
        return { id: b.dataset.hallNode, state: b.dataset.nodeState, look: b.dataset.starLook || null,
                 src: img?.getAttribute('src')?.split('/').pop(), anim: img ? getComputedStyle(img).animationName : null,
                 x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })`);
    console.log(label, JSON.stringify(states));
    save(`${label}_hall.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);

    // A close-up of a few stars around the Hall, at 2x.
    const hall = states.find(s => s.id === 'hall');
    const near = { x: hall.x - 280, y: hall.y - 220, width: 560, height: 440 };
    save(`${label}_stars_2x.png`, await strip(page, [await clip(page, near)], 2));

    // The drift: stills ~50 ms apart of a patch of plain sky (top left of the web), at 2x.
    const patch = { x: 520, y: 40, width: 120, height: 90 };
    const shots = [];
    const times = [];
    const t0 = Date.now();
    for (let n = 0; n < 8; n++) {
        const due = t0 + n * 50;
        while (Date.now() < due) await sleep(2);
        times.push(Date.now() - t0);
        shots.push(await clip(page, patch));
    }
    const offsets = await page.evaluate(`(() => [...document.querySelectorAll('[data-hall-sky-layer]')].map(l => l.dataset.hallSkyLayer + ' ' + getComputedStyle(l).transform + ' ' + getComputedStyle(l).animationTimingFunction))()`);
    console.log(label, 'drift stills at ms', times.join(','), offsets);
    save(`${label}_drift_strip_2x.png`, await strip(page, shots, 2));

    // Loot and a banner arriving while the screen is open.
    await page.evaluate(`(async () => {
        const { InventoryManager } = window.Game;
        InventoryManager.addItem('item_oak_wood', 7);
        InventoryManager.addItem('item_stone', 4);
        const banners = await import('/src/systems/notifications/banners.js');
        banners.push({ kind: 'hero', parts: { heroes: ['Test Hero'] } });
    })()`);
    await sleep(1500);
    const counts = `({ stubs: document.querySelectorAll('[data-item-stub]').length, banners: document.querySelectorAll('[data-banner]').length })`;
    console.log(label, 'open, loot arrived', JSON.stringify(await page.evaluate(counts)));
    save(`${label}_hall_loot.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);

    // Back to the mat: what arrived is there.
    await clickHallOrb(page);
    await sleep(2500);
    console.log(label, 'closed', JSON.stringify(await page.evaluate(counts)));
    save(`${label}_after_close.png`, (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    if (page.consoleErrors.length) console.log(label, 'page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
