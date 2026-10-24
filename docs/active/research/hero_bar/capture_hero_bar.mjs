// Captures the hero bar, the Work Permissions drawer and the equip shine for the owner's phone
// review, from a running dev server:
//   node capture_hero_bar.mjs <url> <outDir> <label>
// At 1920 x 1080 from a New Game: a Recruit the tutorial's way (the Bunk Beds), then the QA
// panel's Spawn Party (Fighter, Wizard, Ranger, Rogue). Saves the whole screen, the hero bar at
// 2x (nearest-neighbour), the drawer open, and the equip animation as one strip of stills 30 ms
// apart at 2x (the animation paused and stepped, so the spacing is exact).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5210', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}.png`), Buffer.from(b64, 'base64'));

const shotOf = async (page, box) => (await page.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: Math.max(0, Math.round(box.x)), y: Math.max(0, Math.round(box.y)), width: Math.round(box.width), height: Math.round(box.height), scale: 1 }
})).data;

/** Pictures upscaled `k` times with nearest-neighbour and laid side by side (or stacked), in the page's own canvas. */
const compose = (page, shots, k, down = false) => page.evaluate(`(async () => {
    const imgs = await Promise.all(${JSON.stringify(shots)}.map(async b => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode(); return i; }));
    const gap = 4 * ${k};
    const c = document.createElement('canvas');
    const along = (i) => (${down} ? i.height : i.width) * ${k};
    const across = (i) => (${down} ? i.width : i.height) * ${k};
    const total = imgs.reduce((s, i) => s + along(i), 0) + gap * (imgs.length - 1);
    c.width = ${down} ? Math.max(...imgs.map(across)) : total;
    c.height = ${down} ? total : Math.max(...imgs.map(across));
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, c.width, c.height);
    let x = 0;
    for (const i of imgs) {
        if (${down}) g.drawImage(i, 0, x, i.width * ${k}, i.height * ${k});
        else g.drawImage(i, x, 0, i.width * ${k}, i.height * ${k});
        x += along(i) + gap;
    }
    return c.toDataURL('image/png').split(',')[1];
})()`);

const rectOf = (page, selector) => page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
})()`);

const awayMouse = async (page) => { await page.mouse('mouseMoved', 960, 300); await sleep(400); };
const clickText = (page, text) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);

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

    // A Recruit, the tutorial's way: buy the Bunk Beds in the Guild Hall.
    const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(orb.x, orb.y);
    await sleep(1500);
    await page.evaluate(`document.querySelector('[data-guild-roster-upgrade]').click()`);
    await sleep(1500);
    await page.evaluate(`document.querySelector('[data-guild-roster-upgrade-button]').click()`);
    await sleep(1000);
    await page.click(orb.x, orb.y);
    await sleep(1200);

    // Four more of different classes from the QA panel.
    log.qaOpened = await page.evaluate(`(() => { const b = document.querySelector('button[title="Open QA Dashboard"]'); if (!b) return false; b.click(); return true; })()`);
    await sleep(800);
    log.party = await clickText(page, 'Spawn Party');
    await sleep(500);
    log.qaClosed = await page.evaluate(`(() => { const p = document.querySelector('[data-testid="qa-panel"]'); const b = p && [...p.querySelectorAll('button')].find(b => /close|✕|×/i.test(b.title + b.textContent + (b.getAttribute('aria-label') || ''))); if (!b) return false; b.click(); return true; })()`);
    await sleep(1500);
    log.heroes = await page.evaluate(`Game.HeroManager.getAllHeroes().map(h => h.name + ' (' + h.spriteId + ')')`);
    await awayMouse(page);
    await sleep(1500);

    // 1: the whole screen.
    save('1_screen', (await page.send('Page.captureScreenshot', { format: 'png' })).data);

    // 2: the hero bar at 2x, with the room above it the heroes may stand into.
    const bar = await rectOf(page, '[data-bottom-hero-dock]');
    log.bar = bar;
    const barBox = { x: bar.x, y: bar.y - 80, width: bar.width, height: bar.height + 80 };
    save('2_hero_bar_2x', await compose(page, [await shotOf(page, barBox)], 2));

    // 3: Work Permissions open.
    const btn = await rectOf(page, '[data-work-rules-button]');
    log.button = btn;
    await page.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await sleep(900);
    await awayMouse(page);
    save('3_permissions_open', (await page.send('Page.captureScreenshot', { format: 'png' })).data);
    log.drawer = await rectOf(page, '[data-work-rules-drawer]');
    log.groups = await page.evaluate(`[...document.querySelectorAll('[data-rules-group]')].map(e => e.getAttribute('data-rules-group'))`);
    log.firstColumn = await page.evaluate(`document.querySelector('[data-rules-col]')?.getAttribute('data-rules-col')`);
    await page.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await sleep(700);

    // 3b: the drawer's slide, five stills (the transition paused and stepped).
    await page.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
    const slide = await page.evaluate(`(async () => {
        for (let i = 0; i < 40; i++) {
            await new Promise(r => requestAnimationFrame(r));
            const a = document.getAnimations().filter(a => a.effect?.target?.closest?.('[data-work-rules-drawer]'));
            if (a.length) { window.__slide = a; a.forEach(x => x.pause()); return a[0].effect.getComputedTiming().duration; }
        }
        return null;
    })()`);
    log.slideMs = slide;
    if (slide) {
        const shots = [];
        const box = { x: bar.x, y: 640, width: bar.width, height: 1080 - 640 };
        for (const f of [0, 0.25, 0.5, 0.75, 1]) {
            await page.evaluate(`(async () => { window.__slide.forEach(a => { a.currentTime = ${f * slide}; }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
            shots.push(await shotOf(page, box));
        }
        await page.evaluate(`window.__slide.forEach(a => a.finish())`);
        save('3b_permissions_slide', await compose(page, shots, 1, true));
    }
    await sleep(400);
    await page.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await sleep(700);

    // 4: the equip animation, from the first hero's panel.
    const heroId = await page.evaluate(`Game.HeroManager.getAllHeroes()[0].id`);
    const figure = await rectOf(page, `[data-dock-hero="${heroId}"]`);
    await page.click(figure.x + figure.width / 2, figure.y + figure.height - 10);
    await sleep(1500);
    await awayMouse(page);
    log.stock = await page.evaluate(`(() => { Game.InventoryManager.addItem('item_copper_pickaxe', 1); return Game.InventoryManager.getItemCount('item_copper_pickaxe'); })()`);
    await sleep(300);
    const gridSel = '[data-hero-panel] [class*="grid-cols-[repeat(3,minmax(0,70px))]"]';
    const grid = await rectOf(page, gridSel);
    log.grid = grid;
    if (grid) {
        log.equip = await page.evaluate(`JSON.stringify(Game.EquipmentManager.equipItem(${JSON.stringify(heroId)}, 'item_copper_pickaxe'))`);
        // Catch the animation as it starts, pause it, and step it by hand.
        const found = await page.evaluate(`(async () => {
            for (let i = 0; i < 40; i++) {
                await new Promise(r => requestAnimationFrame(r));
                const a = document.getAnimations().filter(a => {
                    const t = a.effect?.target;
                    return t && t.closest && t.closest('[data-hero-panel]') && /equipped|shine/.test(a.animationName || '');
                });
                if (a.length) {
                    window.__equipAnims = a;
                    a.forEach(x => x.pause());
                    return a.map(x => x.animationName + ' ' + (x.effect.pseudoElement || '') + ' ' + x.effect.getComputedTiming().duration + 'ms').join(', ');
                }
            }
            return null;
        })()`);
        log.animation = found;
        if (found) {
            const duration = await page.evaluate(`Math.max(...window.__equipAnims.map(a => a.effect.getComputedTiming().endTime))`);
            const pad = 16;
            const box = { x: grid.x - pad, y: grid.y - pad, width: grid.width + pad * 2, height: grid.height + pad * 2 };
            const shots = [];
            for (let t = 0; t <= duration + 30; t += 30) {
                await page.evaluate(`(async () => { window.__equipAnims.forEach(a => { a.currentTime = ${Math.min(t, duration)}; }); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
                shots.push(await shotOf(page, box));
            }
            log.frames = shots.length;
            save('4_equip_strip_2x', await compose(page, shots, 2));
        }
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(label, JSON.stringify(log, null, 1));
    await chrome.close();
}
