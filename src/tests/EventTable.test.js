import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    EVENTS_FILE, EVENT_KIND, EVENT_BIOMES, DEFAULT_BUFF_MINUTES, DEFAULT_EVENT_WEIGHT,
    normaliseEventTable, isRunnable, eventProblems
} from '../config/eventTable.js';
import { BIOME_GROUND } from '../systems/atlas/Budget.js';

/**
 * The events table (brief 640): its shape as the game reads it, the checks the boot audit and the
 * CMS share, and the file being absent until the CMS first syncs one.
 */

let files = {};
vi.mock('../config/DatabaseManager.js', () => ({
    DatabaseManager: { get eventFilesSingle() { return files; } }
}));

async function registry() {
    vi.resetModules();
    return import('../config/registries/eventRegistry.js');
}

afterEach(() => {
    files = {};
});

const COMET = { id: 'evt_comet', name: 'Copper Ore Comet', typeId: 'token_comet', kind: 'node', weight: 10, ground: ['Rock', 'rock'], biomes: [] };
const RAIN = { id: 'evt_rain', name: 'Rainfall', typeId: 'token_rain', kind: 'buff', weight: 5, durationMinutes: 20, biomes: ['meadow'] };

describe('the events file', () => {
    it('is data/events.json', () => {
        expect(EVENTS_FILE).toBe('events.json');
    });

    it('offers the biomes the Region generation knows, no more and no fewer', () => {
        expect([...EVENT_BIOMES].sort()).toEqual(Object.keys(BIOME_GROUND).sort());
    });

    it('absent (no Sync yet), the table is empty: no event ever lands', async () => {
        files = {};
        const { eventTable, allEvents } = await registry();
        expect(eventTable()).toEqual({});
        expect(allEvents()).toEqual([]);
    });

    it('present, its rows are read', async () => {
        files = { '/data/events.json': { default: { evt_comet: COMET, evt_rain: RAIN } } };
        const { allEvents, getEvent } = await registry();
        expect(allEvents().map(e => e.id)).toEqual(['evt_comet', 'evt_rain']);
        expect(getEvent('evt_rain')).toMatchObject({ kind: 'buff', durationMinutes: 20, biomes: ['meadow'] });
    });
});

describe('a row as the game reads it', () => {
    it('keeps what is authored, words lower-cased and once each', () => {
        const { evt_comet: comet } = normaliseEventTable({ evt_comet: COMET });
        expect(comet).toEqual({
            id: 'evt_comet', name: 'Copper Ore Comet', typeId: 'token_comet', kind: EVENT_KIND.NODE,
            weight: 10, ground: ['rock'], biomes: [], durationMinutes: DEFAULT_BUFF_MINUTES
        });
        expect(isRunnable(comet)).toBe(true);
    });

    it('fills a missing weight and time, and a row with no kind, Token or weight never lands', () => {
        const t = normaliseEventTable({
            a: { typeId: 'token_x', kind: 'buff' },
            b: { typeId: 'token_x', kind: 'storm' },
            c: { kind: 'node' },
            d: { typeId: 'token_x', kind: 'node', weight: 0 },
            e: 'not a row'
        });
        expect(t.a).toMatchObject({ id: 'a', name: 'a', weight: DEFAULT_EVENT_WEIGHT, durationMinutes: DEFAULT_BUFF_MINUTES });
        expect(isRunnable(t.a)).toBe(true);
        expect(t.b.kind).toBeNull();
        expect([t.b, t.c, t.d].map(isRunnable)).toEqual([false, false, false]);
        expect(t.e).toBeUndefined();
    });
});

describe('the checks', () => {
    const lookups = {
        hasTokenType: (id) => id === 'token_comet' || id === 'token_rain',
        groundWords: ['water', 'shore', 'grass', 'rock', 'sand', 'stone'],
        biomes: ['meadow', 'forest', 'coast']
    };

    it('find nothing in a sound table, and nothing in no table', () => {
        expect(eventProblems({ evt_comet: COMET, evt_rain: RAIN }, lookups)).toEqual([]);
        expect(eventProblems(null, lookups)).toEqual([]);
    });

    it('name every row that cannot land or names what the game does not have', () => {
        const problems = eventProblems({
            no_kind: { typeId: 'token_comet' },
            no_token: { kind: 'node' },
            ghost: { typeId: 'token_ghost', kind: 'node' },
            zero: { typeId: 'token_comet', kind: 'node', weight: 0 },
            short: { typeId: 'token_rain', kind: 'buff' },
            lava: { typeId: 'token_comet', kind: 'node', ground: ['lava'], biomes: ['moon'] },
            renamed: { id: 'other', typeId: 'token_comet', kind: 'node' }
        }, lookups);
        const by = (id) => problems.filter(p => p.id === id).map(p => p.message);
        expect(by('no_kind')).toEqual([expect.stringContaining('no kind')]);
        expect(by('no_token')).toEqual([expect.stringContaining('names no Token')]);
        expect(by('ghost')).toEqual([expect.stringContaining('"token_ghost", which does not exist')]);
        expect(by('zero')).toEqual([expect.stringContaining('weight of 0')]);
        expect(by('short')).toEqual([expect.stringContaining(`stays ${DEFAULT_BUFF_MINUTES} minutes`)]);
        expect(by('lava')).toEqual([expect.stringContaining('"lava"'), expect.stringContaining('"moon"')]);
        expect(by('renamed')).toEqual([expect.stringContaining('says its id is "other"')]);
    });
});
