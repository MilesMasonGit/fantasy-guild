import { describe, it, expect } from 'vitest';
import { summonOf, isSummonType, circleChargesAt, circleChargeSetting, summonSkillSheet, traitRefOf, DEFAULT_CIRCLE_CHARGES } from '../config/registries/summonRules.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { TOKEN_TYPES } from '../config/registries/tokenConstants.js';
import { summonFindings } from '../systems/core/summonRule.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { xpForLevel } from '../utils/XPCurve.js';

/**
 * Summoned workers as content (brief 810 K5): a summon Token's block read, the charges a Circle's
 * cycle adds, its derived type, and the audit lines the CMS and the boot audit share.
 */

const enemy = { id: 'kc_slime', name: 'Content Slime', enemy: { level: 1 }, config: { skill: '', outputs: [] } };
const trait = { id: 'kc_trait', name: 'Content Trait', statements: [] };
const summon = (block, extra = {}) => ({ id: 'kc_summon', name: 'Summoned Content Slime', sprite: 's_occult', summon: block, ...extra });
const recipe = (outputs, extra = {}) => ({ id: 'recipe_kc_summon', name: 'Summoned Content Slime', skill: 'summoning', inputs: [], outputs, ...extra });
const callIt = recipe([{ tokenId: 'kc_summon', chance: 100, minQty: 1, maxQty: 1 }]);
const good = { of: 'kc_slime', skills: { farming: 10 }, trait: { effectId: 'kc_trait', scale: 1 } };

const findings = ({ tokens = {}, recipes = [callIt], effects = { kc_trait: trait } } = {}) =>
    summonFindings({ tokens: { kc_slime: enemy, ...tokens }, recipes, effects }).map(f => `${f.entityType} ${f.entityId}: ${f.message}`);

describe('a summon Token\'s block', () => {
    it('is read as its copied enemy, its skills at whole levels 1 to 99, and its one trait', () => {
        expect(isSummonType(summon(good))).toBe(true);
        expect(isSummonType({ id: 'x' })).toBe(false);
        expect(summonOf(summon({ of: 'kc_slime', skills: { farming: 10, mining: 120, fishing: 0, forestry: 'x', crafting: 12.7 }, trait: 'kc_trait' })))
            .toEqual({ of: 'kc_slime', skills: { farming: 10, mining: 99, crafting: 12 }, trait: { effectId: 'kc_trait', scale: 1 } });
        expect(summonOf({ id: 'x' })).toBeNull();
        expect(traitRefOf({ effectId: 'kc_trait', scale: 2 })).toEqual({ effectId: 'kc_trait', scale: 2 });
        expect(traitRefOf({ effectId: '' })).toBeNull();
        expect(summonSkillSheet(summon(good))).toEqual({ farming: { level: 10, xp: xpForLevel(10) } });
    });

    it('derives the Token type summon, which the CMS offers', () => {
        expect(deriveTokenType(summon(good)).type).toBe('summon');
        expect(TOKEN_TYPES).toContain('summon');
    });
});

describe('a Summoning Circle\'s charges a cycle', () => {
    it('are its base plus its per-level share of its hero\'s Summoning level, rounded down, never fewer than 1', () => {
        const circle = { summonCircle: { charges: 3, perLevel: 0.1 } };
        expect(circleChargesAt(circle, 1)).toBe(3);
        expect(circleChargesAt(circle, 10)).toBe(4);
        expect(circleChargesAt(circle, 99)).toBe(12);
        expect(circleChargesAt({ summonCircle: { charges: 0, perLevel: 0 } }, 50)).toBe(1);
    });

    it('fall back to the defaults for a Circle that authors none', () => {
        expect(circleChargeSetting({})).toEqual(DEFAULT_CIRCLE_CHARGES);
        expect(circleChargesAt({}, 10)).toBe(Math.floor(DEFAULT_CIRCLE_CHARGES.charges + DEFAULT_CIRCLE_CHARGES.perLevel * 10));
        expect(circleChargeSetting({ summonCircle: { charges: -2, perLevel: 'x' } })).toEqual(DEFAULT_CIRCLE_CHARGES);
    });
});

describe('the summon audit', () => {
    it('a summon written as the rulings ask says nothing', () => {
        expect(findings({ tokens: { kc_summon: summon(good) } })).toEqual([]);
    });

    it('names a summon that can work nothing, a skill the game lacks, a making skill and a level out of range', () => {
        expect(findings({ tokens: { kc_summon: summon({ ...good, skills: {} }) } }))
            .toEqual(['Token kc_summon: is a Summoned worker with no skill, so it can work nothing: give it one, at a level']);
        const lines = findings({ tokens: { kc_summon: summon({ ...good, skills: { brewing: 5, smithing: 20, mining: 0 } }) } });
        expect(lines).toEqual(expect.arrayContaining([
            expect.stringContaining('whose skill "brewing" the game does not have'),
            expect.stringContaining('works Smithing, a making skill'),
            expect.stringContaining('Mining level is not a whole number from 1 to 99, so it does not hold the skill')
        ]));
        // A skill with no trade (Crime, Faith, Science, Summoning) is no making skill: said as not gathering.
        const crime = findings({ tokens: { kc_summon: summon({ ...good, skills: { crime: 5 } }) } });
        expect(crime).toEqual(expect.arrayContaining([expect.stringContaining('works Crime, which is not a gathering skill')]));
        expect(crime.join(' ')).not.toContain('making skill');
    });

    it('names a missing trait or trait effect, and a copied enemy that is missing or no enemy', () => {
        expect(findings({ tokens: { kc_summon: summon({ ...good, trait: null }) } }))
            .toEqual(['Token kc_summon: is a Summoned worker with no trait: each summon carries one, a library effect']);
        expect(findings({ tokens: { kc_summon: summon({ ...good, trait: { effectId: 'kc_gone' } }) } }))
            .toEqual(['Token kc_summon: is a Summoned worker whose trait points at the effect "kc_gone", which does not exist, so it carries none']);
        expect(findings({ tokens: { kc_summon: summon({ ...good, of: '' }) } }))
            .toEqual(['Token kc_summon: is a Summoned worker that names no enemy it is a recolour of']);
        expect(findings({ tokens: { kc_summon: summon({ ...good, of: 'kc_summon' }) } }))
            .toEqual(['Token kc_summon: is a Summoned worker named a recolour of "kc_summon", which is not an enemy']);
    });

    it('names a summon no recipe calls, and a recipe that calls one wrongly', () => {
        expect(findings({ tokens: { kc_summon: summon(good) }, recipes: [] }))
            .toEqual(['Token kc_summon: is a Summoned worker no Summoning recipe calls, so it is never summoned: give a Summoning recipe it as its output']);
        const wrong = recipe([
            { tokenId: 'kc_summon', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'item_x', chance: 100, minQty: 1, maxQty: 1 }
        ], { skill: 'alchemy' });
        expect(findings({ tokens: { kc_summon: summon(good) }, recipes: [wrong] })).toEqual([
            'Recipe recipe_kc_summon: calls a Summoned worker but is a Alchemy recipe: only a Summoning Circle calls one, so make it a Summoning recipe',
            'Recipe recipe_kc_summon: calls a Summoned worker and makes something besides: a summon recipe makes nothing else, so remove its other outputs'
        ]);
    });

    it('names a Circle setting on a Token that does not work as Summoning', () => {
        const forge = { id: 'kc_forge', name: 'Content Forge', summonCircle: { charges: 3 }, statements: [{ id: 's', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } }] };
        const circle = { id: 'kc_circle', name: 'Content Circle', summonCircle: { charges: 3 }, statements: [{ id: 's2', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }] };
        expect(findings({ tokens: { kc_forge: forge, kc_circle: circle } }))
            .toEqual(['Token kc_forge: has a Summoning Circle charge setting but does not work as Summoning, so nothing reads it']);
    });

    it('the boot audit says the same of the registered content, and nothing else of a well-written summon', () => {
        registerEffects({
            kc_boot_trait: { id: 'kc_boot_trait', name: 'Boot Trait', statements: [{ id: 'stm_kc_boot', keyword: KEYWORD.PROVIDES, payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1, category: 'farming' }, to: { mode: 'all', value: '' }, reach: 'nearby' }] }
        });
        registerTokenTypes({
            kc_boot_slime: { id: 'kc_boot_slime', name: 'Boot Slime', rarity: 'common', theme: 'fixture', sprite: 's_occult', tokenType: 'enemy', uses: 1, enemy: { level: 1 }, config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] } },
            kc_boot_summon: { id: 'kc_boot_summon', name: 'Summoned Boot Slime', rarity: 'common', theme: 'fixture', sprite: 's_occult', summon: { of: 'kc_boot_slime', skills: { farming: 10 }, trait: { effectId: 'kc_boot_trait', scale: 1 } } },
            kc_boot_lonely: { id: 'kc_boot_lonely', name: 'Summoned Lonely', rarity: 'common', theme: 'fixture', sprite: 's_occult', summon: { of: 'kc_boot_slime', skills: { farming: 10 }, trait: { effectId: 'kc_boot_trait', scale: 1 } } }
        });
        registerRecipePools({
            summoning: [{ id: 'recipe_kc_boot', name: 'Summoned Boot Slime', skill: 'summoning', levelRequirement: 1, requiresContext: [], inputs: [], outputs: [{ tokenId: 'kc_boot_summon', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 2000, xp: 1 }]
        });
        const about = (id) => auditContent().filter(f => f.where.includes(id)).map(f => f.what);
        expect(about('kc_boot_summon')).toEqual([]);
        expect(about('recipe_kc_boot')).toEqual([]);
        expect(about('kc_boot_lonely')).toEqual(['is a Summoned worker no Summoning recipe calls, so it is never summoned: give a Summoning recipe it as its output']);
    });
});
