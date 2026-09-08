import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { getTriggerEvent } from '../config/registries/triggerRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Engaging an enemy — Unified Effects P6.
 *
 * Two claims, and the second is the one that has never been exercised in this
 * project before:
 *
 * 1. **An engagement is every engagement** (UE-15). An enemy Token holds
 *    charges, each kill spends one, and the enemy returns at full HP for the
 *    next fight — so a hero parked on one must not proc only once.
 * 2. **A status can land on the enemy.** `StatusApplication.applyToEnemy` has
 *    been written and routed since the grammar's Phase 2 and has *never run*:
 *    nothing could author a rule that reached a creature. An item can now.
 */

const TILE = 10;

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    return hero;
}

function place(tile, typeId, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

let engagements;
let unsubscribe;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;

    engagements = [];
    unsubscribe?.();
    unsubscribe = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p));
});

describe('the engagement moment', () => {
    it('fires when a hero is put onto an enemy', () => {
        place(TILE, 'fixture_enemy', 'hero_1');
        run(600);

        expect(engagements.length).toBeGreaterThan(0);
        expect(engagements[0]).toMatchObject({ tile: TILE, typeId: 'fixture_enemy', heroId: 'hero_1' });
    });

    it('does not fire again on the ticks in between', () => {
        place(TILE, 'fixture_enemy', 'hero_1');
        run(600);
        const first = engagements.length;
        run(400);
        expect(engagements.length).toBe(first);
    });

    it('fires AGAIN for the fresh enemy after a kill (UE-15)', () => {
        place(TILE, 'fixture_enemy', 'hero_1');
        // Long enough for a kill, the 2s intermission, and the next enemy.
        run(30000);

        expect(engagements.length).toBeGreaterThan(1);
    });

    it('never fires for an enemy nobody has engaged', () => {
        place(TILE, 'fixture_enemy');
        run(10000);
        expect(engagements).toEqual([]);
    });
});

describe('the trigger vocabulary', () => {
    it('offers the moment to a neighbour and to the enemy itself', () => {
        expect(getTriggerEvent('COMBAT_ENGAGED')?.scopes).toEqual(['adjacent']);
        expect(getTriggerEvent('SELF_COMBAT_ENGAGED')?.scopes).toEqual(['self']);
    });

    it('points both rows at the event the board publishes', () => {
        for (const id of ['COMBAT_ENGAGED', 'SELF_COMBAT_ENGAGED']) {
            expect(getTriggerEvent(id).event).toBe(BOARD_EVENTS.COMBAT_ENGAGED);
        }
    });
});

describe('⭐ a carried rule can put a status on the enemy — the path that had never run', () => {
    beforeEach(() => {
        registerEffects({
            fixture_effect_venom: {
                id: 'fixture_effect_venom',
                name: 'Venom Flask',
                statements: [{
                    ...makeStatement(KEYWORD.APPLIES),
                    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
                    chargeDelta: -1,
                    payload: { statusId: 'poison', stacks: 3, chance: 100, target: 'enemy' },
                }],
            },
        });
        registerItems({
            fixture_venom_flask: {
                id: 'fixture_venom_flask', name: 'Venom Flask',
                effects: [{ effectId: 'fixture_effect_venom', scale: 1 }],
            },
        });
        InventoryManager.addItem('fixture_venom_flask', 5);
    });

    it('poisons the creature, not the hero holding the flask', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_venom_flask';
        GameState.state.heroes = [hero];

        place(TILE, 'fixture_enemy', 'hero_1');
        run(600);

        const fight = BoardCombat.getFight(TILE);
        expect(fight).toBeTruthy();

        const enemyPoison = (fight.combat.enemyStatuses || []).find((s) => s.id === 'poison');
        expect(enemyPoison, 'the enemy should be poisoned').toBeTruthy();
        expect(enemyPoison.stacks).toBe(3);

        // And emphatically NOT on the hero: the rule named the enemy.
        const heroPoison = (hero.statuses || []).find((s) => s.id === 'poison');
        expect(heroPoison, 'the hero must not poison themselves').toBeFalsy();
    });

    it('spends a flask for it', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_venom_flask';
        GameState.state.heroes = [hero];

        place(TILE, 'fixture_enemy', 'hero_1');
        run(600);

        expect(InventoryManager.getItemCount('fixture_venom_flask')).toBe(4);
    });

    it('lands on the hero instead when the rule names the hero', () => {
        registerEffects({
            fixture_effect_brace: {
                id: 'fixture_effect_brace',
                name: 'Brace',
                statements: [{
                    ...makeStatement(KEYWORD.APPLIES),
                    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
                    chargeDelta: 0,
                    payload: { statusId: 'armor_shield', stacks: 2, chance: 100, target: 'hero' },
                }],
            },
        });
        registerItems({
            fixture_brace_charm: {
                id: 'fixture_brace_charm', name: 'Brace Charm',
                effects: [{ effectId: 'fixture_effect_brace' }],
            },
        });
        InventoryManager.addItem('fixture_brace_charm', 2);

        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_brace_charm';
        GameState.state.heroes = [hero];

        place(TILE, 'fixture_enemy', 'hero_1');
        run(600);

        const shield = (hero.statuses || []).find((s) => s.id === 'armor_shield');
        expect(shield, 'the hero should be shielded').toBeTruthy();
    });
});
