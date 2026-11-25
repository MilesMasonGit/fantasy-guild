// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Flags from '../systems/board/Flags.js';
import * as Hideouts from '../systems/board/Hideouts.js';
import * as Thefts from '../systems/board/Thefts.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { HIDEOUT_KIND, CAUGHT_DEFAULTS } from '../config/registries/crime.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { theftBlockOf, lastTheftText, liveTheftSources } from '../ui/components/board/hideoutCard.js';
import { startTheftWatch, resetTheftWatch, lastTheftOf } from '../ui/components/board/lastTheft.js';
import { problemOf, problemText } from '../ui/components/board/problemMark.js';
import { gearStateOf } from '../ui/components/board/centreAlert.js';
import { tokenDetailOf } from '../ui/components/board/useTokenDetail.js';
import { calloutText } from '../ui/components/board/callouts.js';
import { blockedText } from '../ui/components/board/heroBubbles.js';
import { startFightWatch, resetFightWatch, fightsOf } from '../ui/components/combat/fightWatch.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * What the player sees of a Hideout (brief 810 K4): its card names the camp it robs (Change camp
 * flips to the camps in reach), the guard on it, the hero's caught odds, the last theft and what a
 * theft takes; the mat's '!' asks for a camp or says the camp is guarded; a theft is said in a bubble
 * over the Hideout; a guard's fight opens its log naming the camp. No plates.
 */

const ITEM = 'fixture_chu_wheat';
const MOTE = 'fixture_chu_mote';
registerItems({
    [ITEM]: { id: ITEM, name: 'Fixture Wheat', type: 'material', stackable: true, equipSlot: '', sprite: 'i_wheat' },
    [MOTE]: { id: MOTE, name: 'Fixture Mote', type: 'material', stackable: true, equipSlot: '', sprite: 'i_wheat' }
});
registerTokenTypes({
    chu_hideout: {
        id: 'chu_hideout', name: 'UI Hideout', tokenType: 'station', rarity: 'common', uses: null, sprite: 't_campfire', requiresHero: true,
        config: { skill: 'crime', skillRequired: 1, cycleTimeMs: 3000, xp: 2, inputs: [], outputs: [] },
        statements: [{ id: 'stm_chu_works', keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } }]
    },
    chu_cow: {
        id: 'chu_cow', name: 'UI Cow', tokenType: 'enemy', rarity: 'common', uses: 1, sprite: 'e_cow', requiresHero: true,
        enemy: { level: 1, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, xp: 1, inputs: [], outputs: [] },
        steal: {
            outputs: [{ itemId: ITEM, chance: 60, minQty: 1, maxQty: 2 }],
            rareTable: { chance: 4, entries: [{ itemId: MOTE, weight: 1 }] }
        }
    },
    chu_pasture: {
        id: 'chu_pasture', name: 'UI Pasture', tokenType: 'spawner', rarity: 'common', uses: null, sprite: 't_pasture_cow', requiresHero: false,
        config: null, spawner: { spawns: [{ typeId: 'chu_cow', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    }
});

const h = React.createElement;
const mount = (el) => render(h(DndContext, null, el));
const block = (model) => model.blocks.find(b => b.id === CARD_BLOCK.THEFT);

function scene({ thief = false, chosen = true } = {}) {
    const hide = fixtures.placeAt('chu_hideout', 800, 500);
    const pasture = fixtures.placeAt('chu_pasture', 960, 500);
    SpawnerSystem.attemptSpawn(pasture, getTokenType('chu_pasture'), Math.random);
    if (chosen) Hideouts.setTarget(hide, pasture.id);
    const heroId = thief ? fixtures.makeHeroes(1, { crime: 1 })[0].id : null;
    return { hide, pasture, heroId };
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => { cleanup(); resetTheftWatch(); resetFightWatch(); });
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});

describe('a Hideout\'s card', () => {
    it('names the camp it robs and its Crime level, what a theft takes and its rare finds', () => {
        const { hide, pasture } = scene();
        const theft = block(tokenCardModel('chu_hideout', hide.id));
        expect(theft.camp).toMatchObject({ id: pasture.id, typeId: 'chu_pasture', name: 'UI Pasture', crimeLevel: 1 });
        expect(theft.steals).toEqual([{ itemId: ITEM, min: 1, max: 2, chance: 60 }]);
        expect(theft.rare).toMatchObject({ chance: 4, rows: [expect.objectContaining({ itemId: MOTE })] });
        expect(theft.change).toEqual({ label: 'Change camp', chosen: true });
        expect(theft.guard).toBeNull();
        // Nobody on it: the curve's even odds stand in for a hero's.
        expect(theft.caught).toBeNull();
        expect(theft.curve).toEqual(CAUGHT_DEFAULTS);
    });

    it('with a thief on it, says their odds of being caught', () => {
        const { hide, pasture, heroId } = scene({ thief: true });
        // As if they stood at it: the card reads who works it.
        const theft = theftBlockOf(hide, getTokenType('chu_hideout'), { ...liveTheftSources(), workerOf: () => heroId });
        expect(theft.caught).toMatchObject({ chance: Hideouts.caughtChanceAt(hide.id, heroId, pasture), thiefLevel: 1, campLevel: 1 });
    });

    it('with nothing chosen it opens on the camps in its reach, and a click picks one', () => {
        const { hide, pasture } = scene({ chosen: false });
        const view = mount(h(TokenCard, { typeId: 'chu_hideout', instanceId: hide.id, onClose: () => {} }));
        const root = view.container;
        expect(root.querySelector('[data-camp-list]')).not.toBeNull();
        const option = root.querySelector(`[data-camp-option="${pasture.id}"]`);
        expect(option).not.toBeNull();
        act(() => { fireEvent.click(option); });
        expect(Hideouts.targetOf(hide)?.id).toBe(pasture.id);
        expect(root.querySelector('[data-camp-list]')).toBeNull();
        expect(root.querySelector('[data-card-theft-camp="chu_pasture"]')).not.toBeNull();
        expect(root.querySelector(`[data-card-steal="${ITEM}"]`)).not.toBeNull();
    });

    it('Change camp flips to the list, which marks the camp chosen', () => {
        const { hide, pasture } = scene();
        const view = mount(h(TokenCard, { typeId: 'chu_hideout', instanceId: hide.id, onClose: () => {} }));
        const root = view.container;
        act(() => { fireEvent.click(root.querySelector('[data-card-change-camp]')); });
        expect(root.querySelector(`[data-camp-option="${pasture.id}"]`)?.getAttribute('data-camp-selected')).toBe('true');
    });

    it('a guarded camp says so on the card and in the list', () => {
        const { hide, pasture } = scene();
        const guard = Thefts.setGuard(pasture, 'chu_cow');
        expect(guard).not.toBeNull();
        const theft = block(tokenCardModel('chu_hideout', hide.id));
        expect(theft.guard).toMatchObject({ id: guard.id, name: 'UI Cow' });
        expect(theft.options[0].guarded).toBe(true);
        const view = mount(h(TokenCard, { typeId: 'chu_hideout', instanceId: hide.id, onClose: () => {} }));
        expect(view.container.querySelector('[data-card-theft-guard="chu_cow"]')).not.toBeNull();
    });

    it('names its last theft, as heard', () => {
        const { hide, pasture } = scene();
        startTheftWatch();
        EventBus.publish(BOARD_EVENTS.THEFT, { instanceId: hide.id, campId: pasture.id, campTypeId: 'chu_pasture', caught: false, items: [{ itemId: ITEM, quantity: 2 }], guardId: null });
        expect(lastTheftOf(hide.id)).toMatchObject({ caught: false });
        const theft = block(tokenCardModel('chu_hideout', hide.id));
        expect(lastTheftText(theft.last, () => 'Fixture Wheat')).toBe('Stole 2 Fixture Wheat');
        expect(lastTheftText({ caught: true }, () => '')).toBe('Caught! A guard stands on the camp');
    });
});

describe('the mat\'s marks and the hero\'s words', () => {
    it('a Hideout takes the gear, pulsing until a camp is chosen', () => {
        const { hide } = scene({ chosen: false });
        const def = getTokenType('chu_hideout');
        expect(gearStateOf(tokenDetailOf(hide.id, def))).toEqual({ show: true, pulsing: true });
        Hideouts.setTarget(hide, Hideouts.campsInReach(hide)[0].id);
        expect(gearStateOf(tokenDetailOf(hide.id, def))).toEqual({ show: true, pulsing: false });
    });

    it('the \'!\' asks for a camp, or says the camp is guarded and by whom', () => {
        const { hide, pasture } = scene();
        expect(problemOf({ choose: 'camp' })).toEqual({ kind: ALERT.CHOOSE_CAMP, severity: 'waiting' });
        expect(problemText({ kind: ALERT.CHOOSE_CAMP }, hide.id)).toBe('Choose a camp to rob');
        Thefts.setGuard(pasture, 'chu_cow');
        expect(problemOf({ alert: ALERT.GUARDED })).toEqual({ kind: ALERT.GUARDED, severity: 'waiting' });
        expect(problemText({ kind: ALERT.GUARDED }, hide.id)).toBe('Guarded: beat the UI Cow on UI Pasture to rob it again');
        expect(blockedText(ALERT.GUARDED, { token: 'UI Hideout' })).toBe('A guard stands on the camp UI Hideout robs.');
        expect(blockedText(ALERT.CHOOSE_CAMP, { token: 'UI Hideout' })).toBe('Choose a camp for UI Hideout to rob.');
    });

    it('a theft is said over the Hideout: what was taken, or the catch', () => {
        expect(calloutText.stole(['2 Wheat', '1 Milk'], 'Cow Pasture')).toBe('Stole 2 Wheat, 1 Milk from Cow Pasture');
        expect(calloutText.stole([], 'Cow Pasture')).toBe('Found nothing to steal at Cow Pasture');
        expect(calloutText.caught('Cow Pasture')).toBe('Caught at Cow Pasture! A guard stands on it');
    });
});

describe('a guard\'s fight names the theft in its log', () => {
    it('the first line of a fight with a guard says whose camp it guards', () => {
        const { pasture } = scene();
        const guard = Thefts.setGuard(pasture, 'chu_cow');
        const [fighter] = fixtures.makeHeroes(1, { melee: 10 });
        const stop = startFightWatch();
        EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, { heroId: fighter.id, instanceId: guard.id, typeId: 'chu_cow' });
        const record = fightsOf(fighter.id).current;
        stop();
        expect(record.log[0]).toMatchObject({ key: 'guard', vars: { enemy: 'UI Cow', camp: 'UI Pasture' } });
    });
});
