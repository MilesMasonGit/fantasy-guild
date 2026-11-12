// The QA panel's notification checks: real game paths where they cost nothing, display-only
// banners where the real path would cost the save something (a knock-out loses gear).
// ⚠️ QA BUILDS ONLY.

import { GameState } from '../../state/GameState.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { listRecipes } from '../../config/registries/recipePoolRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { getAllTokenTypes } from '../../config/registries/tokenRegistry.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { ROUTES } from '../../systems/notifications/routing.js';
import * as Banners from '../../systems/notifications/banners.js';
import { othersBestLevel } from '../../systems/notifications/recipeUnlocks.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import * as CatchUp from '../../systems/core/CatchUp.js';
import { SaveManager } from '../../systems/core/SaveManager.js';
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
    const item = Object.values(getAllItems() || {}).find(i => i?.id && !found[i.id] && !i.id.includes('coin'));
    if (!item) return 'Every item has been found already';
    const added = InventoryManager.addItem(item.id, 1);
    return added ? `Found ${item.name}` : `The Bank had no room for ${item.name}`;
}

/**
 * Level a hero up, in one go, far enough to unlock three recipes nobody in the guild can run yet
 * (or as many as are left), through the real XP path: the level-up moment plays on the hero and
 * the unlocks drop as one grouped banner.
 */
export function levelUpForRecipes() {
    const recipes = listRecipes();
    let best = null;
    for (const hero of heroes()) {
        for (const [skillId, skill] of Object.entries(hero.skills || {})) {
            const floor = Math.max(skill.level, othersBestLevel(GameState.heroes, hero.id, skillId));
            const levels = recipes
                .filter(r => r.skill === skillId && typeof r.levelRequirement === 'number' && r.levelRequirement > floor && r.levelRequirement <= 99)
                .map(r => r.levelRequirement)
                .sort((a, b) => a - b);
            if (!levels.length) continue;
            const level = levels[Math.min(2, levels.length - 1)];
            const count = levels.filter(l => l <= level).length;
            if (!best || count > best.count || (count === best.count && level < best.level)) {
                best = { hero, skillId, level, count };
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
    upgrade: () => route(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED).handle({ upgradeId: 'bank_tabs', rank: 2 }),
    hero: (h) => route(ENGINE_EVENTS.HERO_RECRUITED).handle({ heroId: h?.id, name: h?.name || 'Bram' }),
    knockout: (h) => route(BOARD_EVENTS.HERO_DEFEATED).handle({ heroId: h?.id, heroName: h?.name || 'Aela', lost: ['Copper Sword'] }),
    bankFull: () => route(ENGINE_EVENTS.BANK_FULL).handle({ itemId: heldItems()[0]?.itemId || 'item_oak_wood' })
};

/** Four milestones at once: three on screen and "+1". */
export function fourBanners() {
    const [a, b] = heroes();
    show.upgrade();
    show.hero(b || a);
    show.hero(a);
    show.upgrade();
    return 'Three on screen, one waiting (+1)';
}

/** Three milestones on screen, one waiting, then a knock-out: it waits ahead of the milestone. */
export function knockoutWithWaiting() {
    const [a, b] = heroes();
    show.upgrade();
    show.hero(b || a);
    show.hero(a);
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

// --- Time away with news --------------------------------------------------------------------

/**
 * The news a time away can bring, made while it plays (the bus quiet, as in a real catch-up):
 * recipes unlocked and first finds through the real paths; a knock-out and the Bank refusing
 * items as their announcements only (display only: no gear lost, nothing put on the mat; the
 * knocked-out hero's flag is taken down and they walk home, as after a real one).
 */
function makeNews({ levelUps = 1, finds = 2, refused = 1, knockouts = 1 } = {}) {
    for (let i = 0; i < levelUps; i++) levelUpForRecipes();
    for (let i = 0; i < finds; i++) findNewItem();
    for (const { itemId } of heldItems().slice(0, refused)) EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId });
    for (const h of heroes().slice(0, knockouts)) {
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: h.id, heroName: h.name, lost: ['Copper Sword'] });
    }
}

/**
 * Play `minutes` of time away now, as a closed game coming back would, with `news` made inside
 * it. Saved at the end when a slot is open, so "Load as I left it" is offered on the summary.
 */
async function awayWithNews(minutes, news) {
    if (CatchUp.isRunning()) return 'A catch-up is already playing';
    if (!GameState.state) return 'Start or load a game first';
    // Heard through the quiet bus, which still delivers the catch-up's start.
    const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_STARTED, () => {
        off();
        makeNews(news);
    }, UI_LISTENER);
    const now = Date.now();
    try {
        await CatchUp.run({ savedAt: now - minutes * 60_000, now, save: SaveManager.currentSlot != null });
    } finally {
        off();
    }
    return null;
}

/** 20 minutes away: the summary lists the news; closing it raises the banners and the gold stubs. */
export async function timeAwayWithNews() {
    return (await awayWithNews(20, {}))
        || 'Played 20 minutes away: the summary lists the news; close it and the banners and gold New! stubs follow';
}

/** One minute away, under the two that bring up the summary: the banners come at once. */
export async function shortTimeAwayWithNews() {
    return (await awayWithNews(1, {}))
        || 'Played 1 minute away: no summary, so the banners and stubs came at once';
}

/** Three hours away with a lot of news: still one banner per kind, and a handful of stubs. */
export async function longTimeAwayWithNews() {
    return (await awayWithNews(180, { levelUps: 4, finds: 10, refused: 3, knockouts: 4 }))
        || 'Played 3 hours away with lots of news: close the summary, one banner per kind, at most 6 stubs';
}

// --- The away summary's look, every section at once ------------------------------------------

const capitalise = (s) => String(s || '').replace(/^./, c => c.toUpperCase());

/**
 * A made-up time away, for the summary's look only: nothing in the game changes. Built from this
 * save's own heroes, items and enemies, so every sprite is real. `full` fills every column with
 * many rows (both columns overflow at 1366 x 768); otherwise only time passed. Closing it raises
 * banners for its made-up news, as a real one would; "Load as I left it" is not offered.
 */
function previewAway({ full }) {
    if (!GameState.state) return 'Start or load a game first';
    if (CatchUp.isRunning()) return 'A catch-up is already playing';
    const items = Object.values(getAllItems() || {}).filter(i => i?.id && !i.id.includes('coin')).slice(0, 26).map(i => i.id);
    const enemies = Object.entries(getAllTokenTypes() || {}).filter(([, d]) => d?.tokenType === 'enemy').map(([id]) => id);
    const others = Object.entries(getAllTokenTypes() || {}).filter(([, d]) => d?.tokenType === 'resource').map(([id]) => id);
    // A new game has no heroes yet: two made-up ones then, so the hero rows show too.
    const hs = heroes().length ? heroes() : [
        { id: 'qa_away_aela', name: 'Aela', skills: { mining: { level: 12 }, forestry: { level: 4 } } },
        { id: 'qa_away_bram', name: 'Bram', skills: { melee: { level: 7 } } }
    ];
    const summary = { items: { gained: {}, spent: {}, net: {}, floor: {} }, levelUps: [], depleted: { total: 0, byType: {} },
        wounded: [], fightsWon: { total: 0, byEnemy: {} }, combat: { food: {}, elixirs: {}, drops: {} }, news: null };
    if (full) {
        const it = summary.items;
        items.forEach((id, i) => {
            const n = (i + 1) * 37 + (i % 3) * 900;
            if (i % 5 === 0) { it.floor[id] = n; return; }                                // waiting on the mat
            if (i % 5 === 1) { it.gained[id] = n; it.spent[id] = Math.round(n / 3); it.net[id] = n - Math.round(n / 3); return; }
            if (i % 5 === 2) { it.spent[id] = n; it.net[id] = -n; return; }               // spent only
            if (i % 5 === 3) { it.gained[id] = n; it.spent[id] = n; return; }             // even: ±0
            it.gained[id] = n; it.net[id] = n;
        });
        summary.levelUps = hs.flatMap(h => Object.entries(h.skills || {}).slice(0, 3).map(([skillId, s]) => ({
            heroId: h.id, heroName: h.name, skillId, skillName: capitalise(skillId), from: s.level, to: s.level + 2
        })));
        others.slice(0, 4).forEach((id, i) => { summary.depleted.byType[id] = i + 1; summary.depleted.total += i + 1; });
        enemies.forEach((id, i) => { summary.fightsWon.byEnemy[id] = 3 + i * 4; summary.fightsWon.total += 3 + i * 4; });
        const recipes = listRecipes().slice(0, 3);
        summary.news = {
            recipes: hs[0] ? [{ heroId: hs[0].id, heroName: hs[0].name, skillId: recipes[0]?.skill, recipes: recipes.map(r => ({ id: r.id, name: r.name || r.id, itemId: r.outputs?.[0]?.itemId || null })) }] : [],
            finds: items.slice(-3).map((itemId, i) => ({ itemId, count: i + 1 })),
            bankFull: items.slice(4, 6),
            knockouts: hs.slice(0, 2).map((h, i) => ({ heroId: h.id, heroName: h.name, times: i + 1, lost: i ? [] : ['Copper Sword'] }))
        };
    }
    const awayMs = full ? 9 * 3600_000 + 41 * 60_000 : 32 * 60_000;
    EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { awayMs, simulatedMs: awayMs, droppedMs: 0, steps: 0, wallMs: 0, show: true, summary });
    // The hero bar keeps a shown catch-up's level-ups for the next reset: a quiet, empty one after
    // it makes sure these made-up ones never reach a hero.
    EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { awayMs: 0, simulatedMs: 0, droppedMs: 0, steps: 0, wallMs: 0, show: false, summary: null });
    return full ? 'Made-up time away, every section (display only)' : 'Made-up time away with nothing to say (display only)';
}

export const previewAwayFull = () => previewAway({ full: true });
export const previewAwayEmpty = () => previewAway({ full: false });
