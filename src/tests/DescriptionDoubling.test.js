import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { expandBearer } from '../systems/effects/effectLibrary.js';
import { statementsOf } from '../systems/effects/statements.js';
import { composeTokenDescription } from '../../cms/src/engine/descriptionDictionary';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';

/**
 * ⚠️ **A Token's description said every rule twice** (fixed 2026-09-12).
 *
 * 24 shipped Tokens were saved reading "Works as a Smithing station. Works as a
 * Smithing station." — every one of them a Token that references a library
 * effect. The CMS's Recalculate expands each Token against the library for the
 * simulator, then expands that result AGAIN before composing its description.
 * `expandBearer` kept a bearer's existing statements as "inline" rules, and the
 * already-expanded statements counted, so the library's rules went in twice.
 *
 * The fix is at the source: expanding is idempotent. Statements an expansion
 * added carry `sourceEffectId`, and a later expansion drops those before adding
 * the library's rules afresh. Hand-authored inline statements still survive.
 */

const library = {
    effect_smithing_station: {
        id: 'effect_smithing_station', name: 'Smithing Station',
        statements: [{ id: 'stm_smith', keyword: 'station', payload: { skill: 'smithing' } }]
    },
    effect_pickaxe: {
        id: 'effect_pickaxe', name: 'Pickaxe',
        statements: [{ id: 'stm_pick', keyword: 'acts_as', payload: { tag: 'pickaxe', tier: 1 } }]
    }
};
const furnace = () => ({ id: 'token_furnace', name: 'Furnace', effects: [{ effectId: 'effect_smithing_station', scale: 1 }] });

describe('expanding a bearer is idempotent', () => {
    it('expanding twice gives exactly what expanding once gives', () => {
        const once = expandBearer(furnace(), library);
        const twice = expandBearer(once, library);
        expect(statementsOf(once)).toHaveLength(1);
        expect(twice).toEqual(once);
    });

    it('stays one rule per reference however many times it is expanded', () => {
        let def = { ...furnace(), effects: [...furnace().effects, { effectId: 'effect_pickaxe', scale: 1 }] };
        for (let i = 0; i < 4; i++) def = expandBearer(def, library);
        expect(statementsOf(def).map(s => s.id)).toEqual(['stm_smith', 'stm_pick']);
    });

    it('still keeps a hand-authored inline rule beside the library ones, once', () => {
        const mixed = {
            ...furnace(),
            statements: [{ id: 'stm_inline', keyword: 'acts_as', payload: { tag: 'anvil', tier: 1 } }]
        };
        const twice = expandBearer(expandBearer(mixed, library), library);
        expect(statementsOf(twice).map(s => s.id)).toEqual(['stm_inline', 'stm_smith']);
    });
});

describe('the description says each rule once', () => {
    it('even when composed from an already-expanded Token', () => {
        const doubleExpanded = expandBearer(expandBearer(furnace(), library), library);
        expect(composeTokenDescription(doubleExpanded, {})).toBe('Works as a Smithing station.');
    });

    it('⭐ through Recalculate itself — the path that wrote the doubled text', () => {
        useEntityStore.setState({
            items: {},
            tokens: {
                token_furnace: { ...furnace(), tokenType: 'station', rarity: 'common', uses: null, requiresHero: true }
            },
            effects: library,
            maps: {},
            recipePools: {},
            activeEntityId: null,
            activeEntityType: null
        });

        const result = useEntityStore.getState().recalculateEconomy();
        const saved = (result.tokens || useEntityStore.getState().tokens).token_furnace;

        expect(saved.description).toBe('Works as a Smithing station.');
        // The file keeps references, not a resolved copy of the rules.
        expect('statements' in saved).toBe(false);
        expect(saved.effects).toEqual([{ effectId: 'effect_smithing_station', scale: 1 }]);
    });

    afterEach(() => useSimulationStore.getState().clearResults());
});

beforeEach(() => {
    useEntityStore.setState({ items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {} });
});
