// Fantasy Guild — what a hero has to say (Hero Speech Bubbles slice SB-B)

import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as RecipeResolver from '../../../systems/board/RecipeResolver.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';

/**
 * ⭐ **A hero's blocked line, in plain words** (SB-5, SBP-3).
 *
 * A block is a live fact rather than an event (SBP-2): the line is worked out
 * from the Token the hero holds *now*, so it names the thing that is missing
 * this moment and vanishes the moment the problem does.
 */

/**
 * How long a hero waits, stuck for want of items, before saying so (SB-6).
 * Provisional — items often arrive within a few seconds, and a bubble that
 * flashes on and off is worse than none.
 */
export const INPUTS_DELAY_MS = 3000;

/** "A", "A and B", "A, B and C". */
export function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "a Pickaxe", "an Anvil" — Tokens are countable things, items are not. */
const withArticle = (name) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/**
 * The sentence for one block, or null if this reason has no wording yet.
 * Pure — every fact it needs is passed in.
 *
 * @param {string} alert  an `ALERT` value
 * @param {{token: string, missing?: {type: ('tokens'|'items'|null), items: string[]}, skill?: string}} facts
 */
export function blockedText(alert, { token, missing = null, skill = 'the right' }) {
    const items = missing?.items || [];
    switch (alert) {
        case ALERT.INPUTS:
            return items.length ? `I need ${joinNames(items)} to work ${token}.` : `I need more items to work ${token}.`;
        case ALERT.NO_RECIPE:
            return items.length ? `I need ${joinNames(items.map(withArticle))} nearby to work ${token}.` : `${token} has nothing to make.`;
        case ALERT.CHARGES:
            return `${token} has too few charges left.`;
        case ALERT.ACCESS:
            return `My ${skill} level is too low to work ${token}.`;
        case ALERT.UNSKILLED:
            return `I don’t have the ${skill} skill to work ${token}.`;
        default:
            return null;
    }
}

/**
 * The blocked line for a hero working `tokenId`, or null when they are not
 * blocked. `alert` is the Token's own alert, already known to the caller.
 */
export function blockedLineFor(tokenId, alert) {
    if (!tokenId || !alert) return null;
    const token = BoardState.getTokenById(tokenId);
    if (!token) return null;
    const def = getTokenType(token.typeId);
    const missing = (alert === ALERT.INPUTS || alert === ALERT.NO_RECIPE)
        ? RecipeResolver.getMissingRequirements(token.id, token)
        : null;
    const skillId = def?.config?.skill;
    return blockedText(alert, {
        token: def?.name || tokenName(token.typeId) || token.typeId,
        missing,
        skill: skillId ? (getSkill(skillId)?.name || skillId) : undefined
    });
}

/**
 * Whether a block has been showing long enough to speak. Only item shortages
 * wait (SB-6); every other block speaks at once.
 */
export function readyToSpeak(alert, sinceMs, nowMs) {
    return alert !== ALERT.INPUTS || nowMs - sinceMs >= INPUTS_DELAY_MS;
}
