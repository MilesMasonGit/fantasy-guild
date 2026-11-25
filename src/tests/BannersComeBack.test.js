import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import * as Atlas from '../systems/atlas/Atlas.js';

/**
 * Banners come back: an event Token on the mat gets its banner after a load, a catch-up and a
 * return by travel, one per Token, and it comes down when the guild leaves the Region; unclicked
 * knock-out and Bank-full banners are saved and shown again at the next start.
 */

const COMET = { id: 'ev_copper_comet', kind: 'node', name: 'Copper Comet' };

function landEvent(event = COMET, at = { x: 300, y: 300 }) {
    const instance = BoardState.createTokenInstance('t_copper_comet', 3, null, BoardState.ORIGIN.SPAWNED);
    instance.event = { ...event };
    BoardState.addToken(instance, at.x, at.y);
    return instance;
}

const eventBanners = () => Banners.getAll().filter(b => b.kind === 'event');

/** The game written and read back as a save is, then announced as loaded. */
function saveAndLoad() {
    const json = JSON.stringify(GameState.serialize());
    const parsed = JSON.parse(json);
    GameState.initFromSave(migrateState(parsed.state, parsed.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
}

function knockOut(heroId, heroName, lost) {
    EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId, heroName, lost });
}

let sounds;
let offSounds;

beforeEach(() => {
    GameState.initNew();
    ItemStubs.reset();
    Banners.reset();
    wireNotifications();
    EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'new_game' });
    sounds = [];
    offSounds = EventBus.subscribe(ENGINE_EVENTS.AUDIO_PLAY, (p) => sounds.push(p.clip));
});

afterEach(() => {
    offSounds();
    unwireNotifications();
    ItemStubs.reset();
    Banners.reset();
});

describe('an event on the mat gets its banner back', () => {
    it('after a load: one banner, silent, naming the event and pointing to its Token', () => {
        const comet = landEvent();
        expect(eventBanners()).toEqual([]);
        saveAndLoad();
        const [banner, ...rest] = eventBanners();
        expect(rest).toEqual([]);
        expect(banner.parts.name).toBe('Copper Comet');
        expect(banner.subjects).toEqual([{ type: 'token', id: comet.id }]);
        expect(banner.groupKey).toBe(`event:${comet.id}`);
        expect(sounds).toEqual([]);
        // Its Token leaving still takes it back.
        EventBus.publish(BOARD_EVENTS.EVENT_ENDED, { instanceId: comet.id });
        expect(eventBanners()).toEqual([]);
    });

    it('a load with the banner already up, or two loads, still shows one', () => {
        const comet = landEvent();
        EventBus.publish(BOARD_EVENTS.EVENT_LANDED, { instanceId: comet.id, typeId: comet.typeId, name: 'Copper Comet' });
        expect(eventBanners()).toHaveLength(1);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        expect(eventBanners()).toHaveLength(1);
    });

    it('a load with no event on the mat raises none', () => {
        saveAndLoad();
        expect(Banners.getAll()).toEqual([]);
    });

    it('after a catch-up it landed in: at once with no summary, or once the summary closes', () => {
        const comet = landEvent();
        const row = { instanceId: comet.id, eventId: COMET.id, typeId: comet.typeId, name: 'Copper Comet', kind: 'node', landed: true, ended: null };
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: { events: [row], news: null } });
        expect(eventBanners()).toHaveLength(1);
        expect(sounds).toEqual(['quest_claim']);

        Banners.reset();
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: true, summary: { events: [row], news: null } });
        expect(eventBanners()).toEqual([]);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
        expect(eventBanners()).toHaveLength(1);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
        expect(eventBanners()).toHaveLength(1);
    });

    it('no banner after a catch-up for an event that came and went, or left before the summary closed', () => {
        const gone = { instanceId: 'tok_gone', typeId: 't_copper_comet', name: 'Copper Comet', landed: true, ended: 'worked_out' };
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: { events: [gone] } });
        expect(eventBanners()).toEqual([]);

        const comet = landEvent();
        const row = { instanceId: comet.id, typeId: comet.typeId, name: 'Copper Comet', landed: true, ended: null };
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: true, summary: { events: [row] } });
        BoardState.removeToken(comet.id);
        EventBus.publish(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED);
        expect(eventBanners()).toEqual([]);
    });

    it('a clicked banner of an event that stood before the catch-up stays clicked', () => {
        const comet = landEvent();
        EventBus.publish(BOARD_EVENTS.EVENT_LANDED, { instanceId: comet.id, typeId: comet.typeId, name: 'Copper Comet' });
        Banners.dismiss(eventBanners()[0].id);
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, { show: false, summary: { events: [], news: null } });
        expect(eventBanners()).toEqual([]);
    });
});

describe('travel: the banner stays with its Region', () => {
    it('comes down on leaving and is back, once, on returning', () => {
        Atlas.createStarterRegion();
        const home = Atlas.activeRegionId();
        const comet = landEvent();
        EventBus.publish(BOARD_EVENTS.EVENT_LANDED, { instanceId: comet.id, typeId: comet.typeId, name: 'Copper Comet' });
        expect(eventBanners()).toHaveLength(1);

        const { region } = Atlas.createRegion({ seed: 7, ground: { main: 'forest' } });
        expect(Atlas.travel(region.id).success).toBe(true);
        expect(eventBanners()).toEqual([]);

        expect(Atlas.travel(home).success).toBe(true);
        const back = eventBanners();
        expect(back).toHaveLength(1);
        expect(back[0].subjects).toEqual([{ type: 'token', id: comet.id }]);
    });
});

describe('unclicked knock-out and Bank-full banners are saved', () => {
    it('come back after a reload, as they read, silently', () => {
        // A Bank with no free slot, so the Bank-full banner still stands after the load.
        GameState.inventory.maxSlots = 0;
        knockOut('h1', 'Aela', ['Iron Sword']);
        EventBus.publish(ENGINE_EVENTS.BANK_FULL, { itemId: 'item_oak' });
        Banners.push({ kind: 'recipe', parts: { heroes: ['Aela'], recipes: ['Cider'] } });
        const before = Banners.getAll().filter(b => b.kind !== 'recipe').map(b => [b.kind, b.title, b.line]);
        sounds = [];

        saveAndLoad();
        expect(Banners.getAll().map(b => [b.kind, b.title, b.line])).toEqual(before);
        expect(Banners.getAll().find(b => b.kind === 'knockout').line).toBe('Aela was carried home, injured. Lost: Iron Sword.');
        expect(sounds).toEqual([]);
    });

    it('a clicked one does not come back', () => {
        knockOut('h1', 'Aela', ['Iron Sword']);
        knockOut('h2', 'Bram', []);
        const aela = Banners.getAll().find(b => b.parts.heroes?.[0] === 'Aela');
        Banners.dismiss(aela.id);
        saveAndLoad();
        expect(Banners.getAll().map(b => b.line)).toEqual(['Bram was carried home, injured. Nothing was lost.']);
    });

    it('come back all, in the order they stood; a merged knock-out keeps who lost what', () => {
        knockOut('h1', 'Aela', ['Iron Sword']);
        knockOut('h2', 'Bram', []);
        knockOut('h3', 'Cara', ['Bow']);
        for (const [id, name, lost] of [['h4', 'Dorn', ['Axe']], ['h5', 'Eli', ['Shield']]]) {
            Banners.push({ kind: 'knockout', groupKey: 'catch_up_knockouts:1', parts: { heroes: [name], lost }, subjects: [{ type: 'hero', id }] });
        }
        const lines = () => Banners.getView().shown.map(b => b.line);
        const before = lines();
        expect(before).toHaveLength(4);
        saveAndLoad();
        expect(lines()).toEqual(before);
        expect(Banners.getAll()[0].line).toBe('Dorn and Eli were defeated and carried home. Dorn lost: Axe. Eli lost: Shield.');
        expect(Banners.getAll().every(b => b.quiet)).toBe(true);
    });

    it('the save keeps the knock-out, not the milestones nor save problems', () => {
        knockOut('h1', 'Aela', ['Iron Sword']);
        Banners.push({ kind: 'hero', parts: { heroes: ['Bram'] } });
        Banners.push({ kind: 'save', groupKey: 'save_failed', parts: { title: 'Save Failed!', message: 'x' } });
        expect(GameState.state.ui.banners).toEqual([{
            kind: 'knockout',
            parts: { heroes: ['Aela'], lost: ['Iron Sword'] },
            sprite: null,
            subjects: [{ type: 'hero', id: 'h1' }]
        }]);
    });

    it('a merged knock-out saved before `losses` existed still reads', () => {
        GameState.state.ui.banners = [{ kind: 'knockout', parts: { heroes: ['Aela', 'Bram'], lost: ['Iron Sword'] }, subjects: [] }];
        saveAndLoad();
        expect(Banners.getAll().map(b => b.title)).toEqual(['Defeated!']);
    });

    it('a new game or another save does not carry them over', () => {
        knockOut('h1', 'Aela', ['Iron Sword']);
        const other = JSON.parse(JSON.stringify(GameState.serialize()));
        other.state.ui.banners = [];
        GameState.initFromSave(migrateState(other.state, other.version));
        // A banner raised before the new save's GAME_LOADED is not written into it.
        knockOut('h2', 'Bram', []);
        expect(GameState.state.ui.banners).toEqual([]);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 1 });
        expect(Banners.getAll()).toEqual([]);

        knockOut('h1', 'Aela', ['Iron Sword']);
        GameState.initNew();
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'new_game' });
        expect(Banners.getAll()).toEqual([]);
        expect(GameState.state.ui.banners).toEqual([]);
    });

    it('an old save without saved banners loads fine; malformed entries are skipped', () => {
        const save = JSON.parse(JSON.stringify(GameState.serialize()));
        delete save.state.ui.banners;
        const migrated = migrateState(save.state, GAME_VERSION);
        expect(migrated.ui.banners).toEqual([]);
        GameState.initFromSave(migrated);
        expect(() => EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 })).not.toThrow();
        expect(Banners.getAll()).toEqual([]);

        GameState.state.ui.banners = [null, 7, { kind: 'nope' }, { kind: 'recipe', parts: {} },
            { kind: 'knockout', parts: { heroes: ['Aela', 'Bram'], losses: [{}] } },
            { kind: 'bankFull', parts: { items: ['Oak Log'] }, sprite: 'bad', subjects: 'bad' }];
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0 });
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
        expect(Banners.getAll().map(b => b.kind)).toEqual(['bankFull']);
        expect(GameState.state.ui.banners).toEqual([{ kind: 'bankFull', parts: { items: ['Oak Log'] }, sprite: null, subjects: [] }]);
    });
});
