import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as Flags from '../systems/board/Flags.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';

/**
 * A kill that spends an enemy Token's last charge takes it off the mat once, through the one
 * depletion route (`Charges.destroyToken`): one "Token Exhausted", one `TOKEN_DEPLETED` naming the
 * departing instance and the hero. A rule on the kill that spends a charge of its own (the old
 * Thorns) may take the last one first; the kill then says nothing more.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** A rule on the kill (one kill is one cycle) that pricks the hero and spends a charge. */
const COSTLY_THORN = {
    ...makeStatement(KEYWORD.DEALS),
    id: 'stm_kd_thorn',
    target: { role: ROLE.ACTOR },
    payload: { amount: 1 },
    chargeDelta: -1
};

registerTokenTypes({
    kd_last_one: { ...getTokenType('fixture_enemy'), id: 'kd_last_one', name: 'Last One', uses: 1 },
    kd_thorned: { ...getTokenType('fixture_enemy'), id: 'kd_thorned', name: 'Thorned', uses: 2, statements: [COSTLY_THORN] },
    kd_endless: { ...getTokenType('fixture_enemy'), id: 'kd_endless', name: 'Endless', uses: null }
});

const AT = { x: 400, y: 300 };

function startFight(typeId) {
    const hero = generateHero({ name: 'Bram' });
    hero.id = 'kd_hero';
    hero.status = 'idle';
    for (const skill of Object.values(hero.skills)) skill.level = 99;
    hero.hp = { current: 500, max: 500 };
    GameState.state.heroes.push(hero);
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return { hero, enemy };
}

/** Run the board until the enemy Token has left (or `ms` passes), recording what was said. */
function playUntilGone(enemy, ms = 120000) {
    const seen = { depleted: [], exhausted: [], kills: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => seen.depleted.push(p)),
        EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => { if (p?.type === 'token_exhausted') seen.exhausted.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p?.outcome === 'victory') seen.kills += 1; })
    ];
    for (let t = 0; t < ms && BoardState.getTokenById(enemy.id); t += 100) BoardRunner.tick(100);
    // A few more ticks, so a late second announcement would be caught.
    for (let t = 0; t < 1000; t += 100) BoardRunner.tick(100);
    offs.forEach(off => off());
    return seen;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    Flags.init();
});

afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('a kill that spends the last charge', () => {
    it('takes the Token off once, naming the departing instance and the hero', () => {
        const { hero, enemy } = startFight('kd_last_one');
        const seen = playUntilGone(enemy);

        expect(seen.kills).toBe(1);
        expect(BoardState.getTokenById(enemy.id)).toBeNull();
        expect(seen.exhausted).toHaveLength(1);
        expect(seen.depleted).toHaveLength(1);
        expect(seen.depleted[0]).toMatchObject({
            instanceId: enemy.id, typeId: 'kd_last_one', heroId: hero.id, exhaustedBy: hero.id,
            x: AT.x, y: AT.y
        });
        expect(seen.depleted[0].instance).toBe(enemy);
    });

    it('ends the fight at the kill', () => {
        const { hero, enemy } = startFight('kd_last_one');
        playUntilGone(enemy);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
    });

    it('lands the kill\'s loot before the Token leaves', () => {
        const { enemy } = startFight('kd_last_one');
        let lootBeforeLeaving = null;
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => {
            lootBeforeLeaving = SpriteLayer.getSprites().length;
        });
        playUntilGone(enemy);
        off();
        expect(lootBeforeLeaving).toBeGreaterThan(0);
    });

    it('⚠️ a rule on the kill that takes the last charge first is not announced twice', () => {
        // Two charges: the kill takes one, the costly rule the other.
        const { hero, enemy } = startFight('kd_thorned');
        const seen = playUntilGone(enemy);

        expect(seen.kills).toBe(1);
        expect(BoardState.getTokenById(enemy.id)).toBeNull();
        expect(seen.exhausted).toHaveLength(1);
        expect(seen.depleted).toHaveLength(1);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
    });

    it('an enemy with unlimited charges never depletes', () => {
        const { enemy } = startFight('kd_endless');
        const seen = playUntilGone(enemy, 60000);
        expect(seen.kills).toBeGreaterThan(1);
        expect(seen.depleted).toEqual([]);
        expect(BoardState.getTokenById(enemy.id)).not.toBeNull();
    });
});
