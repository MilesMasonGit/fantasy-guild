
import * as Flags from '../../../systems/board/Flags.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../../config/registries/enemyProfile.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase } from '../../../config/registries/toolKinds.js';
import { withArticle } from '../../../systems/effects/toolNames.js';
import { GameState } from '../../../state/GameState.js';
import { skipHint } from './boardConstants.js';

/**
 * The words for flags, in one place: the pennant's tooltip, a Token's own hover lines and the
 * Dock tab's status line.
 * ⚠️ Read live, when asked. Skips are runtime records that change without an event (a flag
 * re-checks every second), so callers ask at hover time rather than projecting these into
 * React state.
 */

/** A pennant lists at most this many skipped Tokens, then "+N more". */
export const MAX_SKIP_LINES = 5;

/** "a Pickaxe", "an Iron Pickaxe or better": the tool a Token's work needs, or null. */
function toolOfType(typeId) {
    const need = neededToolOf(getTokenType(typeId));
    return need ? withArticle(toolNeedPhrase(need, getAllItems())) : null;
}

function heroName(heroId) {
    if (!heroId) return null;
    return (GameState.state?.heroes || []).find(h => h?.id === heroId)?.name || 'A hero';
}

/**
 * The type of what `heroId` is waiting for (`Flags.waitingFor`), or null: a busy enemy (every
 * fight is one-on-one) or a resting node in reach that they work the moment it is back.
 */
export function waitingTypeOf(heroId) {
    const id = Flags.waitingFor(heroId);
    return id ? BoardState.getTokenById(id)?.typeId ?? null : null;
}

/** The skip hint key for a skip: `claimed` reads as a fight when the Token is an enemy. */
function hintKey(reason, typeId) {
    return reason === Flags.SKIP.CLAIMED && isEnemyDef(getTokenType(typeId)) ? 'claimed_fight' : reason;
}

/** "Working: Oak Forest" · "Walking to: Oak Forest" · "Waiting for Goblin" · "Nothing to do". */
export function flagStatusLine(heroId) {
    const s = Flags.statusOf(heroId);
    switch (s.state) {
        case 'working': return `Working: ${tokenName(s.typeId) || 'a Token'}`;
        case 'walking': return s.instanceId ? `Walking to: ${tokenName(s.typeId) || 'a Token'}` : 'Heading back to the flag';
        case 'idle': {
            const waiting = waitingTypeOf(heroId);
            return waiting ? `Waiting for ${tokenName(waiting) || 'a Token'}` : 'Nothing to do';
        }
        case 'returning': return s.limping ? 'Limping home' : 'Heading home';
        default: return 'In the Guild';
    }
}

/** One skipped Token as "Iron Forge — needs materials" — by `heroId`'s flag, for "off in X's rules". */
export function skipLine(skip, heroId = null) {
    const holder = skip.reason === Flags.SKIP.CLAIMED ? heroName(BoardState.heroOfInstance(skip.instanceId)) : null;
    return `${tokenName(skip.typeId) || 'A Token'} — ${skipHint(hintKey(skip.reason, skip.typeId), { holder, hero: heroName(heroId), tool: toolOfType(skip.typeId) })}`;
}

/**
 * 'Working only Oak Tree' for a flag pinned to a Token, else null. Read live, like everything
 * here: a pin lapses when its Token is used up.
 */
export function flagPinLine(heroId) {
    const token = Flags.pinnedTokenOf(heroId);
    return token ? `Working only ${tokenName(token.typeId) || 'this Token'}` : null;
}

/**
 * Everything the pennant's tooltip shows, as `{ title, pin, state, status, skips: string[],
 * more }`. The title is the hero's name: a flag has no skill. `pin` is {@link flagPinLine}
 * (null on an area flag).
 */
export function flagTooltip(heroId) {
    const state = Flags.statusOf(heroId).state;
    const all = Flags.skipsOfHero(heroId).map(s => skipLine(s, heroId));
    return {
        title: heroName(heroId),
        pin: flagPinLine(heroId),
        state,
        status: flagStatusLine(heroId),
        skips: all.slice(0, MAX_SKIP_LINES),
        more: Math.max(0, all.length - MAX_SKIP_LINES)
    };
}

/** A Token's own hover lines: which flags passed it over, and why. */
export function tokenSkipLines(instanceId) {
    if (!instanceId) return [];
    return Flags.skipsOf(instanceId).map(s => {
        const holder = s.reason === Flags.SKIP.CLAIMED ? heroName(BoardState.heroOfInstance(instanceId)) : null;
        const typeId = BoardState.getTokenById(instanceId)?.typeId;
        const tool = toolOfType(typeId);
        return `${heroName(s.heroId)}’s flag skipped this: ${skipHint(hintKey(s.reason, typeId), { holder, hero: heroName(s.heroId), tool })}`;
    });
}

/**
 * The Dock tab's status line: Working: X · Walking to: X · Waiting for X · Idle at flag · Idle in
 * Guild. `status.waitingFor` is the type of what the hero waits for ({@link waitingTypeOf}).
 */
export function dockStatusLine(status) {
    switch (status?.state) {
        case 'working': return `Working: ${tokenName(status.typeId) || 'a Token'}`;
        case 'walking': return status.instanceId ? `Walking to: ${tokenName(status.typeId) || 'a Token'}` : 'Heading back to the flag';
        case 'idle': return status.waitingFor ? `Waiting for ${tokenName(status.waitingFor) || 'a Token'}` : 'Idle at flag';
        case 'returning': return status.limping ? 'Limping home' : 'Returning to the Guild';
        default: return 'Idle in Guild';
    }
}
