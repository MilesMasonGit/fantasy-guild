import { EFFECT_KEY, UNIT, LIMIT } from '../../../systems/board/EffectBreakdown.js';
import { t } from '../../../i18n/index.js';
import { chanceText, timesText } from '../../../utils/Formatters.js';
import { getPaletteEntry } from '../../../config/registries/modifierPalette.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import {
    effectTag, percentAmountText, chanceAmountText, countAmountText
} from '../../../config/registries/effectWords.js';

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
    [EFFECT_KEY.ABUNDANCE]: 'charges',
    [EFFECT_KEY.NEVER_RUNS_OUT]: 'lock',
    [EFFECT_KEY.FREE_REPLANT]: 'grow',
    [EFFECT_KEY.GROVE_FELLING]: 'x2',
    [EFFECT_KEY.BETTER_CATCH]: 'plus'
});

/**
 * A badge's number in its unit: a percent always signed (`+23%`, `−10%`), a chance as a plain
 * percent (`8%`, signed only below nothing), a count signed (`+2`). The same writer words a
 * building's Boosts list and every rule line (`effectWords.js`).
 */
export function effectAmountText(unit, value) {
    const n = Number(value) || 0;
    if (unit === UNIT.CHANCE) return chanceAmountText(n);
    return unit === UNIT.COUNT ? countAmountText(n) : percentAmountText(n);
}

/**
 * A rule's payload as the badge it causes (`Speed +25%`, `Double Loot 10%`, `Bird Nest 5%`), and
 * whether it works against its bearer: a building's Boosts list, the mat's support labels, a buff
 * Token's list. `type` is the effect, for its explanation (`effectExplain.js`).
 * @returns {{text: string, against: boolean, type: string}}
 */
export function effectTagOf(payload, itemName = (id) => getItem(id)?.name || null) {
    return { ...effectTag(getPaletteEntry(payload?.type), payload, itemName), type: payload?.type };
}

/** {@link effectTagOf}'s words alone. */
export const effectTagText = (payload, itemName) => effectTagOf(payload, itemName).text;

const rulesOf = (badge) => (badge?.sources || []).flatMap(s => s.rules || []);

/**
 * An amount on `badge` (its total, what counts, or one source's share, given that source's
 * `rules`). Lucky's percentage is a share of the rare table's chance, so it reads as a multiplier
 * (`×1.2`), never `+20%`, which reads as points; a flat Lucky adds points and reads in them (`+1%`).
 * Every other badge reads in its unit.
 */
export function badgeAmountText(badge, value, rules = rulesOf(badge)) {
    const n = Number(value) || 0;
    if (badge?.key !== EFFECT_KEY.LUCKY) return effectAmountText(badge?.unit, n);
    if (rules.every(r => r.bucket !== 'flat')) return timesText(Math.max(0, 1 + n / 100));
    return percentAmountText((n * (Number(badge.base) || 0)) / 100);
}

/** The number on the badge: what counts, so a held badge shows the limit. */
export const badgeText = (badge) => badgeAmountText(badge, badge.counted);

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
        counted: badgeAmountText(badge, badge.counted),
        total: badgeAmountText(badge, badge.total)
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
            key: s.key, name: s.name, amount: badgeAmountText(badge, s.amount, s.rules), value: s.amount
        })),
        total: { amount: badgeAmountText(badge, badge.total), value: badge.total },
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
        const badge = badgeOf(s.effect, s.itemId) || { key: s.effect, unit: UNIT.PERCENT };
        return {
            key: `${s.effect}:${s.itemId || ''}:${s.key}`,
            name: s.name,
            effect: s.itemId
                ? t('effectBadges.card.onItem', { effect: t(`effectBadges.effect.${s.effect}`), item: itemName(s.itemId) })
                : t(`effectBadges.effect.${s.effect}`),
            amount: badgeAmountText(badge, s.amount, s.rules),
            value: s.amount
        };
    });
}

/**
 * A live chance's hover when a bonus counts in it: the base, each bonus with its source, then the
 * result (`1% base · Lucky ×1.2 (Ana's Ring) · = 1.2%`), from the badge that moves it, so the
 * hover and the number on the card are the breakdown's own sums. Null with no badge: a chance
 * nothing changes has no extra hover.
 */
export function chanceBreakdownText(badge) {
    if (!badge?.sources?.length) return null;
    return [
        t('effectBadges.card.chanceBase', { chance: chanceText(badge.base) }),
        ...badge.sources.map(s => t('effectBadges.card.chanceBonus', {
            effect: badge.name, amount: badgeAmountText(badge, s.amount, s.rules), source: s.name
        })),
        t('effectBadges.card.chanceResult', { chance: chanceText(badge.final) })
    ].join(' · ');
}
