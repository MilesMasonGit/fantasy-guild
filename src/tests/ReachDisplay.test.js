import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { showsNearRing } from '../systems/board/reachDisplay.js';
import { caresAboutNeighbours, KEYWORD } from '../systems/effects/statements.js';

/**
 * ⭐ Which Tokens show a reach ring: "only tokens that care about reach" — read
 * broadly, any Token whose rules act on or depend on what is near it.
 */
const provides = (reach) => ({ keyword: KEYWORD.PROVIDES, reach, payload: {} });

registerTokenTypes({
    rd_plain: { id: 'rd_plain', name: 'Plain', tokenType: 'resource' },
    rd_buff_near: { id: 'rd_buff_near', name: 'Near buff', statements: [provides('nearby')] },
    rd_buff_self: { id: 'rd_buff_self', name: 'Self buff', statements: [provides('self')] },
    rd_buff_board: { id: 'rd_buff_board', name: 'Board buff', statements: [provides('board')] },
    rd_requires: { id: 'rd_requires', name: 'Vein', acceptedTokens: [{ tag: 'pickaxe', minTier: 1 }] },
    rd_cannot: { id: 'rd_cannot', name: 'Coast', statements: [{ keyword: KEYWORD.CANNOT, payload: {} }] },
    rd_trigger: {
        id: 'rd_trigger', name: 'Watcher',
        statements: [{ keyword: KEYWORD.SPAWNS, when: { event: 'CYCLE_COMPLETE', scope: 'nearby' }, payload: {} }]
    },
    // A camp of enemies with a neighbour rule, and a Forest-like spawner of plain Tokens with one.
    rd_enemy_camp: {
        id: 'rd_enemy_camp', name: 'Camp', statements: [provides('nearby')],
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    },
    rd_grove: {
        id: 'rd_grove', name: 'Grove', statements: [provides('nearby')],
        spawner: { spawns: [{ typeId: 'fixture_producer', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    },
    rd_applies_role: {
        id: 'rd_applies_role', name: 'Role applier',
        statements: [{ keyword: KEYWORD.APPLIES, reach: 'nearby', target: { role: 'worker' }, payload: {} }]
    }
});

describe('showsNearRing — which Tokens show their reach', () => {
    it('a plain resource does not', () => {
        expect(showsNearRing('rd_plain')).toBe(false);
        expect(showsNearRing('fixture_producer')).toBe(false);
    });

    it('a rule reaching nearby Tokens does; one reaching only itself or the whole board does not', () => {
        expect(showsNearRing('rd_buff_near')).toBe(true);
        expect(showsNearRing('rd_buff_self')).toBe(false);
        // A Near-sized ring would misstate a board-wide rule.
        expect(showsNearRing('rd_buff_board')).toBe(false);
    });

    it('a Token that NEEDS something nearby does (the broad reading the owner chose)', () => {
        expect(showsNearRing('rd_requires')).toBe(true);
        expect(showsNearRing('rd_cannot')).toBe(true);
    });

    it('a tool does, whether it is authored as Acts as or the legacy provides list', () => {
        expect(showsNearRing('fixture_tool')).toBe(true);
    });

    it('a "when a nearby Token…" moment does', () => {
        expect(caresAboutNeighbours({ statements: [] })).toBe(false);
        expect(showsNearRing('rd_trigger')).toBe(true);
    });

    it('an Applies aimed at a role does not — the role replaces the reach', () => {
        expect(showsNearRing('rd_applies_role')).toBe(false);
    });

    it('an enemy camp never does, whatever its rules; a spawner of anything else still may', () => {
        expect(showsNearRing('rd_enemy_camp')).toBe(false);
        expect(showsNearRing('rd_grove')).toBe(true);
    });

    it('an unknown Token does not', () => {
        expect(showsNearRing('nope_not_a_token')).toBe(false);
    });
});
