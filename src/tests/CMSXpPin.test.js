// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { runXpPass, xpPerCycle } from '../../cms/src/engine/sim/xpPass.js';
import { adaptToken, adaptRecipe } from '../../cms/src/engine/sim/fieldAdapter.js';
import { DEFAULT_DIALS } from '../../cms/src/engine/sim/dials.js';
import { progressionRows, recordPatch } from '../../cms/src/engine/progressionRows';
import { workspaceBalance, balancePack, balanceText } from '../../cms/src/engine/ledgerBalance.js';
import { setValue, proposedValue } from '../../cms/src/engine/changePacks.js';
import { LEVER } from '../../cms/src/engine/ledger/balance.js';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import RecipeEditor from '../../cms/src/components/editors/RecipeEditor.jsx';
import { balanceContent } from './fixtures/balanceWorld.js';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

/**
 * A pinned XP a cycle: `sim.xpPinned` on a Token or a recipe, beside its Tempo and Purpose, keeps the
 * record's own number through Recalculate and so through Sync, which runs it. Everything else
 * Recalculate derives, on that record and every other, is untouched. A balancing pack pins the XP
 * numbers it sets on a tagged entry; the editors show a pin and clear it.
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

const store = () => useEntityStore.getState();
const syncPayload = () => JSON.parse(JSON.stringify(syncFiles(store().recalculateEconomy({}))));
const SEAM_TAGS = { tempo: 'quick', purpose: 'iph' };

/** A vein, a tree and a smelting recipe, tagged so Recalculate derives their cycle and XP. */
function pinWorkspace({ pinTokens = false, pinRecipes = false } = {}) {
    const output = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });
    const sim = (pin) => ({ ...SEAM_TAGS, ...(pin ? { xpPinned: true } : {}) });
    const worked = (id, name, skill, itemId, xp, pin) => ({
        id, name, uses: null, sim: sim(pin),
        config: { skill, skillRequired: 1, cycleTimeMs: 3000, xp, inputs: [], outputs: [output(itemId)] }
    });
    return {
        items: {
            fx_ore: { id: 'fx_ore', name: 'Fx Ore', type: 'material' },
            fx_wood: { id: 'fx_wood', name: 'Fx Wood', type: 'material' },
            fx_bar: { id: 'fx_bar', name: 'Fx Bar', type: 'material' }
        },
        tokens: {
            fx_vein: worked('fx_vein', 'Fx Vein', 'mining', 'fx_ore', 12, pinTokens),
            fx_tree: worked('fx_tree', 'Fx Tree', 'forestry', 'fx_wood', 9, false),
            fx_furnace: {
                id: 'fx_furnace', name: 'Fx Furnace', uses: null,
                config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
                statements: [{ keyword: 'station', payload: { skill: 'smithing', stationKind: 'furnace' } }]
            }
        },
        effects: {},
        recipePools: {
            smithing: [
                { id: 'fx_smelt', name: 'Fx Smelt', skill: 'smithing', levelRequirement: 1, stationKinds: ['furnace'], durationMs: 3000, xp: 34, sim: sim(pinRecipes), inputs: [{ itemId: 'fx_ore', quantity: 1 }], outputs: [output('fx_bar')] }
            ]
        }
    };
}

afterEach(() => {
    cleanup();
    useSimulationStore.getState().clearResults();
});

describe('the XP pass', () => {
    const tagged = (sim) => ({ id: 'fx', name: 'Fx', sim, config: { skill: 'mining', skillRequired: 40, cycleTimeMs: 60000, xp: 7, outputs: [{ itemId: 'fx_ore' }] } });
    const pass = (def) => runXpPass([adaptToken(def)], { cycleTimes: new Map([['fx', 60000]]) });

    it('gives a pinned source no derived number, so the write-back keeps the record\'s own', () => {
        expect(pass(tagged({ ...SEAM_TAGS })).xp.has('fx')).toBe(true);
        expect(pass(tagged({ ...SEAM_TAGS, xpPinned: true })).xp.has('fx')).toBe(false);
    });

    it('reads the pin on a recipe as on a Token, and only `true` counts', () => {
        const recipe = adaptRecipe({ id: 'fx_r', name: 'Fx R', skill: 'mining', levelRequirement: 40, durationMs: 60000, xp: 7, sim: { ...SEAM_TAGS, xpPinned: true }, outputs: [{ itemId: 'fx_ore' }] });
        expect(recipe.xpPinned).toBe(true);
        expect(adaptToken(tagged({ ...SEAM_TAGS, xpPinned: 'yes' })).xpPinned).toBe(false);
        expect(adaptToken(tagged({ ...SEAM_TAGS })).xpPinned).toBe(false);
    });

    it('says out loud what the curve would give, on an Info row for the pin', () => {
        const { rows } = pass(tagged({ ...SEAM_TAGS, xpPinned: true }));
        const derived = xpPerCycle(40, 'iph', 60000, DEFAULT_DIALS);
        const row = rows.find(r => r.code === 'xp-pinned');
        expect(row).toMatchObject({ severity: 'info', entityId: 'fx' });
        expect(row.message).toContain('pinned at 7');
        expect(row.message).toContain(String(derived));
        expect(pass(tagged({ ...SEAM_TAGS })).rows.some(r => r.code === 'xp-pinned')).toBe(false);
    });
});

describe('through Recalculate and Sync', () => {
    it('keeps a pinned Token\'s and recipe\'s number and the pin, and derives the source beside them', () => {
        store().hydrate(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.xp).toBe(12);
        expect(files['tokens.json'].fx_vein.sim).toEqual({ ...SEAM_TAGS, xpPinned: true });
        const smelt = files['tokenRecipes.json'].find(r => r.id === 'fx_smelt');
        expect(smelt.xp).toBe(34);
        expect(smelt.sim).toEqual({ ...SEAM_TAGS, xpPinned: true });
        // The source beside them is derived as ever: its 9 goes back to what the curve says.
        expect(files['tokens.json'].fx_tree.config.xp).toBe(1);
    });

    it('puts the number back without the pin: the guard has teeth', () => {
        store().hydrate(pinWorkspace());
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.xp).toBe(1);
        expect(files['tokenRecipes.json'].find(r => r.id === 'fx_smelt').xp).toBe(1);
    });

    it('changes nothing else: the same content pinned and unpinned differs only in XP and the pin', () => {
        const stripped = (files) => {
            const copy = JSON.parse(JSON.stringify(files));
            for (const t of Object.values(copy['tokens.json'])) {
                if (t.config) delete t.config.xp;
                if (t.sim) delete t.sim.xpPinned;
            }
            for (const r of copy['tokenRecipes.json']) {
                delete r.xp;
                if (r.sim) delete r.sim.xpPinned;
            }
            return copy;
        };
        store().hydrate(pinWorkspace());
        const plain = stripped(syncPayload());
        store().hydrate(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        const pinned = stripped(syncPayload());
        expect(pinned).toEqual(plain);
    });

    it('stays put on a second Recalculate', () => {
        store().hydrate(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        const first = syncPayload();
        const second = syncPayload();
        expect(second['tokens.json'].fx_vein.config.xp).toBe(first['tokens.json'].fx_vein.config.xp);
        expect(second['tokenRecipes.json']).toEqual(first['tokenRecipes.json']);
    });

    it('hands the number back to the curve when the pin is cleared', () => {
        store().hydrate(pinWorkspace({ pinTokens: true }));
        expect(syncPayload()['tokens.json'].fx_vein.config.xp).toBe(12);
        store().updateToken('fx_vein', { sim: { ...store().tokens.fx_vein.sim, xpPinned: undefined } });
        const files = syncPayload();
        expect(files['tokens.json'].fx_vein.config.xp).toBe(1);
        expect(files['tokens.json'].fx_vein.sim).toEqual(SEAM_TAGS);
    });

    it('keeps a pin on an untagged source harmlessly: it stays untagged, its numbers as typed', () => {
        const ws = pinWorkspace();
        ws.tokens.fx_vein.sim = { xpPinned: true };
        store().hydrate(ws);
        const vein = syncPayload()['tokens.json'].fx_vein;
        expect(vein.config.xp).toBe(12);
        expect(vein.config.cycleTimeMs).toBe(3000);
    });
});

describe('the shipped content', { timeout: 30000 }, () => {
    it('Recalculate gives every entry with no pin the XP a cycle it already has', () => {
        const DATA = path.resolve(__dirname, '../../data');
        const read = (f) => JSON.parse(asLoaded(f, fs.readFileSync(path.join(DATA, f), 'utf8').replace(/\r\n/g, '\n')));
        const [items, tokens, tokenRecipes, effects] = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'].map(read);
        const recipePools = {};
        for (const r of tokenRecipes) (recipePools[r.skill || 'general'] ||= []).push(r);
        store().hydrate({ items, tokens, effects, recipePools });
        const files = syncPayload();
        const moved = [];
        for (const [id, t] of Object.entries(tokens)) {
            const after = files['tokens.json'][id];
            if (t.config && after?.config?.xp !== t.config.xp) moved.push(`${id} ${t.config.xp} → ${after?.config?.xp}`);
        }
        for (const r of tokenRecipes) {
            const after = files['tokenRecipes.json'].find(x => x.id === r.id);
            if (after?.xp !== r.xp) moved.push(`${r.id} ${r.xp} → ${after?.xp}`);
        }
        expect(moved).toEqual([]);
    });
});

describe('a balancing pack', { timeout: 60000 }, () => {
    /** The balance fixture as a workspace, its slow Herbs and its Elixir tagged, so Recalculate derives them. */
    function balanceWorkspace() {
        const c = balanceContent();
        const recipePools = {};
        for (const r of c.recipes) (recipePools[r.skill] ||= []).push(r);
        c.tokens.token_herbs.sim = { tempo: 'medium', purpose: 'iph' };
        recipePools.alchemy.find(r => r.id === 'recipe_tonic').sim = { tempo: 'medium', purpose: 'iph' };
        return {
            items: c.items, tokens: c.tokens, effects: c.effects, recipePools, starterCamp: c.starterCamp, skillPerks: null,
            planSettings: { stages: [{ tier: 0, budgetMinutes: 30 }] }
        };
    }
    let ws;
    let result;
    let pack;
    beforeAll(() => {
        ws = balanceWorkspace();
        result = workspaceBalance(ws);
        pack = balancePack(ws, result, { createdAt: '2026-11-03T12:00:00Z' });
    });
    const recordIn = (entry) => (entry.kind === 'recipe' ? entry.value.xp : entry.value.config?.xp);
    const xpProposals = () => result.proposals.filter(p => p.lever === LEVER.XP);

    it('pins the XP numbers it sets on a tagged entry, and says so', () => {
        const tagged = xpProposals().filter(p => p.id === 'token_herbs' || p.id === 'recipe_tonic');
        expect(tagged.length).toBeGreaterThan(0);
        for (const p of tagged) {
            const entry = pack.entries.find(e => e.id === p.id);
            expect(entry.value.sim).toEqual({ tempo: 'medium', purpose: 'iph', xpPinned: true });
            expect(recordIn(entry)).toBe(p.to);
            expect(entry.note).toMatch(/Pinned/);
        }
    });

    it('leaves the pin off a number Recalculate would not touch, and off every other lever', () => {
        const pinned = (e) => e.value.sim?.xpPinned === true;
        for (const e of pack.entries) {
            const levers = result.proposals.filter(p => p.id === e.id).map(p => p.lever);
            if (!levers.includes(LEVER.XP) || !e.value.sim?.tempo) expect(pinned(e)).toBe(false);
        }
        // The fixture has untagged XP proposals too, so the rule above is not empty.
        expect(xpProposals().some(p => !pack.entries.find(e => e.id === p.id).value.sim)).toBe(true);
    });

    it('never changes the workspace it is made from', () => {
        expect(ws).toEqual(balanceWorkspace());
    });

    it('survives Recalculate and Sync once accepted: every XP proposal lands as proposed', () => {
        let accepted = ws;
        for (const e of pack.entries) accepted = { ...accepted, ...setValue(accepted, e.kind, e.id, proposedValue(e)) };
        store().hydrate(accepted);
        const files = syncPayload();
        for (const p of xpProposals()) {
            const number = p.kind === 'recipe' ? files['tokenRecipes.json'].find(r => r.id === p.id).xp : files['tokens.json'][p.id].config.xp;
            expect(`${p.id} ${number}`).toBe(`${p.id} ${p.to}`);
        }
    });

    it('the preview\'s text says an XP number survives Sync', () => {
        expect(balanceText(result)).toMatch(/XP a cycle: a change pack pins these numbers .*so Sync keeps them/);
    });

    it('reads a pinned entry\'s number like any other, and can move it again', () => {
        let accepted = ws;
        for (const e of pack.entries) accepted = { ...accepted, ...setValue(accepted, e.kind, e.id, proposedValue(e)) };
        accepted.tokens = { ...accepted.tokens, token_herbs: { ...accepted.tokens.token_herbs, config: { ...accepted.tokens.token_herbs.config, xp: 1 } } };
        const again = workspaceBalance(accepted);
        const herbs = again.proposals.find(p => p.id === 'token_herbs' && p.lever === LEVER.XP);
        expect(herbs).toMatchObject({ from: 1 });
        expect(herbs.to).toBeGreaterThan(1);
        const next = balancePack(accepted, again, { createdAt: '2026-11-03T12:00:00Z' }).entries.find(e => e.id === 'token_herbs');
        expect(next.value.sim.xpPinned).toBe(true);
    });
});

describe('the editors', () => {
    const pinOf = (container) => container.querySelector('[data-xp-pin]');
    const box = (container) => pinOf(container).querySelector('input[type="checkbox"]');

    beforeEach(() => store().hydrate(pinWorkspace()));

    it('a Token shows the pin beside its XP, ticks it, keeps its tags and clears it', () => {
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        expect(pinOf(container).getAttribute('data-xp-pin')).toBe('off');
        expect(box(container).checked).toBe(false);

        fireEvent.click(box(container));
        expect(store().tokens.fx_vein.sim).toEqual({ ...SEAM_TAGS, xpPinned: true });
        expect(pinOf(container).getAttribute('data-xp-pin')).toBe('on');
        expect(pinOf(container).textContent).toMatch(/Recalculate keeps this number/);

        fireEvent.click(box(container));
        expect(store().tokens.fx_vein.sim?.xpPinned).toBeUndefined();
        expect(store().tokens.fx_vein.sim).toMatchObject(SEAM_TAGS);
        expect(pinOf(container).getAttribute('data-xp-pin')).toBe('off');
    });

    it('a pinned Token\'s XP field stops claiming the simulator overwrites it; a typed number holds', () => {
        store().updateToken('fx_vein', { sim: { ...SEAM_TAGS, xpPinned: true } });
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const label = [...container.querySelectorAll('label')].find(l => l.textContent.includes('XP per cycle'));
        expect(label.querySelector('[title*="overwritten"]')).toBeNull();
        const input = label.parentElement.querySelector('input[type="number"]');
        fireEvent.change(input, { target: { value: '21' } });
        expect(syncPayload()['tokens.json'].fx_vein.config.xp).toBe(21);
    });

    it('an unpinned Token\'s XP field still carries the simulator\'s mark', () => {
        store().setActiveEntity('fx_vein', 'token');
        const { container } = render(React.createElement(TokenEditor));
        const label = [...container.querySelectorAll('label')].find(l => l.textContent.includes('XP per cycle'));
        expect(label.querySelector('[title*="overwritten"]')).not.toBeNull();
    });

    it('a station whose XP is set per recipe offers no pin', () => {
        store().setActiveEntity('fx_furnace', 'token');
        const { container } = render(React.createElement(TokenEditor));
        expect(pinOf(container)).toBeNull();
    });

    it('a recipe shows the pin beside its XP, ticks it and clears it', () => {
        const { container } = render(React.createElement(RecipeEditor));
        fireEvent.click(screen.getByText('Smithing'));
        expect(pinOf(container).getAttribute('data-xp-pin')).toBe('off');
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim).toEqual({ ...SEAM_TAGS, xpPinned: true });
        fireEvent.click(box(container));
        expect(store().recipePools.smithing[0].sim?.xpPinned).toBeUndefined();
    });
});

describe('the Progression screen', () => {
    it('its rows say which XP numbers are pinned', () => {
        const rows = progressionRows(pinWorkspace({ pinTokens: true, pinRecipes: true }));
        expect(rows.find(r => r.id === 'fx_vein').xpPinned).toBe(true);
        expect(rows.find(r => r.id === 'fx_smelt').xpPinned).toBe(true);
        expect(rows.find(r => r.id === 'fx_tree').xpPinned).toBe(false);
    });

    it('editing a Tempo or a Purpose keeps the pin', () => {
        const current = pinWorkspace({ pinTokens: true }).tokens.fx_vein;
        const patch = recordPatch({ kind: 'token' }, current, { tempo: 'slow' });
        expect(patch.sim).toEqual({ tempo: 'slow', purpose: 'iph', xpPinned: true });
    });
});
