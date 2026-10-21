// The QA panel's Animation section: each of the mat's effects played on demand, through the same
// code the game's own trigger runs, so the owner can look at one without waiting for it.
// ⚠️ DEV BUILDS ONLY (reached only through AnimationDevSection, rendered behind `import.meta.env.DEV`).
// Nothing here changes the game: no engine event is published, only `UI_EVENTS.UI_TOKEN_FX` and
// the effect modules' own play functions.

import { EventBus } from '../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as MatFx from '../components/board/fx/matFx.js';

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
globalThis.__fxDev = { enemies, worked, everyToken, neighbours, some, playOn, flashStorm, MatFx };
