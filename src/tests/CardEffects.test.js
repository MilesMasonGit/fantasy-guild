import { describe, it, expect } from 'vitest';

import {
    EFFECT_PHASES,
    EFFECT_REACH,
    PHASE_ORDER,
    defineEffect,
    getEffectKind,
    isEffectKind,
    effectsForPhase,
    findEffect,
    hasEffect,
    validateEffects
} from '../config/cards/effectRegistry.js';

import {
    getCardEffects,
    deriveEffectsFromLegacy,
    deriveCardType,
    getCardType,
    getMaxCopies,
    validateCardEffects,
    DEFAULT_MAX_COPIES
} from '../config/cards/cardEffects.js';

import { CARD_TYPES } from '../config/registries/cardConstants.js';

describe('effect registry', () => {
    it('registers the built-in effect kinds', () => {
        for (const kind of ['work_output', 'hazard', 'restore', 'buff', 'token_stamp', 'combat']) {
            expect(isEffectKind(kind), kind).toBe(true);
        }
    });

    it('assigns each built-in kind a known phase', () => {
        expect(getEffectKind('hazard').phase).toBe(EFFECT_PHASES.ON_ACTIVATE);
        expect(getEffectKind('work_output').phase).toBe(EFFECT_PHASES.ON_COMPLETE);
        expect(getEffectKind('buff').phase).toBe(EFFECT_PHASES.ON_ACTIVATE);
        for (const kind of ['work_output', 'hazard', 'restore', 'buff', 'token_stamp', 'combat']) {
            expect(PHASE_ORDER).toContain(getEffectKind(kind).phase);
        }
    });

    it('refuses to register a kind twice, or with an unknown phase', () => {
        expect(() => defineEffect({ kind: 'work_output', phase: EFFECT_PHASES.ON_DRAW }))
            .toThrow(/already registered/);
        expect(() => defineEffect({ kind: 'brand_new_kind', phase: 'whenever' }))
            .toThrow(/unknown phase/);
    });

    it('selects effects by phase, preserving authored order', () => {
        const effects = [
            { kind: 'work_output', outputs: [{ itemId: 'a' }] },
            { kind: 'hazard', damage: 4 },
            { kind: 'restore', resource: 'hp', amount: 5 }
        ];
        expect(effectsForPhase(effects, EFFECT_PHASES.ON_ACTIVATE)).toEqual([{ kind: 'hazard', damage: 4 }]);
        expect(effectsForPhase(effects, EFFECT_PHASES.ON_COMPLETE).map(e => e.kind))
            .toEqual(['work_output', 'restore']);
    });

    it('tolerates a missing or non-array effect list', () => {
        expect(effectsForPhase(undefined, EFFECT_PHASES.ON_COMPLETE)).toEqual([]);
        expect(hasEffect(null, 'work_output')).toBe(false);
        expect(findEffect(undefined, 'buff')).toBeNull();
        expect(validateEffects(undefined)).toEqual([]);
        expect(validateEffects('nope')).toHaveLength(1);
    });
});

describe('effect validation', () => {
    it('rejects an unknown kind', () => {
        expect(validateEffects([{ kind: 'teleport' }])[0]).toMatch(/unknown effect kind/);
    });

    it('rejects malformed payloads per kind', () => {
        expect(validateEffects([{ kind: 'hazard', damage: 0 }])[0]).toMatch(/positive number/);
        expect(validateEffects([{ kind: 'token_stamp' }])[0]).toMatch(/tokenId/);
        expect(validateEffects([{ kind: 'combat' }])[0]).toMatch(/enemyId/);
        expect(validateEffects([{ kind: 'restore', resource: 'mana', amount: 5 }])[0]).toMatch(/hp.*energy/);
        expect(validateEffects([{ kind: 'work_output', outputs: [] }])[0]).toMatch(/at least one output/);
        expect(validateEffects([{ kind: 'buff', reach: 'everywhere', modifiers: [{}] }])[0]).toMatch(/reach/);
    });

    it('accepts well-formed effects', () => {
        expect(validateEffects([
            { kind: 'work_output', outputs: [{ itemId: 'item_copper_ore', quantity: 1 }], xp: 1 },
            { kind: 'hazard', damage: 4 },
            { kind: 'buff', reach: EFFECT_REACH.LOOP, modifiers: [{ stat: 'speed', value: 0.1 }] }
        ])).toEqual([]);
    });
});

describe('legacy card translation', () => {
    // The real Rocky Outcrop card, verbatim from data/cards/tasks/.
    const rockyOutcrop = {
        id: 'task_rocky_outcrop',
        name: 'Rocky Outcrop',
        cardType: 'task',
        isUnique: false,
        config: {
            skill: 'industry',
            baseTickTime: 3000,
            xp: 1,
            inputs: [],
            outputs: [{ itemId: 'item_copper_ore', quantity: 1, chance: 100 }]
        }
    };

    it('translates a real legacy task card into a work_output effect', () => {
        const effects = getCardEffects(rockyOutcrop);
        expect(effects).toHaveLength(1);
        expect(effects[0].kind).toBe('work_output');
        expect(effects[0].outputs[0].itemId).toBe('item_copper_ore');
        expect(effects[0].xp).toBe(1);
        expect(validateEffects(effects)).toEqual([]);
    });

    it('still reads that card as a Task', () => {
        expect(getCardType(rockyOutcrop)).toBe(CARD_TYPES.TASK);
    });

    it('translates enemies and tokens', () => {
        expect(deriveEffectsFromLegacy({ config: { enemyId: 'enemy_bear' } }))
            .toEqual([{ kind: 'combat', enemyId: 'enemy_bear' }]);
        expect(deriveEffectsFromLegacy({ config: { tokenId: 'token_sharp' } }))
            .toEqual([{ kind: 'token_stamp', tokenId: 'token_sharp' }]);
    });

    it('does not count a combat trigger as a yield', () => {
        const ambushOnly = { config: { outputs: [{ type: 'combat_trigger', id: 'x' }] } };
        expect(deriveEffectsFromLegacy(ambushOnly)).toEqual([]);
    });

    it('prefers authored effects over the legacy config', () => {
        const authored = {
            config: { outputs: [{ itemId: 'ignored' }] },
            effects: [{ kind: 'hazard', damage: 4 }]
        };
        expect(getCardEffects(authored)).toEqual([{ kind: 'hazard', damage: 4 }]);
    });

    it('returns an empty list for an empty template', () => {
        expect(getCardEffects(null)).toEqual([]);
        expect(getCardEffects({})).toEqual([]);
    });
});

describe('derived card type (D-60: type is a label, never a capability)', () => {
    it('reads a token stamper as a mutator', () => {
        expect(deriveCardType([{ kind: 'token_stamp', tokenId: 't' }])).toBe(CARD_TYPES.ACTION);
    });

    it('reads a pure fight as combat', () => {
        expect(deriveCardType([{ kind: 'combat', enemyId: 'e' }])).toBe(CARD_TYPES.COMBAT);
    });

    it('reads a fight that also yields loot as a task (legacy ambush)', () => {
        expect(deriveCardType([
            { kind: 'combat', enemyId: 'e' },
            { kind: 'work_output', outputs: [{ itemId: 'i' }] }
        ])).toBe(CARD_TYPES.TASK);
    });

    it('reads a buff-only card as a boost', () => {
        expect(deriveCardType([
            { kind: 'buff', reach: EFFECT_REACH.LOOP, modifiers: [{ stat: 'speed', value: 0.1 }] }
        ])).toBe(CARD_TYPES.BOOST);
    });

    it('reads a Rest card as a task', () => {
        expect(deriveCardType([{ kind: 'restore', resource: 'hp', amount: 20 }])).toBe(CARD_TYPES.TASK);
    });

    it('defaults to task when nothing is recognisable', () => {
        expect(deriveCardType([])).toBe(CARD_TYPES.TASK);
    });
});

describe('the hybrid card (D-60 acceptance test)', () => {
    // The card the owner described: "a Task card that gives an output and
    // also buffs later cards". It must be authorable as DATA ALONE — no
    // engine change, no new type. This test is the whole point of C-3.
    const hybrid = {
        id: 'task_sharpening_quarry',
        name: 'Sharpening Quarry',
        maxCopies: 1,
        effects: [
            { kind: 'work_output', outputs: [{ itemId: 'item_iron_ore', quantity: 2 }], xp: 3 },
            { kind: 'buff', reach: EFFECT_REACH.NEXT_CARD, modifiers: [{ stat: 'yield', value: 0.25 }] }
        ]
    };

    it('validates with no authoring problems', () => {
        expect(validateCardEffects(hybrid)).toEqual([]);
    });

    it('carries both effects, each in its own phase', () => {
        const effects = getCardEffects(hybrid);
        expect(effectsForPhase(effects, EFFECT_PHASES.ON_COMPLETE).map(e => e.kind)).toEqual(['work_output']);
        expect(effectsForPhase(effects, EFFECT_PHASES.ON_ACTIVATE).map(e => e.kind)).toEqual(['buff']);
    });

    it('is labelled a Task, because work output wins the label', () => {
        expect(getCardType(hybrid)).toBe(CARD_TYPES.TASK);
    });

    it('can be unique despite being a Task', () => {
        expect(getMaxCopies(hybrid)).toBe(1);
    });
});

describe('copy limits (D-61)', () => {
    it('defaults to a full banner', () => {
        expect(getMaxCopies({})).toBe(DEFAULT_MAX_COPIES);
        expect(DEFAULT_MAX_COPIES).toBe(4);
    });

    it('honours an authored cap', () => {
        expect(getMaxCopies({ maxCopies: 1 })).toBe(1);
        expect(getMaxCopies({ maxCopies: 2 })).toBe(2);
    });

    it('falls back to the legacy isUnique flag', () => {
        expect(getMaxCopies({ isUnique: true })).toBe(1);
        expect(getMaxCopies({ isUnique: false })).toBe(DEFAULT_MAX_COPIES);
    });

    it('rejects an out-of-range cap', () => {
        expect(validateCardEffects({ maxCopies: 0 })).toHaveLength(1);
        expect(validateCardEffects({ maxCopies: 9 })).toHaveLength(1);
    });

    it('rejects a buff that has no one to buff', () => {
        const problems = validateCardEffects({
            effects: [{ kind: 'buff', reach: EFFECT_REACH.SELF, modifiers: [{ stat: 'x', value: 1 }] }]
        });
        expect(problems.some(p => /no one to buff/.test(p))).toBe(true);
    });
});
