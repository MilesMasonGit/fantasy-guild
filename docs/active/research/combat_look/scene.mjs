// The running game at 1920 x 1080 with a crowd of real fights, made in the page through the dev
// server's own modules: nothing under src/ or data/ changes, and it is gone on reload.
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

export const W = 1920;
export const H = 1080;

export const FIGHTS = [
    { name: 'Kira', token: 'token_goblin', dx: -210, dy: 164, level: 14, elixirs: true },
    { name: 'Aela', token: 'token_wolf', dx: 92, dy: 139, level: 11 },
    { name: 'Bram', token: 'token_goblin_chief', dx: -105, dy: 304, level: 22, elixirs: true },
    { name: 'Neve', token: 'token_greater_slime', dx: 235, dy: 284, level: 18 },
    { name: 'Tomas', token: 'token_cow', dx: -400, dy: 299, level: 6 }
];

export async function openGame(url) {
    const chrome = await launchChrome({ width: W, height: H });
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(3000);
    return { chrome, page };
}

export const setUpCrowd = (page, fights = FIGHTS) => page.evaluate(`(async () => {
    const dev = await import('/src/ui/dev/combatScreenDev.js');
    const HM = await import('/src/systems/hero/HeroManager.js');
    const EM = await import('/src/systems/equipment/EquipmentManager.js');
    const { InventoryManager } = await import('/src/systems/inventory/InventoryManager.js');
    const { GuildUpgradeManager } = await import('/src/systems/progression/GuildUpgradeManager.js');
    const { qaOrder } = await import('/src/ui/dev/qaOrders.js');
    const { getItem } = await import('/src/config/registries/itemRegistry.js');
    const { EventBus } = await import('/src/systems/core/EventBus.js');
    const { ENGINE_EVENTS } = await import('/src/systems/core/engineEvents.js');
    const fights = ${JSON.stringify(fights)};
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = (HM.getAllHeroes() || []).length + fights.length + 2;
    GuildUpgradeManager.recompute();
    InventoryManager.addItem('item_elixir_of_valor', 30);
    InventoryManager.addItem('item_elixir_of_ironskin', 30);
    const out = [];
    for (const f of fights) {
        const enemy = dev.placeBesideHall(f.token, f.dx, f.dy);
        const hero = dev.fighterAt(f.level, f.name);
        if (!enemy || !HM.addHero(hero)) { out.push(f.name + ': not placed'); continue; }
        if (f.elixirs) for (const id of ['item_elixir_of_valor', 'item_elixir_of_ironskin']) if (getItem(id)) EM.equipItem(hero.id, id);
        qaOrder(hero.id, { x: enemy.x, y: enemy.y });
        out.push(f.name + ' on ' + f.token + ' ' + enemy.id);
    }
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'combat_look_mockups' });
    return out;
})()`);

/** Every live fight's boxes on the screen, for overlays placed on the real picture. */
export const readFights = (page) => page.evaluate(`(async () => {
    const { getEnemyProfile } = await import('/src/config/registries/enemyProfile.js');
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    return [...document.querySelectorAll('[data-fight]')].map(f => {
        const id = f.getAttribute('data-fight');
        const heroId = f.querySelector('[data-fight-chip]')?.getAttribute('data-fight-chip');
        const hero = (window.GameState?.state?.heroes || []).find(h => h.id === heroId);
        return {
            id, heroId, heroName: hero?.name, heroMax: hero?.hp?.max,
            enemyMax: getEnemyProfile(window.Game?.BoardState?.tokens?.().find(t => t.id === id)?.typeId)?.hp,
            enemy: box(document.querySelector('[data-token-art="true"][data-token-id="' + id + '"]')),
            hero: box(document.querySelector('[data-board-hero="' + heroId + '"]')),
            enemyBar: box(document.querySelector('[data-health-bar="enemy"][data-health-of="' + id + '"]')),
            heroBar: box(document.querySelector('[data-health-bar="hero"][data-health-of="' + heroId + '"]')),
            enemyText: document.querySelector('[data-health-bar="enemy"][data-health-of="' + id + '"]')?.textContent,
            heroText: document.querySelector('[data-health-bar="hero"][data-health-of="' + heroId + '"]')?.textContent,
            plate: box(f.querySelector('[data-fight-plate]')),
            chip: box(f.querySelector('[data-fight-chip]'))
        };
    });
})()`);
