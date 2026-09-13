import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { KEYWORD, KEYWORDS, makeStatement } from '../systems/effects/statements.js';
import { slotsOf, costSlots, FINE_PRINT_SLOTS } from '../systems/effects/statementSlots.js';
import { renderSegments, renderStatement } from '../systems/effects/statementText.js';
import { statementChargeDelta } from '../systems/board/Charges.js';

/**
 * ⭐ **The fine print** — what a rule costs, beside its sentence (Rules Line P5).
 *
 * Owner ruling 2026-09-12: the strip holds only what the sentence leaves
 * unsaid. The charge cost and the upkeep's clock are said nowhere, so they get
 * slots of their own; cooldown and chance are already words in the rules text.
 */

const slot = (st, id) => costSlots(st).find(s => s.id === id);
const after = (st, id, v) => ({ ...st, ...slot(st, id).patch(v) });
const fires = () => ({ ...makeStatement(KEYWORD.DEALS), payload: { amount: 2 } });
const aura = () => ({ ...makeStatement(KEYWORD.STATION), payload: { skill: 'cooking' } });

describe('the charge cost', () => {
    it('is offered on every rule (UE-20)', () => {
        for (const k of KEYWORDS.filter(k => k.id !== KEYWORD.REQUIRES)) {
            expect(costSlots(makeStatement(k.id)).map(s => s.id), k.id).toEqual(expect.arrayContaining(['charge', 'chargeWhen']));
        }
    });

    it('⚠️ is never offered on Requires — a Token field, not a rule (P6)', () => {
        // A charge written here would land inside the Token's acceptedTokens.
        expect(costSlots({ keyword: KEYWORD.REQUIRES, payload: { tag: 'net', minTier: 1 } })).toEqual([]);
    });

    it('reads as what it spends, and agrees with what the game charges', () => {
        // Unauthored: a firing rule spends 1, an aura spends nothing.
        const unauthoredFiring = { ...fires(), chargeDelta: undefined };
        expect(slot(unauthoredFiring, 'charge').value).toBe(1);
        expect(statementChargeDelta(unauthoredFiring)).toBe(-1);
        const unauthoredAura = { ...aura(), chargeDelta: undefined };
        expect(slot(unauthoredAura, 'charge').value).toBe(0);
        expect(statementChargeDelta(unauthoredAura)).toBe(0);
    });

    it('⚠️ stores the spend as a NEGATIVE change, and pins the moment', () => {
        const spent = after(fires(), 'charge', '3');
        expect(spent.chargeDelta).toBe(-3);
        expect(spent.chargeWhen).toBe('on_fire');
        expect(statementChargeDelta(spent)).toBe(-3);
    });

    it('writes a real 0 for free, and a minus gives charges back', () => {
        expect(after(fires(), 'charge', '0').chargeDelta).toBe(0);
        expect(Object.is(after(fires(), 'charge', '0').chargeDelta, -0)).toBe(false);
        expect(after(fires(), 'charge', '-2').chargeDelta).toBe(2);
        expect(after(fires(), 'charge', 'lots').chargeDelta).toBe(0);
    });

    it('explains itself in the words the retired box used', () => {
        expect(slot(fires(), 'charge').hint).toContain('Spends 1 charge each time it fires');
        expect(slot(after(fires(), 'charge', '0'), 'charge').hint).toContain('Free');
    });

    it('only offers "each time it fires" to a rule that can fire', () => {
        expect(slot(aura(), 'chargeWhen').options.map(o => o.id)).toEqual(['per_cycle']);
        expect(slot(fires(), 'chargeWhen').options.map(o => o.id)).toEqual(['on_fire', 'per_cycle']);
        expect(after(fires(), 'chargeWhen', 'per_cycle').chargeWhen).toBe('per_cycle');
    });

    it('⚠️ never appears in the rules text', () => {
        const st = after(fires(), 'charge', '4');
        expect(renderStatement(st)).toBe(renderStatement(fires()));
        const tagged = new Set(renderSegments(st).map(s => s.slot).filter(Boolean));
        for (const s of costSlots(st)) expect(tagged.has(s.id), s.id).toBe(false);
    });

    it('keeps its ids apart from the sentence’s slots', () => {
        const sentence = new Set(slotsOf(fires()).map(s => s.id));
        for (const s of costSlots(fires())) expect(sentence.has(s.id), s.id).toBe(false);
    });
});

describe('the upkeep clock', () => {
    const costed = () => ({ ...makeStatement(KEYWORD.PROVIDES), upkeep: { items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 30000 } });

    it('exists only while the rule has an upkeep, and only where upkeep is allowed', () => {
        expect(slot(makeStatement(KEYWORD.PROVIDES), 'upkeepEvery')).toBeUndefined();
        expect(slot(costed(), 'upkeepEvery').value).toBe(30);
        // Works as takes no upkeep, so a stray one is not offered for editing.
        expect(slot({ ...aura(), upkeep: { items: [], cadenceMs: 5000 } }, 'upkeepEvery')).toBeUndefined();
    });

    it('takes seconds, keeps the items, and floors at one second as the box did', () => {
        const ten = after(costed(), 'upkeepEvery', '10');
        expect(ten.upkeep).toEqual({ items: [{ itemId: 'item_coal', quantity: 1 }], cadenceMs: 10000 });
        expect(after(costed(), 'upkeepEvery', '0').upkeep.cadenceMs).toBe(1000);
        expect(after(costed(), 'upkeepEvery', '2.5').upkeep.cadenceMs).toBe(2500);
    });
});

describe('⚠️ the cooldown word is in seconds, because the sentence says seconds', () => {
    const cooled = () => ({ ...fires(), when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 5000 } });
    const cooldown = (st) => slotsOf(st).find(s => s.id === 'cooldown');

    it('shows the number the sentence shows', () => {
        const word = renderSegments(cooled()).find(s => s.slot === 'cooldown').text;
        expect(String(cooldown(cooled()).value)).toBe(word);
    });

    it('retyping 5 as 10 means ten seconds, not ten milliseconds', () => {
        const st = { ...cooled(), ...cooldown(cooled()).patch('10') };
        expect(st.when.cooldownMs).toBe(10000);
        expect(renderStatement(st)).toContain('at most once every 10 seconds');
    });

    it('lives in the strip, not the quiet row, while the sentence does not say it', () => {
        expect(FINE_PRINT_SLOTS).toContain('cooldown');
    });
});
