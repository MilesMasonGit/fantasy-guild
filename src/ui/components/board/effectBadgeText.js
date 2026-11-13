import { EFFECT_KEY, UNIT, LIMIT } from '../../../systems/board/EffectBreakdown.js';
import { t } from '../../../i18n/index.js';

/**
 * How the Token card writes an effect badge (brief 600): its icon, its number and its hover's
 * lines, from `effectBreakdown`'s badges. Pure: every sum is the breakdown's, never worked out here.
 */

/** Each named effect's placeholder icon (`PixelGlyph`), until the owner's drawings swap in. */
export const EFFECT_GLYPH = Object.freeze({
    [EFFECT_KEY.SPEED]: 'clock',
    [EFFECT_KEY.YIELD]: 'plus',
    [EFFECT_KEY.GROWTH]: 'grow',
    [EFFECT_KEY.XP]: 'star',
    [EFFECT_KEY.DOUBLE_LOOT]: 'x2',
    [EFFECT_KEY.DOUBLE_ITEM]: 'x2',
    [EFFECT_KEY.PRESERVATION]: 'jar',
    [EFFECT_KEY.REFRESH]: 'regrow',
    [EFFECT_KEY.LUCKY]: 'sparkle',
    [EFFECT_KEY.EFFICIENCY]: 'less',
    [EFFECT_KEY.ABUNDANCE]: 'charges'
});

const MINUS = '−';

/** A number as a badge writes it: one decimal at most, a small one to one figure, never "-0". */
function figure(n) {
    const a = Math.abs(n);
    if (a > 0 && a < 0.1) return String(Number(a.toPrecision(1)));
    return String(Math.round(a * 10) / 10);
}

/**
 * A badge's number in its unit: a percent always signed (`+23%`, `−10%`), a chance as a plain
 * percent (`8%`, signed only below nothing), a count signed (`+2`).
 */
export function effectAmountText(unit, value) {
    const n = Number(value) || 0;
    const body = figure(n);
    if (unit === UNIT.CHANCE) return `${n < 0 ? MINUS : ''}${body}%`;
    const sign = n < 0 ? MINUS : '+';
    return unit === UNIT.COUNT ? `${sign}${body}` : `${sign}${body}%`;
}

/** The number on the badge: what counts, so a held badge shows the limit. */
export const badgeText = (badge) => effectAmountText(badge.unit, badge.counted);

/** A badge's colour: gold when a limit holds it, red when it works against, else green. */
export function badgeTone(badge) {
    if (badge.held) return 'held';
    return badge.counted < 0 ? 'down' : 'up';
}

export const TONE_COLOUR = Object.freeze({
    held: 'var(--color-ui-gold)',
    down: 'var(--color-ui-red)',
    up: 'var(--color-ui-green)'
});

/** The colour of one amount in a hover line. */
export const amountColour = (value) => (value < 0 ? TONE_COLOUR.down : TONE_COLOUR.up);

/**
 * A held badge's note: how much of the total counts and why. Null when nothing holds it.
 */
export function limitNote(badge) {
    if (!badge.held || !badge.limit) return null;
    const key = Object.values(LIMIT).includes(badge.limit) ? badge.limit : LIMIT.SPEED_FLOOR;
    return t(`effectBadges.limit.${key}`, {
        counted: effectAmountText(badge.unit, badge.counted),
        total: effectAmountText(badge.unit, badge.total)
    });
}

/**
 * A badge's hover as plain data: its title, one line per source with its amount, the total, the
 * limit note. The total is the sum before any limit; the note says what counts.
 * @returns {{ title: string, glyph: string, lines: Array<{key: string, name: string, amount: string, value: number}>,
 *   total: {amount: string, value: number}, note: string|null }}
 */
export function badgeTip(badge) {
    return {
        title: badge.name,
        glyph: EFFECT_GLYPH[badge.key] || 'unknown',
        lines: (badge.sources || []).map(s => ({
            key: s.key, name: s.name, amount: effectAmountText(badge.unit, s.amount), value: s.amount
        })),
        total: { amount: effectAmountText(badge.unit, badge.total), value: badge.total },
        note: limitNote(badge)
    };
}

/**
 * The Hero Effects badge's hover lines: each of the working hero's own sources, with the effect it
 * feeds and its amount there, from the breakdown's `hero` block.
 * @param {{name: string, sources: Array<{key: string, name: string, effect: string, amount: number, itemId?: string}>}} hero
 * @param {(badgeKey: string, itemId?: string) => object|null} badgeOf the badge a source belongs to (for its unit)
 * @param {(itemId: string) => string} [itemName] names an item badge's item
 */
export function heroTipLines(hero, badgeOf, itemName = (id) => id) {
    return (hero?.sources || []).map(s => {
        const badge = badgeOf(s.effect, s.itemId);
        const unit = badge?.unit || UNIT.PERCENT;
        return {
            key: `${s.effect}:${s.itemId || ''}:${s.key}`,
            name: s.name,
            effect: s.itemId
                ? t('effectBadges.card.onItem', { effect: t(`effectBadges.effect.${s.effect}`), item: itemName(s.itemId) })
                : t(`effectBadges.effect.${s.effect}`),
            amount: effectAmountText(unit, s.amount),
            value: s.amount
        };
    });
}
