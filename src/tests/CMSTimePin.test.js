// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { runTempoPass, bandMiddleMs } from '../../cms/src/engine/sim/tempoPass.js';
import { adaptToken, adaptRecipe, adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runTuningPass } from '../../cms/src/engine/sim/tuningPass.js';
import { normaliseDials } from '../../cms/src/engine/sim/dials.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';

/**
 * A pinned cycle time: `sim.timePinned` on a Token (`config.cycleTimeMs`) or a recipe
 * (`durationMs`), beside its Tempo and Purpose, keeps the record's own time through Recalculate and
 * so through Sync, which runs it, as `sim.xpPinned` does for XP; the editors show the pin and clear
 * it. A number pack's pins and their round trip are in CMSNumberPackCorrections.test.js.
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
// A quick band's middle at level 1 is not 7.7 s, so a kept 7700 is the pin's doing.
const PINNED_MS = 7700;

/** A vein, a tree and a smelting recipe, tagged so Recalculate derives their cycle. */
function pinWorkspace({ pinTokens = false, pinRecipes = false } = {}) {
    const output = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });
    const sim = (pin) => ({ ...TAGS, ...(pin ? { timePinned: true } : {}) });
    const worked = (id, name, skill, itemId, pin) => ({
        id, name, uses: null, sim: sim(pin),
        config: { skill, skillRequired: 1, cycleTimeMs: PINNED_MS, xp: 3, inputs: [], outputs: [output(itemId)] },
    });
    return {
        items: {
            fx_ore: { id: 'fx_ore', name: 'Fx Ore', type: 'material' },
            fx_wood: { id: 'fx_wood', name: 'Fx Wood', type: 'material' },
            fx_bar: { id: 'fx_bar', name: 'Fx Bar', type: 'material' },
        },
        tokens: {
            fx_vein: worked('fx_vein', 'Fx Vein', 'mining', 'fx_ore', pinTokens),
            fx_tree: worked('fx_tree', 'Fx Tree', 'forestry', 'fx_wood', false),
            fx_furnace: {
                id: 'fx_furnace', name: 'Fx Furnace', uses: null,
                config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
                statements: [{ keyword: 'station', payload: { skill: 'smithing', stationKind: 'furnace' } }],
            },
        },
        effects: {},
        recipePools: {
            smithing: [
                { id: 'fx_smelt', name: 'Fx Smelt', skill: 'smithing', levelRequirement: 1, stationKinds: ['furnace'], durationMs: PINNED_MS, xp: 4, sim: sim(pinRecipes), inputs: [{ itemId: 'fx_ore', quantity: 1 }], outputs: [output('fx_bar')] },
            ],
        },
    };
}

describe('the TIME pass', () => {
    const tagged = (sim) => ({ id: 'fx', name: 'Fx', sim, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: PINNED_MS, xp: 3, outputs: [{ itemId: 'fx_ore' }] } });

    it('keeps a pinned source\'s own time, and bands an unpinned one', () => {
        expect(bandMiddleMs('quick', 1)).not.toBe(PINNED_MS);
        expect(runTempoPass([adaptToken(tagged({ ...TAGS }))]).cycleTimes.get('fx')).toBe(bandMiddleMs('quick', 1));
        expect(runTempoPass([adaptToken(tagged({ ...TAGS, timePinned: true }))]).cycleTimes.get('fx')).toBe(PINNED_MS);
    });

    it('reads the pin on a recipe as on a Token, and only `true` counts', () => {
        const recipe = adaptRecipe({ id: 'fx_r', name: 'Fx R', skill: 'mining', levelRequirement: 1, durationMs: PINNED_MS, sim: { ...TAGS, timePinned: true }, outputs: [{ itemId: 'fx_ore' }] });
        expect(recipe.timePinned).toBe(true);
        expect(adaptToken(tagged({ ...TAGS, timePinned: 'yes' })).timePinned).toBe(false);
        expect(adaptToken(tagged({ ...TAGS })).timePinned).toBe(false);
    });

    it('says what the band would give, on an Info row for the pin', () => {
        const { rows } = runTempoPass([adaptToken(tagged({ ...TAGS, timePinned: true }))]);
        const row = rows.find((r) => r.code === 'time-pinned');
        expect(row).toMatchObject({ severity: 'info', entityId: 'fx' });
        expect(row.message).toContain('7.7 s');
        expect(row.message).toContain(`${bandMiddleMs('quick', 1) / 1000} s`);
        expect(runTempoPass([adaptToken(tagged({ ...TAGS }))]).rows.some((r) => r.code === 'time-pinned')).toBe(false);
    });
});

describe('the TUNE pass', () => {
    /** EconSimLevers' cycle-lever case: a Medium source whose quantity and chance cannot close its band, so only its cycle could. */
    const tuneOne = (sim) => {
        const t = { id: 'token_second', name: 'token_second', rarity: 'common', tokenType: 'resource', uses: 10, sim,
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 16000, inputs: [], outputs: [{ itemId: 'item_x', chance: 100, minQty: 1, maxQty: 1 }] } };
        const entities = adaptCorpus({ tokens: { t } });
        const time = runTempoPass(entities);
        return runTuningPass(entities, { timing: time.timing, values: new Map([['item_x', 9]]), elections: new Map(), dials: normaliseDials() }).tunings.get('token_second');
    };

    it('never moves a pinned time: the cycle is not a lever on it', () => {
        expect(tuneOne({ tempo: 'medium', purpose: 'gph' }).lever).toBe('cycle');
        const pinned = tuneOne({ tempo: 'medium', purpose: 'gph', timePinned: true });
        expect(pinned.lever).not.toBe('cycle');
        expect(pinned.after?.cycleTimeMs ?? 16000).toBe(16000);
    });
});

describe('through Recalculate and Sync', () => {
    it('keeps a pinned Token\'s and recipe\'s time and the pin, and derives the source beside them', () => {
        store().hydrate(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.cycleTimeMs).toBe(PINNED_MS);
        expect(files['tokens.json'].fx_vein.sim).toEqual({ ...TAGS, timePinned: true });
        const smelt = files['tokenRecipes.json'].find((r) => r.id === 'fx_smelt');
        expect(smelt.durationMs).toBe(PINNED_MS);
        expect(smelt.sim).toEqual({ ...TAGS, timePinned: true });
        expect(files['tokens.json'].fx_tree.config.cycleTimeMs).not.toBe(PINNED_MS);
    });

    it('puts the band\'s time back without the pin: the guard has teeth', () => {
        store().hydrate(pinWorkspace());
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.cycleTimeMs).not.toBe(PINNED_MS);
        expect(files['tokenRecipes.json'].find((r) => r.id === 'fx_smelt').durationMs).not.toBe(PINNED_MS);
    });

    it('stays put on a second Recalculate', () => {
        store().hydrate(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        const first = syncPayload();
        const second = syncPayload();
        expect(second['tokens.json'].fx_vein).toEqual(first['tokens.json'].fx_vein);
        expect(second['tokenRecipes.json']).toEqual(first['tokenRecipes.json']);
    });

    it('hands the time back to the band when the pin is cleared', () => {
        store().hydrate(pinWorkspace({ pinTokens: true }));
        expect(syncPayload()['tokens.json'].fx_vein.config.cycleTimeMs).toBe(PINNED_MS);
        store().updateToken('fx_vein', { sim: { ...store().tokens.fx_vein.sim, timePinned: undefined } });
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.cycleTimeMs).not.toBe(PINNED_MS);
        expect(files['tokens.json'].fx_vein.sim).toEqual(TAGS);
    });
});

describe('the editors', () => {
    const pinOf = (container) => container.querySelector('[data-time-pin]');
    const box = (container) => pinOf(container).querySelector('input[type="checkbox"]');

    beforeEach(() => store().hydrate(pinWorkspace()));

    it('a Token shows the pin beside its cycle time, ticks it, keeps its tags and clears it', () => {
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        expect(pinOf(container).getAttribute('data-time-pin')).toBe('off');
        fireEvent.click(box(container));
        expect(store().tokens.fx_vein.sim).toEqual({ ...TAGS, timePinned: true });
        expect(pinOf(container).getAttribute('data-time-pin')).toBe('on');
        expect(pinOf(container).textContent).toMatch(/Recalculate keeps this time/);
        fireEvent.click(box(container));
        expect(store().tokens.fx_vein.sim?.timePinned).toBeUndefined();
        expect(store().tokens.fx_vein.sim).toMatchObject(TAGS);
    });

    it('a pinned Token\'s cycle field stops claiming the simulator overwrites it; a typed time holds', () => {
        store().updateToken('fx_vein', { sim: { ...TAGS, timePinned: true } });
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const label = [...container.querySelectorAll('label')].find((l) => l.textContent.includes('Cycle Time (ms)'));
        expect(label.querySelector('[title*="overwritten"]')).toBeNull();
        fireEvent.change(label.parentElement.querySelector('input[type="number"]'), { target: { value: '9100' } });
        expect(syncPayload()['tokens.json'].fx_vein.config.cycleTimeMs).toBe(9100);
    });

    it('an unpinned Token\'s cycle field still carries the simulator\'s mark', () => {
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const label = [...container.querySelectorAll('label')].find((l) => l.textContent.includes('Cycle Time (ms)'));
        expect(label.querySelector('[title*="overwritten"]')).not.toBeNull();
    });

    it('a recipe shows the pin beside its cycle time, ticks it and clears it', () => {
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Smithing'));
        expect(pinOf(container).getAttribute('data-time-pin')).toBe('off');
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim).toEqual({ ...TAGS, timePinned: true });
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim?.timePinned).toBeUndefined();
    });
});
