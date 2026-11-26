// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { adaptToken, adaptRecipe, adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runTempoPass } from '../../cms/src/engine/sim/tempoPass.js';
import { runTuningPass } from '../../cms/src/engine/sim/tuningPass.js';
import { normaliseDials } from '../../cms/src/engine/sim/dials.js';
import { applyTokenResults, applyRecipePoolResults } from '../../cms/src/engine/sim/writeBack.js';
import { recalculateWorkspace } from '../../cms/src/engine/recalculate.js';
import SupplyChainLayout from '../../cms/src/components/layout/SupplyChainLayout.jsx';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';

/**
 * A pinned output: `sim.outputsPinned` on a Token or a recipe keeps every output's count and
 * chance through Recalculate and so through Sync, as `sim.timePinned` does for the cycle and
 * `sim.xpPinned` for XP (three pins, each one thing): neither the quantity nor the chance lever
 * moves it, and the write-back puts the same numbers back. The editors show the pin beside the
 * outputs. The number pack's output pins and their round trip are in
 * CMSNumberPackCorrections.test.js.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});
afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

const store = () => useEntityStore.getState();
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(store().recalculateEconomy({}))));
const TAGS = { tempo: 'quick', purpose: 'iph' };
const o = (itemId, min, max, chance = 100, extra = {}) => ({ itemId, chance, minQty: min, maxQty: max, baseQty: { min, max }, variable: chance < 100, ...extra });
const tok = (id, outputs, sim = TAGS) => ({ id, name: id, uses: null, sim, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 3, inputs: [], outputs } });

/**
 * Two sources Recalculate tunes: Fx Press (a second source of Fx Bar) has its count of 5 cut to 3
 * by the quantity lever, and Fx Seedy its Seed chance of 50 cut to 30 by the chance lever.
 */
function pinWorkspace({ pin = false } = {}) {
    const pinned = (sim) => (pin ? { ...sim, outputsPinned: true } : sim);
    return {
        items: {
            fx_ore: { id: 'fx_ore', name: 'Fx Ore', type: 'material' },
            fx_seed: { id: 'fx_seed', name: 'Fx Seed', type: 'material' },
            fx_bar: { id: 'fx_bar', name: 'Fx Bar', type: 'material' },
        },
        tokens: {
            fx_vein: tok('fx_vein', [o('fx_ore', 1, 1, 100, { anchor: true })]),
            fx_seedbed: tok('fx_seedbed', [o('fx_seed', 1, 1, 100, { anchor: true })]),
            fx_seedy: tok('fx_seedy', [o('fx_ore', 1, 1, 10), o('fx_seed', 1, 1, 50)], pinned(TAGS)),
            fx_furnace: {
                id: 'fx_furnace', name: 'Fx Furnace', uses: null,
                config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
                statements: [{ keyword: 'station', payload: { skill: 'smithing', stationKind: 'furnace' } }],
            },
        },
        effects: {},
        recipePools: {
            smithing: [
                { id: 'fx_smelt', name: 'Fx Smelt', skill: 'smithing', levelRequirement: 1, stationKinds: ['furnace'], durationMs: 6000, xp: 4, sim: TAGS, inputs: [{ itemId: 'fx_ore', quantity: 1 }], outputs: [o('fx_bar', 1, 1, 100, { anchor: true })] },
                { id: 'fx_press', name: 'Fx Press', skill: 'smithing', levelRequirement: 1, stationKinds: ['furnace'], durationMs: 6000, xp: 4, sim: pinned({ tempo: 'medium', purpose: 'iph' }), inputs: [{ itemId: 'fx_ore', quantity: 1 }], outputs: [o('fx_bar', 5, 5)] },
            ],
        },
    };
}

const pressOf = (files) => files['tokenRecipes.json'].find((r) => r.id === 'fx_press');

describe('the adapter', () => {
    const t = (sim) => adaptToken({ id: 'fx', name: 'Fx', sim, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, outputs: [o('fx_ore', 1, 1)] } });

    it('reads the pin on a Token and a recipe, and only `true` counts', () => {
        expect(t({ ...TAGS, outputsPinned: true }).outputsPinned).toBe(true);
        expect(t({ ...TAGS, outputsPinned: 'yes' }).outputsPinned).toBe(false);
        expect(t(TAGS).outputsPinned).toBe(false);
        expect(adaptRecipe({ id: 'r', name: 'R', skill: 'mining', levelRequirement: 1, durationMs: 3000, sim: { ...TAGS, outputsPinned: true }, outputs: [o('fx_ore', 1, 1)] }).outputsPinned).toBe(true);
    });

    it('prices a pinned output at the chance it keeps, not a chance an old tuning left behind', () => {
        const stale = (sim) => adaptToken({ id: 'fx', name: 'Fx', sim, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, outputs: [o('fx_seed', 1, 1, 13, { baseChance: 15 })] } });
        expect(stale(TAGS).outputs[0].chancePercent).toBe(15);
        expect(stale({ ...TAGS, outputsPinned: true }).outputs[0].chancePercent).toBe(13);
    });
});

describe('the TUNE pass', () => {
    const tuned = (ws) => recalculateWorkspace(ws, {}).report.sim.tunings;

    it('moves an unpinned count and chance: the fixture has teeth', () => {
        const tunings = tuned(pinWorkspace());
        expect(tunings.get('fx_press').lever).toBe('quantity');
        expect(tunings.get('fx_seedy').lever).toBe('chance');
    });

    it('never moves a pinned count or chance: neither is a lever on it', () => {
        const tunings = tuned(pinWorkspace({ pin: true }));
        expect(tunings.get('fx_press').lever).not.toBe('quantity');
        expect(tunings.get('fx_press').lever).not.toBe('chance');
        expect(tunings.get('fx_seedy').lever).not.toBe('quantity');
        expect(tunings.get('fx_seedy').lever).not.toBe('chance');
    });

    it('still moves a pinned-output source\'s cycle, which is the time pin\'s to keep', () => {
        // The time pin's cycle-lever case (CMSTimePin.test.js): only the cycle closes its band.
        const tuneOne = (sim) => {
            const t = { id: 'token_second', name: 'token_second', rarity: 'common', tokenType: 'resource', uses: 10, sim,
                config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 16000, inputs: [], outputs: [{ itemId: 'item_x', chance: 100, minQty: 1, maxQty: 1 }] } };
            const entities = adaptCorpus({ tokens: { t } });
            const time = runTempoPass(entities);
            return runTuningPass(entities, { timing: time.timing, values: new Map([['item_x', 9]]), elections: new Map(), dials: normaliseDials() }).tunings.get('token_second');
        };
        expect(tuneOne({ tempo: 'medium', purpose: 'gph', outputsPinned: true }).lever).toBe('cycle');
        expect(tuneOne({ tempo: 'medium', purpose: 'gph', outputsPinned: true, timePinned: true }).lever).toBe('none');
    });

    it('says the outputs are pinned on an Info row, and raises no refusal when every lever is pinned', () => {
        const ws = pinWorkspace({ pin: true });
        ws.recipePools.smithing[1].sim = { ...ws.recipePools.smithing[1].sim, timePinned: true };
        const { report } = recalculateWorkspace(ws, {});
        const rows = report.sim.rows.filter((r) => r.entityId === 'fx_press');
        const row = rows.find((r) => r.code === 'outputs-pinned');
        expect(row).toMatchObject({ severity: 'info', entityId: 'fx_press' });
        expect(row.message).toMatch(/Fx Press/);
        expect(rows.some((r) => r.code === 'levers-exhausted' || r.code === 'correction-too-large')).toBe(false);
        expect(report.sim.tunings.get('fx_press').lever).toBe('none');
        expect(recalculateWorkspace(pinWorkspace(), {}).report.sim.rows.some((r) => r.code === 'outputs-pinned')).toBe(false);
    });
});

describe('the write-back', () => {
    // A tuning that moved Fx Seed's chance and a downcycle that capped Fx Bar's count: neither lands on a pinned record.
    const moved = { before: { outputs: [{ minQty: 1, maxQty: 1, chancePercent: 50 }] }, after: { outputs: [{ minQty: 1, maxQty: 1, chancePercent: 30 }] }, lever: 'chance' };
    const sim = () => ({
        cycleTimes: new Map(), xp: new Map(),
        tunings: new Map([['fx_t', moved]]),
        downcycles: new Map([['fx_r', { outputs: [{ derivedAvgQty: 2, authoredAvgQty: 5 }] }]]),
    });
    const token = (pinned) => ({ id: 'fx_t', name: 'Fx T', sim: pinned ? { ...TAGS, outputsPinned: true } : TAGS, config: { skill: 'mining', cycleTimeMs: 3000, outputs: [o('fx_seed', 1, 1, 50)] } });
    const pools = (pinned) => ({ smithing: [{ id: 'fx_r', name: 'Fx R', downcycle: true, sim: pinned ? { ...TAGS, outputsPinned: true } : TAGS, durationMs: 3000, outputs: [o('fx_bar', 5, 5)] }] });

    it('puts a pinned record\'s outputs back as written, whatever a pass handed it', () => {
        expect(applyTokenResults({ fx_t: token(true) }, sim()).fx_t.config.outputs).toEqual([o('fx_seed', 1, 1, 50)]);
        expect(applyRecipePoolResults(pools(true), sim()).smithing[0].outputs).toEqual([o('fx_bar', 5, 5)]);
    });

    it('lands them on an unpinned one: the guard has teeth', () => {
        expect(applyTokenResults({ fx_t: token(false) }, sim()).fx_t.config.outputs[0].chance).toBe(30);
        expect(applyRecipePoolResults(pools(false), sim()).smithing[0].outputs[0].minQty).toBe(2);
    });
});

describe('through Recalculate and Sync', () => {
    it('keeps a pinned recipe\'s count and a pinned Token\'s chance, and the pin', () => {
        store().hydrate(pinWorkspace({ pin: true }));
        const files = syncPayload();
        expect(pressOf(files).outputs).toEqual([o('fx_bar', 5, 5)]);
        expect(pressOf(files).sim).toEqual({ tempo: 'medium', purpose: 'iph', outputsPinned: true });
        expect(files['tokens.json'].fx_seedy.config.outputs).toEqual([o('fx_ore', 1, 1, 10), o('fx_seed', 1, 1, 50)]);
        expect(files['tokens.json'].fx_seedy.sim).toEqual({ ...TAGS, outputsPinned: true });
    });

    it('moves them without the pin: the guard has teeth', () => {
        store().hydrate(pinWorkspace());
        const files = syncPayload();
        expect(pressOf(files).outputs[0].minQty).not.toBe(5);
        expect(files['tokens.json'].fx_seedy.config.outputs[1].chance).not.toBe(50);
    });

    it('stays put on a second Recalculate', () => {
        store().hydrate(pinWorkspace({ pin: true }));
        const first = syncPayload();
        const second = syncPayload();
        expect(second['tokens.json'].fx_seedy).toEqual(first['tokens.json'].fx_seedy);
        expect(second['tokenRecipes.json']).toEqual(first['tokenRecipes.json']);
    });

    it('hands the outputs back to the levers when the pin is cleared', () => {
        store().hydrate(pinWorkspace({ pin: true }));
        expect(syncPayload()['tokens.json'].fx_seedy.config.outputs[1].chance).toBe(50);
        store().updateToken('fx_seedy', { sim: { ...store().tokens.fx_seedy.sim, outputsPinned: undefined } });
        const files = syncPayload();
        expect(files['tokens.json'].fx_seedy.config.outputs[1].chance).not.toBe(50);
        expect(files['tokens.json'].fx_seedy.sim).toEqual(TAGS);
    });
});

describe('the editors', () => {
    const pinOf = (container) => container.querySelector('[data-outputs-pin]');
    const box = (container) => pinOf(container).querySelector('input[type="checkbox"]');

    beforeEach(() => store().hydrate(pinWorkspace()));

    it('a Token shows the pin under its outputs, ticks it, keeps its tags and clears it', () => {
        store().setActiveEntity('fx_seedy', 'token');
        const { container } = render(React.createElement(SupplyChainLayout, null, React.createElement('div')));
        expect(pinOf(container).getAttribute('data-outputs-pin')).toBe('off');
        fireEvent.click(box(container));
        expect(store().tokens.fx_seedy.sim).toEqual({ ...TAGS, outputsPinned: true });
        expect(pinOf(container).getAttribute('data-outputs-pin')).toBe('on');
        expect(pinOf(container).textContent).toMatch(/Recalculate keeps these counts and chances/);
        fireEvent.click(box(container));
        expect(store().tokens.fx_seedy.sim?.outputsPinned).toBeUndefined();
        expect(store().tokens.fx_seedy.sim).toEqual(TAGS);
    });

    it('a recipe shows the pin under its outputs, ticks it and clears it', () => {
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Smithing'));
        expect(pinOf(container).getAttribute('data-outputs-pin')).toBe('off');
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim).toEqual({ ...TAGS, outputsPinned: true });
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim?.outputsPinned).toBeUndefined();
    });
});
