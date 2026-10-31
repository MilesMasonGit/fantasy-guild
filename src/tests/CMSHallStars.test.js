// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useReviewStore } from '../../cms/src/stores/useReviewStore';
import HallStarsPage from '../../cms/src/components/hallStars/HallStarsPage.jsx';
import cmsFileApi from '../../cms/vite-plugin-cms-api.js';
import { validatePack, fingerprint, currentValue, workspaceFromDataFiles, KINDS } from '../../cms/src/engine/changePacks.js';
import { emptySession, acceptAll, finish, undo } from '../../cms/src/engine/packReview.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';
import { compareSync } from '../../cms/src/engine/syncGuard.js';
import { snapshot } from '../../cms/src/engine/fileUtils.js';
import { hallSkyFile, workspaceSkyFrom } from '../../cms/src/engine/hallSky.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/**
 * The Guild Hall's sky in the CMS (brief 320 H1): constellations and stars carried by change packs,
 * shown on the Guild Hall page, written to `data/hallStars.json` by Sync (only when the workspace
 * holds a sky) and read back by Restore from Game. The workspace runs on no-op storage and every
 * folder is a temp one (TESTING, "The CMS"); nothing reaches `data/`.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const dataDir = path.resolve(__dirname, '../../data');
const dataStamp = () => fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).map((f) => [f, fs.statSync(path.join(dataDir, f)).mtimeMs]);
let storedBefore;
let dataBefore;

const XP_RULE = {
    id: 'stm_mining_xp_1', keyword: 'provides',
    payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.1, category: 'mining' },
    to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null, chargeDelta: 0
};
const STAR = {
    id: 'star_mining_xp', constellation: 'mining', name: 'Miner\'s Lore', description: 'Mining teaches more.',
    node: { x: 1, y: -0.2 }, links: ['hall'],
    ranks: [{ tier: 1, price: [{ itemId: 'item_copper_ore', quantity: 10 }], rules: [XP_RULE], lines: [] }]
};
const MINING = { id: 'mining', name: 'Mining', label: { x: 1.1, y: -0.6 }, skill: 'mining' };

const store = () => useEntityStore.getState();
const workspace = (sky = {}) => ({ items: { item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore' } }, tokens: {}, effects: {}, recipePools: {}, starterCamp: null, skillPerks: null, ...sky });

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
afterEach(() => cleanup());

describe('the workspace holds the Guild Hall sky', () => {
    it('starts with none, and a workspace that never held a sky stays null', () => {
        expect(store().hallStars).toBeNull();
        expect(store().hallConstellations).toBeNull();
        expect(snapshot(store()).hallStars).toBeNull();
        expect(workspaceSkyFrom({})).toEqual({ hallConstellations: null, hallStars: null });
    });

    it('reads a backup\'s collections and a data file\'s shape alike', () => {
        expect(workspaceSkyFrom({ hallStars: { [STAR.id]: STAR } }).hallStars[STAR.id].name).toBe('Miner\'s Lore');
        expect(workspaceSkyFrom({ hallSky: { constellations: { mining: MINING }, stars: { [STAR.id]: STAR } } })).toMatchObject({
            hallConstellations: { mining: { name: 'Mining' } }, hallStars: { [STAR.id]: { id: STAR.id } }
        });
    });
});

describe('Sync writes data/hallStars.json', () => {
    it('only when the workspace holds a sky, leaving out a star with no rank', () => {
        expect(syncFiles(workspace())['hallStars.json']).toBeUndefined();
        const files = syncFiles(workspace({ hallConstellations: { mining: MINING }, hallStars: { [STAR.id]: STAR, empty: { id: 'empty', ranks: [] } } }));
        expect(Object.keys(files['hallStars.json'].stars)).toEqual([STAR.id]);
        expect(files['hallStars.json'].constellations.mining.name).toBe('Mining');
        expect(files['hallStars.json'].stars[STAR.id].ranks[0].rules[0].payload.category).toBe('mining');
        expect(hallSkyFile({ hallStars: {} })).toEqual({ constellations: {}, stars: {} });
    });

    it('is guarded: a Sync dropping a star the game has asks first; one that writes no sky leaves it alone', () => {
        const onDisk = { 'hallStars.json': { constellations: { mining: MINING }, stars: { [STAR.id]: STAR } } };
        expect(compareSync(onDisk, { 'hallStars.json': { constellations: { mining: MINING }, stars: {} } }).removed.hallSky)
            .toEqual([{ id: `star:${STAR.id}`, name: 'Miner\'s Lore' }]);
        expect(compareSync(onDisk, {}).hasRemovals).toBe(false);
    });

    it('and Restore from Game reads it back', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-hall-'));
        try {
            fs.writeFileSync(path.join(dir, 'items.json'), '{}');
            fs.writeFileSync(path.join(dir, 'tokens.json'), '{}');
            fs.writeFileSync(path.join(dir, 'hallStars.json'), JSON.stringify({ constellations: { mining: MINING }, stars: { [STAR.id]: STAR } }));
            let handler;
            cmsFileApi({ dataDir: dir, planDir: path.join(dir, 'plan') }).configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
            const body = await new Promise((resolve) => {
                const req = new EventEmitter();
                Object.assign(req, { method: 'GET', url: '/api/load-game-data', headers: {} });
                handler(req, { statusCode: 200, setHeader: () => {}, end: (text) => resolve(JSON.parse(text)) }, () => resolve(null));
                req.emit('end');
            });
            store().hydrate(body);
            expect(store().hallStars[STAR.id].name).toBe('Miner\'s Lore');
            expect(store().hallConstellations.mining.label).toEqual({ x: 1.1, y: -0.6 });
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

const pack = (entries) => ({
    format: 'fantasy-guild-change-pack', version: 1, id: 'hall-pack', createdAt: '2026-10-30T15:00:00Z',
    asked: 'The first Mining stars', entries
});

describe('a change pack carries stars and constellations', () => {
    const starEntry = (over = {}) => ({ op: 'create', kind: 'hallStar', id: STAR.id, value: { ...STAR }, note: 'Mining XP, rank by tier', ...over });
    const constellationEntry = { op: 'create', kind: 'hallConstellation', id: 'mining', value: { ...MINING }, note: 'Mining\'s constellation' };

    it('knows both kinds, and refuses a star with no rank, no link, a bad rank or a plan', () => {
        expect(KINDS).toEqual(expect.arrayContaining(['hallStar', 'hallConstellation']));
        expect(validatePack(pack([constellationEntry, starEntry()]))).toEqual({ ok: true });
        const errors = (value) => validatePack(pack([starEntry({ value })])).errors.join(' ');
        expect(errors({ ...STAR, ranks: [] })).toMatch(/at least one rank/);
        expect(errors({ ...STAR, links: [] })).toMatch(/"value.links" must name the Hall/);
        expect(errors({ ...STAR, constellation: '' })).toMatch(/must name its constellation/);
        expect(errors({ ...STAR, ranks: [{ price: 'x' }] })).toMatch(/"price" must be a list/);
        expect(errors({ ...STAR, ranks: [{ tier: 1.5 }] })).toMatch(/"tier" must be a whole number/);
        expect(errors({ ...STAR, plan: { status: 'live' } })).toMatch(/carry a "plan"/);
    });

    it('applies on finish into a workspace that held none, and undoes', () => {
        const ws = workspace();
        const p = pack([constellationEntry, starEntry()]);
        const done = finish(ws, p, acceptAll(ws, p, emptySession()));
        expect(done.workspace.hallStars[STAR.id].name).toBe('Miner\'s Lore');
        expect(done.workspace.hallConstellations.mining.skill).toBe('mining');
        const back = undo(done.workspace, { ...p, review: done.record });
        expect(back.workspace.hallStars).toEqual({});
        expect(back.workspace.hallConstellations).toEqual({});
    });

    it('is fingerprinted from a workspace built from data/', () => {
        const ws = workspaceFromDataFiles({ hallStars: { constellations: { mining: MINING }, stars: { [STAR.id]: STAR } } });
        expect(fingerprint(currentValue(ws, 'hallStar', STAR.id))).toMatch(/^fp:[0-9a-f]{16}$/);
        expect(currentValue(ws, 'hallConstellation', 'mining').name).toBe('Mining');
        expect(currentValue(workspaceFromDataFiles({}), 'hallStar', STAR.id)).toBeNull();
    });
});

describe('the Guild Hall page', () => {
    it('says the workspace holds no sky until a pack brings one', () => {
        const { container } = render(React.createElement(HallStarsPage));
        expect(container.textContent).toContain('holds no Guild Hall sky yet');
    });

    it('lists each constellation\'s stars, reads their ranks, and edits a name', () => {
        store().hydrate(workspace({ hallConstellations: { mining: MINING }, hallStars: { [STAR.id]: STAR } }));
        const { container } = render(React.createElement(HallStarsPage));
        const star = container.querySelector(`[data-hall-star="${STAR.id}"]`);
        expect(star.closest('[data-hall-constellation]').getAttribute('data-hall-constellation')).toBe('mining');
        fireEvent.click([...star.querySelectorAll('button')].find(b => b.textContent.includes('1 rank')));
        const ranks = star.querySelector('[data-hall-star-ranks]').textContent;
        expect(star.querySelector('[data-hall-rank-tier]').value).toBe('1');
        expect(ranks).toContain('10 Copper Ore');
        expect(ranks).toContain('10% more XP');
        fireEvent.change(star.querySelector('[data-hall-star-name]'), { target: { value: 'Deep Lore' } });
        expect(store().hallStars[STAR.id].name).toBe('Deep Lore');
    });
});
