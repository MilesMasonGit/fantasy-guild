import { describe, it, expect } from 'vitest';
import {
    effectRefsOf, hasWorkingStatements, expandBearer, expandAll,
    duplicateRefsOf, usedBy, EFFECT_ID_PREFIX,
    MAX_SCALE, normaliseScale, effectTitle, scaleStatement
} from '../systems/effects/effectLibrary.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { statementCycleCost } from '../systems/board/Charges.js';
import {
    CHARGE_MOMENTS, chargeMomentsFor, chargeMomentOf
} from '../config/registries/chargeMomentRegistry.js';
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

    it('gives every Token that references an effect its rules', () => {
        /**
         * ⚠️ This asserted a **count** (19 Tokens) until 2026-09-07, which was
         * the wrong shape of test: it pinned the content set, so authoring one
         * Token in the CMS turned the engine suite red for no engine reason.
         * `tokenRegistry` is explicit that content should be free to be retuned
         * without the suite noticing.
         *
         * The invariant that actually matters is content-independent: a Token
         * carrying references resolves to real statements. If expansion broke,
         * every one of them would come back empty.
         */
        const referencing = shipped.filter(([, def]) => effectRefsOf(def).length > 0);
        expect(referencing.length).toBeGreaterThan(0);

        const empty = referencing
            .filter(([, def]) => statementsOf(def).length === 0)
            .map(([id]) => id);
        expect(empty).toEqual([]);
    });
});

describe('scale — an integer 1 to 5 (UE-18)', () => {
    it('rounds, floors and caps whatever it is given', () => {
        expect(normaliseScale(3)).toBe(3);
        expect(normaliseScale('4')).toBe(4);
        expect(normaliseScale(1.5)).toBe(2);
        expect(normaliseScale(0)).toBe(1);
        expect(normaliseScale(-7)).toBe(1);
        expect(normaliseScale(99)).toBe(MAX_SCALE);
        expect(normaliseScale('nonsense')).toBe(1);
        expect(normaliseScale(undefined)).toBe(1);
    });

    it('titles a scaled effect with a numeral, and leaves scale 1 plain (UE-9)', () => {
        expect(effectTitle('Shrimp Trawler', 1)).toBe('Shrimp Trawler');
        expect(effectTitle('Shrimp Trawler', 2)).toBe('Shrimp Trawler II');
        expect(effectTitle('Shrimp Trawler', 5)).toBe('Shrimp Trawler V');
        // Out-of-range scales are normalised before they reach the numeral, so a
        // title can never read "Shrimp Trawler undefined".
        expect(effectTitle('Shrimp Trawler', 12)).toBe('Shrimp Trawler V');
        expect(effectTitle('Shrimp Trawler')).toBe('Shrimp Trawler');
    });
});

describe('what a scale multiplies is DECLARED, never inferred (UE-7)', () => {
    const provides = (type, value) => statementFor(KEYWORD.PROVIDES, { type, bucket: 'percentage', value });

    it('scales a Provides value', () => {
        const scaled = scaleStatement(provides('YIELD', 0.05), 3);
        expect(scaled.payload.value).toBeCloseTo(0.15);
    });

    it('scales a negative value in the direction it already points', () => {
        // Work Time is inverted: -5% is the buff, so x3 is a bigger buff.
        const scaled = scaleStatement(provides('WORK_TIME', -0.05), 3);
        expect(scaled.payload.value).toBeCloseTo(-0.15);
    });

    it('saturates a proc instead of producing an impossible chance', () => {
        const scaled = scaleStatement(provides('LOOT_MULT', 40), 3);
        expect(scaled.payload.value).toBe(100);
    });

    it('scales a Grants quantity, not its chance', () => {
        const grant = statementFor(KEYWORD.GRANTS, { type: 'BONUS_DROP', itemId: 'item_ore', quantity: 2, chance: 50 });
        const scaled = scaleStatement(grant, 3);
        expect(scaled.payload.quantity).toBe(6);
        expect(scaled.payload.chance).toBe(50);
    });

    it('scales BOTH sides of a conversion, keeping the exchange rate honest', () => {
        const convert = statementFor(KEYWORD.CONVERTS, {
            type: 'CONVERT',
            consumes: [{ itemId: 'item_ore', quantity: 2 }],
            produces: [{ itemId: 'item_ingot', quantity: 1 }],
        });
        const scaled = scaleStatement(convert, 3);
        expect(scaled.payload.consumes[0].quantity).toBe(6);
        expect(scaled.payload.produces[0].quantity).toBe(3);
    });

    it('scales the stacks an Applies puts on someone', () => {
        const applies = statementFor(KEYWORD.APPLIES, { statusId: 'poison', stacks: 2, chance: 100 });
        expect(scaleStatement(applies, 4).payload.stacks).toBe(8);
    });

    it('leaves a capability tier alone — a Tier 3 pickaxe is a different tool', () => {
        const acts = statementFor(KEYWORD.ACTS_AS, { tag: 'pickaxe', tier: 1 });
        expect(scaleStatement(acts, 5)).toBe(acts);
    });

    it('leaves a restriction alone', () => {
        const cannot = statementFor(KEYWORD.CANNOT, { kind: 'adjacency_limit', max: 2 });
        expect(scaleStatement(cannot, 5)).toBe(cannot);
    });

    it('is a no-op at scale 1, returning the very same object', () => {
        const st = provides('YIELD', 0.05);
        expect(scaleStatement(st, 1)).toBe(st);
    });

    it('does not mutate the statement it scales', () => {
        const st = provides('YIELD', 0.05);
        scaleStatement(st, 4);
        expect(st.payload.value).toBeCloseTo(0.05);
    });
});

describe('scale reaches the game through expansion, so nothing downstream multiplies', () => {
    const library = {
        effect_trawler: {
            id: 'effect_trawler',
            name: 'Shrimp Trawler',
            statements: [statementFor(KEYWORD.PROVIDES, { type: 'YIELD', bucket: 'percentage', value: 0.05 })],
        },
    };

    it('hands the consumer an already-scaled payload', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 3 }] }, library);
        expect(statementsOf(def)[0].payload.value).toBeCloseTo(0.15);
    });

    it('stamps the scale and the titled name for the popup P3 will publish', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 2 }] }, library);
        expect(statementsOf(def)[0]).toMatchObject({
            scale: 2,
            effectName: 'Shrimp Trawler',
            effectTitle: 'Shrimp Trawler II',
        });
    });

    it('renders the SCALED magnitude in the sentence, with no help from statementText', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 3 }] }, library);
        expect(renderStatement(statementsOf(def)[0], {})).toContain('15%');
    });

    it('leaves the library entry itself untouched, so other bearers are unaffected', () => {
        expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 5 }] }, library);
        expect(library.effect_trawler.statements[0].payload.value).toBeCloseTo(0.05);
    });

    it('lets two bearers carry the same effect at different strengths', () => {
        const weak = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 1 }] }, library);
        const strong = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 4 }] }, library);
        expect(statementsOf(weak)[0].payload.value).toBeCloseTo(0.05);
        expect(statementsOf(strong)[0].payload.value).toBeCloseTo(0.20);
    });

    it('normalises a junk scale stored on a reference', () => {
        const def = expandBearer({ effects: [{ effectId: 'effect_trawler', scale: 99 }] }, library);
        expect(statementsOf(def)[0].scale).toBe(MAX_SCALE);
    });
});

describe('when a rule spends its charges (UE-20)', () => {
    it('offers only moments something actually spends at', () => {
        // ⚠️ If this grows, a reader grew with it. P5's cycle-start and P6's
        // engagement are deliberately absent until they are published.
        // `on_promote` arrived with its reader, `BoardPromotion.accept` (P3).
        expect(CHARGE_MOMENTS.map((m) => m.id)).toEqual(['on_fire', 'per_cycle', 'on_promote']);
    });

    it('does not offer "each time it fires" to a rule that cannot fire', () => {
        expect(chargeMomentsFor(false).map((m) => m.id)).toEqual(['per_cycle']);
        expect(chargeMomentsFor(true).map((m) => m.id)).toEqual(['on_fire', 'per_cycle']);
    });

    it('offers a Promotes rule its own moment and nothing else — and nobody else that one', () => {
        expect(chargeMomentsFor(false, 'promotes').map((m) => m.id)).toEqual(['on_promote']);
        expect(chargeMomentsFor(true, 'grants').map((m) => m.id)).toEqual(['on_fire', 'per_cycle']);
        expect(chargeMomentOf({ keyword: 'promotes', chargeWhen: 'per_cycle' })).toBe('on_promote');
    });

    it('infers the moment from the statement when unauthored', () => {
        expect(chargeMomentOf({ keyword: 'grants', when: { event: 'CYCLE_COMPLETE' } })).toBe('on_fire');
        expect(chargeMomentOf({ keyword: 'provides' })).toBe('per_cycle');
    });

    it('lets an authored moment win over the inference', () => {
        expect(chargeMomentOf({ keyword: 'provides', chargeWhen: 'on_fire' })).toBe('on_fire');
    });

    it('ignores a moment that is not declared, rather than trusting it', () => {
        expect(chargeMomentOf({ keyword: 'provides', chargeWhen: 'every_full_moon' })).toBe('per_cycle');
    });

    it('sums only the per-cycle COSTS a Token carries', () => {
        const perCycle = (chargeDelta) => ({ keyword: 'provides', chargeWhen: 'per_cycle', chargeDelta });
        const def = {
            statements: [
                perCycle(-2),
                perCycle(-1),
                // A firing rule is not a per-cycle cost.
                { keyword: 'grants', chargeWhen: 'on_fire', when: { event: 'CYCLE_COMPLETE' }, chargeDelta: -5 },
                // A per-cycle restore is refused: a Token topping itself up
                // every cycle would never deplete.
                perCycle(3),
            ],
        };
        expect(statementCycleCost(def)).toBe(3);
    });

    it('costs a Token nothing for rules authored before the moment existed', () => {
        // ⚠️ The whole compatibility question in one assertion. The third entry
        // is the shape that actually bit: the old editor stamped -1 on every
        // keyword that CAN fire, so ambient Grants sit in the shipped content
        // carrying a delta that has never been spent. A per-cycle cost is opt-in
        // precisely so that dormant number stays dormant.
        const def = {
            statements: [
                { keyword: 'provides' },
                { keyword: 'acts_as' },
                { keyword: 'grants', when: null, chargeDelta: -1 },
            ],
        };
        expect(statementCycleCost(def)).toBe(0);
    });

    it('gives a new statement a cost that matches what its kind has always cost', () => {
        expect(makeStatement(KEYWORD.GRANTS).chargeDelta).toBe(-1);
        expect(makeStatement(KEYWORD.PROVIDES).chargeDelta).toBe(0);
        expect(makeStatement(KEYWORD.ACTS_AS).chargeDelta).toBe(0);
    });
});

describe('the shipped content is unchanged by P2', () => {
    it('costs no shipped Token anything per cycle', () => {
        const charged = Object.entries(TOKENS)
            .filter(([id]) => !id.startsWith('fixture_'))
            .filter(([, def]) => statementCycleCost(def) > 0)
            .map(([id]) => id);
        expect(charged).toEqual([]);
    });

    it('carries every shipped reference at scale 1, so no magnitude moved', () => {
        const scaled = Object.entries(TOKENS)
            .filter(([id]) => !id.startsWith('fixture_'))
            .flatMap(([id, def]) => effectRefsOf(def).filter((r) => r.scale !== 1).map((r) => `${id}:${r.effectId}`));
        expect(scaled).toEqual([]);
    });
});
