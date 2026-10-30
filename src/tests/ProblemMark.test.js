// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as MatCap from '../systems/board/MatCap.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { getSkill } from '../config/registries/skillRegistry.js';
import { MASTERY_LEVEL } from '../systems/hero/PromotionSystem.js';
import { resetMatTuning } from '../config/matTuning.js';
import {
    problemOf, problemText, PROBLEM_SEVERITY, PROBLEM_SPRITE, PROBLEM_COLOUR, SEVERITY
} from '../ui/components/board/problemMark.js';
import { ProblemMark } from '../ui/components/board/ProblemMark.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ One problem mark per Token: yellow while it waits (it needs something given to it), red when
 * it can't (no room, the cap, a hero who cannot do the work), and a hover that says exactly
 * what, read from the engine when the pointer arrives.
 */

registerTokenTypes({
    fixture_pm_foundation: {
        id: 'fixture_pm_foundation', name: 'Fixture PM Foundation',
        rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'wood', skill: 'fixture_pm_build' }
    }
});
registerItems({
    fixture_pm_seed: { id: 'fixture_pm_seed', name: 'Fixture PM Seed', type: 'resource' }
});

const AT = { x: 560, y: 520 };

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const text = (kind, id, extra = {}) => problemText({ kind, ...extra }, id);

describe('which problems are yellow and which red', () => {
    it('⭐ waiting (yellow): items, a Token beside it, charges, a choice, a spawner short of items', () => {
        for (const kind of [ALERT.INPUTS, ALERT.NO_RECIPE, ALERT.CHARGES, ALERT.CHOOSE_RECIPE, ALERT.CHOOSE_BUILD, ALERT.SPAWN_NEEDS_ITEM]) {
            expect(PROBLEM_SEVERITY[kind], kind).toBe(SEVERITY.WAITING);
        }
    });

    it('⭐ can’t (red): no room, the cap, the hero’s level or skill', () => {
        for (const kind of [ALERT.NO_ROOM, ALERT.ACCESS, ALERT.UNSKILLED, ALERT.SPAWN_NO_ROOM, ALERT.SPAWN_MAT_FULL]) {
            expect(PROBLEM_SEVERITY[kind], kind).toBe(SEVERITY.CANT);
        }
    });

    it('every alert the engine can raise has a mark, except resting and a Field’s growing crop, which are not problems', () => {
        for (const kind of Object.values(ALERT)) {
            if (kind === ALERT.RESTING || kind === ALERT.GROWING) expect(PROBLEM_SEVERITY[kind]).toBeUndefined();
            else expect(PROBLEM_SEVERITY[kind], kind).toBeDefined();
        }
    });

    it('the yellow and red pictures and hover colours', () => {
        expect(PROBLEM_SPRITE[SEVERITY.WAITING]).toBe('/assets/ui/u_alert_yellow.png');
        expect(PROBLEM_SPRITE[SEVERITY.CANT]).toBe('/assets/ui/u_alert_red.png');
        expect(PROBLEM_COLOUR[SEVERITY.WAITING]).toBe('var(--color-ui-gold)');
        expect(PROBLEM_COLOUR[SEVERITY.CANT]).toBe('var(--color-ui-red)');
    });
});

describe('problemOf: one mark, the worst first', () => {
    it('none without a problem', () => {
        expect(problemOf({})).toBeNull();
        expect(problemOf({ alert: ALERT.RESTING })).toBeNull();
    });

    it('from the engine’s alert, a spawner’s alert, or nothing chosen', () => {
        expect(problemOf({ alert: ALERT.INPUTS })).toEqual({ kind: ALERT.INPUTS, severity: SEVERITY.WAITING });
        expect(problemOf({ spawner: { alert: ALERT.SPAWN_NEEDS_ITEM, needs: ['x'] } }))
            .toEqual({ kind: ALERT.SPAWN_NEEDS_ITEM, severity: SEVERITY.WAITING, needs: ['x'] });
        expect(problemOf({ choose: 'recipe' })).toEqual({ kind: ALERT.CHOOSE_RECIPE, severity: SEVERITY.WAITING });
        expect(problemOf({ choose: 'build' })).toEqual({ kind: ALERT.CHOOSE_BUILD, severity: SEVERITY.WAITING });
    });

    it('a can’t beats a waiting; between equals, the work alert, then the spawner’s, then the choice', () => {
        expect(problemOf({ alert: ALERT.INPUTS, spawner: { alert: ALERT.SPAWN_MAT_FULL } }).kind).toBe(ALERT.SPAWN_MAT_FULL);
        expect(problemOf({ alert: ALERT.NO_ROOM, choose: 'recipe' }).kind).toBe(ALERT.NO_ROOM);
        expect(problemOf({ alert: ALERT.INPUTS, spawner: { alert: ALERT.SPAWN_NEEDS_ITEM }, choose: 'recipe' }).kind).toBe(ALERT.INPUTS);
        expect(problemOf({ spawner: { alert: ALERT.SPAWN_NEEDS_ITEM }, choose: 'recipe' }).kind).toBe(ALERT.SPAWN_NEEDS_ITEM);
    });
});

describe('⭐ the hover says exactly what, from the engine', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.heroes = [];
    });
    afterEach(() => vi.restoreAllMocks());

    it('out of items: names them, as the Bank stands now', () => {
        const station = put('fixture_consumer');
        expect(text(ALERT.INPUTS, station.id)).toBe('Needs Fixture Oak Wood');
        InventoryManager.addItem('fixture_oak_wood', 5);
        expect(text(ALERT.INPUTS, station.id)).toBe('Needs items');
    });

    it('a Token it needs beside it: names it with its article', () => {
        const vein = put('fixture_copper_vein');
        expect(text(ALERT.NO_RECIPE, vein.id)).toBe('Needs a Pickaxe nearby');
        // Nothing named missing (a station with nothing it can make): it says so.
        const producer = put('fixture_producer', { x: AT.x + 400, y: AT.y });
        expect(text(ALERT.NO_RECIPE, producer.id)).toBe('Nothing to make');
    });

    it('too few charges: on the Token itself', () => {
        const station = put('fixture_consumer');
        station.usesRemaining = 0;
        expect(text(ALERT.CHARGES, station.id)).toBe('Too few charges left');
    });

    it('nothing chosen', () => {
        expect(text(ALERT.CHOOSE_RECIPE, 'nobody')).toBe('Choose a recipe');
        expect(text(ALERT.CHOOSE_BUILD, 'nobody')).toBe('Choose what to build');
    });

    it('⭐ no room: what it makes has nowhere to go; the cap full; a Foundation with nowhere to build', () => {
        const station = put('fixture_consumer');
        expect(text(ALERT.NO_ROOM, station.id)).toBe('No room for what it makes');
        vi.spyOn(MatCap, 'canPlaceMore').mockReturnValue(false);
        expect(text(ALERT.NO_ROOM, station.id)).toBe('Token cap full');
        const foundation = put('fixture_pm_foundation', { x: AT.x + 300, y: AT.y });
        expect(text(ALERT.NO_ROOM, foundation.id)).toBe('No room to build here');
    });

    it('⭐ the hero’s level too low: the skill and the level it needs, as levels read', () => {
        const gated = put('fixture_gated');
        const mining = getSkill('mining')?.name || 'mining';
        expect(text(ALERT.ACCESS, gated.id)).toBe(`Needs ${mining} 25/${MASTERY_LEVEL}`);
        expect(text(ALERT.UNSKILLED, gated.id)).toBe(`Needs the ${mining} skill`);
    });

    it('a spawner: the items it lacks, no room, the cap', () => {
        expect(text(ALERT.SPAWN_NEEDS_ITEM, 'x', { needs: ['fixture_pm_seed'] })).toBe('Needs Fixture PM Seed to spawn');
        expect(text(ALERT.SPAWN_NEEDS_ITEM, 'x', { needs: [] })).toBe('Needs items to spawn');
        expect(text(ALERT.SPAWN_NO_ROOM, 'x')).toBe('No room to spawn');
        expect(text(ALERT.SPAWN_MAT_FULL, 'x')).toBe('Token cap full');
    });

    it('⭐ a station a hero is stuck on, run by the engine: the mark’s kind is the engine’s alert', () => {
        GameState.state.heroes = [{ id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { alchemy: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
        const station = put('fixture_consumer');
        Orders.orderAt('h1', AT);
        for (let i = 0; i < 20; i++) BoardRunner.tick(100);
        expect(station.alert).toBe(ALERT.INPUTS);
        const problem = problemOf({ alert: station.alert });
        expect(problem.severity).toBe(SEVERITY.WAITING);
        expect(problemText(problem, station.id)).toBe('Needs Fixture Oak Wood');
    });
});

describe('the mark itself', () => {
    afterEach(cleanup);

    it('reads its hover only when the pointer arrives, not when drawn', () => {
        const tip = vi.fn(() => 'Needs Fixture Oak Wood');
        const { container } = render(React.createElement(ProblemMark, { problem: { kind: ALERT.INPUTS, severity: SEVERITY.WAITING }, tip, artUnit: 2 }));
        expect(tip).not.toHaveBeenCalled();
        const img = container.querySelector('[data-problem-mark]');
        fireEvent.pointerEnter(img);
        expect(tip).toHaveBeenCalledTimes(1);
        const shown = document.querySelector('[data-tooltip]');
        expect(shown.textContent).toBe('Needs Fixture Oak Wood');
        expect(shown.querySelector('span').style.color).toBe('var(--color-ui-gold)');
        fireEvent.pointerLeave(img);
        expect(document.querySelector('[data-tooltip]')).toBeNull();
    });

    it('one element, crisp, 16 art pixels at the Token’s art size, with a hard shadow', () => {
        const { container } = render(React.createElement(ProblemMark, { problem: { kind: ALERT.NO_ROOM, severity: SEVERITY.CANT }, tip: 'x', artUnit: 3 }));
        expect(container.querySelectorAll('*')).toHaveLength(1);
        const img = container.querySelector('img');
        expect(img.getAttribute('src')).toBe(PROBLEM_SPRITE[SEVERITY.CANT]);
        expect(img.style.width).toBe('48px');
        expect(img.style.imageRendering).toBe('pixelated');
        expect(img.style.filter).toBe('drop-shadow(3px 3px 0 #000)');
    });
});
