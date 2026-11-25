import { describe, it, expect } from 'vitest';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, bucketsFor, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTagText } from '../ui/components/board/effectBadgeText.js';
import { perkFindings } from '../systems/core/perkRule.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';

/**
 * ⭐ The four gathering signature perks as the CMS and the content agent meet them (brief 800 P1 and
 * P2): each a percent chance in the flat bucket with a skill to narrow to, in plain words on a Token,
 * on a hero and as a badge's tag; the perk audit asks for the skill when a perk leaves it out; and
 * the ledger's rate calculator lists each as an axis it does not model, never silently drops it.
 */

const PERK_AXES = [
    { type: EFFECT_TYPES.NEVER_RUNS_OUT, label: 'Never Runs Out', skill: 'mining' },
    { type: EFFECT_TYPES.FREE_REPLANT, label: 'Free Replant', skill: 'farming' },
    { type: EFFECT_TYPES.GROVE_FELLING, label: 'Grove Felling', skill: 'forestry' },
    { type: EFFECT_TYPES.BETTER_CATCH, label: 'Better Catch', skill: 'fishing' }
];

const ALL = { mode: 'all' };
const rule = (type, value, extra = {}) => ({ id: 's', keyword: 'provides', to: ALL, reach: 'nearby', payload: { type, bucket: 'flat', value, ...extra } });

describe('in the CMS palette', () => {
    it.each(PERK_AXES)('$label: a flat percent chance, scaled, narrowed by skill, with a description', ({ type, label }) => {
        const entry = getPaletteEntry(type);
        expect(entry).toMatchObject({ label, shape: MODIFIER_SHAPES.PROC, categories: 'skill', scales: 'value', when: 'never' });
        expect(bucketsFor(entry)).toEqual(['flat']);
        expect(entry.hint.length).toBeGreaterThan(40);
        expect(entry.retired || entry.guildOnly || entry.heroOnly).toBeFalsy();
    });

    it.each(PERK_AXES)('$label: its "only for" picker lists the skills', ({ type, skill }) => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value: 100 } };
        const only = slotsOf(statement).find(s => s.id === 'category');
        expect(only.options.map(o => o.id)).toContain(skill);
    });
});

describe('in plain words', () => {
    it('on a Token, on a hero and as a tag', () => {
        expect(renderStatement(rule(EFFECT_TYPES.NEVER_RUNS_OUT, 100, { category: 'mining' })))
            .toBe('Never Runs Out 100% on every nearby Mining Token.');
        expect(renderStatement(rule(EFFECT_TYPES.NEVER_RUNS_OUT, 100, { category: 'mining' }), { carried: true }))
            .toBe('Never Runs Out 100% on Mining Tokens.');
        expect(renderStatement(rule(EFFECT_TYPES.FREE_REPLANT, 100, { category: 'farming' }), { carried: true }))
            .toBe('Free Replant 100% on Farming Tokens.');
        expect(renderStatement(rule(EFFECT_TYPES.GROVE_FELLING, 100, { category: 'forestry' }), { carried: true }))
            .toBe('Grove Felling 100% on Forestry Tokens.');
        expect(renderStatement(rule(EFFECT_TYPES.BETTER_CATCH, 15, { category: 'fishing' }), { carried: true }))
            .toBe('Better Catch 15% on Fishing Tokens.');
        expect(effectTagText({ type: EFFECT_TYPES.BETTER_CATCH, bucket: 'flat', value: 15 })).toBe('Better Catch 15%');
    });
});

describe('the perk audit', () => {
    it('asks for the skill when a perk leaves it out, and is quiet when it names it', () => {
        const effects = {
            loose: { id: 'loose', name: 'Loose', statements: [rule(EFFECT_TYPES.NEVER_RUNS_OUT, 100)] },
            narrow: { id: 'narrow', name: 'Motherlode', statements: [rule(EFFECT_TYPES.NEVER_RUNS_OUT, 100, { category: 'mining' })] }
        };
        const loose = perkFindings({ skillPerks: { mining: { perks: [{ level: 99, effectId: 'loose' }] } }, effects });
        expect(loose).toHaveLength(1);
        expect(loose[0].message).toMatch(/Never Runs Out on every skill's work/);
        expect(perkFindings({ skillPerks: { mining: { perks: [{ level: 99, effectId: 'narrow' }] } }, effects })).toEqual([]);
    });
});

describe('the CMS rate calculator', () => {
    const work = (id, skill) => ({
        id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: true,
        config: { skill, skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'gpc_ore', chance: 100, minQty: 1, maxQty: 1 }] }
    });
    const building = (id, type, skill) => ({
        id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
        statements: [{ ...rule(type, 100, { category: skill }), id: `stm_${id}` }]
    });

    it.each(PERK_AXES)('$label reaching the work is listed as unmodelled, not dropped', ({ type, skill }) => {
        const book = buildRateBook({
            tokens: { gpc_work: work('gpc_work', skill), gpc_perk: building('gpc_perk', type, skill) },
            items: { gpc_ore: { id: 'gpc_ore', name: 'Ore', type: 'material', stackable: true, equipSlot: '' } },
            recipes: [], effects: {}, starterCamp: { tokens: [] }
        });
        const rate = book.rateOf({ token: 'gpc_work' }, { supports: ['gpc_perk'] });
        expect(rate.unmodelled).toContainEqual(expect.objectContaining({ source: 'gpc_perk', what: type }));
    });
});
