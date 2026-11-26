import { describe, it, expect } from 'vitest';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, bucketsFor, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTagText } from '../ui/components/board/effectBadgeText.js';
import { perkFindings } from '../systems/core/perkRule.js';
import { hallRuleSentence } from '../systems/progression/hallStarText.js';
import { combatContributions } from '../systems/hero/HeroEffects.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';

/**
 * ⭐ The combat tricks as the CMS and the content agent meet them (brief 800 P5): Heal on Kill a flat
 * number of health, Last Stand, Twin Strike and Crit After Dodge each a percent chance; all four
 * read off the hero for the style they fight in (narrowed to a combat style), lent by gear, perks,
 * a lingering effect or a Guild Hall star; in plain words on an item, a perk and a star; the perk
 * audit asks for the style when a combat skill's perk leaves it out.
 */

const TRICKS = [
    { type: EFFECT_TYPES.KILL_HEAL, label: 'Heal on Kill', shape: MODIFIER_SHAPES.DETERMINISTIC, value: 3, tag: 'Heal on Kill +3', style: 'melee' },
    { type: EFFECT_TYPES.LAST_STAND, label: 'Last Stand', shape: MODIFIER_SHAPES.PROC, value: 100, tag: 'Last Stand 100%', style: 'melee' },
    { type: EFFECT_TYPES.TWIN_STRIKE, label: 'Twin Strike', shape: MODIFIER_SHAPES.PROC, value: 20, tag: 'Twin Strike 20%', style: 'ranged' },
    { type: EFFECT_TYPES.DODGE_CRIT, label: 'Crit After Dodge', shape: MODIFIER_SHAPES.PROC, value: 100, tag: 'Crit After Dodge 100%', style: 'stealth' }
];

const provides = (type, value, extra = {}) => ({ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type, bucket: 'flat', value, ...extra } });

describe('in the CMS palette', () => {
    it.each(TRICKS)('$label: a flat number, a fighter\'s, narrowed by combat style, with a description', ({ type, label, shape }) => {
        const entry = getPaletteEntry(type);
        expect(entry).toMatchObject({ label, shape, categories: 'combatStyle', scales: 'value', when: 'never', heroOnly: true, fromGuild: true, group: 'Combat' });
        expect(bucketsFor(entry)).toEqual(['flat']);
        expect(entry.hint.length).toBeGreaterThan(60);
        expect(entry.hint).not.toMatch(/swing/i);
        expect(entry.explains).toBeTruthy();
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(type);
    });

    it.each(TRICKS)('$label: its "only for" picker lists the combat styles', ({ type, value, style }) => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value } };
        const only = slotsOf(statement).find(s => s.id === 'category');
        expect(only.options.map(o => o.id)).toContain(style);
    });

    it.each(TRICKS)('$label on gear or a perk reaches the hero\'s aggregator, its style with it', ({ type, value, style }) => {
        expect(combatContributions([provides(type, value, { category: style })], { carried: true }))
            .toEqual([{ type, value, category: style }]);
    });
});

describe('in plain words', () => {
    it.each(TRICKS)('$label as a tag, on a hero and on a perk', ({ type, value, tag, style }) => {
        expect(effectTagText({ type, bucket: 'flat', value })).toBe(tag);
        const name = { melee: 'Melee', ranged: 'Ranged', stealth: 'Stealth' }[style];
        expect(renderStatement(provides(type, value, { category: style }), { carried: true }))
            .toBe(`${tag} in combat, but only as a ${name} fighter.`);
    });

    it('a Guild Hall star carrying one names the fighters it helps', () => {
        expect(hallRuleSentence(provides(EFFECT_TYPES.KILL_HEAL, 2, { category: 'melee' }))).toBe('Heal on Kill +2 for every Melee fighter in combat.');
        expect(hallRuleSentence(provides(EFFECT_TYPES.TWIN_STRIKE, 10))).toBe('Twin Strike 10% for every hero in combat.');
    });
});

describe('the perk audit', () => {
    const effects = {
        loose: { id: 'loose', name: 'Loose Wind', statements: [provides(EFFECT_TYPES.KILL_HEAL, 3)] },
        narrow: { id: 'narrow', name: 'Second Wind', statements: [provides(EFFECT_TYPES.KILL_HEAL, 3, { category: 'melee' })] },
        damage: { id: 'damage', name: 'Hard Hits', statements: [provides(EFFECT_TYPES.DAMAGE, 1)] }
    };

    it('asks for the style when a combat skill\'s perk leaves it out, and is quiet when it names it', () => {
        const loose = perkFindings({ skillPerks: { melee: { perks: [{ level: 75, effectId: 'loose' }] } }, effects });
        expect(loose).toHaveLength(1);
        expect(loose[0].message).toMatch(/Heal on Kill in every fighting style, not only as a Melee fighter/);
        expect(perkFindings({ skillPerks: { melee: { perks: [{ level: 75, effectId: 'narrow' }] } }, effects })).toEqual([]);
    });

    it('any combat-style row on a combat skill\'s perk, the same; a work skill\'s perk is left alone', () => {
        expect(perkFindings({ skillPerks: { ranged: { perks: [{ level: 10, effectId: 'damage' }] } }, effects })).toHaveLength(1);
        expect(perkFindings({ skillPerks: { mining: { perks: [{ level: 10, effectId: 'loose' }] } }, effects })).toEqual([]);
    });
});
