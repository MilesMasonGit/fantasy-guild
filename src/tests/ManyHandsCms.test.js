import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { getPaletteEntry, bucketsFor, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTagText } from '../ui/components/board/effectBadgeText.js';
import { perkFindings } from '../systems/core/perkRule.js';
import { effectStackFindings } from '../systems/core/effectStackRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';

/**
 * ⭐ Second Recipe, the Many Hands perk's effect (brief 800 P3), as the CMS and the content agent meet
 * it: an on-or-off effect (no number to type), narrowed by skill, read from a hero or a Guild Hall
 * star and never from a Token, so the editor offers it on an item or a perk and not on a Token; in
 * plain words on a hero and as a tag; the perk audit asks for the skill when a perk leaves it out; a
 * Token carrying it is named by the boot audit; the stack audit leaves it alone (it is no chance);
 * and the ledger's rate calculator lists it as an axis it does not model.
 */

const ALL = { mode: 'all' };
const rule = (value = 1, extra = {}) => ({
    id: 's', keyword: 'provides', to: ALL, reach: 'nearby',
    payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value, ...extra }
});

describe('in the CMS palette', () => {
    it('an on-or-off effect in the flat bucket, narrowed by skill, from a hero or the guild, with a description', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.SECOND_RECIPE);
        expect(entry).toMatchObject({
            label: 'Second Recipe', flag: true, shape: MODIFIER_SHAPES.DETERMINISTIC, categories: 'skill',
            heroOrGuild: true, when: 'never'
        });
        expect(entry.scales).toBeUndefined();
        expect(bucketsFor(entry)).toEqual(['flat']);
        expect(entry.hint.length).toBeGreaterThan(80);
        expect(entry.explains).toMatch(/second/i);
        expect(entry.retired || entry.guildOnly || entry.heroOnly).toBeFalsy();
    });

    it('offered on an item or a perk with its skill picker and no amount, never on a Token', () => {
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(EFFECT_TYPES.SECOND_RECIPE);
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).not.toContain(EFFECT_TYPES.SECOND_RECIPE);
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1 } };
        const slots = slotsOf(statement);
        expect(slots.find(s => s.id === 'type').options.map(o => o.id)).toContain(EFFECT_TYPES.SECOND_RECIPE);
        expect(slots.find(s => s.id === 'category').options.map(o => o.id)).toContain('crafting');
        // On or off: nothing to type, nothing to combine.
        expect(slots.find(s => s.id === 'value')).toBeUndefined();
        expect(slots.find(s => s.id === 'bucket')).toBeUndefined();
        // Chosen in the editor, it is born on.
        const picked = slots.find(s => s.id === 'type').patch(EFFECT_TYPES.SECOND_RECIPE);
        expect(picked.payload).toEqual({ type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1 });
    });
});

describe('in plain words', () => {
    it('on a hero, unnarrowed, off, and as a tag', () => {
        expect(renderStatement(rule(1, { category: 'crafting' }), { carried: true }))
            .toBe('Second Recipe at the Crafting stations the hero works.');
        expect(renderStatement(rule(1), { carried: true }))
            .toBe('Second Recipe at the stations the hero works.');
        expect(renderStatement(rule(0, { category: 'crafting' }), { carried: true }))
            .toBe('Second Recipe off at the Crafting stations the hero works.');
        expect(effectTagText({ type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1 })).toBe('Second Recipe');
    });
});

describe('the audits', () => {
    it('the perk audit asks for the skill when a perk leaves it out, and is quiet when it names it', () => {
        const effects = {
            loose: { id: 'loose', name: 'Loose', statements: [rule(1)] },
            narrow: { id: 'narrow', name: 'Many Hands', statements: [rule(1, { category: 'crafting' })] }
        };
        const loose = perkFindings({ skillPerks: { crafting: { perks: [{ level: 99, effectId: 'loose' }] } }, effects });
        expect(loose).toHaveLength(1);
        expect(loose[0].message).toMatch(/Second Recipe on every skill's work, not only Crafting's/);
        expect(perkFindings({ skillPerks: { crafting: { perks: [{ level: 99, effectId: 'narrow' }] } }, effects })).toEqual([]);
    });

    it('the stack audit names nothing: on is on, there is no chance to push past 100', () => {
        const effects = { mh: { id: 'mh', name: 'Many Hands', statements: [rule(1, { category: 'crafting' })] } };
        expect(effectStackFindings({ items: {}, effects, skillPerks: { crafting: { perks: [{ level: 99, effectId: 'mh' }] } } })).toEqual([]);
    });

    it('a Token carrying it is named by the boot audit: a Token\'s reaches nobody', () => {
        registerTokenTypes({
            mhc_banner: {
                id: 'mhc_banner', name: 'MHC Banner', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
                sprite: 's_nature', requiresHero: false, statements: [{ ...rule(1, { category: 'crafting' }), id: 'stm_mhc_banner' }]
            }
        });
        const findings = auditContent().filter(f => f.where === 'Token "mhc_banner"');
        expect(findings.map(f => f.what).join(' ')).toMatch(/Second Recipe reaches nobody/);
    });
});

describe('the CMS rate calculator', () => {
    // ⚠️ The calculator lists the axes it does not read off a Token in reach (`noteAxis`), not off a
    // hero's perks or gear: Many Hands is not priced by the ledger either way.
    it('a Token in reach carrying it is listed as unmodelled, not dropped', () => {
        const book = buildRateBook({
            tokens: {
                mhc_bench: {
                    id: 'mhc_bench', name: 'mhc_bench', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry', requiresHero: true,
                    config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'mhc_rope', chance: 100, minQty: 1, maxQty: 1 }] }
                },
                mhc_banner: {
                    id: 'mhc_banner', name: 'mhc_banner', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
                    statements: [{ ...rule(1, { category: 'crafting' }), id: 'stm_mhc_banner' }]
                }
            },
            items: { mhc_rope: { id: 'mhc_rope', name: 'Rope', type: 'material', stackable: true, equipSlot: '' } },
            recipes: [], effects: {}, starterCamp: { tokens: [] }
        });
        const rate = book.rateOf({ token: 'mhc_bench' }, { supports: ['mhc_banner'] });
        expect(rate.unmodelled).toContainEqual(expect.objectContaining({ source: 'mhc_banner', what: EFFECT_TYPES.SECOND_RECIPE }));
    });
});
