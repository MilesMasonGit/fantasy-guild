// Fantasy Guild — what flags say on hover (Free Playmat slice 1.5)

import * as Flags from '../../../systems/board/Flags.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
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

/** The flag's skill as a word: the skill's name, "Fight", or "no skill yet". */
export function flagSkillName(skill) {
    if (!skill) return 'no skill yet';
    if (skill === Flags.COMBAT_FLAG) return 'Fight';
    return getSkill(skill)?.name || skill;
}

/** "Working: Oak Forest" · "Waiting for restock: Copper Vein" · "Nothing to do". */
export function flagStatusLine(heroId) {
    const s = Flags.statusOf(heroId);
    switch (s.state) {
        case 'working': return `Working: ${tokenName(s.typeId) || 'a Token'}`;
        case 'waiting': return `Waiting for restock: ${tokenName(s.typeId) || 'a Token'}`;
        case 'idle': return 'Nothing to do';
        default: return 'In the Guild';
    }
}

/** One skipped Token as "Iron Forge — needs materials". */
export function skipLine(skip) {
    const holder = skip.reason === Flags.SKIP.CLAIMED ? heroName(BoardState.heroOfInstance(skip.instanceId)) : null;
    return `${tokenName(skip.typeId) || 'A Token'} — ${skipHint(skip.reason, { holder })}`;
}

/**
 * Everything the pennant's tooltip shows, as
 * `{ title, state, status, skips: string[], more }`.
 */
export function flagTooltip(heroId) {
    const flag = BoardState.flagOf(heroId);
    const state = Flags.statusOf(heroId).state;
    const all = Flags.skipsOfHero(heroId).map(skipLine);
    return {
        title: `${heroName(heroId)} · ${flagSkillName(flag?.skill)}`,
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
        return `${heroName(s.heroId)}’s flag skipped this: ${skipHint(s.reason, { holder })}`;
    });
}

/** The Dock tab's status line (FPP-15): Working: X · Waiting · Idle at flag · Idle in Guild. */
export function dockStatusLine(status) {
    switch (status?.state) {
        case 'working': return `Working: ${tokenName(status.typeId) || 'a Token'}`;
        case 'waiting': return 'Waiting';
        case 'idle': return 'Idle at flag';
        default: return 'Idle in Guild';
    }
}
