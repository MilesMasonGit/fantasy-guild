// an effect as a short tag: its name, then its number, the way its badge writes it

import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { chanceFigure, chanceText, timesText, lengthText } from '../../utils/Formatters.js';

/**
 * The one writer for an effect's name and number (UI_STYLE "Effect names"): `Speed +25%`,
 * `Double Loot 10%`, `Lucky ×1.2`, `Bird Nest 5%`. The Token card's badges, a building's Boosts
 * list, the mat's support labels and every rule line read it, so a perk and the badge it causes
 * say the same words.
 *
 * Good is always plus: an inverted axis stores a time or a cost (Speed is Work Time), so its sign
 * is flipped here, never in `data/`. A chance is plain, signed only below nothing; a multiplier
 * reads `×`. `against` says the number works against whoever carries it, which the screens draw
 * red on the player's side.
 */

export const MINUS = '−';

/** A number by the chance rule, unsigned (never "-0"). */
const figure = (n) => String(Math.abs(chanceFigure(n)));
const signOf = (n) => (n < 0 ? MINUS : '+');

/** A percent always signed: `+23%`, `−10%`. */
export const percentAmountText = (n) => `${signOf(Number(n) || 0)}${figure(n)}%`;
/** A chance plain, signed only below nothing: `8%`, `−5%`. */
export const chanceAmountText = (n) => `${Number(n) < 0 ? MINUS : ''}${figure(n)}%`;
/** A count always signed: `+2`, `−1`. */
export const countAmountText = (n) => `${signOf(Number(n) || 0)}${figure(n)}`;

/** Flat combat axes counted in percentage points of a chance. */
const POINT_AXES = new Set([EFFECT_TYPES.ACCURACY, EFFECT_TYPES.DODGE, EFFECT_TYPES.CRIT_CHANCE]);
/** Axes that store a time, whose flat amount is milliseconds. */
const TIME_AXES = new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.GROW_TIME, EFFECT_TYPES.WOUND_TIME, EFFECT_TYPES.PASSIVE_LAP, EFFECT_TYPES.SWING_TIME
]);

/** Flat axes that are a share of a price in percent, read plain as a chance is: `Salvage 50%`. */
const SHARE_AXES = new Set([EFFECT_TYPES.SALVAGE, EFFECT_TYPES.BUILD_DISCOUNT]);

/** A chance rolled once per cycle (`MODIFIER_SHAPES.PROC`; named here, the palette imports this file). */
const PROC = 'proc';

/** An effect's player-facing name: its palette entry's label. */
export function effectName(entry, type = entry?.type) {
    return entry?.label || String(type || '').toLowerCase();
}

/**
 * A payload's number as its badge writes it, and whether it works against its bearer.
 * @param {object|null} entry the payload's palette entry (`getPaletteEntry`)
 * @param {{type: string, bucket?: string, value: number}} payload
 * @returns {{text: string, against: boolean}}
 */
export function effectAmount(entry, payload) {
    const v = Number(payload?.value) || 0;
    if (entry?.shape === PROC || payload?.type === EFFECT_TYPES.BONUS_DROP) {
        return { text: chanceAmountText(v), against: entry?.harmful ? v > 0 : v < 0 };
    }
    if (SHARE_AXES.has(payload?.type)) return { text: chanceAmountText(v), against: v < 0 };
    // Lucky's percentage is a share of the rare table's chance: as `+20%` it would read as points.
    if (payload?.type === EFFECT_TYPES.LUCKY && payload?.bucket !== 'flat') {
        const factor = payload?.bucket === 'multiplier' ? Math.abs(v) : Math.max(0, 1 + v);
        return { text: timesText(factor), against: factor < 1 };
    }
    const flip = entry?.inverted ? -1 : 1;
    switch (payload?.bucket) {
        case 'flat': {
            const good = flip * v;
            if (TIME_AXES.has(payload.type)) return { text: `${signOf(good)}${lengthText(Math.abs(v))}`, against: good < 0 };
            const text = POINT_AXES.has(payload.type) || payload.type === EFFECT_TYPES.LUCKY ? percentAmountText(good) : countAmountText(good);
            return { text, against: good < 0 };
        }
        case 'multiplier': {
            // An inverted multiplier cuts a time or a cost: its share, as the badge counts it.
            if (entry?.inverted) {
                const good = (1 - v) * 100;
                return { text: percentAmountText(good), against: good < 0 };
            }
            return { text: timesText(v), against: v < 1 };
        }
        default: {
            const good = flip * v * 100;
            return { text: percentAmountText(good), against: good < 0 };
        }
    }
}

/**
 * A payload as a short tag, and whether it works against its bearer: `Speed +25%`,
 * `Double Item 25% on Copper Ore`, `Bird Nest 5%`.
 * @param {object|null} entry the payload's palette entry
 * @param {object} payload
 * @param {(id: string) => string|null} [itemName]
 * @returns {{text: string, against: boolean}}
 */
export function effectTag(entry, payload, itemName = (id) => id) {
    const item = (id) => (id ? (itemName(id) || id) : null);
    // An on-or-off effect (a palette entry marked `flag`) has no number to say.
    if (entry?.flag) return { text: effectName(entry, payload?.type), against: false };
    const amount = effectAmount(entry, payload);
    switch (payload?.type) {
        case EFFECT_TYPES.BONUS_DROP: {
            const chance = payload.chance ?? 100;
            const qty = Number(payload.quantity) > 1 ? `${payload.quantity} ` : '';
            const name = `${qty}${item(payload.itemId) || '…'}`;
            return { text: chance < 100 ? `${name} ${chanceText(chance)}` : name, against: false };
        }
        case EFFECT_TYPES.DOUBLE_DROP:
        case EFFECT_TYPES.CATCH_WEIGHT: {
            const on = item(payload.category);
            const head = `${effectName(entry, payload.type)} ${amount.text}`;
            return { text: on ? `${head} on ${on}` : head, against: amount.against };
        }
        default:
            return { text: `${effectName(entry, payload?.type)} ${amount.text}`, against: amount.against };
    }
}
