// A new game with three heroes; the tutorial jumped to its world-map step; a ring-1 place settled
// from the world map as the tutorial does: the banner, the title, the heroes walking in, framed as
// they come; the enemies spread and still; a hero dragged onto one starts the fight; travel to the
// Starter Camp and back with no ceremony; two more settles, one skipped by a key, one by a click.
export async function run({ page, ev, shot, say, sleep }) {
    const centre = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom }; })()`);
    const clickSel = async (sel, wait = 400) => {
        const c = await centre(sel);
        if (!c) throw new Error(`no ${sel}`);
        await page.click(Math.round(c.x), Math.round(c.y));
        await sleep(wait);
        return c;
    };
    const domClick = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const text = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent : null; })()`);
    const mods = `const HM = await import('/src/systems/board/HeroMotion.js'); const OC = await import('/src/systems/board/Occupation.js'); const BC = await import('/src/systems/board/BoardCombat.js'); const BS = await import('/src/systems/board/BoardState.js');`;
    /** What the screen and the engine say right now. */
    const read = () => ev(`(async () => { ${mods}
        const band = document.querySelector('[data-settle-title]');
        const heroes = window.Game.HeroManager.getAllHeroes().map(h => { const b = HM.bodyView(h.id); return { id: h.id.slice(-4), at: b ? [Math.round(b.x), Math.round(b.y)] : null, moving: b?.moving || false, home: b?.home || false, waiting: HM.isWaitingToWalkIn(h.id), fight: !!BC.fightOfHero(h.id) }; });
        const hall = BS.tokens().find(t => t.typeId === 'token_guild_hall');
        return {
            banner: !!document.querySelector('[data-banner="settled"]'),
            title: band ? { name: band.querySelector('[data-arrival-name]')?.textContent, terrain: band.querySelector('[data-settle-terrain]')?.textContent, clip: band.style.clipPath, closing: band.getAttribute('data-settle-closing') } : null,
            plainCard: !!document.querySelector('[data-arrival-card]:not([data-settle-title])'),
            hall: hall ? [hall.x, hall.y] : null,
            heroes,
            enemies: OC.standingEnemies().map(e => [e.id.split('_').pop(), e.typeId.replace('token_', ''), Math.round(e.x), Math.round(e.y)]),
            occupied: OC.isOccupied(),
            matHeld: document.querySelector('[data-mat-held]')?.getAttribute('data-mat-held') || null
        };
    })()`);
    const closeQa = () => ev(`(() => { const x = document.querySelector('[data-testid="qa-panel"] [data-close-x], [data-testid="qa-panel"] button'); x && x.click(); })()`);
    const openQa = async () => { await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA')?.click()`); await sleep(600); };
    const openMap = async () => {
        await clickSel('#atlas-bubble-target', 300);
        await page.waitFor(`!!document.querySelector('[data-world-cell]')`, { timeoutMs: 20000, what: 'the world map' });
        await sleep(1200);
    };
    /** Press Settle on `cellId` and frame the ceremony at the given moments (ms after the press). */
    const settleAndFrame = async (cellId, frames) => {
        // The banners for the heroes this script added: a player would have clicked them away.
        await ev(`(async () => { (await import('/src/systems/notifications/banners.js')).reset(); })()`);
        let btn = null;
        for (let tries = 0; tries < 5 && !btn; tries++) {
            await clickSel(`[data-world-cell="${cellId}"]`, 700);
            btn = await centre(`[data-world-settle="${cellId}"] button, [data-world-settle="${cellId}"]`);
        }
        if (!btn) throw new Error(`no Settle for ${cellId}: ${await text('[data-world-message]')}`);
        const t0 = Date.now();
        await page.click(Math.round(btn.x), Math.round(btn.y));
        for (const [ms, name, keep] of frames) {
            const wait = ms - (Date.now() - t0);
            if (wait > 0) await sleep(wait);
            const at = Date.now() - t0;
            if (name) await shot(name, keep);
            say(`+${at} ms (shot taken from then)`, name, JSON.stringify(await read()));
        }
    };

    // A new game in slot 1, from the title screen.
    await ev(`[...document.querySelectorAll('button')].find(b => /new game/i.test(b.textContent)).click()`);
    await page.waitFor('!!window.Game.World.currentWorld()', { timeoutMs: 60000, what: 'a world' });
    await sleep(2500);
    // Three heroes, so the walk in is a line (a player has them by the tutorial's end).
    const heroes = await ev(`(async () => {
        const { generateHero } = await import('/src/systems/hero/HeroGenerator.js');
        window.GameState.state.progress.rosterLimit = Math.max(3, window.GameState.state.progress.rosterLimit || 0);
        while (window.Game.HeroManager.getAllHeroes().length < 3) window.Game.HeroManager.addHero(generateHero());
        return window.Game.HeroManager.getAllHeroes().map(h => h.name);
    })()`);
    say('heroes', heroes);

    await openQa();
    for (const [sel, what] of [['[data-qa-world-tutorial]', 'tutorial'], ['[data-qa-world-meet]', 'meet']]) {
        say(what, await domClick(sel), await text('[data-qa-world-said]'));
        await sleep(300);
    }
    await closeQa();
    await sleep(1500);
    if (!(await ev(`!!document.querySelector('[data-world-cell]')`))) await openMap();
    else say('the tutorial step opened the world map itself');
    await page.waitFor(`!!document.querySelector('[data-world-cell]')`, { timeoutMs: 20000 });
    await sleep(1500);
    const ringOne = await ev(`window.Game.World.currentWorld().cells.filter(c => c.ring === 1).map(c => c.id)`);
    say('ring 1', ringOne, 'tutorial done before', await ev('window.GameState.state.quests.completedTutorials.length'));

    // 1. The tutorial's first settle, framed.
    await settleAndFrame(ringOne[0], [
        [250, '01_settle_pressed', true],
        [880, '02_title_opening', true],
        [1500, '03_title', true],
        [2400, '04_title_heroes_walk_in', true],
        [3700, '05_heroes_walking', true],
        [7000, '06_heroes_home_enemies_spread', true]
    ]);
    say('tutorial completed after', await ev('window.GameState.state.quests.completedTutorials'), 'active cell', await ev('window.Game.World.activeCellId()'));

    // 2. Still until attacked: a game minute run on top of the live loop, nobody sent.
    const before = await read();
    await ev(`(() => { for (let i = 0; i < 600; i++) window.Game.GameLoop.runHandlers(100); })()`);
    await sleep(500);
    const after = await read();
    say('a minute later: enemies unmoved', JSON.stringify(before.enemies) === JSON.stringify(after.enemies), 'fights', after.heroes.filter(h => h.fight).length, 'home', after.heroes.filter(h => h.home).length, 'occupied', after.occupied);
    await shot('07_a_minute_later_still', true);

    // 3. The player drags a hero onto the farthest enemy: the fight starts then.
    const target = await ev(`(async () => { ${mods}
        const hall = BS.tokens().find(t => t.typeId === 'token_guild_hall');
        const far = OC.standingEnemies().sort((a, b) => Math.hypot(b.x - hall.x, b.y - hall.y) - Math.hypot(a.x - hall.x, a.y - hall.y))[0];
        const el = document.querySelector('[data-token-id="' + far.id + '"]');
        const r = el.getBoundingClientRect();
        const hero = window.Game.HeroManager.getAllHeroes()[0];
        const h = document.querySelector('[data-board-hero="' + hero.id + '"]').getBoundingClientRect();
        return { id: far.id, to: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, from: { x: h.left + h.width / 2, y: h.top + h.height * 0.4 }, hero: hero.id };
    })()`);
    say('drag', target);
    await page.mouse('mouseMoved', Math.round(target.from.x), Math.round(target.from.y));
    await page.mouse('mousePressed', Math.round(target.from.x), Math.round(target.from.y), { buttons: 1, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 10; i++) {
        const x = target.from.x + (target.to.x - target.from.x) * i / 10;
        const y = target.from.y + (target.to.y - target.from.y) * i / 10;
        await page.mouse('mouseMoved', Math.round(x), Math.round(y), { buttons: 1, button: 'left' });
        await sleep(40);
    }
    await sleep(150);
    await page.mouse('mouseReleased', Math.round(target.to.x), Math.round(target.to.y), { buttons: 0, button: 'left', clickCount: 1 });
    await sleep(300);
    say('order', await ev(`(async () => { const BS = await import('/src/systems/board/BoardState.js'); return BS.flagOf(${JSON.stringify(target.hero)}); })()`));
    await page.waitFor(`(async () => { const BC = await import('/src/systems/board/BoardCombat.js'); return !!BC.fightOfHero(${JSON.stringify(target.hero)}); })()`, { timeoutMs: 30000, what: 'the fight' }).catch(e => say('no fight yet', e.message));
    say('fight', await ev(`(async () => { const BC = await import('/src/systems/board/BoardCombat.js'); return BC.fightOfHero(${JSON.stringify(target.hero)})?.instanceId || null; })()`), 'wanted', target.id);
    await shot('08_sent_hero_fights', true);

    // 4. Travel to the Starter Camp and back: the plain arrival card, no title, no walk in.
    await openMap();
    await clickSel('[data-world-cell="0,0"]', 500);
    const t1 = Date.now();
    await clickSel('[data-world-travel]', 0);
    await sleep(Math.max(0, 600 - (Date.now() - t1)));
    await shot('09_travel_home_plain_card', true);
    for (const ms of [900, 1400]) {
        await sleep(Math.max(0, ms - (Date.now() - t1)));
        say(`travel home +${Date.now() - t1} ms`, JSON.stringify(await read()));
    }
    await sleep(2000);
    await openMap();
    await clickSel(`[data-world-cell="${ringOne[0]}"]`, 500);
    const t2 = Date.now();
    await clickSel('[data-world-travel]', 0);
    await sleep(Math.max(0, 600 - (Date.now() - t2)));
    await shot('10_travel_back_plain_card', true);
    for (const ms of [900, 2000]) {
        await sleep(Math.max(0, ms - (Date.now() - t2)));
        say(`travel back +${Date.now() - t2} ms`, JSON.stringify(await read()));
    }
    await sleep(1500);

    // 5. Skipped: one settle by a key, one by a click.
    await openQa();
    say('meet', await domClick('[data-qa-world-meet]'), await text('[data-qa-world-said]'));
    await closeQa();
    await sleep(500);
    await openMap();
    const frontier = await ev(`(() => { const st = window.Game.World.cellStatesNow(); return window.Game.World.currentWorld().cells.filter(c => c.ring === 1 && st.get(c.id) === 'frontier').map(c => c.id); })()`);
    say('frontier ring 1', frontier);
    await settleAndFrame(frontier[0], [[1200, null]]);
    await page.key(' ', 'Space', 32);
    await sleep(150);
    say('after a key', JSON.stringify(await read()));
    await shot('11_skipped_by_key', true);
    await sleep(6000);
    say('six seconds after the skip', JSON.stringify(await read()));
    await shot('12_after_skip_heroes_home_mat_held', true);
    await openQa();
    say('meet', await domClick('[data-qa-world-meet]'), await text('[data-qa-world-said]'));
    await closeQa();
    await sleep(500);
    await openMap();
    const next = await ev(`(() => { const st = window.Game.World.cellStatesNow(); return window.Game.World.currentWorld().cells.filter(c => st.get(c.id) === 'frontier' && !window.Game.World.ringLockOf(c) && window.Game.World.priceOf(c).met).map(c => c.id); })()`);
    say('settleable', next);
    await settleAndFrame(next[0], [[1200, null]]);
    const band = await centre('[data-settle-title]');
    say('band on screen', band);
    if (band) await page.click(Math.round(band.x), Math.round(band.y));
    await sleep(150);
    say('after a click', JSON.stringify(await read()));
}
