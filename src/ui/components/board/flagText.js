// Fantasy Guild — what flags say on hover (Free Playmat slice 1.5)

import * as Flags from '../../../systems/board/Flags.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { GameState } from '../../../state/GameState.js';
import { skipHint } from './boardConstants.js';

/**
 * The words for flags, in one place: the pennant's tooltip, a Token's own
 * hover lines (FP-60) and the Dock tab's status line (FPP-15).
 *
 * ⚠️ Read live, when asked. Skips are runtime records that change without an
 * event (a flag re-checks every second), so callers ask at hover time rather
 * than projecting these into React state.
 */

/** A pennant lists at most this many skipped Tokens, then "+N more". */
export const MAX_SKIP_LINES = 5;

function heroName(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId)?.name || 'A hero';
}

/** "Working: Oak Forest" · "Walking to: Oak Forest" · "Waiting for restock: Copper Vein" · "Nothing to do". */
export function flagStatusLine(heroId) {
    const s = Flags.statusOf(heroId);
    switch (s.state) {
        case 'working': return `Working: ${tokenName(s.typeId) || 'a Token'}`;
        case 'walking': return s.instanceId ? `Walking to: ${tokenName(s.typeId) || 'a Token'}` : 'Heading back to the flag';
        case 'waiting': return `Waiting for restock: ${tokenName(s.typeId) || 'a Token'}`;
        case 'idle': return 'Nothing to do';
        default: return 'In the Guild';
    }
}

/** One skipped Token as "Iron Forge — needs materials" — by `heroId`'s flag, for "off in X's rules". */
export function skipLine(skip, heroId = null) {
    const holder = skip.reason === Flags.SKIP.CLAIMED ? heroName(BoardState.heroOfInstance(skip.instanceId)) : null;
    return `${tokenName(skip.typeId) || 'A Token'} — ${skipHint(skip.reason, { holder, hero: heroName(heroId) })}`;
}

/**
 * Everything the pennant's tooltip shows, as
 * `{ title, state, status, skips: string[], more }`. The title is the hero's
 * name: a flag has no skill since slice 1.5b (FP-71).
 */
export function flagTooltip(heroId) {
    const state = Flags.statusOf(heroId).state;
    const all = Flags.skipsOfHero(heroId).map(s => skipLine(s, heroId));
    return {
        title: heroName(heroId),
        state,
        status: flagStatusLine(heroId),
        skips: all.slice(0, MAX_SKIP_LINES),
        more: Math.max(0, all.length - MAX_SKIP_LINES)
    };
}

/** A Token's own hover lines: which flags passed it over, and why (FP-60). */
export function tokenSkipLines(instanceId) {
    if (!instanceId) return [];
    return Flags.skipsOf(instanceId).map(s => {
        const holder = s.reason === Flags.SKIP.CLAIMED ? heroName(BoardState.heroOfInstance(instanceId)) : null;
        return `${heroName(s.heroId)}’s flag skipped this: ${skipHint(s.reason, { holder, hero: heroName(s.heroId) })}`;
    });
}

/** The Dock tab's status line (FPP-15): Working: X · Walking to: X · Waiting · Idle at flag · Idle in Guild. */
export function dockStatusLine(status) {
    switch (status?.state) {
        case 'working': return `Working: ${tokenName(status.typeId) || 'a Token'}`;
        case 'walking': return status.instanceId ? `Walking to: ${tokenName(status.typeId) || 'a Token'}` : 'Heading back to the flag';
        case 'waiting': return 'Waiting';
        case 'idle': return 'Idle at flag';
        default: return 'Idle in Guild';
    }
}
