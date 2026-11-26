import { describe, it, expect } from 'vitest';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, bucketsFor, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTagText } from '../ui/components/board/effectBadgeText.js';
import { effectStackFindings } from '../systems/core/effectStackRule.js';
import { perkFindings } from '../systems/core/perkRule.js';
import { MAX_BUILD_DISCOUNT, MAX_SALVAGE } from '../config/buildPrices.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';

/**
 * ⭐ Salvage and Build Discount as the CMS and the content agent meet them (brief 800 P4): each a
 * percent in the flat bucket, read from a hero (their gear, perks and what lingers on them) and a
 * Guild Hall star, never from a Token, so the effect editor offers them on an item or a perk and not
 * on a Token; in plain words on a hero and as a tag; and the effect stack audit names a best stack
 * of gear and perks that reaches either's own limit.
 */

const BUILD_AXES = [
    { type: EFFECT_TYPES.SALVAGE, label: 'Salvage' },
    { type: EFFECT_TYPES.BUILD_DISCOUNT, label: 'Build Discount' }
];

const rule = (type, value) => ({ id: 's', keyword: 'provides', to: { mode: 'all' }, reach: 'nearby', payload: { type, bucket: 'flat', value } });
const effect = (id, type, value) => ({ id, name: id, statements: [rule(type, value)] });

describe('in the CMS palette', () => {
    it.each(BUILD_AXES)('$label: a flat percent from a hero or the guild, with no narrowing, with a description', ({ type, label }) => {
        const entry = getPaletteEntry(type);
        expect(entry).toMatchObject({ label, shape: MODIFIER_SHAPES.DETERMINISTIC, scales: 'value', when: 'never', heroOrGuild: true });
        expect(entry.categories).toBeUndefined();
        expect(bucketsFor(entry)).toEqual(['flat']);
        expect(entry.hint.length).toBeGreaterThan(60);
        expect(entry.explains.length).toBeGreaterThan(20);
        expect(entry.retired || entry.guildOnly || entry.heroOnly).toBeFalsy();
    });

    it.each(BUILD_AXES)('$label: offered on an item or a perk, never on a Token', ({ type }) => {
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(type);
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).not.toContain(type);
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value: 20 } };
        expect(slotsOf(statement).find(s => s.id === 'type').options.map(o => o.id)).toContain(type);
    });
});

describe('in plain words', () => {
    it('on a hero, and as a tag', () => {
        expect(renderStatement(rule(EFFECT_TYPES.SALVAGE, 50), { carried: true }))
            .toBe('Salvage 50% on what the hero demolishes.');
        expect(renderStatement(rule(EFFECT_TYPES.BUILD_DISCOUNT, 20), { carried: true }))
            .toBe('Build Discount 20% on Foundations and their builds, while the hero is in the guild.');
        expect(effectTagText({ type: EFFECT_TYPES.SALVAGE, bucket: 'flat', value: 50 })).toBe('Salvage 50%');
        expect(effectTagText({ type: EFFECT_TYPES.BUILD_DISCOUNT, bucket: 'flat', value: 20 })).toBe('Build Discount 20%');
    });
});

describe('the audits', () => {
    const tables = (effectId, level) => ({ construction: { perks: [{ level, effectId }] } });

    it('a best stack reaching Salvage 100% is named: the whole price back, where more stops helping', () => {
        const effects = { sv: effect('sv', EFFECT_TYPES.SALVAGE, MAX_SALVAGE) };
        const found = effectStackFindings({ items: {}, effects, skillPerks: tables('sv', 75) });
        expect(found).toHaveLength(1);
        expect(found[0].message).toMatch(/Salvage 100%/);
        expect(found[0].message).toMatch(/the whole price back/);
        expect(effectStackFindings({ items: {}, effects: { sv: effect('sv', EFFECT_TYPES.SALVAGE, 60) }, skillPerks: tables('sv', 75) })).toEqual([]);
    });

    it(`a best stack reaching Build Discount ${MAX_BUILD_DISCOUNT}% is named: the most a price comes down`, () => {
        const effects = { mb: effect('mb', EFFECT_TYPES.BUILD_DISCOUNT, MAX_BUILD_DISCOUNT) };
        const found = effectStackFindings({ items: {}, effects, skillPerks: tables('mb', 99) });
        expect(found).toHaveLength(1);
        expect(found[0].message).toMatch(new RegExp(`Build Discount ${MAX_BUILD_DISCOUNT}%`));
        expect(found[0].message).toMatch(/the most a price comes down/);
        expect(effectStackFindings({ items: {}, effects: { mb: effect('mb', EFFECT_TYPES.BUILD_DISCOUNT, 20) }, skillPerks: tables('mb', 99) })).toEqual([]);
    });

    it('the perk audit asks nothing of a Salvage or Build Discount perk: they have no skill to narrow to', () => {
        const effects = { sv: effect('sv', EFFECT_TYPES.SALVAGE, 50), mb: effect('mb', EFFECT_TYPES.BUILD_DISCOUNT, 20) };
        expect(perkFindings({ skillPerks: { construction: { perks: [{ level: 75, effectId: 'sv' }, { level: 99, effectId: 'mb' }] } }, effects })).toEqual([]);
    });
});
