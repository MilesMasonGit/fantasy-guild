// The QA panel's free settle (a Highland place off the map): the same ceremony. Run as
// `fixture_still` for reduced motion: the title is open from its first frame and never wipes.
export async function run({ page, ev, shot, say, sleep, stage }) {
    const still = stage.endsWith('_still');
    const domClick = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    const read = () => ev(`(async () => {
        const HM = await import('/src/systems/board/HeroMotion.js');
        const OC = await import('/src/systems/board/Occupation.js');
        const band = document.querySelector('[data-settle-title]');
        return {
            reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
            banner: !!document.querySelector('[data-banner="settled"]'),
            title: band ? { name: band.querySelector('[data-arrival-name]')?.textContent, terrain: band.querySelector('[data-settle-terrain]')?.textContent, clip: band.style.clipPath, closing: band.getAttribute('data-settle-closing') } : null,
            heroes: window.Game.HeroManager.getAllHeroes().map(h => { const b = HM.bodyView(h.id); return b ? [Math.round(b.x), Math.round(b.y), b.moving ? 'walking' : b.home ? 'home' : '-'] : (HM.isWaitingToWalkIn(h.id) ? 'waiting' : null); }),
            enemies: OC.standingEnemies().length
        };
    })()`);

    await ev(`[...document.querySelectorAll('button')].find(b => /new game/i.test(b.textContent)).click()`);
    await page.waitFor('!!window.Game.World.currentWorld()', { timeoutMs: 60000, what: 'a world' });
    await sleep(2500);
    await ev(`(async () => {
        const { generateHero } = await import('/src/systems/hero/HeroGenerator.js');
        window.GameState.state.progress.rosterLimit = Math.max(4, window.GameState.state.progress.rosterLimit || 0);
        while (window.Game.HeroManager.getAllHeroes().length < 4) window.Game.HeroManager.addHero(generateHero());
    })()`);
    // The banners for the heroes this script added: a player would have clicked them away.
    await ev(`(async () => { (await import('/src/systems/notifications/banners.js')).reset(); })()`);
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA')?.click()`);
    await sleep(600);
    const t0 = Date.now();
    say('fixture', await domClick('[data-qa-world-fixture="highland"]'));
    await ev(`(() => { const x = document.querySelector('[data-testid="qa-panel"] [data-close-x], [data-testid="qa-panel"] button'); x && x.click(); })()`);
    for (const [ms, name] of [[300, null], [880, still ? 'S1_still_title_first_frame' : 'F1_fixture_title_opening'], [1700, null], [3400, still ? 'S2_still_title_closing' : null], [6200, still ? null : 'F2_fixture_heroes_home']]) {
        const wait = ms - (Date.now() - t0);
        if (wait > 0) await sleep(wait);
        say(`+${Date.now() - t0} ms`, JSON.stringify(await read()));
        if (name) await shot(name, true);
    }
}
