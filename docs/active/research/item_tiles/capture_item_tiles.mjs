// Captures the Bank's item tiles for the owner's phone review, from a running dev server:
//   node capture_item_tiles.mjs <url> <outDir> <label>
// At 1920 x 1080 from a New Game: buys the Bunk Beds for a hero (the tutorial's path), stocks the
// Bank with varied items through window.Game, equips the hero, then saves the Bank drawer open,
// hover tooltips on a tool, a food, a map and a material, and the hero's loadout slots at 2x
// (nearest-neighbour).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5208', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}.png`), Buffer.from(b64, 'base64'));

/** A clip of the page, upscaled `k` times with nearest-neighbour in the page's own canvas. */
async function clip(page, name, box, k = 1) {
    const c = {
        x: Math.max(0, Math.round(box.x)), y: Math.max(0, Math.round(box.y)),
        width: Math.round(box.width), height: Math.round(box.height), scale: 1
    };
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: c });
    if (k === 1) return save(name, shot.data);
    const b64 = await page.evaluate(`(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
    save(name, b64);
}

const rectOf = (page, selector) => page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
})()`);

const union = (a, b, pad = 8) => {
    const x = Math.min(a.x, b.x) - pad, y = Math.min(a.y, b.y) - pad;
    const r = Math.max(a.x + a.width, b.x + b.width) + pad, btm = Math.max(a.y + a.height, b.y + b.height) + pad;
    return { x, y, width: r - x, height: btm - y };
};

const awayMouse = async (page) => { await page.mouse('mouseMoved', 1900, 1070); await sleep(400); };

const STOCK = [
    ['item_copper_pickaxe', 1], ['item_shrimp', 24], ['item_water', 40], ['item_shrimp_trawler_potion', 3],
    ['map_forest', 2], ['mod_overgrown', 1], ['item_copper_ore', 152], ['item_oak_wood', 87], ['item_coal', 12]
];
const EQUIP = ['item_copper_pickaxe', 'item_shrimp', 'item_water', 'item_shrimp_trawler_potion'];
const HOVERS = [['tool', 'item_copper_pickaxe'], ['food', 'item_shrimp'], ['map', 'map_forest'], ['material', 'item_copper_ore']];

const log = {};
const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    await page.setViewport(1920, 1080);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(3000);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(6000);
    await awayMouse(page);

    // A hero, the tutorial's way: buy the Bunk Beds in the Guild Hall.
    const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(orb.x, orb.y);
    await sleep(1500);
    await page.evaluate(`document.querySelector('[data-guild-roster-upgrade]').click()`);
    await sleep(1500);
    await page.evaluate(`document.querySelector('[data-guild-roster-upgrade-button]').click()`);
    await sleep(1000);
    await page.click(orb.x, orb.y);
    await sleep(1200);
    await awayMouse(page);

    log.stocked = await page.evaluate(`(() => {
        const ids = ${JSON.stringify(STOCK)};
        return ids.map(([id, n]) => {
            try { Game.InventoryManager.addItem(id, n); return id + ' ' + Game.InventoryManager.getItemCount(id); }
            catch (e) { return id + ' failed: ' + e.message; }
        });
    })()`);
    const heroId = await page.evaluate(`Game.HeroManager.getAllHeroes()[0]?.id`);
    log.hero = heroId;
    log.equipped = await page.evaluate(`(() => ${JSON.stringify(EQUIP)}.map(id => {
        const r = Game.EquipmentManager.equipItem(${JSON.stringify(heroId)}, id);
        return id + ' ' + (r?.success ?? JSON.stringify(r));
    }))()`);
    await sleep(500);

    // The Bank drawer.
    const bankBubble = await rectOf(page, '#bank-bubble-target');
    await page.click(bankBubble.x + bankBubble.width / 2, bankBubble.y + bankBubble.height / 2);
    await page.waitFor(`!!document.querySelector('button[data-bank-item]')`, { timeoutMs: 15000 });
    await sleep(1500);
    await awayMouse(page);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    save('1_bank_open', shot.data);

    // Tooltips.
    for (const [kind, id] of HOVERS) {
        const tile = await rectOf(page, `button[data-bank-item="${id}"]`);
        if (!tile) { log[`tip_${kind}`] = 'no tile'; continue; }
        await page.mouse('mouseMoved', tile.x + tile.width / 2, tile.y + tile.height / 2);
        await sleep(700);
        const tip = await rectOf(page, '[data-tooltip]');
        log[`tip_${kind}`] = await page.evaluate(`document.querySelector('[data-tooltip]')?.textContent || null`);
        await clip(page, `2_tip_${kind}`, tip ? union(tile, tip) : tile);
        await awayMouse(page);
    }

    // A click on the tool tile (before: it fills the inspect column; after: nothing happens).
    const toolTile = await rectOf(page, 'button[data-bank-item="item_copper_pickaxe"]');
    if (toolTile) {
        await page.click(toolTile.x + toolTile.width / 2, toolTile.y + toolTile.height / 2);
        await sleep(800);
        await awayMouse(page);
        const clicked = await page.send('Page.captureScreenshot', { format: 'png' });
        save('4_tool_clicked', clicked.data);
    }

    // The hero's loadout slots: open the hero from the hero bar.
    const gridSel = '[data-hero-panel] [class*="grid-cols-[repeat(3,minmax(0,70px))]"]';
    if (!(await rectOf(page, gridSel))) {
        const tab = await rectOf(page, '[data-hero-dock-tab]');
        if (tab) await page.click(tab.x + tab.width / 2, tab.y + tab.height / 2);
        await sleep(1500);
    }
    await awayMouse(page);
    const grid = await page.evaluate(`(() => {
        const g = document.querySelector('[data-hero-panel] [class*="grid-cols-[repeat(3,minmax(0,70px))]"]');
        if (!g) return null;
        const r = g.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    if (grid) {
        await clip(page, '3_hero_slots_2x', { x: grid.x - 10, y: grid.y - 10, width: grid.width + 20, height: grid.height + 20 }, 2);
        const full = await page.send('Page.captureScreenshot', { format: 'png' });
        save('3_hero_panel', full.data);
    } else {
        log.grid = 'no loadout grid found';
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(label, JSON.stringify(log, null, 1));
    await chrome.close();
}
