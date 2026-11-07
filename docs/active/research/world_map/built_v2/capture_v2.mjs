// The wide Shop and the world map under the whole screen, in the running game, for the eye-check
// and the builder's report: node capture_v2.mjs (from the checkout's root or anywhere).
// Starts its own dev server (a free port, its own Vite cache) and a headless Chrome, both closed at
// the end. On the bench's S2 board (`?stress=realistic`), a world made in the page if it has none.
// Half-size PNGs: the Shop into ../../shop_detail/built_v2, the map into this folder.
//   shop  at 1920 x 1080 and 1366 x 768, nav left and right: open; then a row too long for the screen
//   map   at both sizes and sides: open, at rest; at 1366 nav left also mid-glide down and back up
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const { launchChrome, sleep } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);
const { startDevServer } = await import(pathToFileURL(path.join(root, 'bench/browser/servers.mjs')).href);
const SHOP_OUT = path.join(root, 'docs/active/research/shop_detail/built_v2');
const MAP_OUT = here;
mkdirSync(SHOP_OUT, { recursive: true });

const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };

async function shot(page, dir, name, W, H) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } });
    writeFileSync(path.join(dir, `${name}.png`), Buffer.from(data, 'base64'));
}
const js = (page, expr) => page.evaluate(expr);
const rectOf = (page, sel) => js(page, `(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null; })()`);
const attr = (page, sel, name) => js(page, `document.querySelector(${JSON.stringify(sel)})?.getAttribute(${JSON.stringify(name)}) ?? null`);
/** What the pointer would land on at (x, y), as the nearest marked box. */
const hitAt = (page, x, y) => js(page, `(() => { const e = document.elementFromPoint(${x}, ${y}); if (!e) return 'none'; if (e.closest('nav[data-bubble-menu-side]')) return 'nav'; if (e.closest('[data-world-panel]')) return 'panel'; if (e.closest('[data-bottom-hero-dock]') || e.closest('[data-dock-slot]')) return 'dock'; if (e.closest('[data-world-map]')) return 'map'; return e.tagName + '.' + (e.className?.baseVal ?? e.className ?? ''); })()`);

async function boot(page, url, W, H, right) {
    await page.setViewport(W, H);
    await page.navigate(`${url}/?stress=realistic`);
    await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`, { timeoutMs: 180000 });
    await sleep(2000);
    await js(page, `window.__perf.hideHud?.(); true`);
    await js(page, `import('/src/systems/core/SettingsManager.js').then(m => { m.SettingsManager.set('ui.bubbleMenuRight', ${right}); return true; })`);
    await sleep(3000);
    await page.mouse('mouseMoved', Math.round(W / 2), 5);
}

async function clickBubble(page, id) {
    const b = await rectOf(page, `#${id} button`);
    await page.click(b.x, b.y);
}

const server = await startDevServer();
log(`dev server ${server.url}`);
const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    for (const [W, H] of [[1920, 1080], [1366, 768]]) {
        for (const right of [false, true]) {
            const side = right ? 'right' : 'left';
            await boot(page, server.url, W, H, right);
            const nav = await rectOf(page, 'nav[data-bubble-menu-side]');

            // ---------------------------------------------------------------- the Shop
            await clickBubble(page, 'shop-bubble-target');
            await page.waitFor(`document.querySelector('[data-shop-drawer]')?.getAttribute('data-shop-drawer-state') === 'open'`, { timeoutMs: 5000 });
            await sleep(600);
            await page.mouse('mouseMoved', Math.round(W / 2), 5);
            await sleep(300);
            await shot(page, SHOP_OUT, `${W}_${side}_open`, W, H);
            const panel = await rectOf(page, '[data-shop-drawer]');
            const cards = await js(page, `[...document.querySelectorAll('[data-shop-row]')].map(e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; })`);
            const arrows = await js(page, `document.querySelectorAll('[data-shop-drawer] [data-scroll-arrow]').length`);
            log(`${W} ${side}: shop ${JSON.stringify(panel)} nav ${JSON.stringify(nav)} cards ${JSON.stringify(cards)} arrows ${arrows}`);
            check(`${W} ${side}: the Shop spans the screen, edge to edge at the foot`, panel.left === 0 && panel.right === W && panel.bottom === H, JSON.stringify(panel));
            check(`${W} ${side}: the cards keep their size`, new Set(cards.map(c => c.w)).size === 1, cards[0]?.w);
            check(`${W} ${side}: no card is under the nav`, cards.every(c => c.l >= nav.right || c.r <= nav.left));
            const gap = right ? nav.left - cards.at(-1).r : cards[0].l - nav.right;
            // The rows pad for the nav as the Bank drawer does (152 px from md), so a narrower nav on a short screen leaves more.
            check(`${W} ${side}: the cards sit from the nav's side`, gap >= 0 && gap <= 152 + 12 + 8 - nav.w, `gap ${gap}`);
            check(`${W} ${side}: no arrows while the row fits`, arrows === 0, arrows);

            // A row too long for the screen: test Tokens registered in this page only.
            await js(page, `import('/src/config/registries/tokenRegistry.js').then(m => {
                const extra = {};
                for (let i = 1; i <= 8; i++) extra['qa_shop_extra_' + i] = { id: 'qa_shop_extra_' + i, name: 'Extra ' + i, size: 1, sprite: 't_foundation_wood', shop: { price: [{ itemId: 'item_oak_wood', quantity: i }], skills: ['mining'], order: 10 + i } };
                m.registerTokenTypes(extra);
                return true;
            })`);
            await js(page, `window.Game.InventoryManager.addItem('item_oak_wood', 1); true`);
            await sleep(900);
            const arrowsLong = await js(page, `[...document.querySelectorAll('[data-shop-drawer] [data-scroll-arrow]')].map(b => b.getAttribute('data-scroll-arrow') + (b.disabled ? ':dim' : ''))`);
            check(`${W} ${side}: a long row gets its arrows`, arrowsLong.join(',') === 'left:dim,right', arrowsLong.join(','));
            const list = await rectOf(page, '[data-shop-drawer] [data-scroll-list]');
            const first = await rectOf(page, '[data-shop-row]');
            check(`${W} ${side}: a long row starts at its first card, reachable`, first.left >= list.left && first.left - list.left <= 8, `list ${list.left}, first ${first.left}`);
            await page.mouse('mouseMoved', Math.round(W / 2), 5);
            await sleep(200);
            await shot(page, SHOP_OUT, `${W}_${side}_long_row`, W, H);
            await page.key('Escape', 'Escape', 27);
            await sleep(700);

            // ---------------------------------------------------------------- the world map
            await js(page, `import('/src/systems/world/World.js').then(m => { if (!m.currentWorld()) m.createWorld({ seed: 77 }); return !!m.currentWorld(); })`);
            await sleep(300);
            const glide = W === 1366 && !right;
            await clickBubble(page, 'atlas-bubble-target');
            if (glide) {
                await page.waitFor(`document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') === 'to-world' && document.getAnimations().some(a => a.playState === 'running')`, { timeoutMs: 5000 });
                await sleep(260);
                const moving = await js(page, `document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.matches?.('[data-world-camera], [data-world-table]')).map(a => a.effect.target.hasAttribute('data-world-table') ? 'layer' : 'camera')`);
                check(`${W} ${side}: the pan down moves the camera and the screen layer together`, moving.sort().join(',') === 'camera,layer', moving.join(','));
                await shot(page, MAP_OUT, `${W}_${side}_glide_down`, W, H);
            }
            await page.waitFor(`document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') === 'world'`, { timeoutMs: 8000 });
            await sleep(1500);
            // The pointer parked on the panel's foot, so no place's tip covers the map.
            const park = await rectOf(page, '[data-world-panel]');
            await page.mouse('mouseMoved', park.x, park.bottom - 6);
            await sleep(400);
            await shot(page, MAP_OUT, `${W}_${side}_map`, W, H);
            const map = await rectOf(page, '[data-world-map]');
            const room = await rectOf(page, '[data-world-camera-room]');
            const wpanel = await rectOf(page, '[data-world-panel]');
            const dock = await rectOf(page, '[data-bottom-hero-dock]');
            log(`${W} ${side}: map ${JSON.stringify(map)} room ${JSON.stringify(room)} panel ${JSON.stringify(wpanel)} dock ${JSON.stringify(dock)}`);
            check(`${W} ${side}: the map covers the whole screen`, map.left === 0 && map.top === 0 && map.right === W && map.bottom === H, JSON.stringify(map));
            check(`${W} ${side}: the map is laid in the screen box, not the column`, await js(page, `!!document.querySelector('[data-world-map]').closest('[data-world-backdrop]') && !document.querySelector('[data-world-camera-room] [data-world-map]')`));
            check(`${W} ${side}: the panel stays in the room over its right edge`, wpanel.right === room.right - 16 && wpanel.top === room.top + 16 && wpanel.bottom <= room.bottom, JSON.stringify(wpanel));
            // What a press lands on: the nav and the hero bar are on top of the map.
            const navHit = await hitAt(page, nav.x, nav.top + 40);
            check(`${W} ${side}: the nav is over the map`, navHit === 'nav', navHit);
            const navShowsMap = await js(page, `(() => { const n = document.querySelector('nav[data-bubble-menu-side]').getBoundingClientRect(); const m = document.querySelector('[data-world-map]').getBoundingClientRect(); return m.left <= n.left && m.right >= n.right; })()`);
            check(`${W} ${side}: the map runs on under the nav to the screen's edge`, navShowsMap);
            const dockHit = await hitAt(page, Math.round(W / 2), H - 20);
            log(`${W} ${side}: under the hero bar the pointer lands on: ${dockHit}`);
            check(`${W} ${side}: the map runs on under the hero bar`, map.bottom === H && room.bottom < H, `room bottom ${room.bottom}`);
            const panelHit = await hitAt(page, wpanel.x, wpanel.top + 30);
            check(`${W} ${side}: the panel is over the map`, panelHit === 'panel', panelHit);

            // Draggable on the clear part; a click on the nav or the panel never reaches the map.
            const before = await attr(page, '[data-world-map]', 'data-world-view');
            const sx = right ? room.left + 120 : room.left + 120, sy = room.top + 200;
            await page.mouse('mouseMoved', sx, sy);
            await page.mouse('mousePressed', sx, sy, { button: 'left', buttons: 1, clickCount: 1 });
            for (let i = 1; i <= 6; i++) { await page.mouse('mouseMoved', sx + i * 15, sy + i * 8, { button: 'left', buttons: 1 }); await sleep(30); }
            await page.mouse('mouseReleased', sx + 90, sy + 48, { button: 'left', buttons: 0, clickCount: 1 });
            await sleep(300);
            const after = await attr(page, '[data-world-map]', 'data-world-view');
            check(`${W} ${side}: the map drags`, after !== before, `${before} -> ${after}`);
            const detail = await attr(page, '[data-world-detail]', 'data-world-detail');
            await page.mouse('mousePressed', wpanel.x, wpanel.bottom - 10, { button: 'left', buttons: 1, clickCount: 1 });
            await page.mouse('mouseMoved', wpanel.x - 80, wpanel.bottom - 10, { button: 'left', buttons: 1 });
            await page.mouse('mouseReleased', wpanel.x - 80, wpanel.bottom - 10, { button: 'left', buttons: 0, clickCount: 1 });
            await sleep(200);
            check(`${W} ${side}: a drag on the panel does not move the map`, (await attr(page, '[data-world-map]', 'data-world-view')) === after);
            check(`${W} ${side}: the chosen place is unchanged by presses on the panel`, (await attr(page, '[data-world-detail]', 'data-world-detail')) === detail);

            if (glide) {
                // Back up to the mat, mid-glide.
                await page.key('Escape', 'Escape', 27);
                await page.waitFor(`document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') === 'to-mat' && document.getAnimations().some(a => a.playState === 'running')`, { timeoutMs: 5000 });
                await sleep(260);
                await shot(page, MAP_OUT, `${W}_${side}_glide_up`, W, H);
                await page.waitFor(`document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') === 'mat'`, { timeoutMs: 8000 });
                check(`${W} ${side}: back on the mat, nothing of the map is left in the screen box`, await js(page, `!document.querySelector('[data-world-backdrop]') && !!document.querySelector('[data-board-origin]')`));

                // Map to Hall: the map is set down at once, only the Hall glides.
                await clickBubble(page, 'atlas-bubble-target');
                await page.waitFor(`document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') === 'world'`, { timeoutMs: 8000 });
                await sleep(800);
                await clickBubble(page, 'guild-bubble-target');
                await sleep(150);
                const toHall = await js(page, `({ hall: document.querySelector('[data-hall-camera]')?.getAttribute('data-hall-camera'), world: document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') ?? null, backdrop: !!document.querySelector('[data-world-backdrop]'), worldAnims: document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.matches?.('[data-world-camera], [data-world-table]')).length })`);
                check(`map to Hall: the map is set down at once and does not glide`, toHall.world === 'mat' && !toHall.backdrop && toHall.worldAnims === 0, JSON.stringify(toHall));
                await page.waitFor(`document.querySelector('[data-hall-camera]')?.getAttribute('data-hall-camera') === 'sky'`, { timeoutMs: 8000 });
                await sleep(500);
                // Hall to map: the Hall is set down at once, the map opens straight on.
                await clickBubble(page, 'atlas-bubble-target');
                await sleep(150);
                const toMap = await js(page, `({ hall: document.querySelector('[data-hall-camera]')?.getAttribute('data-hall-camera'), world: document.querySelector('[data-world-camera]')?.getAttribute('data-world-camera') ?? null, hallAnims: document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.matches?.('[data-hall-camera], [data-hall-table]')).length })`);
                check(`Hall to map: the Hall is set down at once, and the two never glide together`, toMap.hall === 'mat' && toMap.hallAnims === 0, JSON.stringify(toMap));
                await sleep(1200);
                check(`Hall to map: the map is open, under the whole screen`, (await attr(page, '[data-world-camera]', 'data-world-camera')) === 'world' && !!(await rectOf(page, '[data-world-backdrop] [data-world-map]')));
            }
            await page.key('Escape', 'Escape', 27);
            await sleep(900);
        }
    }
    log(`console errors: ${JSON.stringify(page.consoleErrors ?? [])}`);
} finally {
    const fails = results.filter(r => !r.ok);
    log(`\n${results.length - fails.length}/${results.length} checks passed`);
    for (const f of fails) log(`  FAIL ${f.name} ${f.detail}`);
    const c = await chrome.close();
    log(`chrome closed: ${JSON.stringify(c)}`);
    await server.close();
    log('dev server closed');
}
