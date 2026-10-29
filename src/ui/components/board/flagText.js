
import * as Flags from '../../../systems/board/Flags.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { tokenName, getTokenType } from '../../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../../config/registries/enemyProfile.js';
import { getAllItems } from '../../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase } from '../../../config/registries/toolKinds.js';
import { withArticle } from '../../../systems/effects/toolNames.js';
import { GameState } from '../../../state/GameState.js';
import { skipHint } from './boardConstants.js';
import { t } from '../../../i18n/index.js';

/**
 * The words for orders, in one place: the flag's tooltip, a Token's own hover lines and the
 * roster's status line.
 * ⚠️ Read live, when asked. Skips are runtime records that change without an event (a flag
 * re-checks every second), so callers ask at hover time rather than projecting these into
 * React state.
 */

/** A flag lists at most this many skipped Tokens, then "+N more". */
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
 * The type of what `heroId` is waiting for (`Flags.waitingOf`), or null: a busy enemy (every
 * fight is one-on-one), a resting node in reach that they work the moment it is back, or the next
 * enemy an enemy camp they were sent to spawns.
 */
export function waitingTypeOf(heroId) {
    const waiting = Flags.waitingOf(heroId);
    // At an enemy camp with nothing standing: the next spawn, named by what it spawns.
    if (waiting?.typeId) return waiting.typeId;
    return waiting?.instanceId ? BoardState.getTokenById(waiting.instanceId)?.typeId ?? null : null;
}

/** The skip hint key for a skip: `claimed` reads as a fight when the Token is an enemy. */
function hintKey(reason, typeId) {
    return reason === Flags.SKIP.CLAIMED && isEnemyDef(getTokenType(typeId)) ? 'claimed_fight' : reason;
}

/** `0:42`, `4:05`. */
function clock(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** A healing hero's time left, or null when they are not healing. */
function healingLeftMs(heroId) {
    const hero = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return hero?.status === 'wounded' ? (hero.woundedRemainingMs ?? 0) : null;
}

/**
 * What a hero is doing, in a few words: "Working: Oak Tree" · "Walking to: Oak Tree" · "Waiting
 * for Oak Stump" · "Idle here" · "Needs a job" · "At the Guild Hall" · "Healing 3:12". Read live.
 */
export function flagStatusLine(heroId) {
    const healing = healingLeftMs(heroId);
    const s = Flags.statusOf(heroId);
    if (s.state === 'returning') return s.limping ? t('orders.limpingHome') : t('orders.headingHome');
    if (healing != null) return t('orders.healingShort', { time: clock(healing) });
    return dockStatusLine({ ...s, waitingFor: s.state === 'idle' ? waitingTypeOf(heroId) : null });
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
 * Everything the flag's tooltip shows, as `{ title, pin, state, status, skips: string[],
 * more }`. The title is the hero's name: a flag has no skill. `pin` is {@link flagPinLine}
 * (null on an area flag).
 */
export function flagTooltip(heroId) {
    const state = Flags.statusOf(heroId).state;
    const all = Flags.skipsOfHero(heroId).map(s => skipLine(s, heroId));
    return {
        title: heroName(heroId),
        pin: null,
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
 * A status line from `Flags.statusOf` (plus `waitingFor`, the type of what the hero waits for,
 * {@link waitingTypeOf}): Working: X · Walking to: X · Waiting for X · Nothing to work near X (a
 * camp) · Idle here · Needs a job · At the Guild Hall.
 */
export function dockStatusLine(status) {
    const token = (typeId) => tokenName(typeId) || 'a Token';
    switch (status?.state) {
        case 'working': return t('orders.working', { token: token(status.typeId) });
        case 'walking': return status.instanceId ? t('orders.walkingTo', { token: token(status.typeId) }) : t('orders.walkingSpot');
        case 'idle':
            if (status.needsJob) return t('orders.needsJob');
            if (status.waitingFor) return t('orders.waitingFor', { token: token(status.waitingFor) });
            if (status.campId) return t('orders.campIdle', { camp: token(BoardState.getTokenById(status.campId)?.typeId) });
            return status.order === 'spot' ? t('orders.idleHere') : t('orders.idle');
        case 'returning': return status.limping ? t('orders.limpingHome') : t('orders.headingHome');
        default: return t('orders.atHall');
    }
}

/**
 * The roster's one-word state for a hero, from `Flags.statusOf` alone: `hurt` (healing from a
 * defeat), `busy` (an order on a Token: working it, walking to it, or waiting by it) or `idle` (no
 * order, a spot order, or a job gone for good).
 */
export function rosterStateOf(heroId) {
    if (healingLeftMs(heroId) != null) return 'hurt';
    const s = Flags.statusOf(heroId);
    if (s.needsJob) return 'idle';
    if (s.state === 'working') return 'busy';
    return s.order === 'token' ? 'busy' : 'idle';
}
