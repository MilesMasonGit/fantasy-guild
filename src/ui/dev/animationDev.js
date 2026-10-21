// The QA panel's Animation section: each of the mat's effects played on demand, through the same
// code the game's own trigger runs, so the owner can look at one without waiting for it.
// ⚠️ DEV BUILDS ONLY (reached only through AnimationDevSection, rendered behind `import.meta.env.DEV`).
// Nothing here changes the game: no engine event is published, only `UI_EVENTS.UI_TOKEN_FX` and
// the effect modules' own play functions.

import { EventBus } from '../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as MatFx from '../components/board/fx/matFx.js';
import { beginSettle } from '../components/board/fx/regionSettle.js';
import * as SpriteLayer from '../../systems/board/SpriteLayer.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';

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
globalThis.__fxDev = { enemies, worked, everyToken, neighbours, some, playOn, flashStorm, dropLootFrom, dropRareFrom, beginSettle, MatFx };
