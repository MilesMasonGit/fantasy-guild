import { describe, it, expect } from 'vitest';
import {
    effectRefsOf, hasWorkingStatements, expandBearer, expandAll,
    duplicateRefsOf, usedBy, EFFECT_ID_PREFIX
} from '../systems/effects/effectLibrary.js';
import { migrateBearers, provisionalName } from '../systems/effects/effectMigration.js';
import { KEYWORD, makeStatement, statementsOf } from '../systems/effects/statements.js';
import { EFFECTS } from '../config/registries/effectRegistry.js';
import { TOKENS } from '../config/registries/tokenRegistry.js';

/**
 * The named effect library — Unified Effects P1.
 *
 * P1 is a **pure refactor**: rules moved out of the Tokens that owned them and
 * into a library those Tokens reference, and nothing a player can see changed.
 * These tests hold the four claims that makes:
 *
 * 1. **A reference resolves to the same statements the Token used to carry.**
 * 2. **Statement ids survive the move**, so a live save's upkeep and cooldown
 *    state still lands on the rule it was recorded against.
 * 3. **The migration is idempotent and deduplicating** — running it twice does
 *    nothing, and two identical rules become one shared entry.
 * 4. **The shipped content is internally consistent**: every reference resolves,
 *    every entry is backed by a working statement (UE-10), and no bearer names
 *    one entry twice.
 */

const statementFor = (keyword, payload) => ({ ...makeStatement(keyword), payload });

describe('effect references', () => {
    it('normalises the three shapes a reference can take', () => {
        const refs = effectRefsOf({
            effects: ['effect_bare', { effectId: 'effect_obj' }, { effectId: 'effect_scaled', scale: 3 }]
        });
        expect(refs).toEqual([
            { effectId: 'effect_bare', scale: 1 },
            { effectId: 'effect_obj', scale: 1 },
            { effectId: 'effect_scaled', scale: 3 }
        ]);
    });

    it('drops a malformed entry rather than returning a hole', () => {
        expect(effectRefsOf({ effects: [null, {}, '', { scale: 2 }] })).toEqual([]);
    });

    it('treats a nonsense scale as 1 instead of poisoning the arithmetic', () => {
        const refs = effectRefsOf({ effects: [{ effectId: 'e', scale: -4 }, { effectId: 'f', scale: 'x' }] });
        expect(refs.every(r => r.scale === 1)).toBe(true);
    });
});

describe('UE-10 — a named effect cannot exist without a statement that works', () => {
    it('rejects the shape the deleted 56 were made of: a name and nothing else', () => {
        expect(hasWorkingStatements({ id: 'e', name: 'Damage', description: '+3 damage' })).toBe(false);
        expect(hasWorkingStatements({ id: 'e', name: 'Empty', statements: [] })).toBe(false);
    });

    it('rejects a statement with no keyword', () => {
        expect(hasWorkingStatements({ statements: [{ id: 'stm_1', payload: {} }] })).toBe(false);
    });

    it('accepts a statement that names a keyword, even half-authored', () => {
        // A blank payload is a normal mid-authoring state — the generated
        // sentence shows the author its own blanks. UE-10 is about names with
        // no mechanism, not about unfinished numbers.
        const entry = { statements: [statementFor(KEYWORD.ACTS_AS, { tag: '', tier: 1 })] };
        expect(hasWorkingStatements(entry)).toBe(true);
    });
});

describe('expanding a bearer', () => {
    const library = {
        effect_pickaxe: {
            id: 'effect_pickaxe',
            name: 'Pickaxe',
            statements: [statementFor(KEYWORD.ACTS_AS, { tag: 'pickaxe', tier: 1 })]
        }
    };

    it('resolves a reference into the statements the game runs on', () => {
        const def = expandBearer({ name: 'Rusty Pickaxe', effects: [{ effectId: 'effect_pickaxe' }] }, library);
        expect(statementsOf(def)).toHaveLength(1);
        expect(statementsOf(def)[0].keyword).toBe(KEYWORD.ACTS_AS);
        expect(statementsOf(def)[0].payload.tag).toBe('pickaxe');
    });

    it('stamps where each statement came from, for the audit and P3s popup', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_pickaxe', scale: 2 }] }, library);
        expect(statementsOf(def)[0]).toMatchObject({
            sourceEffectId: 'effect_pickaxe',
            effectName: 'Pickaxe',
            scale: 2
        });
    });

    it('keeps the statement id, so a live saves upkeep state still matches', () => {
        const original = library.effect_pickaxe.statements[0].id;
        const def = expandBearer({ effects: [{ effectId: 'effect_pickaxe' }] }, library);
        expect(statementsOf(def)[0].id).toBe(original);
    });

    it('does not mutate the definition it is given', () => {
        const def = { effects: [{ effectId: 'effect_pickaxe' }] };
        expandBearer(def, library);
        expect(def.statements).toBeUndefined();
    });

    it('leaves a fixture that authors statements inline exactly as it is', () => {
        const inline = { statements: [statementFor(KEYWORD.STATION, { skill: 'mining' })] };
        expect(expandBearer(inline, library)).toBe(inline);
    });

    it('contributes nothing for a reference that names a missing entry', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_ghost' }] }, library);
        expect(statementsOf(def)).toHaveLength(0);
    });

    it('expands a whole collection', () => {
        const out = expandAll({ a: { effects: [{ effectId: 'effect_pickaxe' }] }, b: {} }, library);
        expect(statementsOf(out.a)).toHaveLength(1);
        expect(statementsOf(out.b)).toHaveLength(0);
    });
});

describe('one bearer naming one entry twice', () => {
    it('is reported, because both copies would share one upkeep clock', () => {
        expect(duplicateRefsOf({ effects: [{ effectId: 'e' }, { effectId: 'e' }, { effectId: 'f' }] }))
            .toEqual(['e']);
    });

    it('is not confused with two different effects', () => {
        expect(duplicateRefsOf({ effects: [{ effectId: 'e' }, { effectId: 'f' }] })).toEqual([]);
    });
});

describe('used by — the readout that makes "edit once, changes everywhere" safe', () => {
    it('names every bearer referencing an entry, across collections', () => {
        const tokens = { token_a: { name: 'A', effects: [{ effectId: 'e' }] }, token_b: { name: 'B' } };
        const items = { item_c: { name: 'C', effects: [{ effectId: 'e' }] } };
        expect(usedBy('e', tokens, items)).toEqual([
            { id: 'token_a', name: 'A' },
            { id: 'item_c', name: 'C' }
        ]);
    });
});

describe('the migration', () => {
    const acts = (tag) => statementFor(KEYWORD.ACTS_AS, { tag, tier: 1 });

    it('moves an inline statement into a named entry and leaves a reference', () => {
        const { effects, bearers, moved } = migrateBearers({
            token_a: { name: 'A', statements: [acts('pickaxe')] }
        });

        expect(moved).toBe(1);
        expect(bearers.token_a.statements).toBeUndefined();
        expect(bearers.token_a.effects).toHaveLength(1);

        const entry = effects[bearers.token_a.effects[0].effectId];
        expect(entry.name).toBe('Pickaxe');
        expect(entry.statements[0].payload.tag).toBe('pickaxe');
    });

    it('gives two identical rules ONE shared entry — the librarys whole point', () => {
        const { effects, bearers } = migrateBearers({
            token_a: { name: 'A', statements: [acts('pickaxe')] },
            token_b: { name: 'B', statements: [acts('pickaxe')] }
        });

        expect(Object.keys(effects)).toHaveLength(1);
        expect(bearers.token_a.effects[0].effectId).toBe(bearers.token_b.effects[0].effectId);
    });

    it('keeps genuinely different rules apart', () => {
        const { effects } = migrateBearers({
            token_a: { name: 'A', statements: [acts('pickaxe')] },
            token_b: { name: 'B', statements: [acts('axe')] }
        });
        expect(Object.keys(effects)).toHaveLength(2);
    });

    it('preserves the original statement id inside the entry', () => {
        const statement = acts('pickaxe');
        const { effects } = migrateBearers({ token_a: { statements: [statement] } });
        expect(Object.values(effects)[0].statements[0].id).toBe(statement.id);
    });

    it('is idempotent — a second run finds nothing to move', () => {
        const first = migrateBearers({ token_a: { name: 'A', statements: [acts('pickaxe')] } });
        const second = migrateBearers(first.bearers, { existing: first.effects });

        expect(second.moved).toBe(0);
        expect(second.effects).toEqual(first.effects);
        expect(second.bearers).toEqual(first.bearers);
    });

    it('collapses one bearer carrying the same rule twice into a single reference', () => {
        const { bearers } = migrateBearers({ token_a: { statements: [acts('pickaxe'), acts('pickaxe')] } });
        expect(bearers.token_a.effects).toHaveLength(1);
        expect(duplicateRefsOf(bearers.token_a)).toEqual([]);
    });

    it('names an effect after its mechanism, never after invented flavour', () => {
        expect(provisionalName(statementFor(KEYWORD.STATION, { skill: 'mining' }))).toBe('Mining Station');
        expect(provisionalName(statementFor(KEYWORD.ACTS_AS, { tag: 'pickaxe', tier: 2 }))).toBe('Pickaxe Tier 2');
        expect(provisionalName(statementFor(KEYWORD.CANNOT, {}))).toBe('Placement Limit');
        expect(provisionalName(statementFor(KEYWORD.APPLIES, { statusId: 'poison' }))).toBe('Applies Poison');
    });

    it('reads a Provides direction off the palette, not off the sign', () => {
        // WORK_TIME is inverted — a NEGATIVE value is the buff — so naming by
        // sign alone would label half of them backwards.
        expect(provisionalName(statementFor(KEYWORD.PROVIDES, { type: 'WORK_TIME', value: -0.05 })))
            .toBe('Work Time Bonus');
        expect(provisionalName(statementFor(KEYWORD.PROVIDES, { type: 'YIELD', value: -0.05 })))
            .toBe('Yield Penalty');
    });
});

describe('the shipped library', () => {
    it('has entries', () => {
        expect(Object.keys(EFFECTS).length).toBeGreaterThan(0);
    });

    it('holds no entry that is a name with nothing behind it (UE-10)', () => {
        const unbacked = Object.entries(EFFECTS)
            .filter(([, entry]) => !hasWorkingStatements(entry))
            .map(([id]) => id);
        expect(unbacked).toEqual([]);
    });

    it('carries none of the retired card-era librarys shape', () => {
        // The orphan `data/effects.json` was 56 entries keyed "0"-"55" with
        // `targetEntityTypes` and a description. If one of those ever reappears,
        // the wrong file has been restored.
        const legacy = Object.values(EFFECTS).filter(e => e?.targetEntityTypes);
        expect(legacy).toEqual([]);
    });

    it('ids every entry with the library prefix', () => {
        const wrong = Object.keys(EFFECTS).filter(id => !id.startsWith(`${EFFECT_ID_PREFIX}_`));
        expect(wrong).toEqual([]);
    });
});

describe('shipped Tokens and the library agree', () => {
    const shipped = Object.entries(TOKENS).filter(([id]) => !id.startsWith('fixture_'));

    it('resolves every reference every Token makes', () => {
        const dangling = [];
        for (const [tokenId, def] of shipped) {
            for (const { effectId } of effectRefsOf(def)) {
                if (!EFFECTS[effectId]) dangling.push(`${tokenId} → ${effectId}`);
            }
        }
        expect(dangling).toEqual([]);
    });

    it('has no Token naming one effect twice', () => {
        const duplicated = shipped
            .filter(([, def]) => duplicateRefsOf(def).length)
            .map(([id]) => id);
        expect(duplicated).toEqual([]);
    });

    it('left no Token still carrying inline statements in the shipped data', () => {
        // Fixtures may author inline; shipped content is migrated. This is the
        // check that the migration actually ran over everything.
        const stragglers = shipped
            .filter(([, def]) => (def.effects || []).length === 0 && statementsOf(def).length > 0)
            .map(([id]) => id);
        expect(stragglers).toEqual([]);
    });

    it('still gives the Tokens that had rules their rules', () => {
        const withRules = shipped.filter(([, def]) => statementsOf(def).length > 0);
        // 19 Tokens carried the 21 statements the migration moved.
        expect(withRules.length).toBe(19);
    });
});
