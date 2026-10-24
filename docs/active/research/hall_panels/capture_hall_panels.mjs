// Captures the Guild Hall upgrade screen's panels from a running dev server, for the owner's phone
// review: node capture_hall_panels.mjs <url> <outDir> <label>
// At 1920 x 1080: the screen at rest, the Effects popover (hovered, then pinned by a click), a star
// selected with the Inspect panel showing it, and the Inspect panel at 2x.
// Full-screen shots are scaled down to half size (the 2x close-up excepted) to stay small.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5212', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

/** Rescale a PNG by `k` in the page's canvas: smooth when shrinking, no smoothing when growing. */
async function rescale(page, shot, k) {
    return page.evaluate(`(async () => {
        const i = new Image(); i.src = 'data:image/png;base64,${shot}'; await i.decode();
        const c = document.createElement('canvas'); c.width = Math.round(i.width * ${k}); c.height = Math.round(i.height * ${k});
        const g = c.getContext('2d'); g.imageSmoothingEnabled = ${k} < 1; g.imageSmoothingQuality = 'high';
        g.drawImage(i, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
const rectOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width) + 6, height: Math.ceil(r.height) + 6 }; })()`);
const full = async (page) => (await page.send('Page.captureScreenshot', { format: 'png' })).data;
const clip = async (page, c) => (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...c, scale: 1 } })).data;
const away = async (page) => { await page.mouse('mouseMoved', 5, H - 5); await sleep(400); };
const effectsShown = (page) => page.evaluate(`!!document.querySelector('[data-hall-effects]')`);

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

    // Ranks for every state (the QA panel's sample), and Bank Slots' next price in the Bank.
    await page.evaluate(`(async () => {
        const dev = await import('/src/ui/dev/GuildHallDevSection.jsx');
        dev.devSetGuildRanks(dev.SKY_SAMPLE_RANKS);
        const { GuildUpgradeManager, InventoryManager } = window.Game;
        const { totalPrice } = await import('/src/config/guildUpgrades.js');
        for (const p of totalPrice(GuildUpgradeManager.getNextCost('bank_slots'))) InventoryManager.addItem(p.itemId, p.quantity);
        const stubs = await import('/src/systems/notifications/itemStubs.js');
        stubs.clearUnpinned?.();
    })()`);
    await sleep(800);
    // The Guild Hall orb takes a real click near its middle.
    const orb = await centreOf(page, '#guild-bubble-target button');
    await page.click(orb.x, orb.y);
    await sleep(2500);
    await away(page);
    console.log(label, 'at rest, effects shown:', await effectsShown(page));
    save(`${label}_1_rest.png`, await rescale(page, await full(page), 0.5));

    // The Effects: hovering the Hall star, then a click pins it and the pointer leaves.
    const hall = await centreOf(page, '[data-hall-node="hall"]');
    await page.mouse('mouseMoved', hall.x, hall.y);
    await sleep(500);
    console.log(label, 'Hall star hovered, effects shown:', await effectsShown(page));
    save(`${label}_2_effects_hover.png`, await rescale(page, await full(page), 0.5));
    // ⚠️ Before this change a click on the Hall star closed the screen, so the 'before' run skips it.
    if (label !== 'before') {
        await page.click(hall.x, hall.y);
        await away(page);
        console.log(label, 'pinned and left, effects shown:', await effectsShown(page));
        save(`${label}_3_effects_pinned.png`, await rescale(page, await full(page), 0.5));
        await page.click(Math.round(W * 0.35), 60);
        await sleep(300);
        console.log(label, 'after a click on bare sky, effects shown:', await effectsShown(page));
        await page.click(hall.x, hall.y);
        await sleep(300);
        await page.key('Escape');
        await sleep(300);
        console.log(label, 'pinned then Escape, effects shown:', await effectsShown(page),
            'screen still open:', await page.evaluate(`!!document.querySelector('[data-guild-hall-board]')`));
    }
    await away(page);

    // A star selected: Bank Slots, which the Bank can pay for.
    const star = await centreOf(page, '[data-hall-node="bank_slots"]');
    await page.click(star.x, star.y);
    await away(page);
    save(`${label}_4_star_selected.png`, await rescale(page, await full(page), 0.5));

    const panel = await rectOf(page, '[data-hall-details]');
    save(`${label}_5_inspect_2x.png`, await rescale(page, await clip(page, panel), 2));
    if (page.consoleErrors.length) console.log(label, 'page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
