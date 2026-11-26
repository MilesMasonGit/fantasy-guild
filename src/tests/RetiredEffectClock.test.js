import { describe, it, expect, beforeAll } from 'vitest';
import './fixtures/testTokens.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { KEYWORD, makeStatement, blankPayload } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { seedStoredWorkspace, workspaceFromImport } from '../../cms/src/engine/workspaceSeeds.js';

/**
 * Timed effects are retired: what an `Applies` puts on somebody lasts for the fight, the swing or
 * the work cycle, never "for N seconds". The rule's old time (`durationMs`) is read by nothing.
 * The CMS stops offering it and drops the blank 0 every rule was born with; a rule still asking
 * for a real time is named by the content check, and the CMS lets it be cleared.
 */

const applies = (payload, extra = {}) => ({
    ...makeStatement(KEYWORD.APPLIES), id: `stm_rc_${Object.keys(payload).join('_')}`,
    to: null, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self' },
    ...extra, payload
});
const ctx = { effects: { fx_rc_quick: { id: 'fx_rc_quick', name: 'Quick', statements: [] } } };

describe('⭐ a rule still asking for a time is named by the content check', () => {
    beforeAll(() => registerEffects({
        fx_rc_quick: {
            id: 'fx_rc_quick', name: 'Quick',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_rc_quick', to: null, payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.1 } }]
        },
        fx_rc_timed: { id: 'fx_rc_timed', name: 'Timed Draught', statements: [applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 30_000, chance: 100 })] },
        fx_rc_blank: { id: 'fx_rc_blank', name: 'Blank Draught', statements: [applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 0, forCycle: true, chance: 100 })] },
        fx_rc_plain: { id: 'fx_rc_plain', name: 'Plain Draught', statements: [applies({ effectId: 'fx_rc_quick', scale: 1, forCycle: true, chance: 100 })] }
    }));

    const at = (name) => auditContent().filter(f => f.where === `Effect "${name}"`).map(f => f.what).filter(w => /time/i.test(w));

    it('names the effect and the time it asks for, and says what to do', () => {
        const [line, ...more] = at('Timed Draught');
        expect(more).toEqual([]);
        expect(line).toMatch(/30 ?s/);
        expect(line).toMatch(/retired/);
        expect(line).toMatch(/for the fight|for the cycle/);
    });

    it('says nothing of the blank 0, or of a rule with no time at all', () => {
        expect(at('Blank Draught')).toEqual([]);
        expect(at('Plain Draught')).toEqual([]);
    });
});

describe('the CMS no longer offers a time', () => {
    const ids = (statement) => slotsOf(statement, ctx).map(s => s.id);

    it('a new Applies rule is born without one', () => {
        expect(blankPayload(KEYWORD.APPLIES)).not.toHaveProperty('durationMs');
        expect(makeStatement(KEYWORD.APPLIES).payload).not.toHaveProperty('durationMs');
    });

    it('offers no time on a rule without one, nor on one holding the blank 0', () => {
        expect(ids(applies({ effectId: 'fx_rc_quick', scale: 1, forCycle: true }))).not.toContain('durationMs');
        expect(ids(applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 0 }))).not.toContain('durationMs');
    });

    it('lets a rule still holding a time clear it, and nothing more', () => {
        const old = applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 30_000, chance: 100 });
        const slot = slotsOf(old, ctx).find(s => s.id === 'durationMs');
        expect(slot.kind).toBe('flag');
        expect(slot.value).toBe(true);
        expect(slot.hint).toMatch(/retired/);
        expect(slot.patch(false).payload).toEqual({ effectId: 'fx_rc_quick', scale: 1, chance: 100 });
        expect(slot.patch(true).payload).toEqual(old.payload);
    });
});

describe('a workspace loses the blank 0 as it loads, so the next Sync writes none', () => {
    const workspace = () => ({
        effects: {
            fx_rc_blank: { id: 'fx_rc_blank', name: 'Blank', statements: [applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 0, forCycle: true, chance: 100 })] },
            fx_rc_timed: { id: 'fx_rc_timed', name: 'Timed', statements: [applies({ effectId: 'fx_rc_quick', scale: 1, durationMs: 30_000, chance: 100 })] },
            fx_rc_quick: { id: 'fx_rc_quick', name: 'Quick', statements: [{ ...makeStatement(KEYWORD.PROVIDES), id: 'stm_rc_quick', to: null, payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.1 } }] }
        },
        tokens: {},
        items: {}
    });

    it('drops the 0 on every load path, and keeps a real time for the content check to name', () => {
        for (const seeded of [seedStoredWorkspace(workspace()), workspaceFromImport(workspace())]) {
            expect(seeded.effects.fx_rc_blank.statements[0].payload).toEqual({ effectId: 'fx_rc_quick', scale: 1, forCycle: true, chance: 100 });
            expect(seeded.effects.fx_rc_timed.statements[0].payload.durationMs).toBe(30_000);
        }
    });

    it('leaves an entry with nothing to drop as the same object', () => {
        const ws = workspace();
        const seeded = seedStoredWorkspace(ws);
        expect(seeded.effects.fx_rc_quick).toBe(ws.effects.fx_rc_quick);
        expect(seeded.effects.fx_rc_timed).toBe(ws.effects.fx_rc_timed);
    });
});

describe('the sentence never promises a time', () => {
    it('a rule still holding one reads as the rule it now is', () => {
        const names = { effect: () => 'Quick' };
        const timed = applies({ effectId: 'fx_rc_quick', durationMs: 30_000 }, { when: null, target: null });
        const plain = applies({ effectId: 'fx_rc_quick' }, { when: null, target: null });
        expect(renderStatement(timed, names)).toBe(renderStatement(plain, names));
        expect(renderStatement(timed, names)).not.toMatch(/30/);
    });
});
