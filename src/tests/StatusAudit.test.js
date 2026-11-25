import { describe, it, expect } from 'vitest';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { registerStatusFixtures, VENOM } from './fixtures/statusEffects.js';

/**
 * What the content audit says about statuses and fight moments: a Venomous kind left on an enemy
 * (retired: a poisoning move carries Venom), a rule still naming a retired status, a status narrowing
 * naming an effect that is no status, a fight moment carrying a verb it never runs, and an enemy's
 * rule counting every Nth swing or hit (an enemy's rules fire on every one).
 */

const enemy = (id, enemyBlock, statements = []) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
    enemy: { level: 1, style: 'melee', ...enemyBlock }, statements,
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});

registerEffects({
    sa_every_effect: { id: 'sa_every_effect', name: 'Every Fourth', statements: [{
        ...makeStatement(KEYWORD.APPLIES), id: 'stm_sa_every_effect', when: { event: 'FIGHT_SWING', scope: 'self', every: 4 },
        target: { role: 'opponent' }, payload: { effectId: VENOM, chance: 100 }
    }] }
});

registerTokenTypes({
    sa_venomous: enemy('sa_venomous', { kinds: ['venomous'] }),
    sa_every: enemy('sa_every', {}, [{
        ...makeStatement(KEYWORD.APPLIES), id: 'stm_sa_every', when: { event: 'FIGHT_HIT', scope: 'self', every: 3 },
        target: { role: 'actor' }, payload: { effectId: VENOM, chance: 100 }
    }]),
    sa_every_held: { ...enemy('sa_every_held', {}), effects: [{ effectId: 'sa_every_effect', scale: 1 }] },
    sa_every_one: enemy('sa_every_one', {}, [{
        ...makeStatement(KEYWORD.APPLIES), id: 'stm_sa_every_one', when: { event: 'FIGHT_HIT', scope: 'self', every: 1 },
        target: { role: 'actor' }, payload: { effectId: VENOM, chance: 100 }
    }]),
    sa_item_like: { ...enemy('sa_item_like', {}), enemy: undefined, effects: [{ effectId: 'sa_every_effect', scale: 1 }] },
    sa_retired: enemy('sa_retired', {}, [{
        ...makeStatement(KEYWORD.APPLIES), id: 'stm_sa_retired',
        when: { event: 'SELF_COMBAT_ENGAGED', scope: 'self' }, payload: { statusId: 'burning', stacks: 1 }
    }]),
    sa_bad_scope: enemy('sa_bad_scope', {}, [{
        ...makeStatement(KEYWORD.PROVIDES), id: 'stm_sa_scope', payload: { type: 'STATUS_IMMUNITY', bucket: 'flat', value: 1, category: 'effect_not_a_status' }
    }]),
    sa_grants_on_hit: enemy('sa_grants_on_hit', {}, [{
        ...makeStatement(KEYWORD.GRANTS), id: 'stm_sa_grants', when: { event: 'FIGHT_HIT', scope: 'self' },
        payload: { type: 'BONUS_DROP', itemId: 'item_bones', quantity: 1, chance: 100 }
    }])
});

const findingsFor = (id) => auditContent().filter(f => f.where === `Token "${id}"`).map(f => f.what);

describe('the audit and statuses', () => {
    it('names a Venomous kind left on an enemy as retired, whether or not the library has Venom', () => {
        registerStatusFixtures();
        const named = findingsFor('sa_venomous').filter(w => w.includes('"venomous"'));
        expect(named).toHaveLength(1);
        expect(named[0]).toContain('retired');
    });

    it('names an enemy rule on every Nth hit or swing, its own or in an effect it holds; every 1 and a non-enemy are fine', () => {
        expect(findingsFor('sa_every').filter(w => w.includes('once every 3 hits') && w.includes('ignored'))).toHaveLength(1);
        expect(findingsFor('sa_every_held').filter(w => w.includes('"sa_every_effect"') && w.includes('once every 4 swings'))).toHaveLength(1);
        expect(findingsFor('sa_every_one').some(w => w.includes('ignored'))).toBe(false);
        expect(findingsFor('sa_item_like').some(w => w.includes('the count is ignored'))).toBe(false);
    });

    it('names a rule still applying a retired status', () => {
        expect(findingsFor('sa_retired').some(w => w.includes('retired status "burning"'))).toBe(true);
    });

    it('names a status narrowing that names no status effect', () => {
        expect(findingsFor('sa_bad_scope').some(w => w.includes('"effect_not_a_status", which does not exist'))).toBe(true);
    });

    it('names a fight moment carrying a verb it never runs', () => {
        expect(findingsFor('sa_grants_on_hit').some(w => w.includes('"On Hit"') && w.includes('Grants'))).toBe(true);
    });
});
