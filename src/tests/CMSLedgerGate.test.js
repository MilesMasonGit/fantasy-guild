// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { useReviewStore } from '../../cms/src/stores/useReviewStore.js';
import { useLedgerWatchStore, startLedgerWatch } from '../../cms/src/stores/useLedgerWatchStore.js';
import App from '../../cms/src/App.jsx';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { fingerprint, validatePack } from '../../cms/src/engine/changePacks.js';
import { snapshotOf, compareSnapshots, hasChanges } from '../../cms/src/engine/ledgerCompare.js';
import { runGate, gateRecord, gateStatus, workspaceFingerprint, applyPackInMemory, GATE_VERSION } from '../../cms/src/engine/packGate.js';
import { workspaceSnapshot } from '../../cms/src/engine/ledgerJobs.js';
import { workspaceReport } from '../../cms/src/engine/ledgerReport.js';
import { paceWorkspace } from './fixtures/paceWorld.js';

/**
 * Before and after, and the agent gate (brief 290 L7): snapshots of the ledger compared into moved
 * entries, stage moves and checks turned on and off; a change pack applied in memory and blocked
 * when it adds a Block finding, moves a stage beyond the tolerance undeclared, or adds a waiver;
 * the gate on the review page and ghost dots on the timeline. The store never persists here
 * (TESTING, "The CMS"); the inbox is a temp folder behind the real server routes.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const bigHutRecipe = (ws) => ws.recipePools.construction.find((r) => r.id === 'recipe_build_big_hut');

/**
 * The sample that passes: the Big Hut asks Construction 5, not 15, and the pack says the stages it
 * finishes get faster (the Starter Camp's too: the Big Hut has no tier of its own, so it counts there).
 */
function goodPack(ws = paceWorkspace(), extra = {}) {
    const recipe = bigHutRecipe(ws);
    return {
        format: 'fantasy-guild-change-pack', version: 1, id: 'sample-big-hut-sooner', createdAt: '2026-10-30T12:00:00Z',
        asked: 'The Big Hut sooner (sample)',
        intent: { stages: [{ tier: 0, move: 'faster', note: 'The Big Hut was a wall at Construction 15' }, { tier: 1, move: 'faster', note: 'The Big Hut was a wall at Construction 15' }] },
        entries: [{ op: 'edit', kind: 'recipe', id: recipe.id, value: { ...recipe, levelRequirement: 5 }, fingerprint: fingerprint(recipe), note: 'Construction 5, not 15' }],
        ...extra,
    };
}

/** The sample that is blocked: a Live recipe that needs a Planned stub, and a waiver the agent wrote itself. */
function badPack() {
    return {
        format: 'fantasy-guild-change-pack', version: 1, id: 'sample-bad', createdAt: '2026-10-30T12:00:00Z',
        asked: 'Silver things (sample)',
        entries: [
            { op: 'create', kind: 'item', id: 'item_silver_ore', value: { name: 'Silver Ore', type: 'material', plan: { status: 'planned', tier: 2, note: 'later' } }, note: 'A stub' },
            {
                op: 'create', kind: 'recipe', id: 'recipe_silver_bar', note: 'Silver bars from the stub',
                value: { name: 'Silver Bar', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_silver_ore', quantity: 1 }], outputs: [{ itemId: 'item_oak_wood', chance: 100, minQty: 1, maxQty: 1 }], plan: { tier: 0, waivers: [{ check: 'refs-planned', note: 'fine', by: 'owner' }] } },
            },
        ],
    };
}

describe('before and after', () => {
    const before = workspaceSnapshot(paceWorkspace());

    it('takes a snapshot that survives JSON and a Worker: dots, stages, findings', () => {
        expect(JSON.parse(JSON.stringify(before))).toEqual(before);
        expect(before.dots['token:token_big_hut']).toMatchObject({ lane: 'construction', level: 15 });
        expect(before.stages.find((s) => s.tier === 1).hours).toBeGreaterThan(0);
        expect(before.tolerancePct).toBe(25);
    });

    it('finds nothing moved between a workspace and itself', () => {
        const diff = compareSnapshots(before, workspaceSnapshot(paceWorkspace()));
        expect(diff.moved).toEqual([]);
        expect(diff.added).toEqual([]);
        expect(hasChanges(diff)).toBe(false);
    });

    it('lists the entries an edit moves, furthest first, the stage it moves and the checks it clears', () => {
        const ws = paceWorkspace();
        bigHutRecipe(ws).levelRequirement = 5;
        const diff = compareSnapshots(before, workspaceSnapshot(ws));
        const hut = diff.moved.find((m) => m.key === 'token:token_big_hut');
        expect(hut.change).toBe('earlier');
        expect(hut.to.hours).toBeLessThan(hut.from.hours);
        expect(hut.to.level).toBe(5);
        for (let i = 1; i < diff.moved.length; i++) expect(diff.moved[i - 1].distance).toBeGreaterThanOrEqual(diff.moved[i].distance);
        const plane1 = diff.stages.find((s) => s.tier === 1);
        expect(plane1).toMatchObject({ direction: 'faster', beyond: true });
        expect(plane1.after).toBeLessThan(plane1.before);
    });

    it('says when an entry is no longer reached', () => {
        const ws = paceWorkspace();
        ws.recipePools.construction = ws.recipePools.construction.filter((r) => r.id !== 'recipe_build_big_hut');
        const diff = compareSnapshots(before, workspaceSnapshot(ws));
        expect(diff.moved[0]).toMatchObject({ key: 'token:token_big_hut', change: 'gone', to: null });
    });

    it('reads a stage whose entries lose their time as slower, not faster', () => {
        const report = workspaceReport(paceWorkspace());
        const a = snapshotOf(report);
        const b = structuredClone(a);
        const stage = b.stages.find((s) => s.tier === 1);
        stage.hours = 0.01;
        stage.untimed += 1;
        expect(compareSnapshots(a, b).stages.find((s) => s.tier === 1)).toMatchObject({ beyond: true, direction: 'slower', lost: true });
    });
});

describe('the agent gate', () => {
    it('passes a pack that declares the stage move it makes, and shows its changes', () => {
        const result = runGate(paceWorkspace(), goodPack(), workspaceSnapshot);
        expect(result.verdict).toBe('pass');
        expect(result.blocks).toEqual([]);
        expect(result.diff.moved.find((m) => m.key === 'token:token_big_hut').change).toBe('earlier');
        expect(result.notes.join(' ')).toMatch(/as declared: The Big Hut was a wall/);
        expect(result.summary).toMatch(/^Passes: \d+ entr(y moves|ies move) on the timeline/);
    });

    it('blocks the same edit when the pack does not declare the move, or declares it the other way', () => {
        const undeclared = runGate(paceWorkspace(), goodPack(undefined, { intent: undefined }), workspaceSnapshot);
        expect(undeclared.verdict).toBe('block');
        expect(undeclared.blocks.map((b) => b.rule)).toEqual(['stage-undeclared', 'stage-undeclared']);
        expect(undeclared.blocks[1].message).toMatch(/Plane 1: .* faster: beyond the ±25 % tolerance, and the pack does not declare it/);

        const declare = (plane1) => ({ intent: { stages: [{ tier: 0, move: 'faster', note: 'x' }, { tier: 1, note: 'x', ...plane1 }] } });
        const wrongWay = runGate(paceWorkspace(), goodPack(undefined, declare({ move: 'slower' })), workspaceSnapshot);
        expect(wrongWay.blocks.map((b) => b.rule)).toEqual(['stage-mismatch']);
        expect(wrongWay.blocks[0].message).toMatch(/the pack declares it slower/);

        const after = runGate(paceWorkspace(), goodPack(), workspaceSnapshot).diff.stages.find((s) => s.tier === 1).after;
        const near = runGate(paceWorkspace(), goodPack(undefined, declare({ move: 'faster', toHours: after * 1.1 })), workspaceSnapshot);
        expect(near.verdict).toBe('pass');
        const far = runGate(paceWorkspace(), goodPack(undefined, declare({ move: 'faster', toHours: after * 3 })), workspaceSnapshot);
        expect(far.blocks.map((b) => b.rule)).toEqual(['stage-mismatch']);
    });

    it('blocks a pack that adds a Block finding (Live content needing a Planned stub) and a waiver of its own', () => {
        const result = runGate(paceWorkspace(), badPack(), workspaceSnapshot);
        expect(result.verdict).toBe('block');
        const rules = result.blocks.map((b) => b.rule);
        expect(rules).toContain('new-block');
        expect(rules).toContain('waiver');
        expect(result.blocks.filter((b) => b.rule === 'new-block').map((b) => b.message).join(' | ')).toMatch(/A new Block finding on Silver Bar: Uses Silver Ore, which is only Planned/);
    });

    it('never blocks on problems the workspace already had', () => {
        const ws = paceWorkspace();
        const had = applyPackInMemory(ws, badPack()).workspace;
        delete had.recipePools.cooking.find((r) => r.id === 'recipe_silver_bar').plan.waivers;
        const item = had.items.item_oak_wood;
        const pack = {
            format: 'fantasy-guild-change-pack', version: 1, id: 'note-only', createdAt: '2026-10-30T12:00:00Z', asked: 'A note',
            entries: [{ op: 'edit', kind: 'item', id: 'item_oak_wood', value: { ...item, plan: { ...item.plan, note: 'the first wood' } }, fingerprint: fingerprint(item), note: 'A note' }],
        };
        const result = runGate(had, pack, workspaceSnapshot);
        expect(result.before.findings.some((f) => f.severity === 'block')).toBe(true);
        expect(result.verdict).toBe('pass');
        expect(result.diff.moved).toEqual([]);
    });

    it('blocks a pack the CMS would refuse', () => {
        const pack = goodPack(undefined, { intent: { stages: [{ tier: 'one', move: 'sideways' }] } });
        expect(runGate(paceWorkspace(), pack, workspaceSnapshot)).toMatchObject({ verdict: 'block' });
    });

    it('records a compact gate in the pack, stale once the workspace changes', () => {
        const ws = paceWorkspace();
        const record = gateRecord(runGate(ws, goodPack(), workspaceSnapshot));
        expect(JSON.parse(JSON.stringify(record))).toEqual(record);
        expect(record).toMatchObject({ verdict: 'pass', toolVersion: GATE_VERSION, workspaceFingerprint: workspaceFingerprint(ws) });
        expect(record.deltas.moved[0]).toHaveProperty('name');
        expect(gateStatus(record, workspaceFingerprint(ws))).toBe('pass');
        ws.items.item_oak_wood.name = 'Oak Logs';
        expect(gateStatus(record, workspaceFingerprint(ws))).toBe('stale');
        expect(gateStatus(null, 'fp:x')).toBe('none');
        expect(gateStatus({ ...record, toolVersion: GATE_VERSION - 1 }, record.workspaceFingerprint)).toBe('stale');
    });
});

describe('declaring a move', () => {
    const base = () => goodPack(undefined, { intent: undefined });

    it('keeps a pack that declares nothing valid as before', () => {
        expect(validatePack(base())).toEqual({ ok: true });
        expect(validatePack(goodPack())).toEqual({ ok: true });
    });

    it('refuses a malformed declaration with reasons an agent can act on', () => {
        const errors = (intent) => validatePack({ ...base(), intent }).errors || [];
        expect(errors([])).toEqual(['"intent" must be an object: { "stages": [...] }.']);
        expect(errors({ walls: [] })[0]).toMatch(/only "stages"/);
        expect(errors({ stages: [{ tier: -1, move: 'faster', note: 'x' }] })[0]).toMatch(/"tier" must be a whole number/);
        expect(errors({ stages: [{ tier: 1, move: 'sooner', note: 'x' }] })[0]).toMatch(/"move" must be one of faster, slower/);
        expect(errors({ stages: [{ tier: 1, move: 'faster' }] })[0]).toMatch(/"note" must say why/);
        expect(errors({ stages: [{ tier: 1, move: 'faster', note: 'x', toHours: 0 }] })[0]).toMatch(/"toHours"/);
        expect(errors({ stages: [{ tier: 1, move: 'faster', note: 'x' }, { tier: 1, move: 'slower', note: 'y' }] })[0]).toMatch(/already declared/);
    });
});

describe('the gate command', () => {
    it('exits 0 for the sample that passes and 1 for the sample that is blocked, and writes the gate only when asked', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-gate-'));
        try {
            const wsFile = path.join(dir, 'workspace.json');
            fs.writeFileSync(wsFile, JSON.stringify(paceWorkspace()));
            const run = (pack, ...flags) => {
                const file = path.join(dir, `${pack.id}.json`);
                fs.writeFileSync(file, JSON.stringify(pack));
                const r = spawnSync(process.execPath, [path.join(root, 'cms', 'changePackTool.mjs'), 'gate', file, '--from', wsFile, ...flags], { cwd: root, encoding: 'utf8', timeout: 90000 });
                return { ...r, pack: JSON.parse(fs.readFileSync(file, 'utf8')) };
            };
            const good = run(goodPack(), '--write');
            expect(good.status, good.stderr).toBe(0);
            expect(good.stdout).toMatch(/^PASS: Passes:/);
            expect(good.stdout).toMatch(/Big Hut: .* \(earlier\)/);
            expect(good.pack.gate).toMatchObject({ verdict: 'pass', toolVersion: GATE_VERSION });
            expect(validatePack(good.pack)).toEqual({ ok: true });

            const bad = run(badPack());
            expect(bad.status).toBe(1);
            expect(bad.stdout).toMatch(/^BLOCKED:/);
            expect(bad.stdout).toMatch(/only the owner waives/);
            expect(bad.pack.gate).toBeUndefined();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 120000);
});

describe('in the CMS', () => {
    let storedBefore;
    beforeAll(() => {
        storedBefore = localStorage.getItem(WORKSPACE_KEY);
        useEntityStore.persist.setOptions({ storage: noStorage });
        useReviewStore.persist.setOptions({ storage: noStorage });
    });
    afterAll(() => {
        expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
    });

    const empty = { items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, planSettings: null };
    beforeEach(() => {
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        useEntityStore.getState().hydrate(paceWorkspace());
        useLedgerWatchStore.setState({ current: null, previous: null, sync: null, syncError: null, syncLoading: false, busy: false, error: null });
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        useEntityStore.setState(empty);
    });

    it('works the snapshot out again after each edit, keeping the one before', async () => {
        const stop = startLedgerWatch({ debounceMs: 0, run: async (type, { workspace }) => workspaceSnapshot(workspace) });
        try {
            await waitFor(() => expect(useLedgerWatchStore.getState().current).not.toBeNull());
            expect(useLedgerWatchStore.getState().previous).toBeNull();
            const recipe = bigHutRecipe(useEntityStore.getState());
            useEntityStore.setState({ recipePools: { ...useEntityStore.getState().recipePools, construction: useEntityStore.getState().recipePools.construction.map((r) => (r === recipe ? { ...r, levelRequirement: 5 } : r)) } });
            await waitFor(() => expect(useLedgerWatchStore.getState().previous).not.toBeNull());
            const { previous, current } = useLedgerWatchStore.getState();
            expect(previous.dots['token:token_big_hut'].level).toBe(15);
            expect(current.dots['token:token_big_hut'].level).toBe(5);
        } finally {
            stop();
        }
    });

    it('draws ghost dots where entries were before the last edit, and lists what moved', () => {
        const ws = paceWorkspace();
        bigHutRecipe(ws).levelRequirement = 5;
        useEntityStore.getState().hydrate(ws);
        useLedgerWatchStore.setState({ previous: workspaceSnapshot(paceWorkspace()), current: workspaceSnapshot(ws) });
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.click(view.getByRole('tab', { name: 'Timeline' }));
        expect(view.container.querySelector('[data-ghost]')).toBeNull();
        fireEvent.click(view.getByRole('button', { name: 'Before the last edit' }));
        const ghost = view.container.querySelector('[data-ghost="token:token_big_hut"]');
        expect(ghost).toBeTruthy();
        expect(ghost.querySelector('line')).toBeTruthy();
        const moved = view.getByRole('table', { name: 'Moved entries' });
        expect(within(moved).getByText('Big Hut')).toBeTruthy();
        expect(view.container.querySelector('[data-stage-move="1"]').textContent).toMatch(/Plane 1: .* faster/);
        fireEvent.click(within(moved).getByText('Big Hut'));
        expect(view.getByLabelText('Ledger page of Big Hut')).toBeTruthy();
    });

    it('shows the gate at the top of a pack\'s review: the sample passes, the bad one is blocked', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-gate-review-'));
        let handler;
        cmsFileApi({ incomingDir: dir, backupsDir: path.join(dir, 'backups') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
        const serverFetch = (url, init = {}) => new Promise((resolve) => {
            const req = new EventEmitter();
            Object.assign(req, { method: init.method || 'GET', url, headers: {} });
            const res = { statusCode: 200, setHeader: () => {}, end: (text = '') => resolve({ ok: res.statusCode < 400, status: res.statusCode, json: async () => (text ? JSON.parse(text) : null) }) };
            handler(req, res, () => resolve({ ok: false, status: 404, json: async () => ({}) }));
            if (init.body) req.emit('data', init.body);
            req.emit('end');
        });
        vi.stubGlobal('fetch', vi.fn(serverFetch));
        useReviewStore.setState({ listing: null, sessions: {}, gates: {} });
        fs.writeFileSync(path.join(dir, 'sample-big-hut-sooner.json'), JSON.stringify(goodPack()));
        fs.writeFileSync(path.join(dir, 'sample-bad.json'), JSON.stringify(badPack()));
        try {
            const view = render(React.createElement(App));
            fireEvent.click(await view.findByText('Changes to review (2)'));
            await waitFor(() => expect(view.container.querySelectorAll('[data-gate-badge="none"]').length).toBe(2));
            expect([...view.container.querySelectorAll('[data-gate-badge="none"]')].map((b) => b.textContent.trim()).sort()).toEqual(['Not gated', 'Not gated · declares 2 stage moves']);

            fireEvent.click(await view.findByText('sample-big-hut-sooner'));
            let gate = await view.findByTestId('pack-gate');
            await waitFor(() => expect(gate.getAttribute('data-verdict')).toBe('pass'), { timeout: 10000 });
            expect(within(gate).getByText('Gate passed')).toBeTruthy();
            expect(within(gate).getByText(/stage 1 faster: The Big Hut was a wall/)).toBeTruthy();
            expect(gate.querySelector('[data-stage-move="1"]').textContent).toMatch(/declared faster/);
            expect(within(within(gate).getByRole('table', { name: 'Moved entries' })).getByText('Big Hut')).toBeTruthy();
            await waitFor(() => expect(view.container.querySelector('[data-gate-badge="pass"]')).toBeTruthy());

            fireEvent.click(view.getByText('sample-bad'));
            await waitFor(() => expect(view.getByTestId('pack-gate').getAttribute('data-verdict')).toBe('block'), { timeout: 10000 });
            gate = view.getByTestId('pack-gate');
            expect(within(gate).getByText('Gate blocked')).toBeTruthy();
            const blocks = within(gate).getByTestId('gate-blocks');
            expect(blocks.textContent).toMatch(/only Planned/);
            expect(blocks.textContent).toMatch(/only the owner waives/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }, 30000);
});
