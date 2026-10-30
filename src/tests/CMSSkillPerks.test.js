// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import App from '../../cms/src/App.jsx';
import SkillPerksPage from '../../cms/src/components/perks/SkillPerksPage.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { validatePack, fingerprint, currentValue, workspaceFromDataFiles } from '../../cms/src/engine/changePacks.js';
import { emptySession, acceptAll, finish, undo } from '../../cms/src/engine/packReview.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import { compareSync } from '../../cms/src/engine/syncGuard.js';
import { snapshot } from '../../cms/src/engine/fileUtils.js';
import { editorRows, normaliseWorkspacePerks, perkUsersOf } from '../../cms/src/engine/skillPerks.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { perkFindings } from '../systems/core/perkRule.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * Milestone perks in the CMS: each skill's perk table, authored on the Skill Perks page, carried by
 * change packs, written to `data/skillPerks.json` by Sync (only when the workspace holds any) and read
 * back by Restore from Game. The workspace runs on no-op storage and every folder is a temp one
 * (TESTING, "The CMS"); nothing reaches `data/`.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dataDir = path.resolve(__dirname, '../../data');
const dataStamp = () => fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, fs.statSync(path.join(dataDir, f)).mtimeMs]);
let storedBefore;
let dataBefore;

const FELLING = {
    id: 'effect_clean_felling', name: 'Clean Felling', autoSyncId: true,
    statements: [{
        id: 'stm_felling', keyword: 'provides',
        payload: { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 5, category: 'forestry' },
        to: { mode: 'all', value: '' }, reach: 'nearby', target: null, when: null, upkeep: null, chargeDelta: 0
    }]
};
const UNSCOPED = { ...FELLING, id: 'effect_quick_hands', name: 'Quick Hands', statements: [{ ...FELLING.statements[0], id: 'stm_quick', payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }] };

const store = () => useEntityStore.getState();
const workspace = (skillPerks = null) => ({ items: {}, tokens: {}, effects: { [FELLING.id]: FELLING }, recipePools: {}, starterCamp: null, skillPerks });

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    dataBefore = dataStamp();
    useEntityStore.persist.setOptions({ storage: noStorage });
    useReviewStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
    expect(dataStamp()).toEqual(dataBefore);
});
beforeEach(() => store().hydrate(workspace()));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('the workspace holds each skill\'s perk table', () => {
    it('starts with none, and a workspace that never held perks stays null', () => {
        expect(store().skillPerks).toBeNull();
        expect(snapshot(store()).skillPerks).toBeNull();
        expect(normaliseWorkspacePerks(undefined)).toBeNull();
    });

    it('shows the five default levels as empty rows until an effect is picked', () => {
        expect(editorRows(null).map((r) => [r.level, r.virtual])).toEqual([[10, true], [25, true], [50, true], [75, true], [99, true]]);
        store().setSkillPerkRow('forestry', -1, { level: 10, effectId: FELLING.id });
        store().setSkillPerkRow('forestry', -1, { level: 40, effectId: '' });
        const rows = editorRows(store().skillPerks.forestry);
        expect(rows.map((r) => `${r.level}${r.virtual ? '' : '*'}`)).toEqual(['10*', '25', '40*', '50', '75', '99']);
        store().removeSkillPerkRow('forestry', 1);
        expect(store().skillPerks.forestry.perks).toEqual([{ level: 10, effectId: FELLING.id, scale: 1 }]);
    });

    it('follows an effect\'s rename, which changes its id', () => {
        store().setSkillPerkRow('forestry', -1, { level: 10, effectId: FELLING.id });
        store().updateEffect(FELLING.id, { name: 'Clean Cut' });
        expect(Object.keys(store().effects)).toEqual(['effect_clean_cut']);
        expect(store().skillPerks.forestry.perks[0].effectId).toBe('effect_clean_cut');
    });

    it('names the perks using an effect for the effect editor', () => {
        store().setSkillPerkRow('forestry', -1, { level: 25, effectId: FELLING.id });
        expect(perkUsersOf(FELLING.id, store().skillPerks, () => 'Forestry')).toEqual([{ id: 'forestry:25', name: 'Forestry 25 perk' }]);
    });
});

describe('Sync writes data/skillPerks.json', () => {
    it('only when the workspace holds perk tables, without blank rows or empty tables', () => {
        expect(syncFiles(workspace(null))['skillPerks.json']).toBeUndefined();
        const files = syncFiles(workspace({
            forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }, { level: 25, effectId: '', scale: 1 }] },
            mining: { id: 'mining', perks: [{ level: 10, effectId: '', scale: 1 }] }
        }));
        expect(files['skillPerks.json']).toEqual({ forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] } });
    });

    it('is guarded: a Sync dropping a perk the game has asks first; one that writes no perk file leaves it alone', () => {
        const onDisk = { 'skillPerks.json': { forestry: { perks: [{ level: 10, effectId: FELLING.id }] } } };
        expect(compareSync(onDisk, { 'skillPerks.json': {} }).removed.perks).toEqual([{ id: `forestry:10:${FELLING.id}`, name: 'forestry 10' }]);
        expect(compareSync(onDisk, {}).hasRemovals).toBe(false);
    });

    it('and Restore from Game reads it back', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-perks-'));
        try {
            fs.writeFileSync(path.join(dir, 'items.json'), '{}');
            fs.writeFileSync(path.join(dir, 'tokens.json'), '{}');
            fs.writeFileSync(path.join(dir, 'skillPerks.json'), JSON.stringify({ forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] } }));
            let handler;
            cmsFileApi({ dataDir: dir, planDir: path.join(dir, 'plan') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
            const body = await new Promise((resolve) => {
                const req = new EventEmitter();
                Object.assign(req, { method: 'GET', url: '/api/load-game-data', headers: {} });
                handler(req, { statusCode: 200, setHeader: () => {}, end: (text) => resolve(JSON.parse(text)) }, () => resolve(null));
                req.emit('end');
            });
            store().hydrate(body);
            expect(store().skillPerks).toEqual({ forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] } });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('the audits name a perk that does nothing', () => {
    it('a skill the game does not have, a level no hero reaches, a missing effect, an unscoped work rule', () => {
        const findings = perkFindings({
            skillPerks: {
                leadership: { perks: [{ level: 10, effectId: FELLING.id }] },
                forestry: { perks: [
                    { level: 1, effectId: FELLING.id }, { level: 25, effectId: 'effect_gone' },
                    { level: 50, effectId: UNSCOPED.id }, { level: 75, effectId: FELLING.id }, { level: 99, effectId: '' }
                ] }
            },
            effects: { [FELLING.id]: FELLING, [UNSCOPED.id]: UNSCOPED }
        });
        expect(findings.map((f) => `${f.entityId}: ${f.message}`)).toEqual([
            expect.stringMatching(/^leadership: has a perk table, but "leadership" is not a skill/),
            expect.stringMatching(/^forestry: has a perk at level 1, which no hero reaches/),
            expect.stringMatching(/^forestry: its level 25 perk points at the effect "effect_gone", which does not exist/),
            expect.stringMatching(/^forestry: its level 50 perk \(Quick Hands\) changes Work Time on every skill's work, not only Forestry's/)
        ]);
    });

    it('in the Economy Audit too', () => {
        const issues = auditConnectivity({ effects: { [FELLING.id]: FELLING }, skillPerks: { forestry: { perks: [{ level: 25, effectId: 'effect_gone' }] } } });
        expect(issues.filter((i) => i.entityType === 'Skill').map((i) => i.details)).toEqual([expect.stringMatching(/^Its level 25 perk points at the effect "effect_gone"/)]);
    });
});

const pack = (entries) => ({
    format: 'fantasy-guild-change-pack', version: 1, id: 'perk-pack', createdAt: '2026-10-29T15:00:00Z',
    asked: 'One example perk per Starting skill', entries
});

describe('a change pack carries a skill\'s perk table', () => {
    const tableEntry = (over = {}) => ({
        op: 'create', kind: 'skillPerks', id: 'forestry', value: { perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] },
        note: 'Forestry 10: a chance of double logs', ...over
    });

    it('accepts a table and refuses a skill that does not exist, a bad level or effect, and a plan', () => {
        expect(validatePack(pack([tableEntry()]))).toEqual({ ok: true });
        const errors = (over) => validatePack(pack([tableEntry(over)])).errors.join(' ');
        expect(errors({ id: 'leadership' })).toMatch(/must be a skill's id/);
        expect(errors({ value: { perks: [{ level: 1, effectId: FELLING.id }] } })).toMatch(/whole level from 2 to 99/);
        expect(errors({ value: { perks: [{ level: 10, effectId: '' }] } })).toMatch(/must name a library effect/);
        expect(errors({ value: { perks: [{ level: 10, effectId: FELLING.id, scale: 6 }] } })).toMatch(/"scale" must be a whole number from 1 to 5/);
        expect(errors({ value: { perks: 'x' } })).toMatch(/must be a list/);
        expect(errors({ value: { perks: [], plan: { status: 'live' } } })).toMatch(/carry a "plan"/);
    });

    it('applies on finish into a workspace that held none, and undoes', () => {
        const ws = workspace(null);
        const p = pack([tableEntry()]);
        const done = finish(ws, p, acceptAll(ws, p, emptySession()));
        expect(done.workspace.skillPerks).toEqual({ forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] } });
        const back = undo(done.workspace, { ...p, review: done.record });
        expect(back.workspace.skillPerks).toEqual({});
    });

    it('is fingerprinted from a workspace built from data/', () => {
        const ws = workspaceFromDataFiles({ skillPerks: { forestry: { id: 'forestry', perks: [{ level: 10, effectId: FELLING.id, scale: 1 }] } } });
        expect(fingerprint(currentValue(ws, 'skillPerks', 'forestry'))).toMatch(/^fp:[0-9a-f]{16}$/);
        expect(currentValue(workspaceFromDataFiles({}), 'skillPerks', 'forestry')).toBeNull();
    });
});

describe('the pages', () => {
    it('the Skill Perks page lists the default levels and picking an effect makes the perk', () => {
        const view = render(React.createElement(SkillPerksPage, { setCurrentView: () => {} }));
        fireEvent.click(view.container.querySelector('[data-perk-skill="forestry"]'));
        const rows = () => [...view.container.querySelectorAll('[data-perk-row]')].map((r) => r.getAttribute('data-perk-row'));
        expect(rows()).toEqual(['10', '25', '50', '75', '99']);
        const ten = view.container.querySelector('[data-perk-row="10"]');
        fireEvent.change(ten.querySelector('[data-perk-effect]'), { target: { value: FELLING.id } });
        expect(store().skillPerks.forestry.perks).toEqual([{ level: 10, effectId: FELLING.id, scale: 1 }]);
        expect(view.container.querySelector('[data-perk-row="10"]').textContent).toMatch(/5% chance of double loot/);
        expect(view.container.querySelector('[data-perk-skill="forestry"]').textContent).toMatch(/Forestry1$/);
    });

    it('New effect makes a library effect for the row and opens it', () => {
        const views = [];
        const view = render(React.createElement(SkillPerksPage, { setCurrentView: (v) => views.push(v) }));
        fireEvent.click(view.container.querySelector('[data-perk-skill="mining"]'));
        fireEvent.click(view.container.querySelector('[data-perk-row="25"] [data-perk-new-effect]'));
        const [row] = store().skillPerks.mining.perks;
        expect(row.level).toBe(25);
        expect(store().effects[row.effectId]?.name).toBe('Mining 25 Perk');
        expect(store().activeEntityId).toBe(row.effectId);
        expect(views).toEqual(['editor']);
    });

    describe('the review page', () => {
        let dir;
        let handler;
        function serverFetch(url, init = {}) {
            return new Promise((resolve) => {
                const req = new EventEmitter();
                Object.assign(req, { method: init.method || 'GET', url, headers: {} });
                const res = {
                    statusCode: 200,
                    setHeader: () => {},
                    end: (text = '') => resolve({ ok: res.statusCode < 400, status: res.statusCode, json: async () => (text ? JSON.parse(text) : null) }),
                };
                handler(req, res, () => resolve({ ok: false, status: 404, json: async () => ({}) }));
                if (init.body) req.emit('data', init.body);
                req.emit('end');
            });
        }
        beforeEach(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-perk-pack-'));
            cmsFileApi({ incomingDir: dir, backupsDir: path.join(dir, 'backups') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
            vi.stubGlobal('fetch', vi.fn(serverFetch));
            store().hydrate(workspace(null));
            useReviewStore.setState({ listing: null, sessions: {} });
            fs.writeFileSync(path.join(dir, 'perk-pack.json'), JSON.stringify(pack([
                { op: 'create', kind: 'effect', id: 'effect_steady_pick', value: { name: 'Steady Pick', statements: [] }, note: 'Mining 10' },
                { op: 'create', kind: 'skillPerks', id: 'mining', value: { perks: [{ level: 10, effectId: 'effect_steady_pick', scale: 1 }] }, note: 'Mining 10' }
            ])));
        });
        afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

        it('lists a perk by level and effect name, applies it, and opens the Skill Perks page on it', async () => {
            const view = render(React.createElement(App));
            fireEvent.click(await view.findByText('Changes to review (1)'));
            fireEvent.click(await view.findByText('perk-pack'));
            const row = await view.findByTestId('entry-1');
            expect(within(row).getByText('Mining perks', { selector: 'span' })).toBeTruthy();
            expect(within(within(row).getByTestId('perks-diff')).getByText(/Perk at level 10: Steady Pick/)).toBeTruthy();
            fireEvent.click(within(row).getByText('Open in the editor'));
            expect(store().skillPerks.mining.perks).toEqual([{ level: 10, effectId: 'effect_steady_pick', scale: 1 }]);
            await waitFor(() => expect(view.getByTestId('skill-perks-page')).toBeTruthy());
            expect(view.container.querySelector('[data-perk-rows="mining"]')).toBeTruthy();
        });
    });
});
