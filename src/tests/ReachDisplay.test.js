import { describe, it, expect, beforeEach } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { showsNearRing } from '../systems/board/reachDisplay.js';
import { caresAboutNeighbours, KEYWORD } from '../systems/effects/statements.js';
import * as Flags from '../systems/board/Flags.js';
import { resetMatTuning } from '../config/matTuning.js';

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

    it('an unknown Token does not', () => {
        expect(showsNearRing('nope_not_a_token')).toBe(false);
    });
});

describe('Flags.flagReaches — the one in-reach test', () => {
    beforeEach(() => {
        GameState.initNew();
        resetMatTuning();
    });

    it('is the same centre-inside-the-radius test the heroes use', () => {
        const flag = { x: 500, y: 500 };
        const r = Flags.flagRadius();
        expect(Flags.flagReaches(flag, { x: 500 + r, y: 500 })).toBe(true);
        expect(Flags.flagReaches(flag, { x: 500 + r + 1, y: 500 })).toBe(false);
        expect(Flags.flagReaches(null, { x: 0, y: 0 })).toBe(false);
    });

    it('follows the Scouting Flags upgrade', () => {
        const flag = { x: 500, y: 500 };
        const r = Flags.flagRadius();
        const beyond = { x: 500 + r + 20, y: 500 };
        expect(Flags.flagReaches(flag, beyond)).toBe(false);
        GameState.state.progress.flagRadiusBonus = 40;
        expect(Flags.flagReaches(flag, beyond)).toBe(true);
    });
});
