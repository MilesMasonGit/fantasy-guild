import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { planCycle } from '../systems/board/Charges.js';
import { ownCycleCost, DEFAULT_STATION_CHARGE_COST } from '../systems/board/cycleCharges.js';

/**
 * A recipe carries no charge cost for the Token that runs it: the spend is flat, a Foundation pays
 * none, and a `stationChargeCost` an old recipe still carries is ignored.
 */

registerTokenTypes({
    fixture_rcc_node: {
        id: 'fixture_rcc_node', name: 'Fixture Node', rarity: 'common', theme: 'fixture', uses: 6,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, outputs: [{ itemId: 'item_coal', minQty: 1, maxQty: 1, chance: 100 }] }
    },
    fixture_rcc_foundation: {
        id: 'fixture_rcc_foundation', name: 'Fixture Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'stone', skill: 'construction' }
    }
});

const instance = (typeId) => ({ id: `i_${typeId}`, typeId, usesRemaining: 6 });

describe('The charge a Token spends to run a recipe', () => {
    it('is the flat default, whatever a recipe still carries', () => {
        const io = { recipe: { id: 'r', stationChargeCost: 5 } };
        const plan = planCycle('i1', instance('fixture_rcc_node'), io);
        expect(plan.debits.map(d => d.amount)).toEqual([DEFAULT_STATION_CHARGE_COST]);
    });

    it('is nothing for a Foundation, which is replaced by what it builds', () => {
        const plan = planCycle('i2', instance('fixture_rcc_foundation'), { recipe: { id: 'r' } });
        expect(plan.ok).toBe(true);
        expect(plan.debits).toEqual([]);
    });

    it('is the flat default for the CMS rate calculator', () => {
        expect(ownCycleCost({ id: 'x' })).toBe(DEFAULT_STATION_CHARGE_COST);
    });
});

describe('A recipe still carrying the retired charge cost', () => {
    const recipe = (extra) => ({
        id: 'fixture_rcc_recipe', name: 'Fixture Recipe', skill: 'smithing', levelRequirement: 1,
        inputs: [{ itemId: 'item_coal', quantity: 1 }],
        outputs: [{ itemId: 'item_coal', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 10000, xp: 1, ...extra
    });
    const audit = () => JSON.stringify(auditContent());

    it('loads, and the content check says the same as without it', () => {
        registerRecipePools({ smithing: [recipe({})] });
        const without = audit();
        registerRecipePools({ smithing: [recipe({ stationChargeCost: 3 })] });
        expect(audit()).toBe(without);
    });
});
