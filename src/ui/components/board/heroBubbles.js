// Fantasy Guild — what a hero has to say (Hero Speech Bubbles slice SB-B)

import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as RecipeResolver from '../../../systems/board/RecipeResolver.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
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
export function blockedText(alert, { token, missing = null, skill = null }) {
    const items = missing?.items || [];
    switch (alert) {
        case ALERT.INPUTS:
            return items.length ? `I need ${joinNames(items)} to work ${token}.` : `I need more items to work ${token}.`;
        case ALERT.NO_RECIPE:
            return items.length ? `I need ${joinNames(items.map(withArticle))} nearby to work ${token}.` : `${token} has nothing to make.`;
        case ALERT.CHARGES:
            return `${token} has too few charges left.`;
        case ALERT.CHOOSE_BUILD:
            return `Choose what to build on ${token}.`;
        case ALERT.CHOOSE_RECIPE:
            return `Choose a recipe for ${token}.`;
        case ALERT.NO_ROOM:
            return `There is no room for what ${token} makes.`;
        // A Token that names no skill (FB-54) drops the skill from the
        // sentence rather than filling it with a placeholder.
        case ALERT.ACCESS:
            return skill ? `My ${skill} level is too low to work ${token}.` : `My level is too low to work ${token}.`;
        case ALERT.UNSKILLED:
            return skill ? `I don’t have the ${skill} skill to work ${token}.` : `I don’t have the skill to work ${token}.`;
        default:
            return null;
    }
}

/**
 * ⭐ **Blocks a hero does not speak about** (Token Lifecycle feedback Q6,
 * FB-21). A station or Foundation with nothing chosen is waiting, not broken:
 * the owner ruled after Q1 that it shows only its gear (FB-7), with no alert,
 * so its hero says nothing either. The wording in `blockedText` stays, so the
 * owner can reinstate a line by taking it out of this set. Every line and its
 * status: `docs/reference/speech_bubble_lines.md`.
 */
export const SILENT_BLOCKS = new Set([ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_BUILD]);

/** Whether a hero speaks about this block at all. */
export function speaksBlock(alert) {
    return !!alert && !SILENT_BLOCKS.has(alert);
}

/**
 * The blocked line for a hero working `tokenId`, or null when they are not
 * blocked (or the block is one they keep quiet about, `speaksBlock`). `alert`
 * is the Token's own alert, already known to the caller.
 */
export function blockedLineFor(tokenId, alert) {
    if (!tokenId || !speaksBlock(alert)) return null;
    const token = BoardState.getTokenById(tokenId);
    if (!token) return null;
    const def = getTokenType(token.typeId);
    const missing = (alert === ALERT.INPUTS || alert === ALERT.NO_RECIPE)
        ? RecipeResolver.getMissingRequirements(token.id, token)
        : null;
    const skillId = workConfigOf(def)?.skill;
    return blockedText(alert, {
        token: def?.name || tokenName(token.typeId) || token.typeId,
        missing,
        skill: skillId ? (getSkill(skillId)?.name || skillId) : undefined
    });
}

/**
 * ⭐ What a hero says when their flag, dropped on a Token, could not be pinned
 * to it (B5 bad pin, FB-45) — the **same sentence** they would say stuck on
 * that Token for that reason (lines 7 and 8 of `docs/reference/speech_bubble_lines.md`:
 * level too low, skill not held). Null for a reason with no wording (a Token
 * the player disallowed, or the hero's own rule switched off): the flag's hover
 * still says it. Spoken as a moment (`heroSpeech.MOMENT_SPOKEN.pinRefused`).
 */
export function pinRefusedLineFor(tokenId, reason) {
    if (!tokenId || !reason) return null;
    const token = BoardState.getTokenById(tokenId);
    if (!token) return null;
    const def = getTokenType(token.typeId);
    const skillId = workConfigOf(def)?.skill;
    return blockedText(reason, {
        token: def?.name || tokenName(token.typeId) || token.typeId,
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
