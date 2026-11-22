// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EventTokens from '../systems/board/EventTokens.js';
import * as EventClock from '../systems/events/EventClock.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setEventsForTests, resetEventsForTests } from '../config/registries/eventRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { EVENT_WAIT_MIN_MS, EVENT_WAIT_MAX_MS, EVENT_RETRY_MS, UNWORKED_LEAVE_MS } from '../config/eventTiming.js';

/** An event says goodbye: one banner with its own line (or the plain one), headed Expired or Demolished. */

const MIN = 60_000;
const ORE = 'fixture_copper_ore';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    evg_comet: {
        id: 'evg_comet', name: 'EVG Comet Token', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3, sprite: 't_ore_vein_copper',
        requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 6, chance: 100 }] }
    },
    evg_rain: {
        id: 'evg_rain', name: 'EVG Rain Token', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_minecart_copper'
    }
});

const COMET = { id: 'evg_e_comet', name: 'Copper Comet', typeId: 'evg_comet', kind: 'node', weight: 10 };
const RAIN = { id: 'evg_e_rain', name: 'Rainfall', typeId: 'evg_rain', kind: 'buff', weight: 10, durationMinutes: 20, goodbye: 'The clouds waft away in the breeze.' };
const table = (...rows) => Object.fromEntries(rows.map(r => [r.id, r]));

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.rebuildAll();
}

function runFor(ms, step = 1000) {
    for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step);
}

const goodbyes = () => Banners.getAll().filter(b => b.kind === 'eventGone');
const eventBanners = () => Banners.getAll().filter(b => b.kind === 'event');

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

beforeEach(() => {
    EventClock.setEnabled(true);
    wireNotifications();
    Banners.reset();
});

afterEach(() => {
    EventClock.setEnabled(false);
    resetEventsForTests();
    Banners.reset();
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    unwireNotifications();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the goodbye banner', () => {
    it('a buff whose time is up says Expired with the event\'s own line, and the landing banner goes', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        EventClock.landNow(RAIN.id);
        expect(eventBanners()).toHaveLength(1);
        runFor(20 * MIN);
        expect(eventBanners()).toEqual([]);
        expect(goodbyes()).toHaveLength(1);
        expect(goodbyes()[0]).toMatchObject({ title: 'Expired: Rainfall', line: 'The clouds waft away in the breeze.' });
        expect(goodbyes()[0].subjects || []).toEqual([]);
    });

    it('a rich node never worked says Expired when its hour is up, with the plain line where none is written', () => {
        setEventsForTests(table(COMET));
        freshGame();
        EventClock.landNow(COMET.id);
        runFor(UNWORKED_LEAVE_MS);
        expect(goodbyes()).toHaveLength(1);
        expect(goodbyes()[0]).toMatchObject({ title: 'Expired: Copper Comet', line: 'Copper Comet has gone.' });
    });

    it('a node worked out says Expired', () => {
        setEventsForTests(table(COMET));
        freshGame();
        const { instance } = EventClock.landNow(COMET.id);
        BoardState.removeToken(instance.id);
        EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instance, x: instance.x, y: instance.y });
        expect(eventBanners()).toEqual([]);
        expect(goodbyes()).toHaveLength(1);
        expect(goodbyes()[0].title).toBe('Expired: Copper Comet');
    });

    it('a demolished event says Demolished', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        BoardState.removeToken(instance.id);
        EventBus.publish(BOARD_EVENTS.TOKEN_DEMOLISHED, { instanceId: instance.id, typeId: instance.typeId, event: instance.event, x: instance.x, y: instance.y });
        expect(eventBanners()).toEqual([]);
        expect(goodbyes()).toHaveLength(1);
        expect(goodbyes()[0]).toMatchObject({ title: 'Demolished: Rainfall', line: 'The clouds waft away in the breeze.' });
    });

    it('the two words come from one place', () => {
        expect(EventTokens.endedWord(EventTokens.ENDED.DEMOLISHED)).toBe('Demolished');
        for (const reason of [EventTokens.ENDED.WORKED_OUT, EventTokens.ENDED.TIME_UP]) {
            expect(EventTokens.endedWord(reason)).toBe('Expired');
        }
    });
});

describe('leftovers', () => {
    it('the landing banner says what the event gives', () => {
        setEventsForTests(table(RAIN, COMET));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        expect(eventBanners()[0].line).toBe('for 20 min');
        BoardState.removeToken(instance.id);
        Banners.reset();
        EventClock.landNow(COMET.id);
        expect(eventBanners()[0].line).toBe('leaves in 1 h if unworked');
    });

    it('the QA landings refuse while an event stands', () => {
        setEventsForTests(table(RAIN, COMET));
        freshGame();
        expect(EventClock.landNow(RAIN.id)).toMatchObject({ success: true });
        expect(EventClock.landNow(COMET.id)).toMatchObject({ success: false });
        expect(EventClock.landNext()).toBeNull();
        expect(BoardState.tokens().filter(EventTokens.isEventToken)).toHaveLength(1);
    });

    it('the waits are named together', () => {
        expect([EVENT_WAIT_MIN_MS, EVENT_WAIT_MAX_MS, EVENT_RETRY_MS, UNWORKED_LEAVE_MS]).toEqual([45 * MIN, 75 * MIN, 5 * MIN, 60 * MIN]);
        expect(EventClock.EVENT_WAIT_MIN_MS).toBe(EVENT_WAIT_MIN_MS);
        expect(EventTokens.UNWORKED_LEAVE_MS).toBe(UNWORKED_LEAVE_MS);
    });
});

describe('the CMS goodbye line', () => {
    it('is written to the file only when the owner wrote one', async () => {
        const { eventRowFile } = await import('../../cms/src/engine/events.js');
        const base = { id: 'e', name: 'E', typeId: 't', kind: 'node', weight: 5, ground: [], biomes: [] };
        expect(eventRowFile(base, 'e')).not.toHaveProperty('goodbye');
        expect(eventRowFile({ ...base, goodbye: ' Gone. ' }, 'e').goodbye).toBe('Gone.');
    });
});
