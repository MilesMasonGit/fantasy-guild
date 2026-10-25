// Captures the mat's speech family (hero speech bubbles, the hero bar's level-up alerts, the mat
// callouts and the off-mat refusal callout) in the running game, for the owner's phone:
//   node capture_speech.mjs <url> <outDir> <before|after>
// A New Game at 1920 x 1080 with the game loop stopped. A hero works a Fir Forest down to nothing
// (it says the Forest is depleted, then that it has no work in range), a second hero, at work on
// another Forest, is told a Furnace refused their flag, the mat says an effect's name, a refusal over the Guild Hall and a refusal
// at a bare point, the off-mat callout says a refused equip, and the first hero levels two skills
// (the bar's alerts). The callouts' pop is paused part-way so every picture holds still. Saves
// `<tag>_screen_1x.png` and, per kind, `<tag>_<kind>_1x.png` / `_2x.png` (2x upscaled
// nearest-neighbour). With both tags in the folder, `sheet_speech_pixel_1x/2x.png` puts them side
// by side.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5223', out = '.', tag = 'after'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const save = (name, b64) => writeFileSync(path.join(out, `${name}.png`), Buffer.from(b64, 'base64'));

async function shot(page, name, clip = null) {
    const s = await page.send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : { format: 'png' });
    save(name, s.data);
    return s.data;
}

const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** A part of a picture. */
const crop = (page, data, r) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = ${r.width}; c.height = ${r.height};
    c.getContext('2d').drawImage(img, ${r.x}, ${r.y}, ${r.width}, ${r.height}, 0, 0, ${r.width}, ${r.height});
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** Rows of [label, before, after] tiles on the page's dark background. */
const sheet = (page, rows) => page.evaluate(`(async () => {
    const rows = ${JSON.stringify(rows)};
    const load = async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); return i; };
    const imgs = await Promise.all(rows.map(async r => [await load(r.before), await load(r.after)]));
    const gap = 10, label = 24, head = 30;
    const colW = Math.max(...imgs.flat().map(i => i.width));
    const c = document.createElement('canvas');
    c.width = colW * 2 + gap * 3;
    c.height = head + imgs.reduce((h, [a, b]) => h + label + Math.max(a.height, b.height) + gap, 0);
    const g = c.getContext('2d');
    g.fillStyle = '#1a1612'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = 'bold 18px monospace'; g.textBaseline = 'top';
    g.fillText('Today', gap, 6); g.fillText('Built', colW + gap * 2, 6);
    let y = head;
    imgs.forEach(([a, b], i) => {
        g.font = 'bold 15px monospace'; g.fillStyle = '#facc15';
        g.fillText(rows[i].label, gap, y + 4);
        y += label;
        g.drawImage(a, gap, y); g.drawImage(b, colW + gap * 2, y);
        y += Math.max(a.height, b.height) + gap;
    });
    return c.toDataURL('image/png').split(',')[1];
})()`);

const KINDS = [
    ['hero_depleted_idle', 'Hero speech: depleted, then no work in range'],
    ['hero_refused', 'Hero speech: a refused flag'],
    ['bar_levelups', 'Hero bar: level-up alerts'],
    ['callout_effect', 'Mat callout: an effect fired'],
    ['callout_refusal', 'Mat callout: a refusal over a Token'],
    ['callout_point', 'Mat callout: a refused drop at a point'],
    ['screen_callout', 'Off-mat refusal callout']
];

const log = { tag };
const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    await page.setViewport(1920, 1080);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });

    if (tag === 'sheet') {
        const rows = [];
        for (const [k, label] of KINDS) {
            const b = path.join(out, `before_${k}_1x.png`);
            const a = path.join(out, `after_${k}_1x.png`);
            if (!existsSync(b) || !existsSync(a)) continue;
            rows.push({ label, before: readFileSync(b).toString('base64'), after: readFileSync(a).toString('base64') });
        }
        const data = await sheet(page, rows);
        save('sheet_speech_pixel_1x', data);
        save('sheet_speech_pixel_2x', await upscale(page, data));
        log.rows = rows.length;
    } else {
        await sleep(2500);
        const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
        if (!clicked) throw new Error('no New Game button');
        await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
        await sleep(4000);

        log.build = await page.evaluate(`(async () => {
            const HG = await import('/src/systems/hero/HeroGenerator.js');
            const XP = await import('/src/utils/XPCurve.js');
            const BS = Game.BoardState;
            Game.GameLoop.stop();
            Game.GameState.state.progress.rosterLimit = 8;
            const mk = (name, skills) => {
                const h = HG.generateHero({ name });
                for (const [k, v] of Object.entries(skills)) h.skills[k] = { level: v, xp: XP.xpForLevel(v) };
                return Game.HeroManager.addHero(h);
            };
            const a = mk('Aela', { forestry: 30 });
            const b = mk('Bram', { smithing: 1, forestry: 30 });
            Game.InventoryManager.addItem('item_copper_woodaxe', 1);
            Game.EquipmentManager.equipItem(a.id, 'item_copper_woodaxe');
            Game.InventoryManager.addItem('item_copper_woodaxe', 1);
            Game.EquipmentManager.equipItem(b.id, 'item_copper_woodaxe');
            const place = (typeId, x, y, uses) => {
                const inst = BS.createTokenInstance(typeId, uses);
                Game.BoardPlacement.placeTokenAt(inst, { x, y });
                return inst.id;
            };
            const forest = place('token_fir_forest', 520, 640, 1);
            const furnace = place('token_furnace', 1180, 640);
            const pin = (heroId, tokenId) => { const t = BS.getTokenById(tokenId); return Game.BoardPlacement.plantFlagAt(heroId, { x: t.x, y: t.y }, { pin: true }).success; };
            const pinned = pin(a.id, forest);
            const planted = pin(b.id, place('token_fir_forest', 1450, 780, 500));
            window.__speech = { a: a.id, b: b.id, forest, furnace };
            return { pinned, planted };
        })()`, { timeoutMs: 120000 });

        await sleep(1000);
        for (let i = 0; i < 5; i++) {
            const x = await page.evaluate(`(() => { const b = document.querySelector('[data-hero-panel-close]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
            if (!x) break;
            await page.click(x.x, x.y);
            await sleep(700);
        }
        for (let i = 0; i < 8; i++) {
            const left = await page.evaluate(`(() => { const b = document.querySelector('[data-banner]:not([data-banner-leaving])'); if (b) b.click(); return document.querySelectorAll('[data-banner]').length; })()`);
            if (!left) break;
            await sleep(500);
        }
        await page.mouse('mouseMoved', 1910, 500);

        // Work the Forest's one charge away: the hero says it is depleted, then goes idle.
        log.worked = await page.evaluate(`(async () => {
            const BS = Game.BoardState;
            const { forest } = window.__speech;
            let i = 0;
            for (; i < 600 && BS.getTokenById(forest); i++) {
                Game.GameLoop.runHandlers(100);
                if (i % 20 === 0) await new Promise(r => setTimeout(r, 0));
            }
            for (let j = 0; j < 30; j++) { Game.GameLoop.runHandlers(100); if (j % 10 === 0) await new Promise(r => setTimeout(r, 0)); }
            Game.SpriteLayer.collectAll();
            return { ticks: i, forestGone: !BS.getTokenById(forest) };
        })()`, { timeoutMs: 120000 });
        await sleep(800);

        // The rest are said at once, then the callouts' pop is held part-way.
        log.said = await page.evaluate(`(async () => {
            const { BOARD_EVENTS, ALERT } = await import('/src/systems/board/boardEvents.js');
            const { UI_EVENTS, ENGINE_EVENTS } = await import('/src/systems/core/engineEvents.js');
            const E = Game.EventBus;
            const BS = Game.BoardState;
            const { a, b, furnace } = window.__speech;
            const hall = [...BS.tokens()].find(t => /guild_hall/.test(t.typeId)) || null;
            E.publish(BOARD_EVENTS.PIN_REFUSED, { heroId: b, instanceId: furnace, reason: ALERT.ACCESS });
            E.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: furnace, title: 'Bountiful' });
            if (hall) E.publish(UI_EVENTS.UI_TOKEN_ALERT, { instanceId: hall.id, severity: 'disallow', type: 'drop_rejected', title: 'Guild Hall cannot be removed from the playmat.' });
            E.publish(UI_EVENTS.UI_TOKEN_ALERT, { x: 860, y: 300, severity: 'disallow', type: 'drop_rejected', title: 'Too close to another Token' });
            E.publish(UI_EVENTS.UI_SCREEN_CALLOUT, { text: 'Requires Melee 10', x: 1650, y: 880 });
            E.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: a, skillId: 'forestry', skillName: 'Forestry', oldLevel: 30, newLevel: 31 });
            E.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: a, skillId: 'mining', skillName: 'Mining', oldLevel: 4, newLevel: 5 });
            return { hall: !!hall };
        })()`);
        await sleep(450);
        await page.evaluate(`document.getAnimations().forEach(x => { try { if (x.animationName === 'callout-pop') { x.pause(); x.currentTime = 450; } } catch {} })`);
        await sleep(300);
        // Every close-up is cut from this one picture: the callouts' own timers clear them soon after.
        const screen = await shot(page, `${tag}_screen_1x`);

        const boxes = await page.evaluate(`(() => {
            const { a, b } = window.__speech;
            const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
            const callout = (re) => { const el = [...document.querySelectorAll('[data-callouts] [data-callout]')].find(e => re.test(e.getAttribute('data-callout'))); return box(el); };
            return {
                hero_depleted_idle: box(document.querySelector('[data-hero-bubble-stack="' + a + '"]')),
                hero_refused: box(document.querySelector('[data-hero-bubble-stack="' + b + '"]')),
                bar_levelups: box(document.querySelector('[data-bar-bubbles="' + a + '"]')),
                callout_effect: callout(/Bountiful/),
                callout_refusal: callout(/Guild Hall/),
                callout_point: callout(/Too close/),
                screen_callout: box(document.querySelector('[data-screen-callouts] [data-callout]')),
                lines: {
                    hero: [...document.querySelectorAll('[data-hero-bubble]')].map(e => e.textContent),
                    bar: [...document.querySelectorAll('[data-bar-bubble]')].map(e => e.textContent),
                    callouts: [...document.querySelectorAll('[data-callout]')].map(e => e.getAttribute('data-callout'))
                },
                filters: [...document.querySelectorAll('[data-hero-bubble], [data-callout], [data-bar-bubble]')].map(e => getComputedStyle(e).filter + '|' + getComputedStyle(e).boxShadow).filter(s => s !== 'none|none')
            };
        })()`);
        log.boxes = boxes;
        for (const [k] of KINDS) {
            const bx = boxes[k];
            if (!bx) continue;
            const w = Math.max(240, Math.ceil(bx.w) + 48);
            const h = Math.max(110, Math.ceil(bx.h) + 48);
            const clip = { x: Math.round(bx.x - w / 2), y: Math.round(bx.y - h / 2), width: w, height: h };
            const data = await crop(page, screen, clip);
            save(`${tag}_${k}_1x`, data);
            save(`${tag}_${k}_2x`, await upscale(page, data));
        }
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(JSON.stringify(log, null, 1));
    await chrome.close();
}
