// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useGlobalStore } from '../../cms/src/stores/useGlobalStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { DEFAULT_DIALS, normaliseDials, workspaceDials } from '../../cms/src/engine/sim/dials';
import { xpPerCycle } from '../../cms/src/engine/sim/xpPass';
import { xpAnHourAt } from '../../cms/src/engine/balanceRules';
import PaceDials from '../../cms/src/components/shared/PaceDials.jsx';

/**
 * The rulebook is on wherever the workspace's stored dials are read: Recalculate (and the Sync it
 * runs), the Pace dials panel and the command line (its own test is in `CMSCli.test.js`). A stored
 * `rulebook: false` is a snapshot of the old default, not a choice, and no longer turns it off.
 * The simulator's own default (`DEFAULT_DIALS`) stays off for its unit tests.
 *
 * ⚠️ Fixtures only: no shipped id, and nothing reaches `data/`.
 */

const HOUR_MS = 3600000;

/** What the owner's workspace stores: the old default, written out, with the old XP pins. */
const STORED_OFF = Object.freeze({
    ...DEFAULT_DIALS,
    rulebook: false,
    xphPins: { 1: 700, 10: 1340, 20: 2750, 30: 5700, 40: 11800, 50: 24200, 60: 50300, 70: 103000, 80: 214000, 90: 437000, 99: 837000 },
});

function workspace() {
    return {
        items: { fx_note: { id: 'fx_note', name: 'Note', rarity: 'common' } },
        tokens: {},
        effects: {},
        maps: {},
        recipePools: {
            crafting: [{
                id: 'fx_recipe_study', name: 'Study', skill: 'crafting', levelRequirement: 1,
                durationMs: HOUR_MS, xp: 1, stationChargeCost: 1, requiresContext: [],
                inputs: [],
                outputs: [{ itemId: 'fx_note', chance: 100, minQty: 1, maxQty: 1, anchor: true, baseQty: { min: 1, max: 1 }, variable: false }],
                sim: { tempo: 'medium', purpose: 'xph' },
            }],
        },
    };
}

let globalsBefore;
beforeEach(() => {
    globalsBefore = useGlobalStore.getState().simDials;
    useGlobalStore.setState({ simDials: STORED_OFF });
});
afterEach(() => {
    useGlobalStore.setState({ simDials: globalsBefore });
    useSimulationStore.getState().clearResults();
    cleanup();
});

describe('the workspace\'s dials', () => {
    it('turn the rulebook on over a stored rulebook: false, and the rule then drops the stored pins', () => {
        const dials = workspaceDials(STORED_OFF);
        expect(dials.rulebook).toBe(true);
        const normal = normaliseDials(dials);
        expect(normal).not.toHaveProperty('xphPins');
        expect(normal).not.toHaveProperty('gphPins');
        expect(workspaceDials(null).rulebook).toBe(true);
    });

    it('leave the simulator\'s own default off', () => {
        expect(DEFAULT_DIALS.rulebook).toBe(false);
        expect(STORED_OFF.rulebook).toBe(false);
    });
});

describe('Recalculate on a workspace storing rulebook: false', () => {
    it('reads the rules\' XP an hour, not the stored pins', () => {
        useEntityStore.setState({ ...workspace(), activeEntityId: null, activeEntityType: null });
        const result = useEntityStore.getState().recalculateEconomy(useGlobalStore.getState());
        // The Tempo tag moves the cycle, so the XP is read against the cycle Recalculate settled on.
        const { xp, durationMs } = result.recipePools.crafting[0];
        expect(xp).toBe(xpPerCycle(1, 'xph', durationMs, normaliseDials({ rulebook: true })));
        expect(xp).not.toBe(xpPerCycle(1, 'xph', durationMs, normaliseDials(STORED_OFF)));
        expect(xpPerCycle(1, 'xph', HOUR_MS, normaliseDials(STORED_OFF))).toBe(700);
    });
});

describe('the Pace dials panel on a workspace storing rulebook: false', () => {
    it('shows the balance rules\' curves, read-only', () => {
        const { container } = render(React.createElement(PaceDials));
        expect(container.textContent).toContain('balance rules, sections 1 and 7');
        expect(container.textContent).toContain(Math.round(xpAnHourAt(1)).toLocaleString());
        expect(container.textContent).not.toContain('Experience per hour (§13.2)');
    });
});
