// Captures the Guild Hall star machinery (brief 320 H1) from a running dev server, at 1920 x 1080:
// node capture_hall_h1.mjs <url> <outDir>
// A new game, the QA panel's "Star scene" (the fixture sky, a Copper Ore Vein, a miner, a Mining
// Camp), the sky, a star's details, Miner's Lore bought through its Upgrade button, every other
// kind bought, the Hall's Effects, the QA readout of what the stars do, and the mat after a Hall
// lap and a wound.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5199', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    const shot = async (name) => writeFileSync(path.join(out, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    const centre = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const realClick = async (sel) => {
        const c = await centre(sel);
        if (!c) throw new Error(`nothing at ${sel}`);
        await page.click(c.x, c.y);
    };
    const qa = async (sel) => {
        if (!(await page.evaluate(`!!document.querySelector('[data-testid="qa-guild-hall"]')`))) await realClick('button[title="Open QA Dashboard"]');
        await sleep(600);
        await page.evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
        await sleep(400);
        return page.evaluate(`document.querySelector('[data-qa-hall-status]')?.textContent || ''`);
    };
    const closeQa = async () => { await page.evaluate(`document.querySelector('[data-testid="qa-panel"] .shrink-0 button')?.click()`); await sleep(500); };
    const domClick = async (sel) => { if (!(await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`))) throw new Error(`nothing at ${sel}`); };
    const hallOrb = async () => { await realClick('#guild-bubble-target button'); await sleep(2500); };
    const away = async () => { await page.mouse('mouseMoved', 5, H - 5); await sleep(300); };

    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(6000);

    console.log('scene:', await qa('[data-qa-hall-scene]'));
    await closeQa();
    await sleep(1500);
    await shot('h1_01_mat_scene.png');

    await hallOrb();
    await away();
    const states = await page.evaluate(`[...document.querySelectorAll('[data-hall-node]')].map(b => b.dataset.hallNode + ':' + b.dataset.nodeState + ':' + (b.dataset.starLook || ''))`);
    console.log('sky:', states.join(' '));
    console.log('board:', await page.evaluate(`(() => { const b = document.querySelector('[data-guild-hall-board]'); return [b.dataset.naturalWidth, b.dataset.naturalHeight, b.dataset.skyScale, document.querySelector('[data-hall-sky-view]').dataset.skyPannable].join(' '); })()`));
    await shot('h1_02_sky_fixture.png');

    const lore = await centre('[data-hall-node="qa_mining_xp"]');
    await page.mouse('mouseMoved', lore.x, lore.y);
    await sleep(500);
    await shot('h1_03_star_details.png');

    await domClick('[data-hall-node="qa_mining_xp"]');
    await sleep(400);
    await domClick('#guild-upgrade-button');
    await sleep(800);
    await away();
    console.log('after the Upgrade button:', await page.evaluate(`JSON.stringify(window.GameState.state.progress.guildUpgrades)`));
    await shot('h1_04_first_star_bought.png');

    const bought = await page.evaluate(`(() => {
        const M = window.Game.GuildUpgradeManager;
        const out = [];
        for (const [id, n] of [['wishing_well', 1], ['qa_mining_yield', 1], ['qa_mining_speed', 1], ['qa_vein_rest', 1], ['qa_mining_camp_reach', 1],
            ['qa_forestry_xp', 1], ['qa_oak_regrow', 1], ['qa_infirmary', 1], ['qa_food_slot', 1], ['qa_well_copper', 2], ['qa_well_coal', 1]]) {
            while (M.getRank(id) < n) { const r = M.purchase(id); if (!r.success) { out.push(id + ': ' + r.error); break; } }
        }
        return out;
    })()`);
    console.log('refused purchases:', bought.length ? bought : 'none');
    await sleep(800);
    await away();
    await shot('h1_05_sky_every_kind.png');

    await domClick('[data-hall-node="hall"]');
    await sleep(800);
    console.log('effects:', await page.evaluate(`document.querySelector('[data-hall-effects]')?.textContent`));
    await shot('h1_06_hall_effects.png');
    await domClick('[data-hall-node="hall"]');
    await sleep(300);

    await hallOrb();
    console.log('readout:', await qa('[data-qa-hall-readout]'));
    await page.evaluate(`document.querySelector('[data-qa-hall-status]').scrollIntoView({ block: 'end' })`);
    await sleep(400);
    await shot('h1_07_qa_readout.png');

    console.log('wound:', await qa('[data-qa-hall-wound]'));
    console.log('lap:', await qa('[data-qa-hall-lap]'));
    await closeQa();
    await sleep(3000);
    console.log('on the mat:', await page.evaluate(`(async () => {
        const SL = await import('/src/systems/board/SpriteLayer.js');
        const hero = window.GameState.state.heroes.find(h => h.name === 'QA Hall Miner');
        return JSON.stringify({ copperOreOnMat: SL.countOnBoard('item_copper_ore'), coalOnMat: SL.countOnBoard('item_coal'), miner: hero?.status, woundMs: hero?.woundedRemainingMs });
    })()`));
    await shot('h1_08_mat_after_lap_and_wound.png');

    // The Mining Camp's reach ring under the pointer: 280 authored, 350 with Long Rails.
    const camp = await page.evaluate(`(() => {
        const t = Object.values(window.GameState.state.board.tokens).find(t => t.typeId === 'token_mining_camp');
        const el = t && document.querySelector('[data-token-overlay="' + t.id + '"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`);
    if (camp) {
        await page.mouse('mouseMoved', camp.x, camp.y);
        await sleep(1200);
        await shot('h1_09_camp_reach_ring.png');
    }
    if (page.consoleErrors.length) console.log('page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
