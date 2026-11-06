// A new game; the tutorial jumped to its world-map step; the pack's ring stars put in the sky by the
// QA button; a ring-1 place settled as the tutorial does; a ring-2 cell locked and saying why; the
// star in the Hall's sky, bought there; the ring-2 cell ready and settled.
export async function run({ page, ev, shot, say, sleep }) {
    const centre = async (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
    const clickSel = async (sel) => {
        const c = await centre(sel);
        if (!c) throw new Error(`no ${sel}`);
        await page.click(Math.round(c.x), Math.round(c.y));
        await sleep(400);
        return c;
    };
    const domClick = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const text = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);

    // A new game in slot 1, from the title screen.
    await ev(`[...document.querySelectorAll('button')].find(b => /new game/i.test(b.textContent)).click()`);
    await page.waitFor('!!window.Game.World.currentWorld()', { timeoutMs: 60000, what: 'a world' });
    await sleep(2500);
    let heroes = await ev('window.Game.HeroManager.getAllHeroes().length');
    if (!heroes) {
        say('no hero at start; buying the first Bunk Beds rank (free)', await ev(`window.Game.GuildUpgradeManager.purchase('roster_size')`));
        heroes = await ev('window.Game.HeroManager.getAllHeroes().length');
    }
    say('heroes', heroes, 'ring stars in the sky before QA', await ev(`window.Game.World.ringLockOf(window.Game.World.currentWorld().cells.find(c => c.ring === 2))`));

    // The QA panel: tutorial to its world-map step, the ring stars in the sky, the frontier's prices met.
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA').click()`);
    await sleep(800);
    for (const [sel, what] of [['[data-qa-world-tutorial]', 'tutorial'], ['[data-qa-world-ring-stars]', 'ring stars'], ['[data-qa-world-meet]', 'meet']]) {
        say(what, await domClick(sel), await text('[data-qa-world-said]'));
        await sleep(300);
    }
    await shot('01_qa_panel');
    await ev(`(() => { const x = document.querySelector('[data-testid="qa-panel"] [data-close-x], [data-testid="qa-panel"] button'); x && x.click(); })()`);
    await sleep(500);

    // The world map: the tutorial's last step opens it; else the Atlas bubble.
    await sleep(1500);
    if (!(await ev(`!!document.querySelector('[data-world-cell]')`))) await clickSel('#atlas-bubble-target');
    else say('the tutorial step opened the world map itself');
    await page.waitFor(`!!document.querySelector('[data-world-cell]')`, { timeoutMs: 20000, what: 'the world map' });
    await sleep(1500);
    const world = await ev(`(() => { const w = window.Game.World.currentWorld(); const st = window.Game.World.cellStatesNow(); return w.cells.filter(c => c.ring <= 2).map(c => ({ id: c.id, ring: c.ring, state: st.get(c.id) })); })()`);
    const ringOne = world.filter(c => c.ring === 1);
    say('note', await text('[data-world-note]'));
    say('cells drawn', await ev(`[...document.querySelectorAll('[data-world-cell]')].map(e => e.getAttribute('data-world-cell') + ':' + e.getAttribute('data-world-look')).slice(0, 20)`), 'ring1', ringOne.map(c => c.id));
    await shot('01b_world_open');
    // The tutorial's first settle: a ring-1 place, no star asked.
    const first = ringOne[0].id;
    await clickSel(`[data-world-cell="${first}"]`);
    say('ring-1 panel lock line', await text('[data-world-detail-lock]'), 'settle disabled', await ev(`document.querySelector('[data-world-settle]')?.disabled`), 'locked attr', await ev(`document.querySelector('[data-world-settle]')?.getAttribute('data-world-settle-locked')`));
    await shot('02_ring1_ready', true);
    await clickSel(`[data-world-settle="${first}"] button, [data-world-settle="${first}"]`);
    await sleep(2500);
    say('after first settle: active cell', await ev('window.Game.World.activeCellId()'), 'tutorial step', await ev('window.Game.QuestManager.getTutorialStep?.()'), 'completed', await ev('window.GameState.state.quests.completedTutorials'));

    // Back to the map: a ring-2 cell beside it is locked behind the ring star.
    await ev(`window.Game.World && 0`);
    await clickSel('#atlas-bubble-target');
    await page.waitFor(`!!document.querySelector('[data-world-cell]')`, { timeoutMs: 20000 });
    await sleep(1500);
    // Meet the new frontier's prices too, so the only thing missing is the star.
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA')?.click()`);
    await sleep(500);
    say('meet again', await domClick('[data-qa-world-meet]'), await text('[data-qa-world-said]'));
    await ev(`(() => { const x = document.querySelector('[data-testid="qa-panel"] [data-close-x], [data-testid="qa-panel"] button'); x && x.click(); })()`);
    await sleep(800);
    const two = await ev(`(() => { const st = window.Game.World.cellStatesNow(); const w = window.Game.World.currentWorld(); return w.cells.filter(c => c.ring === 2 && st.get(c.id) === 'frontier').map(c => c.id); })()`);
    say('ring-2 frontier', two);
    const target = two[0];
    const look = () => ev(`document.querySelector('[data-world-cell="${target}"]')?.getAttribute('data-world-look')`);
    say('ring-2 look before the star', await look(), 'price met', await ev(`window.Game.World.priceOf(window.Game.World.currentWorld().cells.find(c => c.id === ${JSON.stringify(target)})).met`));
    // Hover: the tip says why.
    const c2 = await centre(`[data-world-cell="${target}"]`);
    await page.mouse('mouseMoved', Math.round(c2.x), Math.round(c2.y));
    await sleep(900);
    say('tip lock', await text('[data-world-tip-lock]'));
    await shot('03_ring2_locked_tip', true);
    await page.mouse('mouseMoved', 5, 5);
    await sleep(300);
    await clickSel(`[data-world-cell="${target}"]`);
    say('panel message', await text('[data-world-message]'), 'settle disabled', await ev(`document.querySelector('[data-world-settle="${target}"] button, button[data-world-settle="${target}"]')?.disabled ?? document.querySelector('[data-world-settle]')?.querySelector('button')?.disabled`), 'locked attr', await ev(`document.querySelector('[data-world-settle]')?.getAttribute('data-world-settle-locked')`));
    await shot('04_ring2_locked_panel', true);
    say('settle refused', await ev(`window.Game.World.settleCell(${JSON.stringify(target)})`));

    // The Guild Hall: the ring stars in the sky.
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(1200);
    await clickSel('#guild-bubble-target');
    await page.waitFor(`!!document.querySelector('[data-hall-node="star_ring_2"]')`, { timeoutMs: 20000, what: 'the ring star in the sky' });
    await sleep(1500);
    say('ring star states', await ev(`[...document.querySelectorAll('[data-hall-node^="star_ring_"]')].map(b => [b.getAttribute('data-hall-node'), b.getAttribute('data-node-state'), b.getAttribute('data-upgrade-available')])`));
    // Every title, star and constellation name in the sky, checked for touching.
    const overlaps = await ev(`(() => {
        const boxes = [];
        for (const b of document.querySelectorAll('[data-hall-node]')) { const r = b.querySelector('img').getBoundingClientRect(); boxes.push({ what: 'star ' + b.getAttribute('data-hall-node'), r }); }
        for (const t of document.querySelectorAll('[data-star-tag] > span')) { const r = t.getBoundingClientRect(); boxes.push({ what: 'title ' + t.firstChild.textContent, r }); }
        for (const l of document.querySelectorAll('[data-constellation-label], [data-constellation]')) { const r = l.getBoundingClientRect(); if (r.width) boxes.push({ what: 'name ' + l.textContent, r }); }
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const out = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].r, boxes[j].r) && !(boxes[i].what.startsWith('star') && boxes[j].what.startsWith('title') && boxes[i].what.slice(5) === boxes[j].what.slice(6))) out.push(boxes[i].what + ' x ' + boxes[j].what);
        return { boxes: boxes.length, overlaps: out };
    })()`);
    say('sky boxes', overlaps.boxes, 'touching', overlaps.overlaps);
    const ring = await ev(`(() => { const out = {}; for (const id of ['star_ring_2','star_ring_3','star_ring_6']) { const b = document.querySelector('[data-hall-node="' + id + '"]'); const r = b.getBoundingClientRect(); out[id] = { x: Math.round(r.left), y: Math.round(r.top) }; } return out; })()`);
    say('ring stars on screen', ring);
    await shot('05_hall_sky_full', true);
    // Drag the sky so the Compass sits in the middle of the view, if it is off screen.
    await clickSel('[data-hall-node="star_ring_2"]');
    await sleep(800);
    say('sheet sentence', await text('[data-star-sentence]'), 'now', await text('[data-star-now]'), 'next', await text('[data-star-next]'));
    await shot('06_hall_ring_star_sheet', true);
    const up = await centre('#guild-upgrade-button button, #guild-upgrade-button');
    say('upgrade button', up, 'disabled', await ev(`(document.querySelector('#guild-upgrade-button button') || document.querySelector('#guild-upgrade-button'))?.disabled`));
    await clickSel('#guild-upgrade-button button, #guild-upgrade-button');
    await sleep(1000);
    say('rank after buying', await ev(`window.Game.GuildUpgradeManager.getRank('star_ring_2')`));
    await shot('07_hall_ring_star_bought', true);

    // Back to the map: the ring-2 cell is ready, and settles.
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(1200);
    await clickSel('#atlas-bubble-target');
    await page.waitFor(`!!document.querySelector('[data-world-cell]')`, { timeoutMs: 20000 });
    await sleep(1500);
    say('ring-2 look after the star', await look());
    await clickSel(`[data-world-cell="${target}"]`);
    say('panel message after', await text('[data-world-message]'), 'lock line', await text('[data-world-detail-lock]'));
    await shot('08_ring2_open_panel', true);
    await clickSel(`[data-world-settle="${target}"] button, [data-world-settle="${target}"]`);
    await sleep(2500);
    say('after ring-2 settle: active cell', await ev('window.Game.World.activeCellId()'), 'wanted', target);
}
