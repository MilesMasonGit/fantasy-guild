// The mat marks look pick (brief 830, D3 part 1, T-667): one busy scene, the hover name label, the
// reach dots and the proposed progress bar in looks A (see-through dark backing), B (chroma shimmer),
// C (both), D (today, the before), F (A's backing with a rainbow sweeping across the letters) and P (today's label and dots with the proposed bar, plain).
// Needs the throwaway look code (`src/ui/components/board/mmLook.jsx` and `.css`, hooked into
// `TokenBadges.jsx`, `CampReachRing.jsx`, `WorkPlateLayer.jsx`; window.__setMm, not committed) and
// a dev server already running on it:
//   node capture_mat_marks.mjs <url>      e.g. http://localhost:5320
// A new game at 1920 x 1080 in a headless Chrome of its own (closed at the end): four heroes on four
// Tokens east of the Guild Hall (the furnace stuck), an orange tree at rest, and a Logging Camp
// hovered, its reach ring dotting the Tokens round it. Every Token's name is shown at once (forced,
// so the label can be judged on several grounds; in the game only the hovered one shows). The
// game loop is stopped and each bar held at a set fill, so every look shows the same frame.
// The stills hold the colour cycle at its half way point (teal).
// Writes <look>.png (the scene, 2x nearest-neighbour) and <look>_full.png (the whole screen) for
// each look; for B, C and F also <look>_frames.png (four moments of the loop side by side,
// a close crop) and <look>_anim.png (an animated PNG of the loop, one frame a step for F), the latter two
// assembled by `make_anim.py` beside this script (Python with Pillow).
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { launchChrome, sleep } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);

const url = process.argv[2] || 'http://localhost:5320';
// `--looks=F` (comma list) retakes only those looks.
const LOOKS = (process.argv.find(a => a.startsWith('--looks='))?.split('=')[1] ?? 'D,P,A,B,C,F').split(',');
const W = 1920;
const H = 1080;
// Each moving look's loop and how many frames it is shot in: B and C's colour cycle, F's sweep
// (28 steps of 2px, one frame a step).
const MOVING = { B: { cycle: 4, frames: 16 }, C: { cycle: 4, frames: 16 }, F: { cycle: 2.8, frames: 28 } };
const CYCLE_S = 4;

const capture = async (page, clip, scale = 1) => Buffer.from((await page.send('Page.captureScreenshot', {
    format: 'png', clip: { ...clip, scale }
})).data, 'base64');

/** A screenshot blown up 2x with no smoothing, so every art pixel reads. */
const zoom2 = (page, png) => page.evaluate(`(async () => {
    const i = new Image(); i.src = 'data:image/png;base64,${png.toString('base64')}'; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width * 2; c.height = i.height * 2;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(i, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`).then(b64 => Buffer.from(b64, 'base64'));

/** The screen box of a mat rectangle (mat units), clamped to the screen. */
const screenBox = (page, r) => page.evaluate(`(async () => {
    const { matW } = await import('/src/config/matGeometry.js');
    const b = document.querySelector('[data-mat-surface]').getBoundingClientRect();
    const s = b.width / matW();
    const x = Math.max(0, b.left + ${r.x} * s), y = Math.max(0, b.top + ${r.y} * s);
    const right = Math.min(${W}, b.left + (${r.x} + ${r.w}) * s), bottom = Math.min(${H}, b.top + (${r.y} + ${r.h}) * s);
    return { x: Math.round(x), y: Math.round(y), width: Math.round(right - x), height: Math.round(bottom - y) };
})()`);

const setLook = async (page, look) => {
    await page.evaluate(`(() => { window.__setMm({ look: '${look}', allNames: true }); return true; })()`);
    await sleep(900);
};

/** Every chroma animation held at `t` seconds into its cycle, all in step. */
const holdChroma = (page, t) => page.evaluate(`(() => {
    const a = document.getAnimations().filter(a => (a.animationName === 'mm-chroma-text' || a.animationName === 'mm-sweep'));
    for (const x of a) { x.pause(); x.currentTime = ${t * 1000}; }
    return a.length;
})()`);

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    const button = (scope, text) => page.evaluate(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.innerText.trim().toUpperCase() === '${text}'); if (!b) return false; b.click(); return true; })()`);
    if (!await button('', 'NEW GAME')) throw new Error('no New Game button');
    await sleep(1500);
    if (!await button('[data-new-game-footer]', 'BEGIN')) throw new Error('no Begin button');
    await page.waitFor(`window.Game.BoardState.tokens().length > 0 && !!document.querySelector('[data-mat-surface]')`, { timeoutMs: 60000 });
    await sleep(3000);
    await button('', 'CLOSE');

    const scene = await page.evaluate(`(async () => {
        const G = window.Game;
        G.GameLoop.stop();
        const qa = await import('/src/ui/dev/qaTools.js');
        const { isGuildHall } = await import('/src/systems/board/MatCap.js');
        const { tokenStartingUses } = await import('/src/config/registries/tokenRegistry.js');
        const { setSelectedRecipe } = await import('/src/systems/board/StationRecipe.js');
        const hall = G.BoardState.tokens().find(isGuildHall);
        const S = { x: hall.x + 360, y: hall.y - 40 };
        for (const t of G.BoardState.tokens()) if (!isGuildHall(t) && Math.hypot(t.x - S.x, t.y - S.y) < 520) G.BoardState.removeToken(t.id);
        G.EventBus.publish('game_reset', { reason: 'capture' });
        const put = (typeId, x, y) => {
            const inst = G.BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
            const res = G.BoardPlacement.placeTokenAt(inst, { x, y });
            if (!res?.success) throw new Error('could not place ' + typeId + ': ' + res?.reason);
            return G.BoardState.getTokenById(inst.id);
        };
        const L = put('token_lemon_tree', S.x - 100, S.y);
        const O = put('token_cherry_tree', S.x + 100, S.y);
        const P = put('token_peach_tree', S.x, S.y + 230);
        const F = put('token_furnace', S.x - 230, S.y - 250);
        const C = put('token_logging_camp', S.x - 250, S.y + 150);
        const R = put('token_orange_tree', S.x + 160, S.y - 200);
        setSelectedRecipe(F, 'recipe_copper_ingot');
        G.InventoryManager.addItem('item_copper_ore', 40);
        G.InventoryManager.addItem('item_coal', 1);
        G.EventBus.setQuiet(true);
        qa.spawnParty();
        G.EventBus.setQuiet(false);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const free = G.HeroManager.getAllHeroes().slice(-4);
        const pairs = [];
        for (const t of [L, O, F, P]) {
            for (const h of free) {
                const res = G.Orders.orderAt(h.id, { x: t.x, y: t.y + 40 });
                if (res.success && res.instanceId === t.id) { pairs.push([h.id, t.id]); free.splice(free.indexOf(h), 1); break; }
            }
        }
        for (let i = 0; i < 600; i++) G.GameLoop.runHandlers(100);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const pos = (t) => ({ id: t.id, typeId: t.typeId, x: Math.round(t.x), y: Math.round(t.y), alert: t.alert || null });
        return { hall: pos(hall), L: pos(L), O: pos(O), P: pos(P), F: pos(F), C: pos(C), R: pos(R), pairs };
    })()`);
    await sleep(1500);

    // Each worked Token's bar held at a set fill (the loop is stopped, so a running bar would fill up).
    const fills = { [scene.L.id]: 0.625, [scene.O.id]: 0.25, [scene.P.id]: 0.875, [scene.F.id]: 0.5 };
    const held = await page.evaluate(`(async () => {
        const { watchWorkBar } = await import('/src/ui/components/board/workBar.js');
        const out = {};
        for (const [id, f] of Object.entries(${JSON.stringify(fills)})) {
            const stop = watchWorkBar(id, (bar) => {
                if (!bar) return;
                const c = bar.read(performance.now())?.cycleMs || 3000;
                bar.progress({ elapsedMs: f * c, cycleTimeMs: c }, false);
                out[id] = c;
            });
            stop();
        }
        return out;
    })()`);

    // The pointer resting on the Logging Camp: its name, its reach ring and the dots.
    const camp = await page.evaluate(`(() => { const r = document.querySelector('[data-token-art="true"][data-token-id="${scene.C.id}"]').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    await page.mouse('mouseMoved', camp.x - 2, camp.y);
    await sleep(100);
    await page.mouse('mouseMoved', camp.x, camp.y);
    await sleep(1500);

    const { F, P, O, C } = scene;
    const x0 = Math.min(F.x, C.x) - 200;
    const y0 = F.y - 150;
    const box = await screenBox(page, { x: x0, y: y0, w: O.x + 260 - x0, h: P.y + 170 - y0 });
    // The close crop for the colour cycle: the camp, the lemon tree and its bar.
    const close = await screenBox(page, { x: C.x - 170, y: scene.L.y - 110, w: scene.L.x + 190 - (C.x - 170), h: C.y + 90 - (scene.L.y - 110) });

    const report = { scene, held, camp, box, close, looks: {} };
    for (const look of LOOKS) {
        await setLook(page, look);
        // The stills held half way round the cycle (teal): its start is red, the game's can't-do colour.
        const n = await holdChroma(page, CYCLE_S / 2);
        report.looks[look] = {
            chromaAnimations: n,
            names: await page.evaluate(`document.querySelectorAll('[data-token-name]').length`),
            dots: await page.evaluate(`document.querySelectorAll('[data-reach-dot]').length`),
            bars: await page.evaluate(`[...document.querySelectorAll('[data-mm-bar]')].map(b => [b.getAttribute('data-mm-bar'), b.innerText, b.getAttribute('data-mm-blocked')])`),
            plates: await page.evaluate(`document.querySelectorAll('[data-work-plate]').length`)
        };
        writeFileSync(path.join(here, `${look}_full.png`), await capture(page, { x: 0, y: 0, width: W, height: H }));
        writeFileSync(path.join(here, `${look}.png`), await zoom2(page, await capture(page, box)));
        if (MOVING[look]) {
            const { cycle, frames: FRAMES } = MOVING[look];
            const dir = path.join(here, `_frames_${look}`);
            mkdirSync(dir, { recursive: true });
            for (let i = 0; i < FRAMES; i++) {
                await holdChroma(page, (i * cycle) / FRAMES);
                await sleep(120);
                writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), await zoom2(page, await capture(page, close)));
            }
            execFileSync('python', [path.join(here, 'make_anim.py'), dir, path.join(here, `${look}_anim.png`), path.join(here, `${look}_frames.png`),
                String((cycle * 1000) / FRAMES)], { stdio: 'inherit' });
            rmSync(dir, { recursive: true, force: true });
        }
    }
    console.log(JSON.stringify(report, null, 1));
} finally {
    await chrome.close();
}
