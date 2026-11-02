// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import LedgerPanel from '../../cms/src/components/ledger/LedgerPanel.jsx';
import { workspaceBalance, balancePack, balanceText, sortedProposals, changeText, cantFixGroups } from '../../cms/src/engine/ledgerBalance.js';
import { runLedgerJobNow } from '../../cms/src/engine/ledgerJobs.js';
import { currentValue, fingerprint, validatePack } from '../../cms/src/engine/changePacks.js';
import { proposeBalance, LEVER } from '../systems/progression/ledger/balance.js';
import { balanceContent } from './fixtures/balanceWorld.js';

/**
 * The balancing preview in the CMS (brief 290 L9): the Ledger's Balancing page works the preview
 * out on request and shows stages and walls before and after, the proposed numbers and what numbers
 * cannot fix, with Apply locked; the proposals as a change pack the CMS never writes; the agents'
 * `changePackTool.mjs balance`, which never writes into the inbox. The store never persists here
 * (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const originalFetch = globalThis.fetch;
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});

/** The balance fixture as the CMS workspace holds it: recipes in pools by skill, the camp's budget only. */
function balanceWorkspace() {
    const c = balanceContent();
    const recipePools = {};
    for (const r of c.recipes) (recipePools[r.skill] ||= []).push(r);
    return {
        items: c.items, tokens: c.tokens, effects: c.effects, recipePools, starterCamp: c.starterCamp, skillPerks: null,
        planSettings: { stages: [{ tier: 0, budgetMinutes: 30 }] }
    };
}

describe('the preview over a workspace', () => {
    it('is the proposer over the workspace\'s content and settings, and a job the ledger\'s Worker runs', () => {
        const ws = balanceWorkspace();
        const result = workspaceBalance(ws);
        const direct = proposeBalance(balanceContent(), ws.planSettings);
        expect(result.proposals.map(p => `${p.key}|${p.field}|${p.to}`).sort()).toEqual(direct.proposals.map(p => `${p.key}|${p.field}|${p.to}`).sort());
        expect(runLedgerJobNow('balance', { workspace: ws }).proposals.length).toBe(result.proposals.length);
        expect(ws).toEqual(balanceWorkspace());
    });

    it('reads the largest move first, says each change in words and groups what cannot be fixed by cause', () => {
        const result = workspaceBalance(balanceWorkspace());
        const sorted = sortedProposals(result.proposals);
        const size = (p) => Math.max(Math.abs(p.from), Math.abs(p.to)) / Math.min(Math.abs(p.from), Math.abs(p.to));
        for (let i = 1; i < sorted.length; i++) expect(size(sorted[i - 1])).toBeGreaterThanOrEqual(size(sorted[i]));
        expect(changeText({ from: 1, to: 12 })).toBe('1 → 12 (12× up)');
        expect(changeText({ from: 12, to: 8 })).toBe('12 → 8 (1.5× down)');
        expect(cantFixGroups(result.cantFix).map(g => g.cause)).toContain('content');
        const text = balanceText(result);
        expect(text).toMatch(/Starter Camp: 4 h 38 min \(\+826 %\) → \d+ min .*within/);
        expect(text).toMatch(/Numbers to change: \d+/);
    });
});

describe('the proposals as a change pack', () => {
    it('edits each entity once with its whole new record, made against the workspace, and declares the stages it moves', () => {
        const ws = balanceWorkspace();
        const result = workspaceBalance(ws);
        const pack = balancePack(ws, result, { createdAt: '2026-11-02T12:00:00Z' });
        expect(validatePack(pack, { fileName: `${pack.id}.json` })).toMatchObject({ ok: true });
        expect(pack.id).toBe('2026-11-02-ledger-balancing-preview');
        const ids = pack.entries.map(e => `${e.kind}:${e.id}`);
        expect(new Set(ids).size).toBe(ids.length);
        for (const e of pack.entries) {
            const current = currentValue(ws, e.kind, e.id);
            expect(e).toMatchObject({ op: 'edit', fingerprint: fingerprint(current) });
            for (const p of result.proposals.filter(x => x.kind === e.kind && x.id === e.id)) expect(e.note).toContain(`${p.from} → ${p.to}`);
        }
        const elixir = pack.entries.find(e => e.id === 'recipe_elixir');
        expect(elixir.value).toMatchObject({ skill: 'alchemy', name: 'Elixir', inputs: [{ itemId: 'item_herb', quantity: 2 }] });
        expect(elixir.value.levelRequirement).toBeLessThan(12);
        expect(pack.intent.stages).toEqual([expect.objectContaining({ tier: 0, move: 'faster' })]);
        // Made in memory: the workspace is as it was.
        expect(ws).toEqual(balanceWorkspace());
    });

    it('the agents\' tool never writes a preview into the owner\'s inbox', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l9-'));
        const from = path.join(dir, 'workspace.json');
        fs.writeFileSync(from, JSON.stringify(balanceWorkspace()));
        const target = path.join(root, 'cms', 'incoming', 'l9-should-not-exist.json');
        const run = spawnSync(process.execPath, ['cms/changePackTool.mjs', 'balance', '--from', from, '--out', target], { cwd: root, encoding: 'utf8' });
        expect(run.status).toBe(2);
        expect(run.stderr).toMatch(/Refused: --out points into cms\/incoming/);
        expect(fs.existsSync(target)).toBe(false);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('the Balancing page', { timeout: 30000 }, () => {
    const empty = { items: {}, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, planSettings: null };
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        useEntityStore.setState(empty);
        useSimulationStore.setState({ simRows: [] });
        useEntityStore.getState().hydrate(balanceWorkspace());
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        useEntityStore.setState(empty);
    });

    it('works the preview out on request: stages before and after, the numbers, what cannot be fixed, Apply locked, nothing changed', async () => {
        const before = JSON.stringify(['items', 'tokens', 'effects', 'recipePools'].map(k => useEntityStore.getState()[k]));
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.click(view.getByRole('tab', { name: 'Balancing' }));
        expect(view.container.querySelector('[data-balance-stage]')).toBeNull();
        expect(view.getByTestId('balance-apply').disabled).toBe(true);
        fireEvent.click(view.getByTestId('balance-run'));
        await waitFor(() => expect(view.container.querySelector('[data-balance-stage="0"]')).toBeTruthy(), { timeout: 20000 });

        expect(view.container.querySelector('[data-balance-stage="0"]').getAttribute('data-within')).toBe('yes');
        const levers = [...view.container.querySelectorAll('[data-proposal]')].map(r => r.getAttribute('data-proposal'));
        expect(levers).toEqual(expect.arrayContaining([LEVER.XP, LEVER.GATE, LEVER.COST, LEVER.BOOST]));
        expect(view.getByText('Elixir')).toBeTruthy();
        expect(view.container.querySelector('[data-cant-fix="content"]').textContent).toMatch(/Mining 7\d → 90/);
        expect(view.getByTestId('balance-counts').textContent).toMatch(/Walls \(a run of levels over twice the curve\): 2 → 1/);
        expect(view.getByTestId('balance-apply').disabled).toBe(true);

        // A name opens the entry's page; nothing in the workspace changed.
        fireEvent.click(view.getByText('Elixir'));
        expect(view.getByText(/Back/)).toBeTruthy();
        expect(JSON.stringify(['items', 'tokens', 'effects', 'recipePools'].map(k => useEntityStore.getState()[k]))).toBe(before);
    });

    it('files checks E under Economy on the Problems page', () => {
        const view = render(React.createElement(LedgerPanel, { setCurrentView: () => {} }));
        fireEvent.click(view.getByRole('tab', { name: /Problems/ }));
        const groups = [...view.getByLabelText('Filter by group').querySelectorAll('option')].map(o => o.textContent);
        expect(groups.some(g => /^E\. Economy/.test(g))).toBe(true);
    });
});
