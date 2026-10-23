// Captures the quieter-Tokens screens for the owner's phone review, from a running dev server:
//   node capture_quiet_tokens.mjs <url> <outDir> <label> [heroOnly]
// At 1920 x 1080 from a New Game: the mat, the tutorial's first step played by clicks (hover the
// quest, open the Guild Hall, the Bunk Beds, buy them), the done quest waiting, its claim (the
// next step must appear), a hero planted on the mat, and 2x close-ups (nearest-neighbour) of a
// movable Token at rest, Tokens and the hero with their names up. With `heroOnly` it stops after
// the hero's close-up and saves only that one.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5205', out = '.', label = 'shot', heroOnly = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}.png`), Buffer.from(b64, 'base64'));

async function full(page, name) {
    const s = await page.send('Page.captureScreenshot', { format: 'png' });
    save(name, s.data);
}

/** A clip of the page, upscaled `k` times with nearest-neighbour in the page's own canvas. */
async function clipScaled(page, name, clip, k = 2) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    const b64 = await page.evaluate(`(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
    save(name, b64);
}

const tokenRect = (page, typeId) => page.evaluate(`(() => {
    const t = Game.BoardState.tokens().find(t => t.typeId === ${JSON.stringify(typeId)});
    if (!t) return null;
    const o = document.querySelector('[data-token-overlay="' + t.id + '"]').getBoundingClientRect();
    const h = document.querySelector('[data-token-hit="' + t.id + '"]').getBoundingClientRect();
    return { id: t.id, x: o.x, y: o.y, w: o.width, h: o.height, cx: h.x + h.width / 2, cy: h.y + h.height / 2 };
})()`);

const heroRect = (page) => page.evaluate(`(() => {
    const e = document.querySelector('[data-board-hero]');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
})()`);

const around = (r, pad = 1) => ({
    x: Math.max(0, Math.round(r.x - r.w * pad)),
    y: Math.max(0, Math.round(r.y - r.h * pad)),
    width: Math.round(r.w * (1 + 2 * pad)),
    height: Math.round(r.h * (1 + 2 * pad))
});

const tutorial = (page) => page.evaluate(`(async () => {
    const QT = await import('/src/systems/quests/QuestTokens.js');
    return QT.tutorialTokens().map(t => t.quest.id + (t.quest.done ? ' (done)' : ''));
})()`);

const beacons = (page) => page.evaluate(`[...document.querySelectorAll('div')].filter(d => (d.style.zIndex || '').includes('tutorial')).length`);

const awayMouse = async (page) => { await page.mouse('mouseMoved', 1900, 1070); await sleep(400); };
const hover = async (page, x, y) => { await page.mouse('mouseMoved', x, y); await sleep(1000); };
const runTicks = (page, n) => page.evaluate(`(() => { for (let i = 0; i < ${n}; i++) Game.GameLoop.runHandlers(100); })()`);

const log = {};
const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    await page.setViewport(1920, 1080);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(3000);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(6000);
    await awayMouse(page);

    if (!heroOnly) {
        await full(page, '1_new_game');
        log.tutorialAtStart = await tutorial(page);

        // The tutorial's first step, played by clicks.
        const q = await tokenRect(page, 'token_quest');
        await hover(page, q.cx, q.cy);
        log.beaconsHoveringQuest = await beacons(page);
        await full(page, '2_tutorial_hover_quest');
        await awayMouse(page);

        const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        await page.click(orb.x, orb.y);
        await sleep(1500);
        log.beaconsHallOpen = await beacons(page);
        await full(page, '3_tutorial_hall_open');
        await page.evaluate(`document.querySelector('[data-guild-roster-upgrade]').click()`);
        await sleep(1500);
        log.beaconsBunkBeds = await beacons(page);
        await full(page, '4_tutorial_bunk_beds');
        const bought = await page.evaluate(`(() => { const b = document.querySelector('[data-guild-roster-upgrade-button]'); if (!b) return false; b.click(); return true; })()`);
        await sleep(1000);
        await runTicks(page, 20);
        log.boughtBunkBeds = bought;
        log.heroes = await page.evaluate(`Game.HeroManager.getAllHeroes().map(h => h.name)`);
        log.tutorialAfterBuy = await tutorial(page);
        await page.click(orb.x, orb.y);   // close the Guild Hall
        await sleep(1200);
        await awayMouse(page);

        // The done quest, waiting to be claimed.
        const qd = await tokenRect(page, 'token_quest');
        await full(page, '5_quest_ready');
        await clipScaled(page, '5_quest_ready_2x', around(qd, 0.6));

        // Claim it: the next step must appear.
        await page.click(qd.cx, qd.cy);
        await sleep(1500);
        await runTicks(page, 20);
        await sleep(1000);
        log.tutorialAfterClaim = await tutorial(page);
        await awayMouse(page);
    } else {
        // Only a hero: buy the Bunk Beds the short way.
        const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        await page.click(orb.x, orb.y);
        await sleep(1500);
        await page.evaluate(`document.querySelector('[data-guild-roster-upgrade]').click()`);
        await sleep(1500);
        await page.evaluate(`document.querySelector('[data-guild-roster-upgrade-button]').click()`);
        await sleep(1000);
        await page.click(orb.x, orb.y);
        await sleep(1200);
        await awayMouse(page);
    }

    // A hero on the mat, its flag left of the Hall.
    const heroId = await page.evaluate(`Game.HeroManager.getAllHeroes()[0]?.id`);
    log.planted = await page.evaluate(`Game.BoardPlacement.plantFlagAt(${JSON.stringify(heroId)}, { x: 700, y: 760 })?.success`);
    await sleep(6000);
    await awayMouse(page);

    const hr = await heroRect(page);
    if (!heroOnly) {
        await full(page, '6_mat_with_hero');

        // A movable Token at rest, then Tokens with their names up.
        const hall = await tokenRect(page, 'token_guild_hall');
        await clipScaled(page, '7_hall_at_rest_2x', around(hall, 0.6));
        await hover(page, hall.cx, hall.cy);
        await clipScaled(page, '8_hall_name_2x', around(hall, 0.6));
        await awayMouse(page);
        const mine = await tokenRect(page, 'token_copper_mine');
        await hover(page, mine.cx, mine.cy);
        await clipScaled(page, '9_mine_name_2x', around(mine, 0.6));
        await full(page, '9_mine_name_full');
        await awayMouse(page);
    }

    if (hr) {
        const h = await heroRect(page);
        await hover(page, h.cx, h.cy);
        await clipScaled(page, 'hero_name_2x', around({ x: h.x, y: h.y, w: h.w, h: h.h }, 1.2));
        await awayMouse(page);
    } else {
        log.hero = 'no hero on the mat';
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(label, JSON.stringify(log, null, 1));
    await chrome.close();
}
