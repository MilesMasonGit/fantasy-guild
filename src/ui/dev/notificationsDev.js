// The QA panel's notification checks: real game paths where they cost nothing, display-only
// banners where the real path would cost the save something (a knock-out loses gear).
// ⚠️ DEV BUILDS ONLY.

import { GameState } from '../../state/GameState.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ROUTES } from '../../systems/notifications/routing.js';
import * as Banners from '../../systems/notifications/banners.js';
import { othersBestLevel } from '../../systems/notifications/recipeUnlocks.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';

const heroes = () => (GameState.heroes || []).filter(h => h && !h.isVillager);
const route = (event) => ROUTES.find(r => r.event === event);

/** Items the Bank holds, most first. */
function heldItems() {
    const items = GameState.state?.inventory?.items || {};
    return Object.entries(items)
        .map(([itemId, e]) => ({ itemId, quantity: e?.quantity ?? 0 }))
        .filter(e => e.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity);
}

let flowTimer = null;

/**
 * A busy minute: every half second a few items come in, and the most-held item is spent faster
 * than it arrives, as a station eating it would. Real Bank changes, so the stubs see the real flow.
 * @returns {string} what it does, for the panel
 */
export function startLootFlow(seconds = 60) {
    stopLootFlow();
    const held = heldItems();
    if (!held.length) return 'The Bank is empty: give an item first';
    const spent = held[0].itemId;
    const gained = held.slice(1, 5).map(e => e.itemId);
    if (!gained.length) gained.push(spent);
    const end = Date.now() + seconds * 1000;
    flowTimer = setInterval(() => {
        if (Date.now() > end) { stopLootFlow(); return; }
        for (const itemId of gained) if (itemId !== spent) InventoryManager.addItem(itemId, 1 + Math.floor(Math.random() * 3));
        InventoryManager.addItem(spent, 1);
        if (InventoryManager.getItemCount(spent) >= 3) InventoryManager.removeItem(spent, 3);
    }, 500);
    return `For ${seconds} s: ${gained.length} items in, ${spent} spent faster than it comes`;
}

export function stopLootFlow() {
    if (flowTimer) clearInterval(flowTimer);
    flowTimer = null;
}

/** One of an item never found before, through the Bank: its stub is gold, led by "New!". */
export function findNewItem() {
    const found = GameState.state?.collection?.discoveredItems || {};
    const item = getAllItems().find(i => i?.id && !found[i.id] && !i.id.includes('coin'));
    if (!item) return 'Every item has been found already';
    const added = InventoryManager.addItem(item.id, 1);
    return added ? `Found ${item.name}` : `The Bank had no room for ${item.name}`;
}

/**
 * Level a hero up to the next level that unlocks recipes nobody in the guild can run yet, through
 * the real XP path: the level-up moment plays on the hero and one grouped banner drops.
 */
export function levelUpForRecipes() {
    const recipes = listRecipes();
    let best = null;
    for (const hero of heroes()) {
        for (const [skillId, skill] of Object.entries(hero.skills || {})) {
            const floor = Math.max(skill.level, othersBestLevel(GameState.heroes, hero.id, skillId));
            const next = recipes
                .filter(r => r.skill === skillId && typeof r.levelRequirement === 'number' && r.levelRequirement > floor)
                .map(r => r.levelRequirement)
                .sort((a, b) => a - b)[0];
            if (!next || next > 99) continue;
            const count = recipes.filter(r => r.skill === skillId && r.levelRequirement === next).length;
            if (!best || count > best.count || (count === best.count && next < best.level)) {
                best = { hero, skillId, level: next, count };
            }
        }
    }
    if (!best) return 'No hero has a recipe left to unlock';
    const skill = best.hero.skills[best.skillId];
    SkillSystem.addXP(best.hero.id, best.skillId, Math.max(1, xpForLevel(best.level) - skill.xp));
    return `${best.hero.name}: ${best.skillId} to ${best.level} (${best.count} recipe${best.count === 1 ? '' : 's'})`;
}

/** Display only: the banners a real event would raise, without the event's cost. */
const show = {
    upgrade: () => route(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED).handle({ upgradeId: 'bank_slots', rank: 2 }),
    hero: (h) => route(ENGINE_EVENTS.HERO_RECRUITED).handle({ heroId: h?.id, name: h?.name || 'Bram' }),
    promotion: (h) => route(ENGINE_EVENTS.HERO_PROMOTED).handle({ heroId: h?.id, heroName: h?.name || 'Aela', toJobName: 'Knight' }),
    knockout: (h) => route(BOARD_EVENTS.HERO_DEFEATED).handle({ heroId: h?.id, heroName: h?.name || 'Aela', lost: ['Copper Sword'] }),
    bankFull: () => route(ENGINE_EVENTS.BANK_FULL).handle({ itemId: heldItems()[0]?.itemId || 'item_oak_wood' })
};

/** Four milestones at once: three on screen and "+1". */
export function fourBanners() {
    const [a, b] = heroes();
    show.upgrade();
    show.hero(b || a);
    show.promotion(a);
    show.upgrade();
    return 'Three on screen, one waiting (+1)';
}

/** Three milestones on screen, one waiting, then a knock-out: it waits ahead of the milestone. */
export function knockoutWithWaiting() {
    const [a, b] = heroes();
    show.upgrade();
    show.hero(b || a);
    show.promotion(a);
    show.upgrade();
    show.knockout(a);
    return 'Click a banner: the red knock-out comes next, ahead of the waiting milestone';
}

export function knockoutNow() {
    show.knockout(heroes()[0]);
    return 'Knock-out banner (display only: no gear lost)';
}

export function bankFullNow() {
    show.bankFull();
    return 'Bank full banner (display only)';
}

export function clearBanners() {
    Banners.reset();
    return 'Banners cleared';
}
