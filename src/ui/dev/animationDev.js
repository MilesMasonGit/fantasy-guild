// The QA panel's Animation section: each of the mat's effects played on demand, through the same
// code the game's own trigger runs, so the owner can look at one without waiting for it.
// ⚠️ DEV BUILDS ONLY (reached only through AnimationDevSection, rendered behind `import.meta.env.DEV`).
// The effect buttons change nothing in the game: they publish only `UI_EVENTS.UI_TOKEN_FX` (and
// `BOARD_EVENTS.RARE_DROP`, which only the mat hears) or call the effect modules' play functions.
// The scene set-up and the loot buttons do change it, like the panel's Spawn Party and Scatter Loot.

import { EventBus } from '../../systems/core/EventBus.js';
import { UI_EVENTS, ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as MatFx from '../components/board/fx/matFx.js';
import { beginSettle } from '../components/board/fx/regionSettle.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import * as Placement from '../../systems/board/Placement.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { heroMaxHpFromSkills } from '../../utils/CombatFormulas.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/** The Tokens on the mat, in arrival order. */
const onMat = () => BoardState.tokens().filter(t => Number.isFinite(t.x) && Number.isFinite(t.y));

/** Enemies on the mat. */
export const enemies = () => onMat().filter(t => getTokenType(t.typeId)?.enemy);

/** Tokens a hero is working right now. */
export const worked = () => onMat().filter(t => BoardState.workerOf(t.id));

/** Every Token on the mat but the Guild Hall. */
export const everyToken = () => onMat().filter(t => !getTokenType(t.typeId)?.isGuildHall && t.typeId !== 'token_guild_hall');

/** Up to `n` pairs of Tokens standing near each other (a giver and a receiver). */
export function neighbours(n = 3, within = 260) {
    const list = everyToken();
    const pairs = [];
    for (const a of list) {
        const b = list.find(o => o !== a && Math.hypot(o.x - a.x, o.y - a.y) <= within && !pairs.some(([, r]) => r === o));
        if (b) pairs.push([a, b]);
        if (pairs.length >= n) break;
    }
    return pairs;
}

/**
 * A small scene to watch the effects in, beside the Guild Hall: two oak trees, a copper vein and
 * two goblins, four level-50 heroes (a fighter, a wizard, a ranger and a rogue, roster room
 * made as the QA panel's Spawn Party does), each flag planted on one of them, and five oak
 * seedlings in the Bank so the Oak Forest spawns. ⚠️ Changes the game, like Spawn Party.
 * @returns {number} how many Tokens it placed
 */
export function setUpAnimationScene() {
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const put = (typeId, dx, dy) => {
        const inst = BoardState.createTokenInstance(typeId, getTokenType(typeId)?.uses ?? null);
        return Placement.placeTokenAt(inst, { x: c.x + dx, y: c.y + dy })?.success ? inst : null;
    };
    const placed = [
        put('token_oak_tree', -260, -120), put('token_copper_ore_vein', 260, -120),
        put('token_goblin', 280, 170), put('token_oak_tree', -260, 150), put('token_goblin', 120, 260)
    ];
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 4);
    GuildUpgradeManager.recompute();
    const targets = [placed[0], placed[1], placed[2], placed[3]];
    ['fighter', 'wizard', 'ranger', 'rogue'].forEach((jobId, i) => {
        const hero = generateHero({ jobId, spriteId: jobId });
        // Level 50 set before they join, so no level-up is said for every skill at once.
        for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level: 50, xp: xpForLevel(50) };
        const maxHp = heroMaxHpFromSkills(hero.skills);
        hero.hp = { current: maxHp, max: maxHp };
        if (!HeroManager.addHero(hero)) return;
        const t = targets[i];
        if (t) Placement.plantFlagAt(hero.id, { x: t.x + 40, y: t.y + 40 });
    });
    InventoryManager.addItem('item_oak_seedling', 5);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_animation_scene' });
    return placed.filter(Boolean).length;
}

/** Up to `n` of `list`, spread over it. */
export function some(list, n = 3) {
    if (list.length <= n) return list;
    const step = list.length / n;
    return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
}

/** Play the named Token effect on each of `tokens`. Returns how many. */
export function playOn(tokens, payload) {
    for (const t of tokens) EventBus.publish(UI_EVENTS.UI_TOKEN_FX, { ...payload, instanceId: t.id });
    return tokens.length;
}

/** An item that drops as loot: the first plain one in the item registry. */
function someItemId() {
    const items = Object.values(getAllItems() || {});
    return (items.find(i => i?.id && !i.equipSlot && /wood|ore|berry|log/i.test(i.id)) || items.find(i => i?.id && !i.equipSlot))?.id || null;
}

/**
 * One loot item hops out of each of `tokens`, as a finished cycle's output does. ⚠️ Real loot: it
 * lies on the floor and can be collected, like the QA panel's Scatter Loot. Returns the sprites.
 */
export function dropLootFrom(tokens) {
    const itemId = someItemId();
    if (!itemId) return [];
    return tokens.map(t => SpriteLayer.addSprite('item', itemId, 1, t.id)).filter(Boolean);
}

/**
 * As {@link dropLootFrom}, each drop said to be a rare find (`BOARD_EVENTS.RARE_DROP`, which only
 * the mat listens to), so it twinkles as it lands.
 */
export function dropRareFrom(tokens) {
    const sprites = dropLootFrom(tokens);
    for (const s of sprites) EventBus.publish(BOARD_EVENTS.RARE_DROP, { spriteId: s.id, itemId: s.refId, chance: 5 });
    return sprites;
}

/**
 * The tinted-copy cost check: every Token on the mat flashes white for `frames` effect frames,
 * every `everyMs`, for `forMs`. Returns a stop function.
 */
export function flashStorm({ everyMs = 240, forMs = 10000, frames = 2 } = {}) {
    const all = everyToken();
    const fire = () => playOn(all, { fx: 'flash', tint: 'white', frames });
    fire();
    const timer = setInterval(fire, everyMs);
    const stopAt = setTimeout(() => clearInterval(timer), forMs);
    return () => { clearInterval(timer); clearTimeout(stopAt); };
}

// The measuring scripts reach the page's own copies of these through here (a module imported
// again from the console can be a second copy with none of the page's state).
globalThis.__fxDev = { enemies, worked, everyToken, neighbours, some, playOn, flashStorm, dropLootFrom, dropRareFrom, beginSettle, setUpAnimationScene, MatFx };
