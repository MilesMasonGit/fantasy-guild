// The pop-up Shop (brief 410 S2) in the running game, for the eye-check and the builder's report:
// node capture_shop.mjs <url> <outDir>
// Any dev server, on the bench's S2 board (`?stress=realistic`). Half-size PNGs.
//   open     at 1920 x 1080 and 1366 x 768, nav on the left and on the right: the Shop open
//   use      at both sizes, nav on the left: hover a skill icon and a card, the lip mid-drag, two
//            purchases in a row, a cancel on the panel, a row too long for the screen scrolled by
//            its arrow, a group's dropdown, a card that can't be afforded, a full Token cap
// Extra cards and the group are test Tokens registered in the page only (nothing is saved).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5291', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };

async function shot(page, name, W, H) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } });
    writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
}
const js = (page, expr) => page.evaluate(expr);
const rectOf = (page, sel) => js(page, `(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null; })()`);
const shopState = (page) => js(page, `document.querySelector('[data-shop-drawer]')?.getAttribute('data-shop-drawer-state')`);
const countOf = (page, typeId) => js(page, `window.Game.BoardState.tokens().filter(t => t.typeId === ${JSON.stringify(typeId)}).length`);
const wood = (page) => js(page, `window.Game.InventoryManager.getItemCount('item_oak_wood')`);

async function boot(page, W, H, right) {
    await page.setViewport(W, H);
    await page.navigate(`${url}/?stress=realistic`);
    await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`);
    await sleep(2000);
    await js(page, `window.__perf.hideHud?.(); true`);
    await js(page, `import('/src/systems/core/SettingsManager.js').then(m => { m.SettingsManager.set('ui.bubbleMenuRight', ${right}); return true; })`);
    await sleep(4000);
    await page.mouse('mouseMoved', Math.round(W / 2), 5);
}

async function openShop(page) {
    const b = await rectOf(page, '#shop-bubble-target button');
    await page.click(b.x, b.y);
    await page.waitFor(`document.querySelector('[data-shop-drawer]')?.getAttribute('data-shop-drawer-state') === 'open'`, { timeoutMs: 5000 });
    await sleep(600);
}

/** A real mouse drag from a card through `points`; `atPoint(i)` runs as each is reached, `mid` before the release. */
async function drag(page, from, points, mid, atPoint) {
    await page.mouse('mouseMoved', from.x, from.y);
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(40);
    await page.mouse('mouseMoved', from.x + 12, from.y - 12, { button: 'left', buttons: 1 });
    await sleep(60);
    let last = from;
    for (const p of points) {
        for (let i = 1; i <= 6; i++) {
            const x = Math.round(last.x + (p.x - last.x) * i / 6), y = Math.round(last.y + (p.y - last.y) * i / 6);
            await page.mouse('mouseMoved', x, y, { button: 'left', buttons: 1 });
            await sleep(30);
        }
        last = p;
        await sleep(350);
        if (atPoint) await atPoint(points.indexOf(p));
    }
    if (mid) await mid();
    await page.mouse('mouseReleased', last.x, last.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(700);
}

const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    for (const [W, H] of [[1920, 1080], [1366, 768]]) {
        for (const right of [false, true]) {
            const side = right ? 'right' : 'left';
            await boot(page, W, H, right);
            await openShop(page);
            await page.mouse('mouseMoved', Math.round(W / 2), 5);
            await sleep(300);
            await shot(page, `${W}_${side}_open`, W, H);
            const panel = await rectOf(page, '[data-shop-drawer]');
            const nav = await rectOf(page, 'nav[data-bubble-menu-side]');
            const cards = await js(page, `[...document.querySelectorAll('[data-shop-row]')].map(e => e.getAttribute('data-shop-row'))`);
            const arrows = await js(page, `document.querySelectorAll('[data-scroll-arrow]').length`);
            log(`${W}x${H} ${side}: panel ${JSON.stringify(panel)} nav ${JSON.stringify(nav)} cards ${cards.join(',')} arrows ${arrows}`);
            check(`${W} ${side}: the panel sits on the screen's foot`, panel.bottom === H, `bottom ${panel.bottom}`);
            check(`${W} ${side}: the panel stands beside the nav, not under it`, right ? panel.right <= W && nav.left >= W - nav.w - 1 : panel.left === 0 && nav.left === 0);
            check(`${W} ${side}: five Foundation cards in order`, cards.join(',') === 'token_wood_foundation,token_stone_foundation,token_farmland,token_excavation,token_battlefield', cards.join(','));
            const cardsShown = await js(page, `(() => { const n = document.querySelector('nav[data-bubble-menu-side]').getBoundingClientRect(); return [...document.querySelectorAll('[data-shop-row]')].every(e => { const r = e.getBoundingClientRect(); return r.left >= n.right || r.right <= n.left; }); })()`);
            check(`${W} ${side}: no card is under the nav`, cardsShown);
            if (right) continue;

            // Hover: a skill icon names its skill; a card lists what it builds.
            const icon = await rectOf(page, '[data-shop-row="token_wood_foundation"] [data-shop-skill]');
            await page.mouse('mouseMoved', icon.x, icon.y);
            await sleep(400);
            await shot(page, `${W}_hover_icon`, W, H);
            check(`${W}: a skill icon names the skill`, /Crafting/.test(await js(page, `document.querySelector('[data-tooltip]')?.textContent || ''`)));
            const face = await rectOf(page, '[data-shop-row="token_wood_foundation"] [data-shop-art]');
            await page.mouse('mouseMoved', face.x, face.y);
            await sleep(400);
            await shot(page, `${W}_hover_card`, W, H);
            check(`${W}: a card lists what it builds`, /Builds: .*Workbench/.test(await js(page, `document.querySelector('[data-tooltip]')?.textContent || ''`)));

            // A purchase by drag, the lip on the way, then a second one without reopening.
            await js(page, `window.Game.InventoryManager.addItem('item_oak_wood', 100); window.__seenPurchase = null; window.Game.EventBus.subscribe('token_purchased', (d) => { window.__seenPurchase ??= d?.typeId; }); true`);
            await sleep(300);
            const matPoint = { x: Math.round(W / 2), y: Math.round(H * 0.35) };
            for (const n of [1, 2]) {
                const before = await countOf(page, 'token_wood_foundation');
                const woodBefore = await wood(page);
                const card = await rectOf(page, '[data-shop-row="token_wood_foundation"] [data-shop-art]');
                let lipState = null;
                await drag(page, card, [{ x: matPoint.x + n * 60, y: matPoint.y }], async () => {
                    lipState = await shopState(page);
                    if (n === 1) await shot(page, `${W}_lip`, W, H);
                });
                check(`${W}: purchase ${n}: the panel drops to its lip over the mat`, lipState === 'lip', lipState);
                const after = await countOf(page, 'token_wood_foundation');
                check(`${W}: purchase ${n}: bought (Wood Foundations ${before} -> ${after}, Oak Wood ${woodBefore} -> ${await wood(page)})`, after === before + 1);
                check(`${W}: purchase ${n}: the panel is open again after the drop`, (await shopState(page)) === 'open');
                if (n === 1) check(`${W}: purchase 1 published token_purchased (what the tutorial's Foundation step counts)`, (await js(page, 'window.__seenPurchase')) === 'token_wood_foundation');
            }
            await shot(page, `${W}_bought_two`, W, H);

            // A cancel: out over the mat (lip), back over where the panel was (it rises), let go.
            {
                const before = await countOf(page, 'token_wood_foundation');
                const woodBefore = await wood(page);
                const card = await rectOf(page, '[data-shop-row="token_wood_foundation"] [data-shop-art]');
                const states = [];
                const bought = await js(page, `window.__shopBought = 0; window.Game.EventBus.subscribe('token_purchased', () => { window.__shopBought++; }); true`);
                await drag(page, card, [matPoint, { x: card.x, y: card.y - 20 }], async () => {
                    await shot(page, `${W}_cancel_over_panel`, W, H);
                }, async () => { states.push(await shopState(page)); });
                check(`${W}: cancel: a lip over the mat, then the panel rose back under the pointer`, states.join(',') === 'lip,open', states.join(','));
                check(`${W}: cancel: nothing bought, nothing paid`, bought && (await js(page, 'window.__shopBought')) === 0 && (await countOf(page, 'token_wood_foundation')) === before && (await wood(page)) === woodBefore);
                check(`${W}: cancel: the panel stays open`, (await shopState(page)) === 'open');
            }

            // Escape closes it; the Bank bubble swaps it for the Bank, as the drawer did.
            await page.key('Escape', 'Escape', 27);
            await sleep(600);
            check(`${W}: Escape closes the Shop`, (await shopState(page)) === 'closed');
            await openShop(page);
            const bankB = await rectOf(page, '#bank-bubble-target button');
            await page.click(bankB.x, bankB.y);
            await sleep(900);
            check(`${W}: the Bank bubble closes the Shop and opens the Bank`, (await shopState(page)) === 'closed' && (await js(page, `!!document.querySelector('[data-dnd-region="drawer"]:not([data-shop-drawer]):not([data-bottom-hero-dock]):not([data-hero-panel] *)')`)));
            await page.click(bankB.x, bankB.y);
            await sleep(900);
            await openShop(page);

            // A row too long for the screen, and a group with a dropdown: test Tokens in this page only.
            await js(page, `import('/src/config/registries/tokenRegistry.js').then(m => {
                const extra = {};
                for (let i = 1; i <= 6; i++) extra['qa_shop_extra_' + i] = { id: 'qa_shop_extra_' + i, name: 'Extra ' + i, size: 1, sprite: 't_foundation_wood', shop: { price: [{ itemId: 'item_oak_wood', quantity: i }, { itemId: 'item_stone', quantity: 2 }, { itemId: 'item_copper_ore', quantity: 3 }, { itemId: 'item_coal', quantity: 4 }], skills: ['mining'], order: 10 + i } };
                extra.qa_shop_grp_a = { id: 'qa_shop_grp_a', name: 'Oak Tier', size: 1, sprite: 't_foundation_wood', shop: { price: [{ itemId: 'item_oak_wood', quantity: 5 }], group: 'Tiered Foundation', skills: ['crafting'], order: 9 } };
                extra.qa_shop_grp_b = { id: 'qa_shop_grp_b', name: 'Ebony Tier', size: 1, sprite: 't_foundation_wood', shop: { price: [{ itemId: 'item_oak_wood', quantity: 50000 }], group: 'Tiered Foundation', skills: ['crafting'], order: 9 } };
                m.registerTokenTypes(extra);
                return true;
            })`);
            await js(page, `window.Game.InventoryManager.addItem('item_oak_wood', 1); true`);
            await sleep(800);
            const arrowsLong = await js(page, `[...document.querySelectorAll('[data-scroll-arrow]')].map(b => b.getAttribute('data-scroll-arrow') + (b.disabled ? ':dim' : ''))`);
            check(`${W}: a long row gets its left and right arrows`, arrowsLong.join(',') === 'left:dim,right', arrowsLong.join(','));
            await page.mouse('mouseMoved', Math.round(W / 2), 5);
            await sleep(200);
            await shot(page, `${W}_scroll_start`, W, H);
            const right1 = await rectOf(page, '[data-scroll-arrow="right"]');
            const before = await js(page, `document.querySelector('[data-shop-drawer] [data-scroll-list]').scrollLeft`);
            await page.click(right1.x, right1.y);
            await sleep(900);
            const after = await js(page, `document.querySelector('[data-shop-drawer] [data-scroll-list]').scrollLeft`);
            check(`${W}: the right arrow scrolls the row`, after > before, `${before} -> ${after}`);
            await shot(page, `${W}_scrolled`, W, H);
            // The group's dropdown: a real focus and a key press picks the next option.
            await js(page, `document.querySelector('[data-shop-group] [data-shop-select]').scrollIntoView({ inline: 'center' }); true`);
            await sleep(500);
            const sel = await rectOf(page, '[data-shop-group] [data-shop-select]');
            await js(page, `document.querySelector('[data-shop-group] [data-shop-select]').focus(); true`);
            await page.key('ArrowDown', 'ArrowDown', 40);
            await sleep(400);
            const picked = await js(page, `({ value: document.querySelector('[data-shop-group] [data-shop-select]').value, row: document.querySelector('[data-shop-group]').getAttribute('data-shop-row'), ok: document.querySelector('[data-shop-group]').getAttribute('data-shop-affordable') })`);
            check(`${W}: the group's dropdown picks another option, with its own price`, picked.value === 'qa_shop_grp_b' && picked.row === 'qa_shop_grp_b' && picked.ok === 'false', JSON.stringify(picked));
            await page.mouse('mouseMoved', sel.x, 5);
            await sleep(200);
            await shot(page, `${W}_dropdown_picked`, W, H);
            await js(page, `document.querySelector('[data-shop-drawer] [data-scroll-list]').scrollLeft = 0; true`);
            await sleep(400);

            // Can't afford: an empty Bank and no loot on the floor.
            await js(page, `(() => { const G = window.Game; for (const id of ['item_oak_wood', 'item_stone']) G.InventoryManager.removeItem(id, G.InventoryManager.getItemCount(id)); return true; })()`);
            await sleep(600);
            const poor = await js(page, `(() => { const c = document.querySelector('[data-shop-row="token_wood_foundation"]'); return { ok: c.getAttribute('data-shop-affordable'), need: /Need/.test(c.textContent), dim: c.querySelector('[data-shop-art]').className.includes('opacity-40'), red: c.querySelectorAll('.text-gi-danger').length }; })()`);
            check(`${W}: can't afford: the Token dimmed, the short count red, no Need line`, poor.ok === 'false' && !poor.need && poor.dim && poor.red >= 1, JSON.stringify(poor));
            await shot(page, `${W}_cant_afford`, W, H);
            const card = await rectOf(page, '[data-shop-row="token_wood_foundation"] [data-shop-art]');
            const n0 = await countOf(page, 'token_wood_foundation');
            await drag(page, card, [matPoint]);
            check(`${W}: can't afford: the card cannot be dragged out`, (await countOf(page, 'token_wood_foundation')) === n0);

            // A full Token cap keeps its message.
            await js(page, `window.Game.InventoryManager.addItem('item_oak_wood', 100); true`);
            await js(page, `Promise.all([import('/src/config/matTuning.js'), import('/src/systems/board/MatCap.js')]).then(([m, c]) => { m.setMatTuning('tokenCap', c.tokenCount()); return true; })`);
            await sleep(600);
            const capMsg = await js(page, `document.querySelector('[data-shop-row="token_wood_foundation"] [data-shop-missing]')?.textContent || ''`);
            check(`${W}: a full cap says so on the card`, /Token cap full/.test(capMsg), capMsg);
            await shot(page, `${W}_cap_full`, W, H);
            await js(page, `import('/src/config/matTuning.js').then(m => { m.resetMatTuning(); return true; })`);
        }
    }
} finally {
    const fails = results.filter(r => !r.ok);
    log(`\n${results.length - fails.length}/${results.length} checks passed`);
    for (const f of fails) log(`  FAIL ${f.name} ${f.detail}`);
    const c = await chrome.close();
    log(`chrome closed: ${JSON.stringify(c)}`);
}
