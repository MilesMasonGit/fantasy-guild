// Loot flights with a drawer open (T-241): node capture_particles_drawer.mjs <url> <outDir> <label>
// On the bench's S2 board (`?stress=realistic`, any build with the perf harness), opens the Bank,
// then the Shop, and with each open sends eight loot collections whose flights start under the
// drawer and cross it toward the hero column (Bank), or cross the mat to the table's right edge
// (Shop); a still while they are in the air (300 ms in; 550 ms for the Shop), half size. `node capture_particles_drawer.mjs sheet <outDir>` lays the
// before and after stills out as one PNG (`particles_drawer.png`).
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5220', out = '.', label = 'shot'] = process.argv.slice(2);
const W = 1600, H = 900;
const sheetMode = url === 'sheet';
const outDir = out;
mkdirSync(outDir, { recursive: true });

const rectOf = (page, sel) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; })()`);

async function flyAcross(page, from, to, inAirMs = 300) {
    // Eight flights, from points spread down the drawer to points spread down the target band.
    const flights = [];
    for (let i = 0; i < 8; i++) {
        const fy = from.y + from.h * (0.15 + 0.1 * i);
        const ty = to.y + to.h * (0.1 + 0.1 * i);
        flights.push({ fx: Math.round(from.x + from.w * 0.5), fy: Math.round(fy), tx: Math.round(to.x + to.w * 0.5), ty: Math.round(ty) });
    }
    await page.evaluate(`(async () => {
        const { EventBus } = await import('/src/systems/core/EventBus.js');
        const { BOARD_EVENTS } = await import('/src/systems/board/boardEvents.js');
        for (const f of ${JSON.stringify(flights)}) {
            EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
                kind: 'item', refId: 'item_copper_ore', quantity: 1,
                fromScreenX: f.fx, fromScreenY: f.fy, toScreenX: f.tx, toScreenY: f.ty
            });
        }
        return true;
    })()`);
    await sleep(inAirMs);
}

async function shot(page, name) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } });
    writeFileSync(path.join(outDir, `${label}_${name}.png`), Buffer.from(data, 'base64'));
}

async function sheet(page) {
    const names = [['before_bank', 'before: Bank open'], ['before_shop', 'before: Shop open'], ['after_bank', 'after: Bank open'], ['after_shop', 'after: Shop open']];
    const stills = names.map(([n, l]) => ({ label: l, data: readFileSync(path.join(outDir, `${n}.png`)).toString('base64') }));
    const png = await page.evaluate(`(async () => {
        const stills = ${JSON.stringify(stills)};
        const imgs = [];
        for (const s of stills) { const i = new Image(); i.src = 'data:image/png;base64,' + s.data; await i.decode(); imgs.push(i); }
        const w = imgs[0].width, h = imgs[0].height, gap = 8, head = 34, lab = 24, cols = 2;
        const c = document.createElement('canvas');
        c.width = cols * w + (cols + 1) * gap; c.height = head + 2 * (h + lab + gap) + gap;
        const g = c.getContext('2d');
        g.fillStyle = '#16120e'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#f3e6c8'; g.font = 'bold 20px sans-serif';
        g.fillText('Loot flying while a drawer is open (eight flights each, still while they are in the air)', gap, 24);
        g.font = '16px sans-serif';
        imgs.forEach((im, n) => {
            const x = gap + (n % cols) * (w + gap), y = head + Math.floor(n / cols) * (h + lab + gap);
            g.fillStyle = '#f3e6c8'; g.fillText(stills[n].label, x, y + 17);
            g.drawImage(im, x, y + lab);
        });
        return c.toDataURL('image/png').split(',')[1];
    })()`);
    writeFileSync(path.join(outDir, 'particles_drawer.png'), Buffer.from(png, 'base64'));
}

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    if (sheetMode) {
        await sheet(page);
    } else {
        await page.setViewport(W, H);
        await page.navigate(`${url}/?stress=realistic`);
        await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`);
        await sleep(2000);
        await page.evaluate(`window.__perf.hideHud?.(); true`);
        await sleep(6000);
        await page.mouse('mouseMoved', Math.round(W / 2), H - 5);

        const bankBtn = await rectOf(page, '#bank-bubble-target button');
        await page.click(Math.round(bankBtn.x + bankBtn.w / 2), Math.round(bankBtn.y + bankBtn.h / 2));
        await sleep(900);
        await page.mouse('mouseMoved', Math.round(W / 2), H - 5);
        // The Bank reaches from the screen's edge to the hero column (its own box is mid-animation for a while).
        const heroCol = await rectOf(page, '[data-hero-panel]');
        const bank = { x: 0, y: 0, w: heroCol.x, h: H };
        console.log('bank', bank, 'hero column', heroCol);
        await flyAcross(page, bank, heroCol);
        await shot(page, 'bank');
        await sleep(1200);
        await page.click(Math.round(bankBtn.x + bankBtn.w / 2), Math.round(bankBtn.y + bankBtn.h / 2));
        await sleep(900);

        const shopBtn = await rectOf(page, '#shop-bubble-target button');
        await page.click(Math.round(shopBtn.x + shopBtn.w / 2), Math.round(shopBtn.y + shopBtn.h / 2));
        await sleep(900);
        await page.mouse('mouseMoved', W - 5, H - 5);
        const shop = await rectOf(page, '[data-shop-drawer]');
        const matBand = { x: W - 140, y: shop.y, w: 80, h: shop.h };
        console.log('shop', shop);
        await flyAcross(page, shop, matBand, 550);
        await shot(page, 'shop');
        // Which is on top where: the flights' canvas made hit-testable for a moment, then the
        // topmost element under a point on the Shop and a point on the mat.
        await flyAcross(page, shop, matBand, 100);
        console.log('stacking', await page.evaluate(`(() => {
            const canvases = [...document.querySelectorAll('canvas[class*="flight"]')].filter(c => c.style.display === 'block');
            canvases.forEach(c => { c.style.pointerEvents = 'auto'; });
            const top = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.tagName + ' ' + (e.className?.baseVal ?? e.className)).slice(0, 80) : null; };
            const out = canvases.map(c => {
                const r = c.getBoundingClientRect();
                const y = Math.round(r.top + r.height / 2);
                return { canvas: c.className, rect: [r.left, r.top, r.width, r.height].map(Math.round), onShop: top(${Math.round(shop.x + shop.w / 2)}, y), onMat: top(${Math.round(shop.x + shop.w + 60)}, y) };
            });
            canvases.forEach(c => { c.style.pointerEvents = ''; });
            return JSON.stringify(out);
        })()`));
    }
} finally {
    await chrome.close?.();
}
