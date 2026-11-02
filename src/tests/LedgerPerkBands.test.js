import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace } from '../systems/progression/ledger/pace.js';
import { PROFILE, PROFILES } from '../systems/progression/ledger/profiles.js';
import { paceContent } from './fixtures/paceWorld.js';

/**
 * A milestone perk counts from its level on, on every piece of work of its skill: the level tracks
 * price each level band at the level its perks come with, not each work at its own gate. Here a
 * Mining perk at level 7 doubles Mining XP; the only Mining work is gated at 1, and a Token asking
 * Mining 10 stretches the track past the perk.
 */

const PERK_LEVEL = 7;

function content({ perks = true } = {}) {
    const c = paceContent();
    // No Beer: its XP would meet the perk's under the bonus cap and hide it at Typical.
    delete c.items.item_beer;
    c.recipes = c.recipes.filter(r => r.id !== 'recipe_beer');
    c.effects.pw_fx_keen = {
        id: 'pw_fx_keen', name: 'Keen Eye',
        statements: [{ id: 'stm_pw_keen', keyword: 'provides', to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: 'XP_BONUS', bucket: 'percentage', value: 1, category: 'mining' } }]
    };
    if (perks) c.skillPerks = { mining: { id: 'mining', perks: [{ level: PERK_LEVEL, effectId: 'pw_fx_keen', scale: 1 }] } };
    // Markers asking Mining 6 (the Starter Camp's stage) and Mining 10 (stage 1), giving no XP.
    const marker = (id, level, tier, x) => {
        c.items[`item_${id}`] = { id: `item_${id}`, name: id, type: 'material', plan: { tier } };
        c.tokens[`token_${id}`] = {
            id: `token_${id}`, name: `${id} marker`, uses: null, needsTool: { kind: 'pickaxe', minTier: 1 },
            config: { skill: 'mining', skillRequired: level, cycleTimeMs: 3000, xp: 0, inputs: [], outputs: [{ itemId: `item_${id}`, chance: 100, minQty: 1, maxQty: 1 }] }
        };
        c.starterCamp.tokens.push({ typeId: `token_${id}`, x, y: 0 });
    };
    marker('mid', 6, 0, 3);
    marker('deep', 10, 1, 4);
    return c;
}

const paceOf = (c) => buildPace(c, buildLedger(c), null);
const row = (pace, level) => pace.trackOf('mining').levels.find(r => r.level === level);

describe('milestone perks by level band', () => {
    it('a perk lifts low-level work from its level on, at every profile', () => {
        const pace = paceOf(content());
        expect(pace.trackOf('mining').top).toBe(10);
        for (const profile of PROFILES) {
            const before = row(pace, PERK_LEVEL - 1).source[profile];
            const after = row(pace, PERK_LEVEL).source[profile];
            expect(before.work.target.token, profile).toBe('token_vein');
            expect(after.work.target.token, profile).toBe('token_vein');
            expect(after.xp / before.xp, profile).toBeCloseTo(2, 5);
        }
    });

    it('levels past the perk take half the hours they take without it; levels before it are the same', () => {
        const withPerk = paceOf(content());
        const without = paceOf(content({ perks: false }));
        for (const profile of PROFILES) {
            expect(row(withPerk, PERK_LEVEL - 1).hours[profile]).toBeCloseTo(row(without, PERK_LEVEL - 1).hours[profile], 9);
            expect(row(withPerk, 8).hours[profile] / row(without, 8).hours[profile]).toBeCloseTo(0.5, 5);
        }
    });

    it('the per-skill breakdown reads the perk where its stage levels past it', () => {
        const pace = paceOf(content());
        const [first, second] = pace.breakdown().filter(r => r.skill === 'mining');
        // Each stage is read at its last level: 5 for the Starter Camp's, below the perk: none listed.
        expect([first.tier, first.level, second.tier, second.level]).toEqual([0, 5, 1, 9]);
        expect(first.profiles[PROFILE.TYPICAL].kinds.perk).toBeUndefined();
        // Stage 1's at 9, past it: listed, and Bare's XP there is doubled.
        expect(second.profiles[PROFILE.TYPICAL].kinds.perk.names).toEqual(['perk:mining:7:pw_fx_keen']);
        expect(second.profiles[PROFILE.TYPICAL].bareXp / first.profiles[PROFILE.TYPICAL].bareXp).toBeCloseTo(2, 5);
    });
});
