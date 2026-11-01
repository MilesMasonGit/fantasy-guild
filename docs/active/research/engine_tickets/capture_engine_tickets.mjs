// node capture_engine_tickets.mjs <url> <outDir> <before|after> [date]
// Shots for T-266 (each enemy camp counts its own) and T-248 (enemies stroll with their art on the mat),
// at a 1920 × 1080 screen with headless Chrome, from a New Game (the Starter Camp's Goblin Camp stands
// near the bottom edge). Run once on the code before the fix ("before") and once after ("after"); the
// "after" run also lays each pair side by side.
//   <date>_t266_<label>.png    two Goblin Camps after a QA Hunter has hunted at the second for 4 minutes,
//                              then until the second has a goblin standing (at most 40 s more)
//   <date>_t248_<label>.png    the Starter Camp's goblins at the bottom edge, the moment one comes closest
//   <date>_t266_compare.png / _t248_compare.png   before and after side by side ("after" run only)
// Game time is run by script with the loop stopped, so a run takes seconds. It prints what it counted.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, label, date = '2026-10-30'] = process.argv.slice(2);
if (!url || !out || !['before', 'after'].includes(label)) {
    throw new Error('usage: node capture_engine_tickets.mjs <url> <outDir> <before|after> [date]');
}
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const file = (name) => path.join(out, `${date}_${name}.png`);

const shot = async (page, clip) => (await page.send('Page.captureScreenshot', {
    format: 'png', clip: { ...clip, scale: 1 }
})).data;

/** Pictures side by side, each labelled above, on a dark background. */
const compose = (page, tiles) => page.evaluate(`(async () => {
    const tiles = ${JSON.stringify(tiles)};
    const imgs = await Promise.all(tiles.map(async t => { const i = new Image(); i.src = 'data:image/png;base64,' + t.data; await i.decode(); return i; }));
    const gap = 16, top = 34;
    const c = document.createElement('canvas');
    c.width = imgs.reduce((w, i) => w + i.width, 0) + gap * (imgs.length - 1);
    c.height = Math.max(...imgs.map(i => i.height)) + top;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = 'bold 20px monospace'; g.textBaseline = 'top';
    let x = 0;
    imgs.forEach((img, i) => { g.fillText(tiles[i].label, x + 4, 6); g.drawImage(img, x, top); x += img.width + gap; });
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** The screen box of a mat rectangle (mat units), padded by `pad` screen pixels, clamped to the screen. */
const screenBox = (page, r, pad = 0) => page.evaluate(`(async () => {
    const { matW } = await import('/src/config/matGeometry.js');
    const el = document.querySelector('[data-mat-surface]');
    const b = el.getBoundingClientRect();
    const s = b.width / matW();
    const x = Math.max(0, b.left + ${r.x} * s - ${pad}), y = Math.max(0, b.top + ${r.y} * s - ${pad});
    const right = Math.min(${W}, b.left + (${r.x} + ${r.w}) * s + ${pad}), bottom = Math.min(${H}, b.top + (${r.y} + ${r.h}) * s + ${pad});
    return { x: Math.round(x), y: Math.round(y), width: Math.round(right - x), height: Math.round(bottom - y) };
})()`);

async function newGame(page) {
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-mat-surface]')`, { timeoutMs: 60000 });
    await sleep(3000);
    await page.evaluate('window.Game.GameLoop.stop()');
}

const chrome = await launchChrome({ width: W, height: H });
const log = { label };
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);

    // T-266: a second Goblin Camp nearer the Hall than the Starter Camp's, both filled; a QA Hunter
    // hunts at the second (the later on the mat) for four minutes.
    await newGame(page);
    log.t266 = await page.evaluate(`(async () => {
        const G = window.Game;
        const { findSpot } = await import('/src/systems/board/MatPlacement.js');
        const camps = () => G.BoardState.tokens().filter(t => t.typeId === 'token_goblin_camp');
        const first = camps()[0];
        const { guildHallPoint } = await import('/src/systems/board/HeroMotion.js');
        const hall = guildHallPoint();
        const at = findSpot('token_goblin_camp', { x: hall.x + 300, y: hall.y - 300 }, { reach: 200 });
        const inst = G.BoardState.createTokenInstance('token_goblin_camp');
        G.BoardPlacement.placeTokenAt(inst, at);
        const second = G.BoardState.getTokenById(inst.id);
        for (let i = 0; i < 1000; i++) G.GameLoop.runHandlers(100);          // both fill: 3 goblins each
        const own = (c) => G.BoardState.tokens().filter(t => t.tether === c.id).length;
        const filled = { first: own(first), second: own(second) };
        const { huntAtGoblinCamp } = await import('/src/ui/dev/campsDev.js');
        const hunt = huntAtGoblinCamp();
        const hunter = G.GameState.state.heroes.find(h => h.name === hunt.name);
        let kills = 0;
        const off = G.EventBus.subscribe('board:token_depleted', (p) => { if (p?.typeId === 'token_goblin') kills++; });
        for (let i = 0; i < 2400; i++) G.GameLoop.runHandlers(100);         // four minutes
        // Then up to 40 s more, until the second camp has a goblin standing (never, before the fix).
        let more = 0;
        for (; more < 400 && own(second) === 0; more++) G.GameLoop.runHandlers(100);
        off();
        G.EventBus.publish('heroes_updated');
        return {
            firstCampAt: [first.x, first.y], secondCampAt: [second.x, second.y], filled,
            hunterSentToSecond: G.BoardState.flagOf(hunter.id)?.pinnedTo === second.id, goblinsBeaten: kills, extraSeconds: more / 10,
            after4min: { first: own(first), second: own(second) },
            hunterWaiting: G.Flags.waitingOf(hunter.id) || null,
            hunterFighting: G.BoardState.claimOfHero(hunter.id)?.instanceId || null
        };
    })()`);
    await sleep(1500);
    {
        const [fx, fy] = log.t266.firstCampAt;
        const [sx, sy] = log.t266.secondCampAt;
        const x = Math.min(fx, sx) - 260, y = Math.min(fy, sy) - 260;
        const box = await screenBox(page, { x, y, w: Math.max(fx, sx) - x + 260, h: Math.max(fy, sy) - y + 260 });
        writeFileSync(file(`t266_${label}`), Buffer.from(await shot(page, box), 'base64'));
    }

    // T-248: the Starter Camp's goblins by the bottom edge; stop the moment one comes closest to it
    // (art over the edge before the fix, its art at the edge after).
    await newGame(page);
    log.t248 = await page.evaluate(`(async () => {
        const G = window.Game;
        const { matH, artRadiusOf } = await import('/src/config/matGeometry.js');
        const camp = G.BoardState.tokens().find(t => t.typeId === 'token_goblin_camp');
        const goblins = () => G.BoardState.tokens().filter(t => t.tether === camp.id);
        let deepest = -Infinity, ticks = 0;
        const want = ${label === 'before' ? 8 : 0};
        for (; ticks < 12000; ticks++) {
            G.GameLoop.runHandlers(100);
            for (const g of goblins()) deepest = Math.max(deepest, g.y + artRadiusOf(g.typeId) - matH());
            if (goblins().some(g => g.y + artRadiusOf(g.typeId) - matH() >= want)) break;
        }
        return {
            campAt: [camp.x, camp.y], matH: matH(), ticks,
            overEdgeBy: Math.max(...goblins().map(g => g.y + artRadiusOf(g.typeId) - matH())),
            deepestSeen: deepest
        };
    })()`);
    await sleep(1500);
    {
        const [cx, cy] = log.t248.campAt;
        const box = await screenBox(page, { x: cx - 300, y: cy - 260, w: 600, h: log.t248.matH - cy + 260 }, 40);
        writeFileSync(file(`t248_${label}`), Buffer.from(await shot(page, box), 'base64'));
    }

    if (label === 'after') {
        for (const t of ['t266', 't248']) {
            if (!existsSync(file(`${t}_before`))) continue;
            const tiles = ['before', 'after'].map(l => ({ label: `${t.toUpperCase()} ${l}`, data: readFileSync(file(`${t}_${l}`)).toString('base64') }));
            writeFileSync(file(`${t}_compare`), Buffer.from(await compose(page, tiles), 'base64'));
        }
    }
} finally {
    await chrome.close();
}
console.log(JSON.stringify(log, null, 2));
