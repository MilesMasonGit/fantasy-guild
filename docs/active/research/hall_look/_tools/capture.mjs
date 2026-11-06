// Throwaway (brief 390 G1): open the real game on the throwaway server, put a mid-game sky in, open the
// Guild Hall, then show each mock-up option by changing the screen's DOM in place (inject.js) and save
// the pictures to raw/. node capture.mjs [job,job]   jobs: probe, panel, stars, sky
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'raw');
mkdirSync(out, { recursive: true });
const jobs = (process.argv[2] || 'probe').split(',');
const SPACING = Number(process.argv[3] || 1.5);
const inject = readFileSync(path.join(here, 'inject.js'), 'utf8');

// A guild some way in: a few stars of each state, the Forestry and Hearth groups well along.
const RANKS = {
    roster_size: 3, bank_tabs: 2, wishing_well: 3,
    star_infirmary: 1, star_larder: 1,
    star_forestry_speed: 2, star_forestry_yield: 1, star_forestry_xp: 1,
    star_mining_speed: 1, star_mining_xp: 1,
    star_fishing_speed: 1,
    star_well_oak_wood: 1, star_well_copper_ore: 2, star_well_stone: 1
};

const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    const shot = async (name, clip) => {
        const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}) });
        writeFileSync(path.join(out, name), Buffer.from(r.data, 'base64'));
        console.log('saved', name);
    };
    const ev = (js) => page.evaluate(js);
    const centre = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const away = async () => { await page.mouse('mouseMoved', 900, 1075); await sleep(300); };

    await page.setViewport(1920, 1080);
    await page.navigate('http://localhost:5405/');
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME')?.click()`);
    await sleep(6000);
    console.log(await ev(`(() => {
        const G = window.Game;
        G.InventoryManager.addItem('item_oak_wood', 400);
        G.InventoryManager.addItem('item_copper_ore', 60);
        const ranks = ${JSON.stringify(RANKS)};
        G.GameState.state.progress.guildUpgrades = { ...(G.GameState.state.progress.guildUpgrades || {}), ...ranks };
        G.GuildUpgradeManager.recompute();
        G.EventBus.publish('guild_upgrades_updated', {});
        return JSON.stringify(G.GameState.state.progress.guildUpgrades);
    })()`));
    // Publish through the engine's own event name, whatever its string is.
    await ev(`(async () => { const m = await import('/src/systems/core/engineEvents.js'); window.Game.EventBus.publish(m.ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {}); window.Game.EventBus.publish(m.ENGINE_EVENTS.INVENTORY_UPDATED, {}); })()`);
    const bubble = await centre('#guild-bubble-target button');
    await page.click(bubble.x, bubble.y);
    await sleep(2500);
    await away();
    await ev(inject);
    console.log('board:', await ev(`(() => { const b = document.querySelector('[data-guild-hall-board]'); return [b.dataset.naturalWidth, b.dataset.naturalHeight, b.dataset.skyScale, b.offsetWidth, b.offsetHeight].join(' '); })()`));
    console.log('states:', await ev(`[...document.querySelectorAll('button[data-hall-node]')].map(b => b.dataset.hallNode.replace('star_','') + ':' + b.dataset.nodeState + ':' + b.dataset.starLook).join(' ')`));

    if (jobs.includes('probe')) {
        await shot('probe_hall.png');
        for (const k of [1, 1.25, 1.4, 1.5, 1.6, 1.75]) {
            await ev(`window.G1.layout({ k: ${k}, below: true, ranks: false })`);
            const o = await ev(`window.G1.overlaps()`);
            console.log(`k=${k}: ${o.length} overlaps`, o.slice(0, 12).join('; '));
        }
        await ev(`window.G1.layout({ k: 1, below: false, ranks: true })`);
        console.log('today:', (await ev(`window.G1.overlaps()`)).length, 'overlaps');
    }
    if (jobs.includes('skyprobe')) {
        const VW = 3600, VH = 2800;
        await page.setViewport(VW, VH);
        await sleep(1500);
        await away();
        for (const k of [1, 1.25, 1.4, 1.5]) {
            const sz = await ev(`window.G1.layout({ k: ${k}, below: ${k > 1}, ranks: ${k === 1} })`);
            await sleep(300);
            const r = await ev(`(() => { const r = document.querySelector('[data-guild-hall-board]').getBoundingClientRect(); return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(Math.min(r.width, ${VW})), height: Math.round(Math.min(r.height, ${VH})) }; })()`);
            console.log(k, JSON.stringify(sz), JSON.stringify(r));
            await shot(`skyprobe_${k}.png`, r);
        }
    }
    const boardClip = (VW, VH) => ev(`(() => { const r = document.querySelector('[data-guild-hall-board]').getBoundingClientRect(); return { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.round(Math.min(r.width, ${VW})), height: Math.round(Math.min(r.height, ${VH})) }; })()`);
    // Every star's centre in the saved picture's pixels, for the close-up crops.
    const starsAt = (clip) => ev(`Object.fromEntries([...document.querySelectorAll('button[data-hall-node]')].map(b => { const r = b.getBoundingClientRect(); return [b.dataset.hallNode, [Math.round(r.x + r.width / 2 - ${clip.x}), Math.round(r.y + r.height / 2 - ${clip.y})]]; }))`);
    const hoverStar = async (id) => { const c = await centre(`button[data-hall-node="${id}"]`); await page.mouse('mouseMoved', c.x, c.y); await sleep(400); };
    const pos = {};

    if (jobs.includes('panel')) {
        await page.setViewport(1920, 1080);
        await sleep(1200);
        await ev(`window.G1.layout({ k: 1, below: false, ranks: true })`);
        await ev(`window.G1.stars('A')`);
        const c = await centre('button[data-hall-node="star_forestry_camp_reach"]');
        await page.click(c.x, c.y);
        await sleep(600);
        await away();
        for (const f of ['E', 'F', 'G']) {
            await ev(`window.G1.frame('${f}')`);
            await sleep(400);
            await shot(`panel_${f}.png`);
        }
        await ev(`window.G1.frame('E')`);
        pos.panel = await ev(`(() => { const r = document.querySelector('[data-hall-return]').closest('.gap-3').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()`);
    }

    if (jobs.includes('sky')) {
        const VW = 3600, VH = 2800;
        await page.setViewport(VW, VH);
        await sleep(1500);
        await away();
        // Today: today's spacing, tags on their authored sides, ranks shown, plain stars.
        await ev(`window.G1.layout({ k: 1, below: false, ranks: true })`);
        await ev(`window.G1.stars('A')`);
        await sleep(300);
        let clip = await boardClip(VW, VH);
        await shot('sky_today.png', clip);
        pos.sky_today = { clip, stars: await starsAt(clip) };
        for (const t of ['A', 'B', 'C', 'D']) {
            await ev(`window.G1.stars('${t}')`);
            await ev(`window.G1.layout({ k: ${SPACING}, below: true, ranks: false, hoverRank: 'star_forestry_yield' })`);
            await sleep(300);
            clip = await boardClip(VW, VH);
            await hoverStar('star_forestry_yield');
            await shot(`sky_${t}.png`, clip);
            pos[`sky_${t}`] = { clip, stars: await starsAt(clip) };
        }
        pos.overlaps = await ev(`window.G1.overlaps()`);
        console.log('overlaps with D:', pos.overlaps.length, pos.overlaps.join('; '));
    }
    writeFileSync(path.join(here, `positions_${jobs.join('_')}.json`), JSON.stringify(pos, null, 1));
} finally {
    await chrome.close();
}
