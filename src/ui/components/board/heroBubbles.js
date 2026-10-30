import { ALERT } from '../../../systems/board/boardEvents.js';

/**
 * A hero's sentence for a Token they cannot work. Heroes no longer speak a Token's problems (its
 * problem mark says them, and a refused order says its reason over the Token: `Orders.js`); the
 * sentences stay in {@link blockedText} as the record of the retired lines
 * (`docs/reference/speech_bubble_lines.md`).
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
 * @param {{token: string, missing?: {type: ('tokens'|'items'|null), items: string[]}, skill?: string, tool?: string}} facts
 *        `tool`: the words for the tool the work needs ("Pickaxe", "Iron Pickaxe or better")
 */
export function blockedText(alert, { token, missing = null, skill = null, tool = null }) {
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
        case ALERT.NO_TOOL:
            return tool ? `I need ${withArticle(tool)} to work ${token}.` : `I need a tool to work ${token}.`;
        default:
            return null;
    }
}
