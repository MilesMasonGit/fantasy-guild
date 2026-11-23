// The job area look pick (brief 830, D4, T-668): one busy scene, the dimmed area of each job in four
// looks with no ring line. Needs the throwaway look code in `TaskRings.jsx` (window.__jobArea, not
// committed) and a dev server already running on it:
//   node capture_job_areas.mjs <url>      e.g. http://localhost:5316
// A new game at 1920 x 1080 in a headless Chrome of its own (closed at the end); four jobs side by
// side east of the Guild Hall, the furnace stuck, an orange tree at rest half inside the cherry tree's
// area. Each sprite's visual centre is measured from the screen: the box of the pixels that change
// when that sprite alone is hidden. Writes A.png .. D.png (the scene, 2x nearest-neighbour),
// A_full.png .. D_full.png (the whole screen), today_ring.png and today_ring_full.png (the game as it
// is, ring line and all) and centres.json (the measured centres, not kept) here.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { launchChrome, sleep } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);

const url = process.argv[2] || 'http://localhost:5316';
const W = 1920;
const H = 1080;

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

const setLook = async (page, look, jobs = null) => {
    await page.evaluate(`(() => { window.__jobArea = { look: ${JSON.stringify(look)}, jobs: ${JSON.stringify(jobs)} }; window.dispatchEvent(new Event('jobarea')); return true; })()`);
    await sleep(1200);
};

/**
 * A sprite's visual centre on screen: shot with it shown and hidden, the box of the pixels that
 * differ. `sel` is the element to hide.
 */
const visualCentre = async (page, sel) => {
    const rect = await page.evaluate(`(() => { const e = document.querySelector('${sel}'); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    const padX = rect.w * 0.75;
    const padY = rect.h * 0.25;
    const clip = {
        x: Math.max(0, Math.round(rect.x - padX)), y: Math.max(0, Math.round(rect.y - padY)),
        width: Math.round(rect.w + 2 * padX), height: Math.round(rect.h + 2 * padY)
    };
    const shown = await capture(page, clip);
    const again = await capture(page, clip);
    if (!shown.equals(again)) console.warn('the screen moved by itself under ' + sel);
    await page.evaluate(`(() => { document.querySelector('${sel}').style.visibility = 'hidden'; return true; })()`);
    await sleep(300);
    const hidden = await capture(page, clip);
    await page.evaluate(`(() => { document.querySelector('${sel}').style.visibility = ''; return true; })()`);
    await sleep(300);
    const box = await page.evaluate(`(async () => {
        const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
        const a = await load('${shown.toString('base64')}');
        const b = await load('${hidden.toString('base64')}');
        let l = Infinity, t = Infinity, r = -Infinity, bo = -Infinity;
        for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
            const k = (y * a.width + x) * 4;
            if (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]) > 12) {
                l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); bo = Math.max(bo, y);
            }
        }
        return { l, t, r, b: bo };
    })()`);
    if (!Number.isFinite(box.l)) throw new Error('no pixels changed hiding ' + sel);
    return { x: clip.x + (box.l + box.r + 1) / 2, y: clip.y + (box.t + box.b + 1) / 2, box: { ...box, x0: clip.x, y0: clip.y } };
};

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
        // The scene, in the open grass east of the Hall: heroes come from the Hall, so each stands
        // on its Token's west side. Anything of the starter camp in the way is taken off.
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
        // At rest, just above the worked cherry tree: its lower part inside the cherry tree's area, the rest out.
        const at = [128, 132, 136, 140, 148].map(d => ({ x: O.x - 32, y: O.y - d }));
        let R = null;
        for (const p of at) {
            const inst = G.BoardState.createTokenInstance('token_orange_tree', tokenStartingUses('token_orange_tree'));
            if (G.BoardPlacement.placeTokenAt(inst, p)?.success) { R = G.BoardState.getTokenById(inst.id); break; }
        }
        if (!R) throw new Error('no room for the orange tree above the cherry tree');
        setSelectedRecipe(F, 'recipe_copper_ingot');
        G.InventoryManager.addItem('item_copper_ore', 40);
        G.InventoryManager.addItem('item_coal', 1);
        // Quietly: the party's levels would fill the screen with level-up floats and banners.
        G.EventBus.setQuiet(true);
        qa.spawnParty();
        G.EventBus.setQuiet(false);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const free = G.HeroManager.getAllHeroes().slice(-4);
        // Each Token takes the first free hero whose order it accepts (not every hero may work every Token).
        const pairs = [];
        const orders = [];
        for (const t of [L, O, F, P]) {
            for (const h of free) {
                const res = G.Orders.orderAt(h.id, { x: t.x, y: t.y + 40 });
                orders.push([h.name, t.typeId, res.success, res.reason || null, res.instanceId || null]);
                if (res.success && res.instanceId === t.id) { pairs.push([h.id, t.id]); free.splice(free.indexOf(h), 1); break; }
            }
        }
        const party = pairs.map(([id]) => G.HeroManager.getHero ? G.HeroManager.getHero(id) : G.HeroManager.getAllHeroes().find(h => h.id === id));
        // Walk up, work, and the furnace eats its one Coal and stands stuck.
        for (let i = 0; i < 600; i++) G.GameLoop.runHandlers(100);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const status = party.map(h => [h.id, h.name, G.Flags.statusOf(h.id).state]);
        const pos = (t) => ({ id: t.id, typeId: t.typeId, x: Math.round(t.x), y: Math.round(t.y), alert: t.alert || null });
        return { hall: pos(hall), L: pos(L), O: pos(O), P: pos(P), F: pos(F), R: pos(R), status, orders, pairs };
    })()`);
    await sleep(1500);
    // The pointer off the mat, so no hover shows.
    await page.mouse('mouseMoved', Math.round(W / 2), 5);
    await sleep(800);

    // Today's game, ring line and all.
    await setLook(page, 'live');
    writeFileSync(path.join(here, 'today_ring_full.png'), await capture(page, { x: 0, y: 0, width: W, height: H }));
    const live = await page.evaluate(`[...document.querySelectorAll('[data-task-ring]')].map(e => ({ id: e.getAttribute('data-task-ring'), px: Number(e.getAttribute('data-px')), stuck: e.getAttribute('data-stuck') === 'true' }))`);
    const artScale = await page.evaluate(`Number(/scale\\(([0-9.]+)\\)/.exec(document.querySelector('[data-task-ring]').getAttribute('transform'))[1])`);

    // Visual centres, with no area drawn and every animation held still.
    await setLook(page, 'off');
    await page.evaluate(`(async () => {
        (await import('/src/ui/components/board/frameClock.js')).setDrawingPaused(true);
        for (const a of document.getAnimations()) a.pause();
        return true;
    })()`);
    await sleep(500);
    const toMat = await page.evaluate(`(async () => {
        const { matW } = await import('/src/config/matGeometry.js');
        const b = document.querySelector('[data-mat-surface]').getBoundingClientRect();
        return { left: b.left, top: b.top, s: b.width / matW() };
    })()`);
    const mat = (p) => ({ x: (p.x - toMat.left) / toMat.s, y: (p.y - toMat.top) / toMat.s });
    const consts = await page.evaluate(`(async () => {
        const g = await import('/src/config/matGeometry.js');
        const c = await import('/src/ui/components/board/boardConstants.js');
        return { HIT: c.HERO_HIT_PX, BOX: c.HERO_BOX_PX, body: Object.fromEntries(${JSON.stringify(['L', 'O', 'P', 'F'].map(k => scene[k].typeId))}.map(t => [t, g.artRadiusOf(t)])) };
    })()`);
    const tokens = Object.fromEntries(['L', 'O', 'P', 'F'].map(k => [scene[k].id, scene[k]]));
    const jobs = {};
    const centres = {};
    for (const [heroId, tokenId] of scene.pairs) {
        const t = tokens[tokenId];
        const tv = mat(await visualCentre(page, `[data-token-art="true"][data-token-id="${tokenId}"]`));
        const hv = mat(await visualCentre(page, `[data-board-hero="${heroId}"]`));
        // Where the hero stands (mat units), from its box: left = x - HIT/2, top = y - BOX/2.
        const hp = await page.evaluate(`(() => { const m = /translate\\(([-0-9.]+)px, ([-0-9.]+)px\\)/.exec(document.querySelector('[data-board-hero="${heroId}"]').style.transform); return { x: Number(m[1]) + ${consts.HIT / 2}, y: Number(m[2]) + ${consts.BOX / 2} }; })()`);
        // The area's centre: the middle of the sprites' visual centres (one hero each here).
        const x = (tv.x + hv.x) / 2;
        const y = (tv.y + hv.y) / 2;
        // Its radius as today's: reaching the farthest corner of the Token's and the hero's boxes, plus 2 art px.
        const body = consts.body[t.typeId];
        const boxes = [[t.x - body, t.y - body, t.x + body, t.y + body],
            [hp.x - consts.HIT / 2, hp.y - consts.BOX / 2, hp.x + consts.HIT / 2, hp.y + consts.BOX / 2]];
        let far = 0;
        for (const [l, tp, r, b] of boxes) far = Math.max(far, Math.hypot(Math.max(x - l, r - x), Math.max(y - tp, b - y)));
        jobs[tokenId] = { x, y, r: far + 2 * artScale };
        centres[tokenId] = { token: t.typeId, tokenPoint: { x: t.x, y: t.y }, tokenVisual: tv, heroPoint: hp, heroVisual: hv, area: jobs[tokenId] };
    }
    await page.evaluate(`(async () => {
        (await import('/src/ui/components/board/frameClock.js')).setDrawingPaused(false);
        for (const a of document.getAnimations()) a.play();
        return true;
    })()`);
    writeFileSync(path.join(here, 'centres.json'), JSON.stringify({ artScale, live, centres }, null, 1) + '\n');

    const { O, P, F } = scene;
    const x0 = F.x - 200;
    const y0 = F.y - 150;
    const box = await screenBox(page, { x: x0, y: y0, w: O.x + 220 - x0, h: P.y + 160 - y0 });
    await setLook(page, 'live');
    writeFileSync(path.join(here, 'today_ring.png'), await zoom2(page, await capture(page, box)));
    for (const look of ['A', 'B', 'C', 'D']) {
        await setLook(page, look, jobs);
        writeFileSync(path.join(here, `${look}_full.png`), await capture(page, { x: 0, y: 0, width: W, height: H }));
        writeFileSync(path.join(here, `${look}.png`), await zoom2(page, await capture(page, box)));
    }
    console.log(JSON.stringify({ scene, live, artScale, jobs }, null, 1));
} finally {
    await chrome.close();
}
