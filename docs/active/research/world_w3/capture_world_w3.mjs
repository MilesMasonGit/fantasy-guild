// Captures a settled place's mat and the arrival (brief 330 W3) from a running dev server, at 1920 x 1080:
// node capture_world_w3.mjs <url> <outDir>
// A new game in a throwaway headless Chrome profile (no save slot of anyone's is touched): the
// tutorial's last step opening the world map, two kits' fixture places (darkened on arrival, then
// beaten and bright, their Stone outcrops), and a frontier place settled through the world map,
// its goblins fought by a hero who moves on from one to the next.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5283', out = '.'] = process.argv.slice(2);
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
    const away = async () => { await page.mouse('mouseMoved', 5, H - 5); await sleep(300); };
    const atlas = async () => { await realClick('#atlas-bubble-target button'); await sleep(1200); await away(); };
    const qa = async (sel) => {
        if (!(await page.evaluate(`!!document.querySelector('[data-testid="qa-atlas"]')`))) await realClick('button[title="Open QA Dashboard"]');
        await sleep(600);
        await page.evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView()`);
        await realClick(sel);
        await sleep(500);
        return page.evaluate(`document.querySelector('[data-qa-world-said]')?.textContent || ''`);
    };
    const closeQa = async () => { await page.evaluate(`document.querySelector('[data-testid="qa-panel"] .shrink-0 button')?.click()`); await sleep(500); };
    const atlasOpen = () => page.evaluate(`!!document.querySelector('[data-world-map]')`);
    const closeAtlas = async () => { if (await atlasOpen()) { await page.key('Escape'); await sleep(700); } };
    const held = () => page.evaluate(`JSON.stringify({ shade: document.querySelector('[data-mat-held]')?.dataset.matHeld, dimmed: document.querySelectorAll('.gi-token-held').length, region: window.Game.Atlas.activeRegion()?.practicalName, enemies: (window.Game.GameState.state.board.arrival?.ids || []).filter(id => window.Game.BoardState.getTokenById(id)).length, cleared: window.Game.GameState.state.board.arrival?.cleared ?? null })`);
    const ground = () => page.evaluate(`(() => { const t = window.Game.Atlas.activeRegion()?.terrain; if (!t) return 'no ground'; const i = t.legend.indexOf('stone'); const stone = i < 0 ? 0 : [...t.cells].filter(c => parseInt(c, 36) === i).length; return JSON.stringify({ legend: t.legend, stoneCells: stone, outcrops: t.stone?.shapes?.length || 0 }); })()`);
    const tokens = () => page.evaluate(`(() => { const m = {}; for (const t of window.Game.BoardState.tokens()) m[t.typeId] = (m[t.typeId] || 0) + 1; return JSON.stringify(m); })()`);

    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(6000);
    console.log('hero:', await page.evaluate(`JSON.stringify(window.Game.GuildUpgradeManager.purchase('roster_size'))`));

    // 1. The tutorial's end: the cartographer opens the world map with "Settle your first place".
    console.log('tutorial jump:', await qa('[data-qa-world-tutorial]'));
    await closeQa();
    await sleep(1200);
    console.log('atlas opened by the step:', await atlasOpen(), await page.evaluate(`JSON.stringify(window.Game.QuestManager.getActiveQuests().filter(q => q.tutorial).map(q => q.id + ': ' + q.title))`));
    await away();
    await shot('w3_01_tutorial_world_map.png');
    await closeAtlas();

    // 2. A Highland place: the mat arrives darkened, its enemies bright in their lair.
    console.log('highland:', await qa('[data-qa-world-fixture="highland"]'));
    await closeQa();
    await sleep(1500);
    console.log('held:', await held(), 'ground:', await ground());
    console.log('tokens:', await tokens());
    const refusal = await page.evaluate(`(() => { const hero = window.Game.HeroManager.getAllHeroes()[0]; const node = window.Game.BoardState.tokens().find(t => t.fixture); const enemy = window.Game.BoardState.getTokenById(window.Game.GameState.state.board.arrival.ids[0]); return JSON.stringify({ node: node.typeId, nodeRefused: window.Game.Flags.orderToken(hero.id, node), enemyRefused: window.Game.Flags.orderToken(hero.id, enemy).success }); })()`);
    console.log('orders while held:', refusal);
    await page.evaluate(`window.Game.Flags.sendHome(window.Game.HeroManager.getAllHeroes()[0].id)`);
    await away();
    await shot('w3_02_highland_arrival_dark.png');

    // 3. Beaten: the mat brightens; its Stone outcrops show.
    console.log('beat:', await qa('[data-qa-world-beat]'));
    await closeQa();
    await sleep(2500);
    console.log('after:', await held());
    await away();
    await shot('w3_03_highland_cleared_stone.png');

    // 4. A Woodland place (Stone on dark forest ground) and a Riverside one (the sea), both beaten.
    console.log('woodland:', await qa('[data-qa-world-fixture="woodland"]'));
    await qa('[data-qa-world-beat]');
    await closeQa();
    await sleep(2500);
    console.log('woodland ground:', await ground(), await tokens());
    await away();
    await shot('w3_04_woodland_stone.png');
    console.log('riverside:', await qa('[data-qa-world-fixture="riverside"]'));
    await qa('[data-qa-world-beat]');
    await closeQa();
    await sleep(2500);
    console.log('riverside ground:', await ground(), await tokens());
    await away();
    await shot('w3_05_riverside_mat.png');

    // 5. Back home, a frontier place settled through the world map: paid, travelled, darkened,
    // and the tutorial's last step done.
    await page.evaluate(`window.Game.Atlas.travel(window.Game.Atlas.list().find(r => r.kind === 'starter').id)`);
    await sleep(1500);
    await qa('[data-qa-world-meet]');
    await closeQa();
    const target = await page.evaluate(`(() => { const w = window.Game.World; const s = w.cellStatesNow(); return w.currentWorld().cells.find(c => s.get(c.id) === 'frontier').id; })()`);
    console.log('settle', target, JSON.stringify(await page.evaluate(`JSON.stringify(window.Game.World.settleCell('${target}').arrival)`)));
    await sleep(1500);
    console.log('held:', await held(), 'ground:', await ground());
    console.log('tokens:', await tokens());
    console.log('last step:', await page.evaluate(`JSON.stringify(window.Game.QuestManager.getActiveQuests().filter(q => q.tutorial).map(q => [q.id, q.currentCount, q.requiredCount]))`));
    await away();
    await shot('w3_06_settled_place_arrival.png');

    // 6. A hero sent at one enemy fights the lair through: each fallen one hands them the next.
    const fight = await page.evaluate(`(() => {
        const G = window.Game;
        const hero = G.HeroManager.getAllHeroes()[0];
        // A hero fit for the fight, as the tutorial has the player do: fed (food in hand), and lent
        // a melee level, so the walk-through does not hang on the rolls.
        G.SkillSystem.addXP(hero.id, 'melee', 2000000);
        G.InventoryManager.addItem('item_steak', 20);
        G.EquipmentManager.equipItem(hero.id, 'item_steak');
        const ids = G.GameState.state.board.arrival.ids;
        const first = G.BoardState.getTokenById(ids[0]);
        const sent = G.Flags.orderToken(hero.id, first).success;
        const log = [];
        for (let i = 0; i < 6000 && !G.GameState.state.board.arrival.cleared; i++) {
            G.GameLoop.runHandlers(100);
            const pin = G.BoardState.flagOf(hero.id)?.pinnedTo;
            if (log[log.length - 1] !== pin) log.push(pin);
        }
        return JSON.stringify({ sent, standing: ids.filter(id => G.BoardState.getTokenById(id)).length, cleared: G.GameState.state.board.arrival.cleared, pins: log, status: G.HeroManager.getAllHeroes()[0].status });
    })()`);
    console.log('fight:', fight);
    await sleep(2500);
    console.log('after the fight:', await held());
    await away();
    await shot('w3_07_settled_place_cleared.png');
} finally {
    await chrome.close();
}
