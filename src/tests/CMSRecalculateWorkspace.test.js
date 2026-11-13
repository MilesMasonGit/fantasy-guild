// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { recalculateWorkspace, balancedForSync } from '../../cms/src/engine/recalculate';
import { workspaceFromImport } from '../../cms/src/engine/workspaceSeeds';
import { workspaceFromDataFiles } from '../../cms/src/engine/changePacks';
import { DEFAULT_DIALS } from '../../cms/src/engine/sim/dials';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';

/**
 * Recalculate as a function (`engine/recalculate.js`): the store's Recalculate button and the
 * command line run the same line, so the store's result must be exactly the function's. Runs on
 * today's `data/`; the store never persists here (TESTING, "The CMS").
 */

const root = path.resolve(__dirname, '../..');
const read = (name, fallback) => {
    const file = path.join(root, 'data', name);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
};
let workspace;

beforeAll(() => {
    useEntityStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
    workspace = workspaceFromImport(workspaceFromDataFiles({
        items: read('items.json'), tokens: read('tokens.json'), effects: read('effects.json', {}),
        tokenRecipes: read('tokenRecipes.json', []), starterCamp: read('starterCamp.json', null),
        skillPerks: read('skillPerks.json', null), hallStars: read('hallStars.json', null), world: read('world.json', null),
        events: read('events.json', null),
        plan: JSON.parse(fs.readFileSync(path.join(root, 'cms', 'plan', 'plan.json'), 'utf8')),
    }));
});

describe('recalculateWorkspace', () => {
    it('leaves its input and every store alone', () => {
        const before = JSON.stringify(workspace);
        const churnBefore = useSimulationStore.getState().churnReport;
        const { workspace: next, report } = recalculateWorkspace(workspace, DEFAULT_DIALS, { now: () => 1 });
        expect(JSON.stringify(workspace)).toBe(before);
        expect(useSimulationStore.getState().churnReport).toBe(churnBefore);
        expect(Object.keys(next.items).length).toBe(Object.keys(workspace.items).length);
        expect(report.auditIssues.length).toBeGreaterThan(0);
        // The collections the line does not touch pass through as they were.
        for (const key of ['starterCamp', 'skillPerks', 'hallStars', 'hallConstellations', 'world', 'events', 'planSettings']) {
            expect(next[key], key).toBe(workspace[key]);
        }
    });

    it('is what the Recalculate button writes, to the store and the simulator panel alike', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);
        try {
            const { workspace: next, report } = recalculateWorkspace(workspace, DEFAULT_DIALS, { previousChurn: null });
            useSimulationStore.getState().setSimResults({});
            useEntityStore.getState().hydrate(workspace);
            const balanced = useEntityStore.getState().recalculateEconomy({ simDials: DEFAULT_DIALS });
            const state = useEntityStore.getState();
            for (const key of ['items', 'tokens', 'recipePools', 'effects']) {
                expect(JSON.stringify(state[key]), key).toBe(JSON.stringify(next[key]));
            }
            const sim = useSimulationStore.getState();
            expect(JSON.stringify(sim.simAnswers)).toBe(JSON.stringify(report.simAnswers));
            expect(JSON.stringify(sim.churnReport)).toBe(JSON.stringify(report.churnReport));
            expect(JSON.stringify(sim.auditResults)).toBe(JSON.stringify(report.auditIssues));
            const { sim: _a, ...fromStore } = balanced;
            const { sim: _b, ...fromFunction } = balancedForSync(useEntityStore.getState(), report);
            expect(JSON.stringify(fromStore)).toBe(JSON.stringify(fromFunction));
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('the Audit tab hears the Guild Hall', () => {
    it('lists every finding the game\'s own Hall star rule makes of the workspace\'s sky', async () => {
        const { hallStarFindings } = await import('../systems/core/hallStarRule.js');
        const { report } = recalculateWorkspace(workspace, DEFAULT_DIALS, { now: () => 1 });
        const expected = hallStarFindings({
            sky: { constellations: workspace.hallConstellations || {}, stars: workspace.hallStars || {} },
            items: report.items, tokens: report.tokens,
        }).map((f) => `${f.entityId}: ${f.message}`);
        const listed = report.auditIssues.filter((i) => i.entityType === 'Hall star')
            .map((i) => `${i.entityId}: ${i.details.charAt(0).toLowerCase()}${i.details.slice(1)}`);
        expect(listed).toEqual(expected);
    });
});
