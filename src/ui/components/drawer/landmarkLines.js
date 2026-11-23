// What a landmark's inspection says: the skill, level and items its challenge needs
import { skillLevel } from '../../../systems/core/levelNeed.js';

/**
 * Every word the inspection shows about a landmark (an endgame site), in one place. Placeholder
 * wording until the owner writes the sites' text.
 */
export const LANDMARK_TEXT = Object.freeze({
    TITLE: 'Endgame site',
    NEEDS: 'Needs',
    NO_SKILL: 'The skill it needs is not written yet',
    NO_ITEMS: 'The items it needs are not written yet',
    FIXED: 'It cannot be moved or demolished.'
});

/**
 * The lines a landmark's inspection shows, read from the type's own fields (`config.skill`,
 * `config.skillRequired`, `config.inputs`), with placeholder lines where they are not authored.
 * Null for a Token that is not a landmark. The panel passes the item names.
 *
 * @param {object} def a Token type
 * @param {{itemName: (id: string) => string}} names
 * @returns {{title: string, lines: {label: string, value: string, icons?: object[], placeholder?: boolean}[],
 *          note: string}|null}
 */
export function landmarkLines(def, { itemName = (id) => id } = {}) {
    if (def?.landmark !== true) return null;
    const lines = [];
    const skill = def.config?.skill;
    if (skill) {
        const level = Number(def.config?.skillRequired) > 0 ? def.config.skillRequired : 1;
        // Beside its "Needs" label, the level writer's own words: "[icon] Forestry 99".
        const words = skillLevel(skill, level);
        lines.push({ label: LANDMARK_TEXT.NEEDS, value: words.text, icons: words.icons });
    } else {
        lines.push({ label: LANDMARK_TEXT.NEEDS, value: LANDMARK_TEXT.NO_SKILL, placeholder: true });
    }
    const inputs = (def.config?.inputs || []).filter(i => i?.itemId && Number(i.quantity) > 0);
    if (inputs.length) {
        for (const { itemId, quantity } of inputs) {
            lines.push({ label: '', value: `${quantity} × ${itemName(itemId)}` });
        }
    } else {
        lines.push({ label: '', value: LANDMARK_TEXT.NO_ITEMS, placeholder: true });
    }
    return { title: LANDMARK_TEXT.TITLE, lines, note: LANDMARK_TEXT.FIXED };
}
