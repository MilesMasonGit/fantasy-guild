import { describe, it, expect } from 'vitest';
import { TOKENS, getToken, getAllTokens, tokenMatchesTags } from '../systems/effects/TokenRegistry.js';
import { CARD_TYPES } from '../config/registries/cardConstants.js';

/**
 * Card Mutators & Tokens — test scaffold (mutator_roadmap_v1.md).
 *
 * Phase 0 is inert scaffolding, so these tests only pin the scaffolding
 * itself. Later phases append their own describe blocks here:
 *   Phase 1 — Two-Bucket math rules (§15.3)
 *   Phase 2 — card tag derivation (§15.4)
 *   Phase 3 — slot token lifecycle & Cycle wipe (F1/F2/F3)
 *   Phase 4 — stamping, charge waste, area-wide targeting (§15.5/§15.14)
 */
describe('Phase 0 — Mutator scaffolding', () => {
    it('CARD_TYPES exposes the ACTION type (§15.16)', () => {
        expect(CARD_TYPES.ACTION).toBe('action');
    });

    it('ACTION is a single type with no subtype field — traits distinguish mutators from consumables', () => {
        const actionish = Object.keys(CARD_TYPES).filter(k => k.startsWith('ACTION'));
        expect(actionish).toEqual(['ACTION']);
    });

    it('adding ACTION did not disturb the existing card types', () => {
        expect(CARD_TYPES.TASK).toBe('task');
        expect(CARD_TYPES.COMBAT).toBe('combat');
        expect(CARD_TYPES.STATION).toBe('station');
    });

    it('TokenRegistry ships empty in Phase 0 — content lands in Phase 10', () => {
        expect(TOKENS).toEqual({});
        expect(getAllTokens()).toBe(TOKENS);
    });

    it('getToken returns null for an unknown id rather than throwing', () => {
        expect(getToken('trawler_net')).toBeNull();
        expect(getToken(undefined)).toBeNull();
    });

    describe('tokenMatchesTags', () => {
        it('matches a declared tag regardless of casing (§15.4)', () => {
            const def = { target_tags: ['Aquatic'] };
            expect(tokenMatchesTags(def, ['fishing', 'aquatic'])).toBe(true);
            expect(tokenMatchesTags(def, ['AQUATIC'])).toBe(true);
        });

        it('does not match a card without the tag', () => {
            expect(tokenMatchesTags({ target_tags: ['Aquatic'] }, ['Mining'])).toBe(false);
        });

        it("'*' targets any card (the Cursed / Dam case, §14)", () => {
            expect(tokenMatchesTags({ target_tags: ['*'] }, ['Mining'])).toBe(true);
            expect(tokenMatchesTags({ target_tags: ['*'] }, [])).toBe(true);
        });

        it('a token declaring no target_tags matches nothing', () => {
            expect(tokenMatchesTags({}, ['Mining'])).toBe(false);
            expect(tokenMatchesTags(null, ['Mining'])).toBe(false);
        });
    });
});
