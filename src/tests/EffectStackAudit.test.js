import { describe, it, expect } from 'vitest';
import { bestEffectStacks, effectStackFindings, STACK_LIMITS } from '../systems/core/effectStackRule.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';

/**
 * The same effect from several sources adds in full, so the audits name an effect a hero's best
 * stack of gear and perks pushes to its own limit: a chance at 100 %, a speed-up at the floor, a
 * cost cut at 100 %. Content is handed in, as the CMS hands in its workspace.
 */

const provides = (id, type, bucket, value, category) => ({
    id, keyword: KEYWORD.PROVIDES, to: null,
    payload: { type, bucket, value, ...(category ? { category } : {}) }
});
const effect = (id, ...statements) => ({ id, name: id, statements });
const item = (id, equipSlot, effectId, scale = 1, extra = {}) => ({ id, name: id, type: 'armor', equipSlot, effects: [{ effectId, scale }], ...extra });

const EFFECTS = {
    lucky: effect('lucky', provides('s_lucky', EFFECT_TYPES.LOOT_MULT, 'flat', 10, 'mining')),
    quick: effect('quick', provides('s_quick', EFFECT_TYPES.WORK_TIME, 'percentage', -0.1, 'mining')),
    quick_all: effect('quick_all', provides('s_quick_all', EFFECT_TYPES.WORK_TIME, 'percentage', -0.1)),
    frugal: effect('frugal', provides('s_frugal', EFFECT_TYPES.INPUT_COST, 'percentage', -0.25, 'smithing')),
    keen: effect('keen', provides('s_keen', EFFECT_TYPES.CRIT_CHANCE, 'flat', 10)),
    slow: effect('slow', provides('s_slow', EFFECT_TYPES.WORK_TIME, 'percentage', 0.5, 'mining')),
    moment: effect('moment', { ...provides('s_moment', EFFECT_TYPES.LOOT_MULT, 'flat', 90, 'mining'), when: { event: 'WORK_START', scope: 'self' } })
};

const ofType = (stacks, type, category) => stacks.find(s => s.type === type && s.category === category);

describe('the best stack of gear and perks on one effect', () => {
    it('fills every place gear goes with its best piece, adds the perks in full, and keeps skills apart', () => {
        const items = {
            hat: item('hat', 'hat', 'quick', 3),
            hat2: item('hat2', 'hat', 'quick', 1),
            chest: item('chest', 'chest', 'quick', 2),
            ring: item('ring', 'trinket', 'quick_all', 1)
        };
        const skillPerks = { mining: { perks: [{ level: 10, effectId: 'quick', scale: 1 }, { level: 25, effectId: 'quick', scale: 1 }] } };
        const stacks = bestEffectStacks({ items, effects: EFFECTS, skillPerks });
        const mining = ofType(stacks, EFFECT_TYPES.WORK_TIME, 'mining');
        expect(mining.pieces.map(p => p.itemId).sort()).toEqual(['chest', 'hat', 'ring']);
        expect(mining.perks).toBeCloseTo(0.2);
        expect(mining.total).toBeCloseTo(0.8);
        // Only the unnarrowed ring counts on every skill.
        expect(ofType(stacks, EFFECT_TYPES.WORK_TIME, 'ALL').total).toBeCloseTo(0.1);
    });

    it('counts only always-on rules in the limit\'s bucket, in the helping direction', () => {
        const items = { a: item('a', 'hat', 'moment', 1), b: item('b', 'chest', 'slow', 1) };
        expect(effectStackFindings({ items, effects: EFFECTS })).toEqual([]);
        expect(ofType(bestEffectStacks({ items, effects: EFFECTS }), EFFECT_TYPES.WORK_TIME, 'mining').total).toBe(0);
    });

    it('reads every limit the brief names: chances, crits, the speed-up floor, a cost cut', () => {
        const types = STACK_LIMITS.map(l => l.type);
        expect(types).toEqual(expect.arrayContaining([
            EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.REFRESH, EFFECT_TYPES.PRESERVATION, EFFECT_TYPES.CRIT_CHANCE,
            EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.INPUT_COST
        ]));
        expect(types).not.toContain(EFFECT_TYPES.FAIL_CHANCE);
    });
});

describe('the audit names a stack at the effect\'s own limit', () => {
    it('names Speed at the floor, with every piece and the perks', () => {
        const items = { hat: item('hat', 'hat', 'quick', 4), chest: item('chest', 'chest', 'quick', 3) };
        const skillPerks = { mining: { perks: [{ level: 10, effectId: 'quick', scale: 1 }] } };
        const [finding] = effectStackFindings({ items, effects: EFFECTS, skillPerks });
        expect(finding).toMatchObject({ entityType: 'Item', entityId: 'hat', field: 'effects' });
        expect(finding.message).toContain('Speed -80%');
        expect(finding.message).toContain('Mining');
        expect(finding.message).toContain('hat -40%');
        expect(finding.message).toContain('milestone perks -10%');
        expect(finding.message).toContain('speed-up floor');
    });

    it('stays quiet one step short of it', () => {
        const items = { hat: item('hat', 'hat', 'quick', 4), chest: item('chest', 'chest', 'quick', 3) };
        expect(effectStackFindings({ items, effects: EFFECTS })).toEqual([]);
    });

    it('names a chance at 100 % and a crit on every hit', () => {
        const items = {
            hat: item('hat', 'hat', 'lucky', 5), chest: item('chest', 'chest', 'lucky', 5),
            t1: item('t1', 'trinket', 'keen', 5), t2: item('t2', 'trinket', 'keen', 5)
        };
        const skillPerks = { melee: { perks: [{ level: 10, effectId: 'keen', scale: 5 }] } };
        const messages = effectStackFindings({ items, effects: EFFECTS, skillPerks }).map(f => f.message);
        expect(messages.some(m => m.includes('Double Loot 100%') && m.includes('a chance of 100%'))).toBe(true);
        expect(messages.some(m => m.includes('Crit Chance 155%') && m.includes('a crit on every hit'))).toBe(true);
    });

    it('names a cost cut at 100 %', () => {
        const items = { hat: item('hat', 'hat', 'frugal', 2), chest: item('chest', 'chest', 'frugal', 2) };
        const [finding] = effectStackFindings({ items, effects: EFFECTS });
        expect(finding.message).toContain('Efficiency -100%');
        expect(finding.message).toContain('inputs cut by 100%');
    });

    it('counts two hands as one weapon and one tool, and a trinket place twice', () => {
        const items = {
            sword: item('sword', 'hand', 'quick_all', 3, { type: 'weapon', styles: ['melee'], damage: 2 }),
            sword2: item('sword2', 'hand', 'quick_all', 3, { type: 'weapon', styles: ['melee'], damage: 2 }),
            t1: item('t1', 'trinket', 'quick_all', 1), t2: item('t2', 'trinket', 'quick_all', 1), t3: item('t3', 'trinket', 'quick_all', 1)
        };
        const all = ofType(bestEffectStacks({ items, effects: EFFECTS }), EFFECT_TYPES.WORK_TIME, 'ALL');
        expect(all.total).toBeCloseTo(0.5);
    });

    it('names a stack on every skill once, not again for each skill', () => {
        const items = { hat: item('hat', 'hat', 'quick_all', 5), chest: item('chest', 'chest', 'quick_all', 3), ring: item('ring', 'trinket', 'quick', 1) };
        const findings = effectStackFindings({ items, effects: EFFECTS });
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain('every skill');
    });

    it('names a stack made of perks alone', () => {
        const skillPerks = { mining: { perks: [10, 20, 30, 40].map(level => ({ level, effectId: 'quick', scale: 2 })) } };
        const [finding] = effectStackFindings({ items: {}, effects: EFFECTS, skillPerks });
        expect(finding).toMatchObject({ entityType: 'Milestone perks', entityId: null });
        expect(finding.message).toContain('milestone perks -80%');
    });
});
