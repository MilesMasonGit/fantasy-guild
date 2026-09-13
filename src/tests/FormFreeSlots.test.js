import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { slotsOf, slotDisplay, SLOT_KIND } from '../systems/effects/statementSlots.js';
import { renderSegments, renderStatement } from '../systems/effects/statementText.js';

/**
 * ⭐ **Every decision the retired forms held has a slot** (Rules Line P4).
 *
 * P4 deletes the forms beneath each rule. The roadmap said where the danger was,
 * in as many words: *"a decision that was only ever authorable through a form
 * will be found — expect more, and expect them to be silent."* The last code
 * review found one already (`Works as` became unauthorable).
 *
 * So before a single form is deleted, this file walks what each form edited and
 * proves the grammar can reach it without the form — with the same clamps the
 * form applied, and a clickable word wherever the sentence mentions it.
 *
 * The inventory was read off the forms themselves:
 *
 * | Keyword   | The form edited                          |
 * | --------- | ---------------------------------------- |
 * | Provides  | effect, combine, amount, direction, skill|
 * | Grants    | item (+ create), how many, chance        |
 * | Works as  | skill                                    |
 * | Acts as   | capability, tool tier                    |
 * | Restocks  | the Tokens                               |
 * | Cannot    | kind, limit                              |
 * | Applies   | status/effect, stacks, chance, target    |
 * | Deals     | damage, ignores armour                   |
 */

const ctx = {
    items: { item_a: { id: 'item_a', name: 'Oak Wood' }, item_b: { id: 'item_b', name: 'Raw Shrimp' } },
    tokens: { tok_a: { id: 'tok_a', name: 'Oak Tree' }, tok_b: { id: 'tok_b', name: 'Quarry' } },
    effects: {},
    capabilities: []
};
const names = { item: (id) => ctx.items[id]?.name || id, token: (id) => ctx.tokens[id]?.name || id };

const slot = (st, id) => slotsOf(st, ctx).find(s => s.id === id);
const after = (st, id, v) => ({ ...st, ...slot(st, id).patch(v) });
const wordFor = (st, id) => renderSegments(st, names).filter(s => s.slot === id).map(s => s.text);

describe('⭐ nothing the forms edited is left without a slot', () => {
    const inventory = {
        [KEYWORD.PROVIDES]: ['type', 'bucket', 'value', 'category'],
        [KEYWORD.GRANTS]: ['quantity', 'itemId', 'chance'],
        [KEYWORD.STATION]: ['skill'],
        [KEYWORD.ACTS_AS]: ['tag', 'tier'],
        [KEYWORD.RESTOCKS]: ['tokenIds'],
        [KEYWORD.CANNOT]: ['kind', 'max'],
        [KEYWORD.APPLIES]: ['chance', 'target'],
        [KEYWORD.DEALS]: ['amount', 'ignoresArmor']
    };
    for (const [keyword, fields] of Object.entries(inventory)) {
        it(`${keyword}: ${fields.join(', ')}`, () => {
            const ids = slotsOf(makeStatement(keyword), ctx).map(s => s.id);
            for (const field of fields) expect(ids, `${keyword} lost ${field}`).toContain(field);
        });
    }

    it('keeps a form ONLY for a conversion’s item lists (E-8)', () => {
        for (const keyword of Object.values(KEYWORD)) {
            const forms = slotsOf(makeStatement(keyword), ctx).filter(s => s.kind === SLOT_KIND.FORM);
            if (keyword === KEYWORD.CONVERTS) expect(forms.map(s => s.id)).toEqual(['payload']);
            else expect(forms, `${keyword} still has a form slot`).toEqual([]);
        }
    });
});

describe('Provides', () => {
    const yieldRule = () => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'YIELD', bucket: 'percentage', value: 0.25 } });

    it('⚠️ offers every skill for "only for" — the list used to be empty', () => {
        const options = slot(yieldRule(), 'category').options.map(o => o.id);
        expect(options).toContain('mining');
        expect(options.length).toBeGreaterThan(10);
    });

    it('scopes to a skill, and "Any skill" clears the scope again', () => {
        const scoped = after(yieldRule(), 'category', 'mining');
        expect(scoped.payload.category).toBe('mining');
        expect(wordFor(scoped, 'category')).toEqual(['Mining']);
        const cleared = after(scoped, 'category', '');
        expect('category' in cleared.payload).toBe(false);
    });

    it('⚠️ rebuilds the payload when the effect changes, as the form did', () => {
        // Keeping the old bucket and value turned Yield 25% into "a 0.25% chance".
        const loot = after(yieldRule(), 'type', 'LOOT_MULT');
        expect(loot.payload).toEqual({ type: 'LOOT_MULT', bucket: 'flat', value: 0 });
        const back = after(loot, 'type', 'WORK_TIME');
        expect(back.payload).toEqual({ type: 'WORK_TIME', bucket: 'percentage', value: 0 });
    });
});

describe('Grants', () => {
    const grant = () => ({ ...makeStatement(KEYWORD.GRANTS), payload: { type: 'BONUS_DROP', itemId: 'item_b', quantity: 2, chance: 40 } });

    it('makes how many, which item and how often each their own word', () => {
        const st = grant();
        expect(wordFor(st, 'quantity')).toEqual(['2']);
        expect(wordFor(st, 'itemId')).toEqual(['Raw Shrimp']);
        expect(wordFor(st, 'chance')).toEqual(['40%']);
    });

    it('offers the items it can drop, and says it may create one', () => {
        const s = slot(grant(), 'itemId');
        expect(s.options.map(o => o.label)).toEqual(['Oak Wood', 'Raw Shrimp']);
        expect(s.creates).toBe('item');
    });

    it('clamps exactly as the form did', () => {
        expect(after(grant(), 'quantity', '0').payload.quantity).toBe(1);
        expect(after(grant(), 'chance', '250').payload.chance).toBe(100);
        expect(after(grant(), 'chance', '0').payload.chance).toBe(1);
        expect(after(grant(), 'chance', 'lots').payload.chance).toBe(100);
    });

    it('a blank item is a word to click, not a hole', () => {
        const blank = { ...makeStatement(KEYWORD.GRANTS) };
        expect(wordFor(blank, 'itemId')).toEqual(['…']);
    });
});

describe('Works as', () => {
    it('⚠️ has a skill slot at all — it had none, and a new station was unauthorable', () => {
        const st = makeStatement(KEYWORD.STATION);
        expect(slot(st, 'skill').options.map(o => o.id)).toContain('cooking');
        const cooking = after(st, 'skill', 'cooking');
        expect(cooking.payload.skill).toBe('cooking');
        expect(wordFor(cooking, 'skill')).toEqual(['Cooking']);
        expect(wordFor(st, 'skill')).toEqual(['…']);
    });
});

describe('Acts as', () => {
    it('makes the tool tier its own word, with the form’s floor of 1', () => {
        const st = { ...makeStatement(KEYWORD.ACTS_AS), payload: { tag: 'net', tier: 2 } };
        expect(wordFor(st, 'tier')).toEqual(['2']);
        expect(wordFor(st, 'tag')).toEqual(['net']);
        expect(after(st, 'tier', '0').payload.tier).toBe(1);
    });

    it('leaves Requires without a tool tier, and Acts as without a minimum', () => {
        expect(slotsOf(makeStatement(KEYWORD.REQUIRES), ctx).map(s => s.id)).not.toContain('tier');
        expect(slotsOf(makeStatement(KEYWORD.ACTS_AS), ctx).map(s => s.id)).not.toContain('minTier');
    });
});

describe('Requires (Rules Line P6)', () => {
    it('⚠️ makes the minimum tier a word — the retired Min Tool Tier box was its only control', () => {
        const st = { keyword: KEYWORD.REQUIRES, payload: { tag: 'net', minTier: 2 } };
        expect(wordFor(st, 'minTier')).toEqual(['2']);
        expect(renderStatement(st)).toBe('Requires an adjacent Tier 2 net.');
        expect(after(st, 'minTier', '3').payload).toEqual({ tag: 'net', minTier: 3 });
        expect(after(st, 'minTier', '0').payload.minTier).toBe(1);
    });
});

describe('Restocks', () => {
    it('picks several Tokens as one word, with no duplicates', () => {
        const st = { ...makeStatement(KEYWORD.RESTOCKS), payload: { tokenIds: ['tok_a'] } };
        const s = slot(st, 'tokenIds');
        expect(s.kind).toBe(SLOT_KIND.LIST);
        const both = after(st, 'tokenIds', ['tok_a', 'tok_b', 'tok_a', '']);
        expect(both.payload.tokenIds).toEqual(['tok_a', 'tok_b']);
        expect(slotDisplay(slot(both, 'tokenIds'))).toBe('Oak Tree and Quarry');
        expect(wordFor(both, 'tokenIds')).toEqual(['Oak Tree and Quarry']);
    });
});

describe('Cannot', () => {
    it('makes the limit its own word, and the sentence is unchanged', () => {
        const st = { ...makeStatement(KEYWORD.CANNOT), payload: { kind: 'adjacency_limit', max: 2 }, to: { mode: 'tag', value: 'Coast' } };
        expect(wordFor(st, 'max')).toEqual(['2']);
        expect(renderStatement(st)).toBe('Cannot be adjacent to more than 2 Coast Tokens.');
    });
});

describe('Applies — library effects only (owner ruling 2026-09-12)', () => {
    it('offers an effect, a chance and a target — and never a status', () => {
        const effect = { ...makeStatement(KEYWORD.APPLIES), payload: { effectId: '', durationMs: 0 } };
        const status = { ...makeStatement(KEYWORD.APPLIES), payload: { statusId: 'poison', stacks: 2 } };
        for (const st of [effect, status]) {
            const ids = slotsOf(st, ctx).map(s => s.id);
            expect(ids).toEqual(expect.arrayContaining(['effectId', 'chance', 'target']));
            expect(ids).not.toContain('statusId');
            expect(ids).not.toContain('stacks');
        }
    });

    it('⚠️ switches an old status rule to an effect cleanly', () => {
        // A rule still naming a status shows the effect picker in its place.
        // Picking an effect must REPLACE the status, not sit beside it — a rule
        // carrying both would apply whichever the engine happened to read first.
        const status = { ...makeStatement(KEYWORD.APPLIES), payload: { statusId: 'poison', stacks: 3, chance: 50 } };
        expect(wordFor(status, 'effectId')).toEqual(['Poison']);
        const switched = after(status, 'effectId', 'fx_thorns');
        expect(switched.payload.effectId).toBe('fx_thorns');
        expect('statusId' in switched.payload).toBe(false);
        expect('stacks' in switched.payload).toBe(false);
        expect(switched.payload.chance).toBe(50);
    });

    it('makes the odds and the item target clickable where the sentence says them', () => {
        const st = { ...makeStatement(KEYWORD.APPLIES), payload: { statusId: 'poison', stacks: 1, chance: 25, target: 'enemy' } };
        expect(wordFor(st, 'chance')).toEqual(['25%']);
        expect(wordFor(st, 'target')).toEqual(['the enemy its hero is fighting']);
        expect(after(st, 'target', 'hero').payload.target).toBe('hero');
    });
});
