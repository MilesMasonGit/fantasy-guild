// The task ring follow-ups in the running game (owner, 22 Nov): a stuck job's amber ring, crossing
// rings drawn as one outer edge, rings centred on the Token and its hero, and a Token at rest half
// inside a ring dimmed on that half. Against a dev server already running:
//   node capture_amber.mjs <url> [prefix]      e.g. http://localhost:5307, or before_ for the R4 code
// A new game at 1920 x 1080 in a headless Chrome of its own (closed at the end); the mat cleared but
// for the Guild Hall; four QA heroes. Writes <prefix>amber_stuck.png (the whole screen) and
// <prefix>outer_edge.png, <prefix>inside_dim.png (the scene, 2x nearest-neighbour) here.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { launchChrome, sleep } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);

const url = process.argv[2] || 'http://localhost:5307';
const prefix = process.argv[3] || '';
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
        for (const t of G.BoardState.tokens()) if (!isGuildHall(t) && Math.hypot(t.x - S.x, t.y - S.y) < 460) G.BoardState.removeToken(t.id);
        G.EventBus.publish('game_reset', { reason: 'capture' });
        const put = (typeId, x, y) => {
            const inst = G.BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
            const res = G.BoardPlacement.placeTokenAt(inst, { x, y });
            if (!res?.success) throw new Error('could not place ' + typeId + ': ' + res?.reason);
            return G.BoardState.getTokenById(inst.id);
        };
        const L = put('token_lemon_tree', S.x - 100, S.y);
        const O = put('token_orange_tree', S.x + 100, S.y);
        const F = put('token_furnace', S.x - 230, S.y - 250);
        // At rest, just above the orange tree, where its ring reaches farthest past the body (the
        // ring's centre sits between the tree and its hero): its lower part inside, the rest out.
        const at = [128, 132, 136, 140, 148].map(d => ({ x: O.x - 32, y: O.y - d }));
        let R = null;
        for (const p of at) {
            const inst = G.BoardState.createTokenInstance('token_cherry_tree', tokenStartingUses('token_cherry_tree'));
            if (G.BoardPlacement.placeTokenAt(inst, p)?.success) { R = G.BoardState.getTokenById(inst.id); break; }
        }
        if (!R) throw new Error('no room for the cherry tree above the orange tree');
        setSelectedRecipe(F, 'recipe_copper_ingot');
        G.InventoryManager.addItem('item_copper_ore', 40);
        G.InventoryManager.addItem('item_coal', 1);
        // Quietly: the party's levels would fill the screen with level-up floats and banners.
        G.EventBus.setQuiet(true);
        qa.spawnParty();
        G.EventBus.setQuiet(false);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const party = G.HeroManager.getAllHeroes().slice(-4);
        G.Orders.orderAt(party[0].id, { x: L.x, y: L.y });
        G.Orders.orderAt(party[1].id, { x: O.x, y: O.y });
        G.Orders.orderAt(party[2].id, { x: F.x, y: F.y });
        // Walk up, work, and the furnace eats its one Coal and stands stuck.
        for (let i = 0; i < 600; i++) G.GameLoop.runHandlers(100);
        G.EventBus.publish('heroes_updated', { source: 'capture' });
        const status = party.slice(0, 3).map(h => [h.name, G.Flags.statusOf(h.id).state]);
        const pos = (t) => ({ id: t.id, typeId: t.typeId, x: Math.round(t.x), y: Math.round(t.y), alert: t.alert || null });
        return { hall: pos(hall), L: pos(L), O: pos(O), F: pos(F), R: pos(R), status };
    })()`);
    await sleep(1500);
    // The pointer off the mat, so no hover shows.
    await page.mouse('mouseMoved', Math.round(W / 2), 5);
    await sleep(800);

    const rings = await page.evaluate(`[...document.querySelectorAll('[data-task-ring]')].map(e => ({ id: e.getAttribute('data-task-ring'), px: Number(e.getAttribute('data-px')), stuck: e.getAttribute('data-stuck') === 'true', fill: e.getAttribute('fill') }))`);
    const dimZ = await page.evaluate(`document.querySelector('[data-task-dim="grey"]')?.style.zIndex ?? null`);
    console.log(JSON.stringify({ scene, rings, dimZ }, null, 1));

    writeFileSync(path.join(here, `${prefix}amber_stuck.png`), await capture(page, { x: 0, y: 0, width: W, height: H }));
    const { L, O, F, R } = scene;
    const x0 = F.x - 200;
    const y0 = F.y - 150;
    const box = await screenBox(page, { x: x0, y: y0, w: O.x + 170 - x0, h: L.y + 150 - y0 });
    writeFileSync(path.join(here, `${prefix}outer_edge.png`), await zoom2(page, await capture(page, box)));
    const near = await screenBox(page, { x: R.x - 150, y: R.y - 90, w: 300, h: O.y + 100 - (R.y - 90) });
    writeFileSync(path.join(here, `${prefix}inside_dim.png`), await zoom2(page, await capture(page, near)));
    console.log('written', [`${prefix}amber_stuck.png`, `${prefix}outer_edge.png`, `${prefix}inside_dim.png`].join(', '));
} finally {
    await chrome.close();
}
