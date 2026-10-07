// Scene set-up for the drawing bench: which stress board, and what is done to the UI on top of
// it. Opening things uses REAL input (`Input.dispatchMouseEvent` on the button the player
// clicks); bursts call the game's own functions from a timer inside the page, so they keep
// coming through the settle and the measured window.

import { sleep } from './cdp.mjs';

/** Centre of the first visible element matching `selector`, or null. */
export async function centreOf(page, selector) {
    return page.evaluate(`(() => {
        for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) {
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height, innerHeight - r.top) / 2) };
            }
        }
        return null;
    })()`);
}

async function clickSelector(page, selector) {
    const at = await centreOf(page, selector);
    if (!at) throw new Error(`nothing to click: ${selector}`);
    await page.click(at.x, at.y);
    return at;
}

/**
 * Click until `opened` holds: a click that lands while the page is still busy settling the
 * board can be lost, so it is retried, but only while the thing is still shut (a second click
 * on an open toggle would close it).
 */
export async function clickUntil(page, selector, opened, what, tries = 3) {
    for (let i = 1; i <= tries; i++) {
        await clickSelector(page, selector);
        try {
            await page.waitFor(opened, { timeoutMs: 4000, what });
            return i;
        } catch (err) {
            if (i === tries) throw err;
        }
    }
    return tries;
}

export const BANK_OPEN = `!!document.querySelector('[data-dnd-region="drawer"]:not([data-shop-drawer]):not([data-bottom-hero-dock])')`;
export const SHOP_OPEN = `document.querySelector('[data-shop-drawer]')?.getAttribute('data-shop-drawer-state') === 'open'`;

async function openBank(page) {
    const n = await clickUntil(page, 'button[aria-label="Item Bank"]', BANK_OPEN, 'the Bank drawer');
    return `clicked the Item Bank button (real input${n > 1 ? `, ${n} clicks` : ''})`;
}

async function openShop(page) {
    const n = await clickUntil(page, 'button[aria-label="Shop"]', SHOP_OPEN, 'the Shop drawer');
    return `clicked the Shop button (real input${n > 1 ? `, ${n} clicks` : ''})`;
}

async function openInspect(page) {
    // The dock figure's strip sits at the bottom edge; its visible part is the target.
    const n = await clickUntil(page, '[data-dock-hero]', `!!document.querySelector('[data-dock-selected="true"]')`, 'the hero inspection sheet');
    await sleep(300);
    return `clicked the first dock hero (real input${n > 1 ? `, ${n} clicks` : ''})`;
}

/** 20 notifications every 4 s (each lives 5 s, so the column stays full and keeps changing). */
async function notifyBurst(page) {
    const n = await page.evaluate(`(() => {
        const N = window.__perf.game.NotificationSystem;
        let k = 0;
        const burst = () => { for (let i = 0; i < 20; i++) N.info('Bench notification ' + (++k), { groupable: false }); };
        burst();
        window.__benchTimer = setInterval(burst, 4000);
        return N.getQueue().length;
    })()`);
    if (!n) throw new Error('the notification burst produced no notifications');
    return `NotificationSystem.info × 20 every 4 s from a page timer (queue ${n})`;
}

/** 30 loot sprites every 3 s, scattered over the mat (as the QA panel's Scatter Loot does). */
async function lootBurst(page) {
    const n = await page.evaluate(`(() => {
        const G = window.__perf.game;
        const items = Object.values(G.getAllItems()).filter(i => i && i.id && !i.equipSlot).slice(0, 4).map(i => i.id);
        if (!items.length) return 0;
        const mat = document.querySelector('[data-board-origin]');
        const w = Number(mat.dataset.naturalWidth);
        const h = mat.getBoundingClientRect().height / Number(mat.dataset.boardScale);
        const burst = () => {
            for (let i = 0; i < 30; i++) {
                const from = { centre: { x: w * (0.15 + 0.7 * Math.random()), y: h * (0.15 + 0.7 * Math.random()) } };
                G.SpriteLayer.addSprite('item', items[i % items.length], 1 + Math.floor(Math.random() * 5), from);
            }
        };
        burst();
        window.__benchTimer = setInterval(burst, 3000);
        return G.SpriteLayer.getSprites().length;
    })()`);
    if (!n) throw new Error('the loot burst produced no sprites');
    return `SpriteLayer.addSprite × 30 every 3 s from a page timer (${n} sprites after the first)`;
}

export const SCENES = {
    S1: { id: 'S1', name: 'S1 quiet', stress: 'quiet' },
    S2: { id: 'S2', name: 'S2 realistic', stress: 'realistic' },
    S3: { id: 'S3', name: 'S3 torture', stress: 'torture' },
    bank: { id: 'bank', name: 'S2 + Bank open', stress: 'realistic', ui: openBank },
    shop: { id: 'shop', name: 'S2 + Shop open', stress: 'realistic', ui: openShop },
    notify: { id: 'notify', name: 'S2 + notification burst', stress: 'realistic', ui: notifyBurst },
    loot: { id: 'loot', name: 'S2 + loot burst', stress: 'realistic', ui: lootBurst },
    inspect: { id: 'inspect', name: 'S2 + hero sheet open', stress: 'realistic', ui: openInspect }
};

const STRESS_IDS = { quiet: 'S1', realistic: 'S2', torture: 'S3' };

export function sceneUrl(base, scene, offSwitches = []) {
    const q = new URLSearchParams({ stress: scene.stress });
    if (offSwitches.length) q.set('off', offSwitches.join(','));
    return `${base}/?${q.toString()}`;
}

/**
 * Load a stress board in a fresh tab and wait until it is built and measuring. Returns the page.
 * `cpu` is set before the load, so the build itself runs at that speed too.
 */
export async function openBoard(chrome, url, { cpu = 1, stress = 'realistic', timeoutMs = 180000 } = {}) {
    const page = await chrome.newPage();
    try {
        await page.setCpuThrottling(cpu);
        await page.navigate(url);
        const id = STRESS_IDS[stress] || 'S2';
        await page.waitFor(`window.__perf?.running === true && window.__perf.report().scenario?.id === ${JSON.stringify(id)}`,
            { timeoutMs, intervalMs: 500, what: `the ${id} board` });
        return page;
    } catch (err) {
        await page.close();
        throw err;
    }
}
