import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { KEYWORD, KEYWORDS, WHEN, getKeyword, makeStatement } from '../systems/effects/statements.js';
import {
    slotsOf, slotIsOrphaned, slotDisplay, filterOptions, SLOT_KIND
} from '../systems/effects/statementSlots.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { REACH } from '../config/registries/reachRegistry.js';

/**
 * **A statement as the ordered slots an author fills in** (Effects Grammar v2,
 * V3 — the model behind the sentence editor).
 *
 * ⚠️ These tests are about **legality and order**, not about looks. The point of
 * the slot model is that the editor never offers something the grammar refuses,
 * and that it reads down the row in the order the sentence says it. Both are
 * things a test can hold; neither is something a screenshot can.
 */

const slotIds = (s) => slotsOf(s).map(x => x.id);
const slot = (s, id) => slotsOf(s).find(x => x.id === id);

/** Apply a slot's patch the way the editor does. */
const applySlot = (statement, id, value) => ({ ...statement, ...slot(statement, id).patch(value) });

describe('the row reads in sentence order', () => {
    it('puts the moment before the verb, because the sentence does', () => {
        const ids = slotIds(makeStatement(KEYWORD.DEALS));
        expect(ids.indexOf('moment')).toBeLessThan(ids.indexOf('keyword'));
    });

    it('puts who it acts on after what it does', () => {
        const ids = slotIds(makeStatement(KEYWORD.DEALS));
        expect(ids.indexOf('keyword')).toBeLessThan(ids.indexOf('role'));
    });

    it('gives every keyword a verb slot and nothing it cannot use', () => {
        for (const kw of KEYWORDS) {
            const ids = slotIds(makeStatement(kw.id));
            expect(ids, kw.id).toContain('keyword');
            if (kw.when === WHEN.NEVER) expect(ids, kw.id).not.toContain('moment');
            if (!kw.filter) expect(ids, kw.id).not.toContain('filterMode');
            if (!kw.reach) expect(ids, kw.id).not.toContain('reach');
            if (!kw.targetsRole) expect(ids, kw.id).not.toContain('role');
        }
    });
});

describe('⭐ G-2 is enforced by the model, not by the UI', () => {
    it('offers the actor on a moment that has one', () => {
        const s = makeStatement(KEYWORD.DEALS);   // born on SELF_CYCLE_COMPLETE
        expect(slot(s, 'role').options.map(o => o.id)).toContain(ROLE.ACTOR);
    });

    it('⚠️ does NOT offer the actor when nobody acted', () => {
        let s = makeStatement(KEYWORD.DEALS);
        s = applySlot(s, 'moment', 'TOKEN_DEPLETED');
        const ids = slot(s, 'role').options.map(o => o.id);
        expect(ids).not.toContain(ROLE.ACTOR);
        expect(ids).toContain(ROLE.SELF);
    });

    it('reports a role left stranded by a change of moment', () => {
        // The author picked "the actor", then changed the moment to one with
        // none. The value is not invalid data — it is a rule that now reaches
        // nobody on any board, and the editor has to be able to say so.
        let s = makeStatement(KEYWORD.DEALS);
        s = applySlot(s, 'moment', 'TOKEN_DEPLETED');
        expect(s.target.role).toBe(ROLE.ACTOR);
        expect(slotIsOrphaned(slot(s, 'role'))).toBe(true);
    });

    it('names a stranded value in the words the author picked it by', () => {
        // Looking the label up in the CURRENT options finds nothing, so without
        // help the warning reads "actor" — a vocabulary the author never sees.
        let s = makeStatement(KEYWORD.DEALS);
        s = applySlot(s, 'moment', 'TOKEN_DEPLETED');
        expect(slotDisplay(slot(s, 'role'))).toBe('the hero');
    });

    it('stops reporting it once the author picks again', () => {
        let s = makeStatement(KEYWORD.DEALS);
        s = applySlot(s, 'moment', 'TOKEN_DEPLETED');
        s = applySlot(s, 'role', ROLE.SELF);
        expect(slotIsOrphaned(slot(s, 'role'))).toBe(false);
    });
});

describe('⚠️ changing the verb rebuilds the rule', () => {
    it('does not leave the old payload behind', () => {
        // Swapping only the word produced a `Deals` carrying a `Provides`
        // payload, with no moment and nothing to act on — a rule no author could
        // have written, so the editor must not be able to produce it either.
        const s = applySlot(makeStatement(KEYWORD.PROVIDES), 'keyword', KEYWORD.DEALS);
        expect(s.keyword).toBe(KEYWORD.DEALS);
        expect(s.payload).toEqual({ amount: 1, ignoresArmor: false });
        expect(s.when.event).toBe('SELF_CYCLE_COMPLETE');
        expect(s.target).toEqual({ role: ROLE.ACTOR });
    });

    it('keeps the statement id, because a live save keys state by it', () => {
        const before = makeStatement(KEYWORD.PROVIDES);
        const after = applySlot(before, 'keyword', KEYWORD.DEALS);
        expect(after.id).toBe(before.id);
    });
});

describe('a slot writes itself back into the statement', () => {
    it('changes the moment and keeps its scope legal', () => {
        const s = applySlot(makeStatement(KEYWORD.DEALS), 'moment', 'CYCLE_COMPLETE');
        expect(s.when.event).toBe('CYCLE_COMPLETE');
        expect(s.when.scope).toBe('adjacent');
    });

    it('changes a number without losing the rest of the payload', () => {
        const s = applySlot(makeStatement(KEYWORD.DEALS), 'amount', 4);
        expect(s.payload).toEqual({ amount: 4, ignoresArmor: false });
    });

    it('never lets a negative amount through', () => {
        expect(applySlot(makeStatement(KEYWORD.DEALS), 'amount', -3).payload.amount).toBe(0);
    });

    it('sets a reach', () => {
        const s = applySlot(makeStatement(KEYWORD.PROVIDES), 'reach', REACH.SELF);
        expect(s.reach).toBe(REACH.SELF);
    });
});

describe('what the chip says', () => {
    it('uses the vocabulary own label, never a paraphrase', () => {
        const s = makeStatement(KEYWORD.DEALS);
        expect(slotDisplay(slot(s, 'role'))).toBe('the hero');
        expect(slotDisplay(slot(s, 'keyword'))).toBe('Deals');
        expect(slotDisplay(slot(s, 'moment'))).toBe("This Token's cycle completes");
    });

    it('shows a blank rather than a guess when nothing is picked', () => {
        // ⚠️ An `Applies` with no `statusId` takes the LIBRARY EFFECT shape as of
        // V6 — that is the new default and the one that makes the status
        // registry deletable, so the unset slot to check is `effectId`.
        const s = makeStatement(KEYWORD.APPLIES);
        expect(s.payload.effectId).toBe('');
        expect(slotDisplay(slot(s, 'effectId'))).toBe('…');
    });

    it('shows a flag only when it is on', () => {
        const s = makeStatement(KEYWORD.DEALS);
        expect(slotDisplay(slot(s, 'ignoresArmor'))).toBe('');
        const piercing = applySlot(s, 'ignoresArmor', true);
        expect(slotDisplay(slot(piercing, 'ignoresArmor'))).toBe('ignores armour');
    });
});

describe('typing narrows a slot', () => {
    it('matches on the label', () => {
        const s = makeStatement(KEYWORD.DEALS);
        const hits = filterOptions(slot(s, 'moment'), "Token's cycle");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every(o => /Token's cycle/i.test(o.label))).toBe(true);
    });

    it('matches on the hint too, so you can search by meaning', () => {
        const s = makeStatement(KEYWORD.DEALS);
        expect(filterOptions(slot(s, 'moment'), 'kill').length).toBeGreaterThan(0);
    });

    it('returns everything when nothing is typed', () => {
        const s = makeStatement(KEYWORD.DEALS);
        const all = slot(s, 'moment').options;
        expect(filterOptions(slot(s, 'moment'), '')).toEqual(all);
    });
});

describe('list payloads stay a form beneath the sentence (G-20)', () => {
    it('marks a conversion items as a form rather than spelling them inline', () => {
        expect(slot(makeStatement(KEYWORD.CONVERTS), 'payload').kind).toBe(SLOT_KIND.FORM);
        expect(slot(makeStatement(KEYWORD.RESTOCKS), 'payload').kind).toBe(SLOT_KIND.FORM);
    });
});

describe('⚠️ the model reads the game own declarations', () => {
    it('offers every keyword the grammar has, so a new one needs no editor change', () => {
        const offered = slot(makeStatement(KEYWORD.DEALS), 'keyword').options.map(o => o.id);
        expect(offered).toEqual(KEYWORDS.map(k => k.id));
    });

    it('offers a filter only where KEYWORDS says one is legal', () => {
        for (const kw of KEYWORDS) {
            const has = slotIds(makeStatement(kw.id)).includes('filterMode');
            expect(has, kw.id).toBe(!!getKeyword(kw.id).filter);
        }
    });
});
