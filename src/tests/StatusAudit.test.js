import { describe, it, expect } from 'vitest';
import { auditContent } from '../systems/core/ContentAudit.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EFFECTS } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { registerStatusFixtures, POISON } from './fixtures/statusEffects.js';

/**
 * What the content audit says about statuses and fight moments (brief 220, C4): a Venomous enemy
 * with no Poison in the library, a rule still naming a retired status, a status narrowing naming
 * an effect that is no status, and a fight moment carrying a verb it never runs.
 */

const enemy = (id, enemyBlock, statements = []) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
    enemy: { level: 1, style: 'melee', ...enemyBlock }, statements,
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});

registerTokenTypes({
    sa_venomous: enemy('sa_venomous', { kinds: ['venomous'] }),
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
    it('names a Venomous enemy while the library has no Poison status, and not once it has', () => {
        const saved = EFFECTS[POISON];
        delete EFFECTS[POISON];
        try {
            expect(findingsFor('sa_venomous').some(w => w.includes('is Venomous') && w.includes('effect_poison'))).toBe(true);
        } finally {
            if (saved) EFFECTS[POISON] = saved;
        }
        registerStatusFixtures();
        expect(findingsFor('sa_venomous').some(w => w.includes('is Venomous'))).toBe(false);
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
