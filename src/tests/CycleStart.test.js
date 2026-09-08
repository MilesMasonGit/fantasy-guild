import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { TRIGGER_EVENTS, getTriggerEvent } from '../config/registries/triggerRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * `CYCLE_START` — the moment work begins (Unified Effects P5).
 *
 * The mirror of `CYCLE_COMPLETE`, and the moment the owner asked for first: a
 * buff should already be up while the hero swings, not arrive as they finish.
 *
 * The whole risk of this phase is the event firing at the wrong instant — once
 * per tick instead of once per cycle, or on a Token that is stalled and only
 * *looks* like it is working. Most of these tests are about that.
 */

const TILE = 10;

function makeHero(id, equipment = []) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    const grid = [...equipment];
    while (grid.length < 9) grid.push(null);
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 }, equipment: grid };
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

let started;
let unsubscribe;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardState.clear?.();
    TileModifiers.rebuildAll();
    GameState.state.heroes = [makeHero('hero_1')];

    started = [];
    unsubscribe?.();
    unsubscribe = EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => started.push(p));
});

describe('the event fires when work actually begins', () => {
    it('announces the tile and the Token starting', () => {
        place(TILE, 'fixture_producer', 'hero_1');
        run(300);

        expect(started.length).toBeGreaterThan(0);
        expect(started[0]).toMatchObject({ tile: TILE, typeId: 'fixture_producer' });
    });

    it('fires ONCE per cycle, not once per tick', () => {
        place(TILE, 'fixture_producer', 'hero_1');
        // Well inside the first cycle: many ticks, one cycle, one start.
        run(1000);
        expect(started).toHaveLength(1);
    });

    it('fires again when the next cycle begins', () => {
        const instance = place(TILE, 'fixture_producer', 'hero_1');
        const cycle = instance.config?.cycleTimeMs ?? 12000;
        run(cycle + 400);
        expect(started.length).toBeGreaterThanOrEqual(2);
    });

    it('does not fire for a Token nobody is working', () => {
        // `fixture_producer` needs a hero; without one there is no cycle to
        // start, and a Token that only gets ticked must not claim otherwise.
        place(TILE, 'fixture_producer');
        run(1000);
        expect(started).toEqual([]);
    });
});

describe('the trigger vocabulary', () => {
    it('offers the moment to a neighbour and to the Token itself', () => {
        expect(getTriggerEvent('CYCLE_START')?.scopes).toEqual(['adjacent']);
        expect(getTriggerEvent('SELF_CYCLE_START')?.scopes).toEqual(['self']);
    });

    it('points both rows at the event the board actually publishes', () => {
        for (const id of ['CYCLE_START', 'SELF_CYCLE_START']) {
            expect(getTriggerEvent(id).event).toBe(BOARD_EVENTS.CYCLE_START);
        }
    });

    it('leaves every existing trigger untouched', () => {
        const ids = TRIGGER_EVENTS.map((t) => t.id);
        for (const existing of ['CYCLE_COMPLETE', 'TOKEN_DEPLETED', 'COMBAT_RESOLVED', 'ITEM_PRODUCED', 'SELF_CYCLE_COMPLETE', 'ITEM_THRESHOLD']) {
            expect(ids).toContain(existing);
        }
    });
});

describe('a carried rule that asked for the start of the cycle', () => {
    beforeEach(() => {
        registerEffects({
            fixture_effect_prep: {
                id: 'fixture_effect_prep',
                name: 'Prepared',
                statements: [{
                    ...makeStatement(KEYWORD.GRANTS),
                    when: { event: 'CYCLE_START', scope: 'self' },
                    chargeDelta: -1,
                    payload: { type: 'BONUS_DROP', itemId: 'fixture_oak_wood', quantity: 1, chance: 100 },
                }],
            },
        });
        registerItems({
            fixture_prep_kit: {
                id: 'fixture_prep_kit', name: 'Prep Kit',
                effects: [{ effectId: 'fixture_effect_prep', scale: 1 }],
            },
        });
        InventoryManager.addItem('fixture_prep_kit', 3);
    });

    it('fires at the START, before the cycle has had time to finish', () => {
        GameState.state.heroes = [makeHero('hero_1', ['fixture_prep_kit'])];
        place(TILE, 'fixture_producer', 'hero_1');

        // One tick in: the Token cannot possibly have completed anything yet,
        // so anything on the board came from the start-of-cycle rule.
        run(100);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBeGreaterThan(0);
    });

    it('spends one unit of the item that granted it', () => {
        GameState.state.heroes = [makeHero('hero_1', ['fixture_prep_kit'])];
        place(TILE, 'fixture_producer', 'hero_1');

        run(100);
        expect(InventoryManager.getItemCount('fixture_prep_kit')).toBe(2);
    });

    it('stops once the Bank runs out, rather than firing on credit', () => {
        GameState.state.heroes = [makeHero('hero_1', ['fixture_prep_kit'])];
        place(TILE, 'fixture_producer', 'hero_1');

        const instance = BoardState.getToken(TILE);
        const cycle = instance.config?.cycleTimeMs ?? 12000;
        // Four cycles' worth against a stack of three.
        run(cycle * 4 + 400);

        expect(InventoryManager.getItemCount('fixture_prep_kit')).toBe(0);
    });

    it('leaves a carried rule with no When clause on the completion path', () => {
        registerEffects({
            fixture_effect_ambient: {
                id: 'fixture_effect_ambient',
                name: 'Ambient Bonus',
                statements: [{
                    ...makeStatement(KEYWORD.GRANTS),
                    when: null,
                    payload: { type: 'BONUS_DROP', itemId: 'fixture_oak_wood', quantity: 1, chance: 100 },
                }],
            },
        });
        registerItems({
            fixture_ambient_charm: {
                id: 'fixture_ambient_charm', name: 'Ambient Charm',
                effects: [{ effectId: 'fixture_effect_ambient' }],
            },
        });
        InventoryManager.addItem('fixture_ambient_charm', 3);

        GameState.state.heroes = [makeHero('hero_1', ['fixture_ambient_charm'])];
        place(TILE, 'fixture_producer', 'hero_1');

        // A single tick starts a cycle but completes nothing, so an untriggered
        // carried rule must not have fired yet.
        started = [];
        run(100);
        expect(started).toHaveLength(1);
        expect(InventoryManager.getItemCount('fixture_ambient_charm')).toBe(3);
    });
});
