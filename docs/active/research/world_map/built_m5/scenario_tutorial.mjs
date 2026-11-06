// The tutorial's first settle with the ceremony: its last step is done once a place is settled.
export async function run({ page, ev, say, sleep, shot }) {
    await ev(`[...document.querySelectorAll('button')].find(b => /new game/i.test(b.textContent)).click()`);
    await page.waitFor('!!window.Game.World.currentWorld()', { timeoutMs: 60000, what: 'a world' });
    await sleep(2500);
    // A hero, as the tutorial's first step brings one; the price asks for a skill level.
    await ev(`(async () => {
        const { generateHero } = await import('/src/systems/hero/HeroGenerator.js');
        window.GameState.state.progress.rosterLimit = Math.max(2, window.GameState.state.progress.rosterLimit || 0);
        while (window.Game.HeroManager.getAllHeroes().length < 2) window.Game.HeroManager.addHero(generateHero());
    })()`);
    await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'QA')?.click()`);
    await sleep(600);
    await ev(`document.querySelector('[data-qa-world-tutorial]').click()`);
    await sleep(300);
    await ev(`document.querySelector('[data-qa-world-meet]').click()`);
    await sleep(300);
    const step = `(async () => { const QT = await import('/src/systems/quests/QuestTokens.js'); return QT.tutorialTokens().map(t => ({ id: t.quest.id, done: !!t.quest.done, progress: t.quest.progress ?? null })); })()`;
    say('tutorial step before', await ev(step));
    const cell = await ev(`window.Game.World.currentWorld().cells.find(c => c.ring === 1).id`);
    const r = await ev(`(() => { const r = window.Game.World.settleCell(${JSON.stringify(cell)}); return { success: r.success, reason: r.reason || null, walkIn: r.walkIn?.length, enemies: r.arrival?.ids?.length }; })()`);
    say('settled', cell, r);
    await sleep(1500);
    say('tutorial step after', await ev(step), 'title', await ev(`document.querySelector('[data-settle-title] [data-arrival-name]')?.textContent || null`));
    await shot('T1_tutorial_first_settle', true);
}
