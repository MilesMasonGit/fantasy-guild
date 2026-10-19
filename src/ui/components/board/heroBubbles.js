
import { ALERT } from '../../../systems/board/boardEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { workConfigOf } from '../../../systems/board/StationRecipe.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';

/**
 * A hero's sentence for a Token they cannot work. Heroes no longer speak a Token's problems (its
 * problem mark says them); what is left is the moment a flag dropped on a Token could not be
 * pinned to it ({@link pinRefusedLineFor}). The other sentences stay in {@link blockedText} as
 * the record of the retired lines (`docs/reference/speech_bubble_lines.md`).
 */

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
        // A Token that names no skill drops the skill from the sentence rather than filling it
        // with a placeholder.
        case ALERT.ACCESS:
            return skill ? `My ${skill} level is too low to work ${token}.` : `My level is too low to work ${token}.`;
        case ALERT.UNSKILLED:
            return skill ? `I don’t have the ${skill} skill to work ${token}.` : `I don’t have the skill to work ${token}.`;
        default:
            return null;
    }
}

/**
 * What a hero says when their flag, dropped on a Token, could not be pinned to it: the **same
 * sentence** they would say stuck on that Token for that reason (level too low, skill not
 * held; see `docs/reference/speech_bubble_lines.md`). Null for a reason with no wording (a
 * Token the player disallowed, or the hero's own rule switched off): the flag's hover still
 * says it. Spoken as a moment (`heroSpeech.MOMENT_SPOKEN.pinRefused`).
 */
export function pinRefusedLineFor(tokenId, reason) {
    if (!tokenId || !reason) return null;
    const token = BoardState.getTokenById(tokenId);
    if (!token) return null;
    const def = getTokenType(token.typeId);
    const skillId = workConfigOf(def, token)?.skill;
    return blockedText(reason, {
        token: def?.name || tokenName(token.typeId) || token.typeId,
        skill: skillId ? (getSkill(skillId)?.name || skillId) : undefined
    });
}
