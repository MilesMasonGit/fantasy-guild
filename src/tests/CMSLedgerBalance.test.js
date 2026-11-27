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
import { proposeBalance, LEVER } from '../../cms/src/engine/ledger/balance.js';
import { balanceContent, balanceWorldRaw, withWorld } from './fixtures/balanceWorld.js';

/**
 * The balancing preview in the CMS (brief 290 L9): the Ledger's Balancing page works the preview
 * out on request and shows each stage's way out and the walls before and after, the proposed numbers and what numbers
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

/** The balance fixture as the CMS workspace holds it: recipes in pools by skill, the camp's budget only, its way out asking Forestry 15. */
function balanceWorkspace() {
    const c = balanceContent();
    const recipePools = {};
    for (const r of c.recipes) (recipePools[r.skill] ||= []).push(r);
    return {
        items: c.items, tokens: c.tokens, effects: c.effects, recipePools, starterCamp: c.starterCamp, skillPerks: null, world: balanceWorldRaw({ level: 15 }),
        // The camp is done when the pace rule reaches level 9, about 30 minutes in, with eight
        // heroes from the start so a stage is its slowest path, the levers' measure.
        planSettings: { tierLevels: [{ tier: 0, level: 1 }, { tier: 1, level: 9 }], heroesByTier: [{ tier: 0, heroes: 8 }] }
    };
}

describe('the preview over a workspace', () => {
    it('is the proposer over the workspace\'s content and settings, and a job the ledger\'s Worker runs', () => {
        const ws = balanceWorkspace();
        const result = workspaceBalance(ws);
        const direct = proposeBalance(withWorld(balanceContent(), { level: 15 }), ws.planSettings);
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
        // The way out before and after, what the budget times; the full content beside it.
        expect(text).toMatch(/^- Starter Camp: 1 h 10 min \(\+133 %\) → 1 h 10 min \(\+133 %\) against 30 min, OUT \(.+ ring 1: Forestry 15, a floor\); full content \d+ min$/m);
        expect(text).toMatch(/ring 1's settle level Forestry 15 → about \d+/);
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
        const statue = pack.entries.find(e => e.id === 'token_statue');
        expect(statue.value).toMatchObject({ name: 'Gold Statue', plan: { tier: 0 } });
        expect(statue.value.shop.price[0].quantity).toBeLessThan(5000);
        // A way out is the world tables' to move: the pack never writes a settle level.
        expect(pack.entries.filter(e => e.kind === 'world')).toEqual([]);
        expect(pack.intent.stages).toEqual([expect.objectContaining({ tier: 0, move: 'faster' })]);
        // Made in memory: the workspace is as it was.
        expect(ws).toEqual(balanceWorkspace());
    });

    it('levers keep only those levers edits, no option keeps all, an unknown lever throws', () => {
        const ws = balanceWorkspace();
        const result = workspaceBalance(ws);
        const coin = { ...result.proposals.find(p => p.kind === 'token'), lever: LEVER.COINS, field: 'shop.price.0.quantity' };
        const mixed = { ...result, proposals: [...result.proposals, coin] };
        const present = [...new Set(mixed.proposals.map(p => p.lever))];
        expect(present.length).toBeGreaterThan(1);
        const lever = present.find(l => l !== LEVER.COINS);
        const kept = balancePack(ws, mixed, { levers: [lever], createdAt: '2026-11-02T12:00:00Z' });
        const keptIds = new Set(mixed.proposals.filter(p => p.lever === lever).map(p => `${p.kind}:${p.id}`));
        expect(kept.entries.length).toBeGreaterThan(0);
        for (const e of kept.entries) {
            expect(keptIds.has(`${e.kind}:${e.id}`)).toBe(true);
            expect(e.note).not.toContain(`${coin.label} (${coin.field})`);
        }
        expect(kept.intent).toBeUndefined();
        const all = balancePack(ws, mixed, { createdAt: '2026-11-02T12:00:00Z' });
        expect(balancePack(ws, mixed, { levers: present, createdAt: '2026-11-02T12:00:00Z' }).entries).toEqual(all.entries);
        expect(balancePack(ws, result, { levers: null, createdAt: '2026-11-02T12:00:00Z' })).toEqual(balancePack(ws, result, { createdAt: '2026-11-02T12:00:00Z' }));
        expect(() => balancePack(ws, result, { levers: ['xp', 'nope'] })).toThrow(/Unknown lever nope\. Valid levers: xp, cost, time, boost, coins/);
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
        // Under StrictMode, as the CMS mounts it: effects run twice in development.
        const view = render(React.createElement(React.StrictMode, null, React.createElement(LedgerPanel, { setCurrentView: () => {} })));
        fireEvent.click(view.getByRole('tab', { name: 'Balancing' }));
        expect(view.container.querySelector('[data-balance-stage]')).toBeNull();
        expect(view.getByTestId('balance-apply').disabled).toBe(true);
        // An XP number is no longer lost to Sync: the page says it is pinned, and never that it is undone.
        expect(view.getByTestId('ledger-balance').textContent).toMatch(/pinned on its entry, so Recalculate and Sync keep it/);
        fireEvent.click(view.getByTestId('balance-run'));
        await waitFor(() => expect(view.container.querySelector('[data-balance-stage="0"]')).toBeTruthy(), { timeout: 20000 });

        // The camp's way out, not its content: off its budget before and after, its settle level suggested.
        const camp = view.container.querySelector('[data-balance-stage="0"]');
        expect(camp.getAttribute('data-within')).toBe('no');
        expect(camp.querySelector('[data-balance-before]').textContent).toBe('1 h 10 min (+133 %)*');
        expect(camp.querySelector('[data-balance-way-out]').textContent).toMatch(/ring 1: Forestry 15$/);
        expect(camp.querySelector('[data-balance-content]').textContent).toMatch(/^\d+ min, \d+ entries: Elixir/);
        expect(view.container.querySelector('[data-cant-fix="world"]').textContent).toMatch(/settle level Forestry 15 → about \d+ .*A suggestion only/);
        const levers = [...view.container.querySelectorAll('[data-proposal]')].map(r => r.getAttribute('data-proposal'));
        expect(levers).toEqual(expect.arrayContaining([LEVER.XP, LEVER.COST, LEVER.BOOST]));
        expect(levers).not.toContain('gate');
        expect(view.getByText('Gold Statue')).toBeTruthy();
        expect(view.container.querySelector('[data-cant-fix="content"]').textContent).toMatch(/Mining 30 → 90/);
        expect(view.getByTestId('balance-counts').textContent).toMatch(/Walls \(a run of levels over twice the curve\): 2 → 1/);
        expect(view.getByTestId('balance-apply').disabled).toBe(true);

        // A name opens the entry's page; nothing in the workspace changed.
        fireEvent.click(view.getByText('Gold Statue'));
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
