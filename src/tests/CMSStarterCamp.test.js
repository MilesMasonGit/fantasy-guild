// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent, act, within } from '@testing-library/react';
import { asLoaded } from './fixtures/shippedAsLoaded.js';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import StarterCampPage from '../../cms/src/components/starterCamp/StarterCampPage.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { normaliseStarterCamp } from '../config/starterCampShape.js';
import {
    authoredStarterCamp, setStarterCampForTests, resetStarterCampForTests
} from '../config/registries/starterCampRegistry.js';

/**
 * ⭐ The Starter Camp in the CMS: the page lists what the game's dev button saved, the counts are
 * editable, Clear empties it, and Sync to Game writes `data/starterCamp.json` for the game's loader;
 * the Landmark flag survives Sync. Verified with no-op storage, so nothing reaches the real
 * workspace (TESTING, "The CMS").
 */

const DATA = path.resolve(__dirname, '../../data');
const FILES = ['items.json', 'tokens.json', 'tokenRecipes.json', 'effects.json'];
const read = (file) => fs.readFileSync(path.join(DATA, file), 'utf8').replace(/\r\n/g, '\n');
const raw = Object.fromEntries(FILES.map((f) => [f, asLoaded(f, read(f))]));
const shippedTokenIds = Object.keys(JSON.parse(raw['tokens.json']));
const shippedItemIds = Object.keys(JSON.parse(raw['items.json'])).filter((id) => id.startsWith('item_'));

/** The workspace `/api/load-game-data` builds from `data/`, plus the Starter Camp it now carries. */
function workspaceFromFiles(starterCamp = null) {
    const files = Object.fromEntries(FILES.map((f) => [f, JSON.parse(raw[f])]));
    const recipePools = {};
    for (const recipe of files['tokenRecipes.json']) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return {
        items: files['items.json'], tokens: files['tokens.json'],
        effects: files['effects.json'], recipePools, starterCamp
    };
}

/** Recalculate + build the sync payload, exactly as `syncToGame` does, minus the POST. */
const syncPayload = () => syncFiles(useEntityStore.getState().recalculateEconomy({}));

const [T1, T2] = shippedTokenIds;
const [I1, I2, I3] = shippedItemIds;
const CAMP = Object.freeze({
    version: 1, savedAt: '2026-10-09T14:02:00.000Z', mat: { w: 1760, h: 1126 }, hall: { x: 880, y: 563 },
    tokens: [{ typeId: T1, x: 560, y: 563 }, { typeId: T2, x: 1200, y: 563 }],
    bank: { [I1]: 3, [I2]: 10 }
});

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});

let fetchMock;
beforeEach(() => {
    useEntityStore.getState().hydrate(workspaceFromFiles());
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ camp: null }) }));
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    useSimulationStore.getState().clearResults();
    resetStarterCampForTests();
});

describe('Sync to Game and the Starter Camp', () => {
    it('a workspace that never held a Starter Camp writes no starterCamp.json, so data/ keeps its own', () => {
        expect(useEntityStore.getState().starterCamp).toBeNull();
        expect(syncPayload()).not.toHaveProperty('starterCamp.json');
    });

    it('a Starter Camp loaded from data/ is synced back unchanged, and the game reads what was written', () => {
        useEntityStore.getState().hydrate(workspaceFromFiles(CAMP));
        const written = syncPayload()['starterCamp.json'];
        expect(written).toEqual(normaliseStarterCamp(CAMP));
        setStarterCampForTests(JSON.parse(JSON.stringify(written)));
        expect(authoredStarterCamp()).toEqual(normaliseStarterCamp(CAMP));
    });

    it('is carried by every save path of the workspace: backups, export and localStorage', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        const persisted = useEntityStore.persist.getOptions().partialize(useEntityStore.getState());
        expect(persisted.starterCamp).toEqual(normaliseStarterCamp(CAMP));
    });
});

describe('the Starter Camp page', () => {
    const mount = () => render(React.createElement(StarterCampPage));

    it('lists the Tokens with their points and the opening Bank', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        const { container } = mount();
        const rows = container.querySelectorAll('[data-camp-token]');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain(useEntityStore.getState().tokens[T1].name);
        expect(rows[0].textContent).toContain('560');
        expect(rows[0].textContent).toContain('563');
        expect(container.querySelectorAll('[data-camp-bank]')).toHaveLength(2);
    });

    it('a Bank count edited on the page is what Sync writes', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        const { container } = mount();
        const input = container.querySelector(`[data-camp-bank="${I2}"] input`);
        fireEvent.change(input, { target: { value: '25' } });
        expect(syncPayload()['starterCamp.json'].bank).toEqual({ [I1]: 3, [I2]: 25 });
        fireEvent.change(input, { target: { value: '0' } });
        expect(syncPayload()['starterCamp.json'].bank).toEqual({ [I1]: 3 });
    });

    it('an item can be added to the opening Bank', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        const { container } = mount();
        fireEvent.change(container.querySelector('[data-camp-add-item] select'), { target: { value: I3 } });
        fireEvent.click(within(container.querySelector('[data-camp-add-item]')).getByRole('button'));
        expect(useEntityStore.getState().starterCamp.bank[I3]).toBe(1);
    });

    it('Clear empties it, Sync writes the empty camp, and the game then opens on its built-in camp', () => {
        useEntityStore.getState().setStarterCamp(CAMP);
        vi.stubGlobal('confirm', () => true);
        const { getByText } = mount();
        fireEvent.click(getByText('Clear'));
        const written = syncPayload()['starterCamp.json'];
        expect(written.tokens).toEqual([]);
        expect(written.bank).toEqual({});
        setStarterCampForTests(written);
        expect(authoredStarterCamp()).toBeNull();
    });

    it('a layout the game saved waits on the page until it is taken into the workspace', async () => {
        const pending = { ...CAMP, tokens: [{ typeId: T2, x: 300, y: 300 }] };
        fetchMock.mockImplementation(async (url, options = {}) => ({
            ok: true,
            json: async () => (options.method === 'DELETE' ? { success: true } : { camp: pending, receivedAt: '2026-10-09T14:05:00.000Z' })
        }));
        const { findByText, getByText } = mount();
        await findByText('Use this layout');
        expect(useEntityStore.getState().starterCamp).toBeNull();
        await act(async () => { fireEvent.click(getByText('Use this layout')); });
        expect(useEntityStore.getState().starterCamp.tokens).toEqual([{ typeId: T2, x: 300, y: 300 }]);
        expect(fetchMock).toHaveBeenCalledWith('/api/starter-camp', expect.objectContaining({ method: 'DELETE' }));
    });
});

describe('the Landmark flag on the Token editor', () => {
    it('ticks `landmark` on the Token, and Recalculate and Sync keep it', () => {
        useEntityStore.getState().setActiveEntity(T1, 'token');
        const { getByLabelText } = render(React.createElement(TokenEditor));
        fireEvent.click(getByLabelText(/Landmark/));
        expect(useEntityStore.getState().tokens[T1].landmark).toBe(true);
        expect(syncPayload()['tokens.json'][T1].landmark).toBe(true);
        fireEvent.click(getByLabelText(/Landmark/));
        expect(JSON.parse(JSON.stringify(syncPayload()['tokens.json']))[T1]).not.toHaveProperty('landmark');
    });
});

describe('the CMS route the game\'s dev button posts to', () => {
    let inboxDir;
    let handler;

    /** One request through the plugin's middleware; resolves with what it answered. */
    function request(method, url, { body, origin = 'http://localhost:5173' } = {}) {
        return new Promise((resolve) => {
            const req = new EventEmitter();
            Object.assign(req, { method, url, headers: { origin } });
            const headers = {};
            const res = {
                statusCode: 200,
                setHeader: (k, v) => { headers[k.toLowerCase()] = v; },
                end: (text = '') => resolve({ status: res.statusCode, headers, body: text ? JSON.parse(text) : null })
            };
            handler(req, res, () => resolve({ status: 'next' }));
            if (body !== undefined) req.emit('data', JSON.stringify(body));
            req.emit('end');
        });
    }

    beforeAll(() => {
        inboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-camp-inbox-'));
        cmsFileApi({ inboxDir }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
    });
    afterAll(() => fs.rmSync(inboxDir, { recursive: true, force: true }));

    it('keeps a posted layout in the CMS inbox until the page takes it, never in data/', async () => {
        expect((await request('GET', '/api/starter-camp')).body).toEqual({ camp: null });
        const posted = await request('POST', '/api/starter-camp', { body: { camp: CAMP } });
        expect(posted).toMatchObject({ status: 200, body: { success: true, tokens: 2 } });
        expect(fs.existsSync(path.join(inboxDir, 'starter-camp.json'))).toBe(true);
        const got = await request('GET', '/api/starter-camp');
        expect(got.body.camp).toEqual(normaliseStarterCamp(CAMP));
        expect(typeof got.body.receivedAt).toBe('string');
        await request('DELETE', '/api/starter-camp');
        expect((await request('GET', '/api/starter-camp')).body).toEqual({ camp: null });
    });

    it('refuses something that is not a Starter Camp', async () => {
        expect((await request('POST', '/api/starter-camp', { body: { camp: 'nope' } })).status).toBe(400);
    });

    it('answers the game\'s cross-origin call from this machine only', async () => {
        const local = await request('OPTIONS', '/api/starter-camp', { origin: 'http://localhost:5199' });
        expect(local.status).toBe(204);
        expect(local.headers['access-control-allow-origin']).toBe('http://localhost:5199');
        const foreign = await request('OPTIONS', '/api/starter-camp', { origin: 'https://example.com' });
        expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    });
});
