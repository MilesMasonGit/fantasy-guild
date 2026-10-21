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

// The hero panel is a drawer region too, and it stays open beside the Bank: not the Bank.
export const BANK_OPEN = `!!document.querySelector('[data-dnd-region="drawer"]:not([data-shop-drawer]):not([data-bottom-hero-dock]):not([data-hero-panel] *)')`;
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

/**
 * The Guild Hall in place of the mat, its roster upgrade picked: on a board still at the
 * recruit-hero step the tutorial's two standing beacons are showing (on the roster node and on
 * the inspection's upgrade button), so their cost is measured with a target, not only looking
 * for one.
 */
async function openHall(page) {
    const n = await clickUntil(page, '#guild-bubble-target', `!!document.querySelector('[data-guild-roster-upgrade="true"]')`, 'the Guild Hall');
    await sleep(500);
    const beacons = await page.evaluate(`document.querySelectorAll('.rounded-full.border-yellow-400').length`);
    return `clicked the Guild Hall bubble (real input${n > 1 ? `, ${n} clicks` : ''}); ${beacons} tutorial beacon(s) showing`;
}

/**
 * The Atlas opened and closed over the busy mat every 1.5 s from a page timer: a click at the
 * centre of the Atlas bubble (it takes a click only inside its circle): each open and close slides
 * the book up over the mat and back down.
 */
async function atlasToggle(page) {
    const ok = await page.evaluate(`(() => {
        const button = document.querySelector('#atlas-bubble-target button');
        if (!button) return false;
        const press = () => {
            const r = button.getBoundingClientRect();
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        };
        press();
        window.__benchTimer = setInterval(press, 1500);
        return true;
    })()`);
    if (!ok) throw new Error('no Atlas bubble to click');
    await page.waitFor(`!!document.querySelector('[data-atlas-screen]')`, { timeoutMs: 4000, what: 'the Atlas' });
    return 'the Atlas bubble clicked every 1.5 s from a page timer (open, close, open…)';
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

// A fixed piece of JavaScript, timed in the page: the same work at 1× and at the throttle says what
// slowdown Chrome actually delivered. The best of three, so a task that slipped in between does
// not count.
const FIXED_WORK = `(() => { let best = Infinity, x = 0; for (let r = 0; r < 3; r++) { const t0 = performance.now(); for (let i = 0; i < 2e6; i++) x += Math.sqrt(i); best = Math.min(best, performance.now() - t0); } return [best, x]; })()`;

/**
 * The slowdown Chrome is delivering right now: the fixed work at `cpu` over the same at 1×.
 * ⚠️ Not always what was asked (bench/README.md, "Chrome's CPU throttle").
 */
export async function deliveredSlowdown(page, cpu) {
    if (cpu === 1) return 1;
    await page.setCpuThrottling(1);
    const [full] = await page.evaluate(FIXED_WORK);
    await page.setCpuThrottling(cpu);
    const [slowed] = await page.evaluate(FIXED_WORK);
    return full > 0 ? Math.round((slowed / full) * 100) / 100 : null;
}

export const SCENES = {
    S1: { id: 'S1', name: 'S1 quiet', stress: 'quiet' },
    S2: { id: 'S2', name: 'S2 realistic', stress: 'realistic' },
    S3: { id: 'S3', name: 'S3 torture', stress: 'torture' },
    bank: { id: 'bank', name: 'S2 + Bank open', stress: 'realistic', ui: openBank },
    shop: { id: 'shop', name: 'S2 + Shop open', stress: 'realistic', ui: openShop },
    notify: { id: 'notify', name: 'S2 + notification burst', stress: 'realistic', ui: notifyBurst },
    loot: { id: 'loot', name: 'S2 + loot burst', stress: 'realistic', ui: lootBurst },
    inspect: { id: 'inspect', name: 'S2 + hero sheet open', stress: 'realistic', ui: openInspect },
    // Not in the default run (`--only=cap128,camp128,cap256`): S2's mix filled to the Token cap.
    cap128: { id: 'cap128', name: 'S2 mix at cap 128', stress: 'cap128' },
    camp128: { id: 'camp128', name: 'Starter Camp at 128', stress: 'camp128' },
    cap256: { id: 'cap256', name: 'S2 mix at cap 256', stress: 'cap256' },
    // Not in the default run either (`--only=hall`, `--only=atlas`).
    hall: { id: 'hall', name: 'S2 + Guild Hall (beacons)', stress: 'realistic', ui: openHall },
    atlas: { id: 'atlas', name: 'S2 + Atlas open/close every 1.5 s', stress: 'realistic', ui: atlasToggle }
};

const STRESS_IDS = { quiet: 'S1', realistic: 'S2', torture: 'S3', cap128: 'C128', camp128: 'K128', cap256: 'C256' };

// --- The Performance Envelope's scenes (brief 90) ------------------------------------------------
//
// Named with a number, any number, so a limit can be swept (`--only=cap96,cap128,cap160`):
//   cap<N> heroes<N> enemies<N> fights<N>   the boards of `bench/scenarios/envelope.mjs`
//   floor<N>    cap128 with N loot piles resting on the floor: auto-collect off and the game's own
//               pile cap (`gameplay.maxItemStacks`, 40 shipped) set to N, the floor filled to it
//               first; the board's own drops then keep it at N, the oldest pile flying to the Bank
//   floorstill<N>  the same with the piles' hover animation stopped: what the hover costs
//   notify<N>   cap128 with N notifications a minute on top of the board's own: every tenth a
//               banner (the oldest on screen dismissed when three show, as a player clicking), the
//               rest item flows into the Bank (`InventoryManager.addItem`), which the item stubs
//               show, over 24 items in turn
// Each also samples what is on the mat every 500 ms (Tokens, enemies, fights going on, loot piles,
// stub rows, banners) and counts the item flows and banners the window saw: the scene's `probe`,
// kept in the results JSON as `envelope` and printed.

const ENVELOPE_BOARD = /^(cap|heroes|enemies|fights)(\d+)$/;
const ENVELOPE_ID = { cap: 'C', heroes: 'H', enemies: 'E', fights: 'F' };
const ENVELOPE_LABEL = {
    cap: (n) => `S2 mix at cap ${n}`,
    heroes: (n) => `cap128, ${n} heroes`,
    enemies: (n) => `cap128, room for ${n} goblins`,
    fights: (n) => `cap128, ${n} heroes fighting`
};

/** What is on the mat, every 500 ms, and the notifications the window sees. */
const SAMPLER = `(() => {
    const G = window.__perf.game;
    const S = window.__envSamples = [];
    window.__envFlows = []; window.__envBanners = window.__envBanners || [];
    G.EventBus.subscribe('inventory_updated', (p) => { if (p && p.itemId && (p.added > 0 || p.removed > 0)) window.__envFlows.push(performance.now()); });
    window.__envSampler = setInterval(() => {
        const tokens = G.BoardState.tokens();
        let enemies = 0;
        for (const t of tokens) if (G.BoardCombat.isEnemyToken(t)) enemies++;
        let fights = 0;
        for (const h of G.GameState.heroes || []) if (h && G.BoardCombat.fightOfHero(h.id)) fights++;
        S.push({ t: performance.now(), tokens: tokens.length, enemies, fights, heroes: (G.GameState.heroes || []).length,
            piles: G.SpriteLayer.getSprites().length, stubs: G.ItemStubs.getStubs().length, banners: G.Banners.getView().shown.length });
    }, 500);
    return true;
})()`;

/** The samples since the window started, summarised (mean, min, max) per count, and the flows a minute. */
export const ENVELOPE_PROBE = `(() => {
    const from = window.__envWindowStart || 0, now = performance.now();
    const S = (window.__envSamples || []).filter(s => s.t >= from);
    const out = { samples: S.length };
    for (const k of ['tokens', 'enemies', 'fights', 'heroes', 'piles', 'stubs', 'banners']) {
        const v = S.map(s => s[k]);
        out[k] = v.length ? { mean: Math.round(10 * v.reduce((a, b) => a + b, 0) / v.length) / 10, min: Math.min(...v), max: Math.max(...v) } : null;
    }
    const minutes = (now - from) / 60000;
    out.flowsPerMin = Math.round((window.__envFlows || []).filter(t => t >= from).length / minutes);
    out.bannersPerMin = Math.round((window.__envBanners || []).filter(t => t >= from).length / minutes);
    return out;
})()`;

async function startSampler(page) {
    await page.evaluate(SAMPLER);
}

/** floor<N>: the floor kept at N resting loot piles. */
async function floorPiles(page, n) {
    await startSampler(page);
    const made = await page.evaluate(`(() => {
        const G = window.__perf.game;
        G.SettingsManager.set('gameplay.autoCollectLoot', false);
        G.SettingsManager.set('gameplay.maxItemStacks', ${n});
        // Distinct items, on a grid over the mat, so no two piles merge (same item within 2¼ steps).
        const items = Object.values(G.getAllItems()).filter(i => i && i.id && !i.equipSlot).map(i => i.id);
        const mat = document.querySelector('[data-board-origin]');
        const w = Number(mat.dataset.naturalWidth);
        const h = mat.getBoundingClientRect().height / Number(mat.dataset.boardScale);
        const cols = Math.ceil(Math.sqrt(${n} * w / h));
        const rows = Math.ceil(${n} / cols);
        for (let i = 0; i < ${n}; i++) {
            const c = i % cols, r = Math.floor(i / cols);
            const at = { centre: { x: w * (0.06 + 0.88 * (c + 0.5) / cols), y: h * (0.08 + 0.84 * (r + 0.5) / rows) } };
            G.SpriteLayer.addSprite('item', items[i % items.length], 1 + (i % 4), at);
        }
        return G.SpriteLayer.getSprites().length;
    })()`);
    return `auto-collect off, maxItemStacks ${n}, ${made} piles scattered (then the board's own drops)`;
}

/**
 * floorstill<N>: the same floor with the piles' hover (`gi-sprite-hover`, a stepped transform on
 * each pile's picture, `TokenSprite.jsx`) stopped by a page style: what the hover itself costs.
 */
async function stillPiles(page) {
    await page.evaluate(`(() => {
        const st = document.createElement('style');
        st.textContent = '.gi-sprite-hover { animation: none !important; }';
        document.head.appendChild(st);
        return true;
    })()`);
    return 'the piles hover animation stopped (a page style)';
}

/** notify<N>: N notifications a minute, every tenth a banner. */
async function notifyRate(page, n) {
    await startSampler(page);
    await page.evaluate(`(() => {
        const G = window.__perf.game;
        const items = Object.values(G.getAllItems()).filter(i => i && i.id && !i.equipSlot).slice(0, 24).map(i => i.id);
        let k = 0;
        const one = () => {
            k++;
            if (k % 10 === 0) {
                const view = G.Banners.getView();
                if (view.shown.length >= G.Banners.MAX_SHOWN) G.Banners.dismiss(view.shown[view.shown.length - 1].id);
                G.Banners.push({ kind: 'save', groupKey: 'env' + k, parts: { title: 'Bench banner ' + k, message: 'A banner from the envelope bench' } });
                window.__envBanners.push(performance.now());
            } else {
                G.InventoryManager.addItem(items[k % items.length], 1, 'bench');
            }
        };
        // At most every 50 ms; faster rates send several at once.
        const every = Math.max(50, 60000 / ${n});
        const per = Math.max(1, Math.round(${n} * every / 60000));
        window.__benchTimer = setInterval(() => { for (let i = 0; i < per; i++) one(); }, every);
        return true;
    })()`);
    return `${n} notifications a minute from a page timer (every tenth a banner, the rest item flows over 24 items)`;
}

/** The scene an id names: one of `SCENES`, or an envelope scene with a number. Null if none. */
export function sceneFor(id) {
    if (SCENES[id]) return SCENES[id];
    const key = String(id || '').trim().toLowerCase();
    const known = Object.keys(SCENES).find(k => k.toLowerCase() === key);
    if (known) return SCENES[known];
    let m = ENVELOPE_BOARD.exec(key);
    if (m) {
        const n = Number(m[2]);
        return {
            id: `${m[1]}${n}`, name: ENVELOPE_LABEL[m[1]](n), stress: `${m[1]}${n}`, stressId: `${ENVELOPE_ID[m[1]]}${n}`,
            ui: async (page) => { await startSampler(page); return null; }, probe: ENVELOPE_PROBE
        };
    }
    m = /^floor(still)?(\d+)$/.exec(key);
    if (m) {
        const n = Number(m[2]);
        if (m[1]) {
            return {
                id: `floorstill${n}`, name: `cap128, ${n} loot piles, not hovering`, stress: 'cap128', probe: ENVELOPE_PROBE,
                ui: async (page) => `${await floorPiles(page, n)}; ${await stillPiles(page)}`
            };
        }
        return { id: `floor${n}`, name: `cap128, ${n} loot piles on the floor`, stress: 'cap128', ui: (page) => floorPiles(page, n), probe: ENVELOPE_PROBE };
    }
    m = /^notify(\d+)$/.exec(key);
    if (m) {
        const n = Number(m[1]);
        return { id: `notify${n}`, name: `cap128, ${n} notifications a minute`, stress: 'cap128', ui: (page) => notifyRate(page, n), probe: ENVELOPE_PROBE };
    }
    return null;
}


export function sceneUrl(base, scene, offSwitches = []) {
    const q = new URLSearchParams({ stress: scene.stress });
    if (offSwitches.length) q.set('off', offSwitches.join(','));
    return `${base}/?${q.toString()}`;
}

/**
 * Load a stress board in a fresh tab and wait until it is built and measuring. Returns the page.
 * `cpu` is set before the load, so the build itself runs at that speed too.
 */
export async function openBoard(chrome, url, { cpu = 1, stress = 'realistic', stressId = null, timeoutMs = 180000 } = {}) {
    const page = await chrome.newPage();
    try {
        await page.setCpuThrottling(cpu);
        await page.navigate(url);
        const id = stressId || STRESS_IDS[stress] || 'S2';
        await page.waitFor(`window.__perf?.running === true && window.__perf.report().scenario?.id === ${JSON.stringify(id)}`,
            { timeoutMs, intervalMs: 500, what: `the ${id} board` });
        return page;
    } catch (err) {
        await page.close();
        throw err;
    }
}
