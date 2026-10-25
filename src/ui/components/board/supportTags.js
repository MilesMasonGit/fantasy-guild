import { EFFECT_TYPES } from '../../../systems/effects/constants.js';
import { getPaletteEntry } from '../../../config/registries/modifierPalette.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { MAX_SPEED_UP_CUT } from '../../../config/loopConstants.js';

/**
 * A support's effect as the few words a tag says: "−25 % grow", "×2 Copper Ore 25 %",
 * "+2 harvests". Pure, so every wording is tested without a mat.
 */

const MINUS = '−';
const round1 = (n) => Math.round(n * 10) / 10;
const signOf = (n) => (n < 0 ? MINUS : '+');

/** A bucket's number: a percentage as "−25 %", a flat as "+2", a multiplier as "×1.5". */
function amount(payload) {
    const v = Number(payload?.value) || 0;
    if (payload?.bucket === 'multiplier') return `×${round1(v)}`;
    if (payload?.bucket === 'flat') return `${signOf(v)}${round1(Math.abs(v))}`;
    return `${signOf(v)}${round1(Math.abs(v) * 100)} %`;
}

const itemNameOf = (id, itemName) => (id ? (itemName(id) || id) : null);

/**
 * @param {object} payload a support's payload (`supportLinks.supportPayloadOf`)
 * @param {(id: string) => string|null} [itemName]
 * @returns {string}
 */
export function supportTag(payload, itemName = (id) => getItem(id)?.name || null) {
    const v = Number(payload?.value) || 0;
    switch (payload?.type) {
        case EFFECT_TYPES.GROW_TIME: return `${amount(payload)} grow`;
        case EFFECT_TYPES.WORK_TIME:
            return payload.bucket === 'flat' ? `${signOf(v)}${round1(Math.abs(v) / 1000)} s work` : `${amount(payload)} work`;
        case EFFECT_TYPES.CROP_LOAD:
            return payload.bucket === 'flat'
                ? `${signOf(v)}${round1(Math.abs(v))} harvest${Math.abs(v) === 1 ? '' : 's'}`
                : `${amount(payload)} harvests`;
        case EFFECT_TYPES.DOUBLE_DROP:
            return `×2 ${itemNameOf(payload.category, itemName) || 'items'} ${round1(v)} %`;
        case EFFECT_TYPES.LOOT_MULT: return `×2 loot ${round1(v)} %`;
        case EFFECT_TYPES.BONUS_DROP: {
            const chance = payload.chance ?? 100;
            const qty = Number(payload.quantity) > 1 ? `${payload.quantity} ` : '';
            return `+${qty}${itemNameOf(payload.itemId, itemName)}${chance < 100 ? ` ${round1(chance)} %` : ''}`;
        }
        case EFFECT_TYPES.YIELD: return `${amount(payload)} yield`;
        case EFFECT_TYPES.XP_BONUS: return `${amount(payload)} XP`;
        case EFFECT_TYPES.INPUT_COST: return `${amount(payload)} input`;
        case EFFECT_TYPES.FAIL_CHANCE: return `${signOf(v)}${round1(Math.abs(v))} % fail`;
        case EFFECT_TYPES.CATCH_WEIGHT: return `${amount(payload)} ${itemNameOf(payload.category, itemName) || 'bites'}`;
        default: {
            const label = getPaletteEntry(payload?.type)?.label || String(payload?.type || '').toLowerCase();
            return `${amount(payload)} ${label}`.trim();
        }
    }
}

const CUT = `${MINUS}${Math.round(MAX_SPEED_UP_CUT * 100)} %`;

/** The card's note when speed-ups stack past the standard floor and are held there. */
export const FLOOR_NOTE = Object.freeze({
    work: `Work held at ${CUT}, the most speed-ups can cut`,
    grow: `Growth held at ${CUT}, the most speed-ups can cut`
});
