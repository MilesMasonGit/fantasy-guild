// The drags the Bank's move could touch, by real browser input once the motion has settled:
// node check_drags.mjs <url> [rounds]   (SHOT=1 also saves after_shop_lip.png mid-drag)
//   shop  a Shop row onto a free spot on the mat (bought, landed near the aim), before the Bank
//         has ever opened and again after each Bank open and close
//   equip with the Bank open, an equippable Bank tile onto a hero's tab beside the drawer (the
//         tab's box is the column's width; the drawn tab is at its outer end)
import { writeFileSync } from 'node:fs';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';
import { installDragKit } from '../../../../bench/browser/dragKit.mjs';
import { dragPath } from '../../../../bench/browser/dragLib.mjs';

const [url = 'http://localhost:5214', roundArg = '3'] = process.argv.slice(2);
const rounds = Number(roundArg);
const W = 1920, H = 1080;
const log = (...a) => console.log(...a);
let shotLip = !!process.env.SHOT;
const centre = (page, sel) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null; })()`);

async function drag(page, from, to) {
    await page.mouse('mouseMoved', from.x, from.y);
    await sleep(120);
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(30);
    for (const p of dragPath(from, to)) {
        await page.mouse('mouseMoved', p.x, p.y, { button: 'left', buttons: 1 });
        await sleep(30);
    }
    await sleep(80);
    const seen = await page.evaluate(`({ hand: window.__dragKit.inHand(), at: window.__dragKit.describeAt(${to.x}, ${to.y}), drops: window.__dragKit.droppablesAt(${to.x}, ${to.y}) })`);
    if (process.env.DEBUG) log('  before release', JSON.stringify(seen).slice(0, 600));
    // Once: the screen with a Shop Token in the hand over the mat (the drawer slid to its lip).
    if (shotLip && /^Shop row/.test(seen.hand)) {
        shotLip = false;
        const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } });
        writeFileSync(new URL('./after_shop_lip.png', import.meta.url), Buffer.from(data, 'base64'));
    }
    await page.mouse('mouseReleased', to.x, to.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(500);
}

async function shopDrag(page, shopOrb, tag) {
    await page.evaluate('window.__dragKit.ensureShopFunds(); true');
    await page.click(shopOrb.x, shopOrb.y);
    await sleep(800);
    const plan = await page.evaluate(`(() => {
        const kit = window.__dragKit; kit.ensureShopFunds();
        const rows = [...document.querySelectorAll('[data-shop-row][data-shop-affordable="true"]')];
        if (!rows.length) return { skip: 'no affordable row' };
        const row = rows[0];
        row.scrollIntoView({ block: 'center' });
        const r = row.getBoundingClientRect();
        const typeId = row.getAttribute('data-shop-row');
        const to = kit.freeSpot();
        const ids = window.__perf.game.BoardState.tokens().filter(t => t.typeId === typeId).map(t => t.id);
        return { from: { x: Math.round(r.right - 70), y: Math.round(r.top + r.height / 2) }, to: to.screen, expect: { kind: 'shop', typeId, beforeIds: ids, mat: to.mat } };
    })()`);
    if (plan.skip) { log(tag, 'shop skipped:', plan.skip); return false; }
    await sleep(300);
    await drag(page, plan.from, plan.to);
    const res = await page.evaluate(`window.__dragKit.check(${JSON.stringify(plan.expect)})`);
    log(tag, 'shop row -> mat:', res.ok ? 'OK' : 'FAIL', res.detail);
    if (await page.evaluate(`document.querySelector('[data-shop-drawer]')?.getAttribute('data-shop-drawer-state') !== 'closed'`)) await page.click(shopOrb.x, shopOrb.y);
    await sleep(800);
    return res.ok;
}

async function equipDrag(page, bankOrb, tag) {
    await page.click(bankOrb.x, bankOrb.y);
    await sleep(900);
    const plan = await page.evaluate(`(() => {
        const G = window.__perf.game, kit = window.__dragKit;
        const heroes = (G.GameState.state.heroes || []).map(h => h.id);
        const tiles = [...document.querySelectorAll('button[data-bank-item]')].map(el => ({ el, itemId: el.getAttribute('data-bank-item') }))
            .filter(t => G.EquipmentValidator.canEquipToSlot(t.itemId));
        for (const t of tiles) for (const h of heroes) {
            const tab = document.querySelector('[data-hero-panel] [data-dock-hero-id="' + h + '"]');
            if (tab && G.EquipmentValidator.canHeroEquip(h, t.itemId).canEquip) {
                kit.clearHeroGear(h);
                t.el.scrollIntoView({ block: 'center' });
                const a = t.el.getBoundingClientRect(), b = tab.getBoundingClientRect();
                return { heroId: h, itemId: t.itemId, from: { x: Math.round(a.x + a.width / 2), y: Math.round(a.y + a.height / 2) }, to: { x: Math.round(b.right - 40), y: Math.round(b.y + b.height / 2) } };
            }
        }
        return { skip: 'no equippable tile and hero tab (' + tiles.length + ' tiles)' };
    })()`);
    if (plan.skip) { log(tag, 'equip skipped:', plan.skip); return false; }
    await sleep(300);
    await drag(page, plan.from, plan.to);
    const res = await page.evaluate(`window.__dragKit.check({ kind: 'equip', heroId: ${JSON.stringify(plan.heroId)}, itemId: ${JSON.stringify(plan.itemId)} })`);
    log(tag, `bank ${plan.itemId} -> hero tab ${plan.heroId}:`, res.ok ? 'OK' : 'FAIL', res.detail);
    if (process.env.DEBUG) log('  gear', JSON.stringify(await page.evaluate(`window.__perf.game.HeroManager.getHero(${JSON.stringify(plan.heroId)})?.equipment`)));
    await page.click(bankOrb.x, bankOrb.y);
    await sleep(900);
    return res.ok;
}

const chrome = await launchChrome({ width: W, height: H });
let fails = 0;
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(`${url}/?stress=realistic`);
    await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`);
    await sleep(2000);
    await page.evaluate(`window.__perf.hideHud?.(); true`);
    await page.evaluate(`(${installDragKit.toString()})(); window.__dragKit.ensureEquipStock(); true`);
    await sleep(6000);
    const bankOrb = await centre(page, '#bank-bubble-target button');
    const shopOrb = await centre(page, '#shop-bubble-target button');
    if (!(await shopDrag(page, shopOrb, 'before any Bank'))) fails++;
    for (let i = 0; i < rounds; i++) {
        if (!(await equipDrag(page, bankOrb, `round ${i + 1}`))) fails++;
        if (!(await shopDrag(page, shopOrb, `round ${i + 1}, after the Bank closed`))) fails++;
    }
    if (page.consoleErrors.length) log('page errors', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
log(fails ? `${fails} failed` : 'all drags OK');
process.exit(fails ? 1 : 0);
