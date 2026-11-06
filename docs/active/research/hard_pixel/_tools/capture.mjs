// Throwaway (brief 460 P1): open the real game on the throwaway server (port 5408), put each soft
// effect on screen, and shoot it before and after inject.js swaps in the hard version. Pictures go
// to raw/, the boxes to crop to positions_<job>_<width>.json.
// node capture.mjs <job> [width height]   jobs: camp (a new game), busy (the S2 stress board), shop, ghost
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'raw');
mkdirSync(out, { recursive: true });
const job = process.argv[2] || 'camp';
const W = Number(process.argv[3] || 1920), H = Number(process.argv[4] || 1080);
const inject = readFileSync(path.join(here, 'inject.js'), 'utf8');
const pos = {};

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    const ev = (js) => page.evaluate(js);
    const shot = async (name) => {
        const r = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(out, `${job}_${W}_${name}.png`), Buffer.from(r.data, 'base64'));
        console.log('saved', `${job}_${W}_${name}.png`);
    };
    const rect = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()`);
    const tokenOf = (type, n = 0) => ev(`(() => { const e = [...document.querySelectorAll('[data-token-art][data-token-type=${JSON.stringify(type)}]')][${n}]; if (!e) return null; const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-token-id'), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const looks = async (name, modes = ['before', 'after']) => {
        for (const m of modes) {
            await ev(`window.HP.look('${m}')`);
            await sleep(350);
            await shot(`${name}_${m}`);
        }
        await ev(`window.HP.look('before')`);
    };

    await page.setViewport(W, H);
    if (job === 'busy') {
        await page.navigate('http://localhost:5408/?stress=realistic');
        await page.waitFor('window.__perf?.running === true', { timeoutMs: 180000, intervalMs: 500 });
        await sleep(3000);
        // The perf HUD covers a corner of the mat; it is a dev overlay, so it goes.
        await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'HIDE')?.click()`);
    } else {
        await page.navigate('http://localhost:5408/');
        await page.waitFor('!!window.Game', { timeoutMs: 180000 });
        await sleep(2500);
        await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME')?.click()`);
        await sleep(8000);
    }
    // Hold the world still so before and after show the same moment.
    await ev(`window.Game.GameLoop.stop()`);
    await sleep(500);
    console.log(await ev(inject));
    pos.mat = await rect('[data-mat-surface]');

    if (job === 'debug') {
        console.log(await ev(`JSON.stringify([...document.querySelectorAll('[data-token-art]')].map(e => { const r = e.getBoundingClientRect(); return e.getAttribute('data-token-type') + '@' + Math.round(r.x) + ',' + Math.round(r.y); }))`));
        const rock = await tokenOf('token_stone_outcrop', 0);
        console.log(await ev(`(async () => { const m = await import('/src/ui/hooks/useMapMode.js'); return JSON.stringify(m.flipDemolishMark(${JSON.stringify(rock.id)})); })()`));
    }
    if (job === 'camp') {
        const mm = `await import('/src/ui/hooks/useMapMode.js')`;
        const tree = await tokenOf('token_oak_tree', 1);
        const rock = await tokenOf('token_stone_outcrop', 0);
        const vein = await tokenOf('token_copper_ore_vein', 0);
        const coal = [await tokenOf('token_coal_vein', 0), await tokenOf('token_coal_vein', 1)];
        const fire = await tokenOf('token_campfire', 0) || await tokenOf('token_copper_mine', 0);
        console.log(JSON.stringify({ tree, rock, vein, coal, fire }));
        await ev(`(async () => { const m = ${mm}; m.flipDisallowed(${JSON.stringify(tree.id)}); })()`);
        await sleep(800);
        pos.floater = await ev(`window.HP.floater(${JSON.stringify(vein.id)})`);
        const icon = await ev(`(async () => (await import('/src/ui/components/base/SkillIcon.jsx')).skillArt(null, 'construction').spritePath)()`);
        const iconSrc = icon.startsWith('/') ? icon : `/${icon}`;
        await ev(`window.HP.badge(${JSON.stringify(rock.id)}, 'marked', ${JSON.stringify(iconSrc)})`);
        // The gold gear stands beside the copper veins' mine, a station.
        await ev(`window.HP.badge(${JSON.stringify(fire.id)}, 'gear')`);
        await ev(`document.querySelectorAll('[data-token-type="token_coal_vein"]').forEach(e => e.setAttribute('data-summary-highlight', 'true'))`);
        // A bubble that would take a dropped item, as while an item is carried over it.
        await ev(`document.querySelector('#bank-bubble-target, [id$="-bubble-target"]:not(#guild-bubble-target)')?.classList.add('ring-4', 'ring-gi-success', 'shadow-[0_0_15px_rgba(34,197,94,0.6)]')`);
        Object.assign(pos, { tree, rock, vein, coal, fire });
        pos.disallow = await rect('[data-tile-disallowed]');
        pos.marked = await rect('[data-demolish-badge]');
        pos.gear = await rect('[data-station-gear]');
        pos.navRing = await rect('.ring-gi-success');
        pos.nav = await rect('#guild-bubble-target');
        pos.bubbles = await ev(`[...document.querySelectorAll('[id$="-bubble-target"]')].map(e => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })`);
        await page.mouse('mouseMoved', W - 5, H - 5);
        await sleep(600);
        await looks('still');
        // Rest the pointer on the campfire: its name and its recipe gear show.
        const target = fire || tree;
        await page.mouse('mouseMoved', target.x, target.y);
        await sleep(1200);
        pos.name = await rect('[data-token-name] span');
        pos.gear = await rect('[data-station-gear]');
        await looks('hover', ['before', 'after', 'afterB']);
        // A tree's name over the grass and dirt too.
        const tree2 = await tokenOf('token_oak_tree', 0);
        await page.mouse('mouseMoved', tree2.x, tree2.y + 10);
        await sleep(1200);
        pos.name2 = await rect('[data-token-name] span');
        await looks('hover2', ['before', 'after', 'afterB']);
    }

    if (job === 'busy') {
        // Rest the pointer on a Token in the thick of it: its name over trees, heroes and plates.
        const pick = await ev(`(() => {
            const want = ['bench_forest', 'bench_tree', 'bench_rock'];
            for (const t of want) for (const e of document.querySelectorAll('[data-token-art][data-token-type="' + t + '"]')) {
                const r = e.getBoundingClientRect();
                if (r.x > 500 && r.x < ${W} - 400 && r.y > 200 && r.y < ${H} - 300) return { id: e.getAttribute('data-token-id'), type: t, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
            return null;
        })()`);
        console.log(JSON.stringify(pick));
        pos.floater = await ev(`window.HP.floater(${JSON.stringify(pick.id)})`);
        await page.mouse('mouseMoved', pick.x, pick.y);
        await sleep(1200);
        pos.name = await rect('[data-token-name] span');
        pos.pick = pick;
        await looks('hover', ['before', 'after', 'afterB']);
        await ev(`window.HP.look('afterB')`);
        console.log(await ev(`JSON.stringify({ v: getComputedStyle(document.documentElement).getPropertyValue('--shadow-outline-2'), ts: getComputedStyle(document.querySelector('[data-token-name] span')).textShadow, f: getComputedStyle(document.querySelector('[data-token-name] span')).filter, scale: document.querySelector('[data-token-name]').getBoundingClientRect().width / document.querySelector('[data-token-name]').offsetWidth })`));
    }

    if (job === 'shop') {
        const at = await rect('button[aria-label="Shop"]');
        await page.click(at[0] + at[2] / 2, at[1] + at[3] / 2);
        await sleep(2000);
        const sprite = await ev(`(() => { for (const e of document.querySelectorAll('[data-item-bar-sprite]')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.y > 100 && r.y < innerHeight - 100) return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; } return null; })()`);
        console.log('sprite', JSON.stringify(sprite));
        await page.mouse('mouseMoved', sprite[0], sprite[1]);
        await sleep(800);
        pos.ribbon = sprite;
        await looks('ribbon');
    }

    if (job === 'ghost') {
        // Pick the Guild Hall up and carry it off the mat: its ghost dims and shows the refusal mark.
        const hall = await tokenOf('token_guild_hall', 0);
        await page.mouse('mouseMoved', hall.x, hall.y);
        await sleep(300);
        await page.mouse('mousePressed', hall.x, hall.y, { button: 'left', buttons: 1, clickCount: 1 });
        for (let i = 1; i <= 20; i++) {
            await page.mouse('mouseMoved', hall.x + (760 - hall.x) * i / 20, hall.y + (H - 18 - hall.y) * i / 20, { button: 'left', buttons: 1 });
            await sleep(40);
        }
        await sleep(800);
        pos.ghost = await rect('img[alt="Disallow"]');
        console.log('ghost', JSON.stringify(pos.ghost));
        await looks('ghost');
        await page.mouse('mouseReleased', 160, H - 60, { button: 'left', buttons: 0, clickCount: 1 });
    }

    console.log('console errors:', page.consoleErrors.slice(0, 5));
    writeFileSync(path.join(here, `positions_${job}_${W}.json`), JSON.stringify(pos, null, 1));
    console.log(JSON.stringify(pos));
} finally {
    await chrome.close();
}
