import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as StatusEffectSystem from '../systems/effects/StatusEffectSystem.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getStatusStacks } from '../config/registries/statusRegistry.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * **Dying to poison (CR2-070).**
 *
 * For months a hero taken to 0 HP by a damage-over-time effect while working an
 * ordinary Token was never wounded: the status clock noticed the death, wrote a
 * log line, and the hero carried on working at zero health forever. The code
 * that used to handle it was `LoopRunner`, deleted by the playmat rework, and
 * nothing replaced it — the only surviving zero-HP check lived on the enemy-tile
 * path in `BoardCombat.tickTile`.
 *
 * Owner decision 11 (2026-08-19): *"Poison death costs equipment, like combat
 * death. One rule for dying however it happens, so it cannot be dodged by dying
 * to a damage-over-time effect."*
 *
 * ⚠️ **The point of this suite is that there is exactly ONE way to die.** The
 * gear test below asserts the shared `applyDefeatPenalties` actually ran, not
 * that some equivalent-looking penalty was applied — a second implementation of
 * dying would pass a looser test and is precisely what must not happen.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn()
}));

function makeHero(id, hp = 3) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

/** Advance the global 5s status clock by exactly one tick. */
function statusTick() {
    StatusEffectSystem.tick(STATUS_TICK_INTERVAL_MS);
}

let hero;

beforeAll(() => {
    // Subscribes `hero_downed` → `resolveStatusDefeat`. Once per file: the
    // EventBus is a singleton, so re-subscribing per test would stack handlers.
    BoardCombat.init();
});

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    hero = makeHero('hero_1');
    GameState.state.heroes = [hero];
    GameState.state.inventory.maxSlots = 50;

    const instance = BoardState.createTokenInstance(
        'fixture_producer', tokenStartingUses('fixture_producer')
    );
    Placement.placeToken(10, instance);
    Placement.placeHero('hero_1', 10);
});

describe('A hero poisoned to 0 HP dies properly (CR2-070)', () => {
    it('is actually wounded, rather than working on at zero health', () => {
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);   // 12 damage
        statusTick();

        expect(hero.hp.current).toBe(0);
        expect(hero.status).toBe('wounded');
    });

    it('is carried off the board, leaving the tile free for someone else', () => {
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        statusTick();

        expect(BoardState.tileOfHero('hero_1')).toBeNull();
        expect(BoardState.heroOnTile(10)).toBeNull();
        expect(BoardState.getToken(10)?.typeId).toBe('fixture_producer');
    });

    it('costs equipment, through the SAME penalty the combat path uses', () => {
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        statusTick();

        expect(applyDefeatPenalties).toHaveBeenCalledWith('hero_1');
        expect(applyDefeatPenalties).toHaveBeenCalledTimes(1);
    });

    it('cleanses every status on the way out — a forced retreat, as in combat', () => {
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        StatusEffectSystem.applyToHero('hero_1', 'well_fed', 1);
        statusTick();

        expect(getStatusStacks(hero.statuses, 'burning')).toBe(0);
        expect(getStatusStacks(hero.statuses, 'well_fed')).toBe(0);
    });

    it('does not roll the penalty twice when the clock ticks again', () => {
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        statusTick();
        statusTick();
        statusTick();

        expect(applyDefeatPenalties).toHaveBeenCalledTimes(1);
    });

    it('leaves a hero who SURVIVES the tick working, untouched', () => {
        hero.hp.current = 100;
        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        statusTick();

        expect(hero.hp.current).toBe(88);
        expect(hero.status).not.toBe('wounded');
        expect(BoardState.tileOfHero('hero_1')).toBe(10);
        expect(applyDefeatPenalties).not.toHaveBeenCalled();
    });

    it('works for a hero downed in the Dock, with no tile to leave', () => {
        // A DoT outlives the tile it was applied on: recall the hero and the
        // poison keeps ticking. `resolveDefeat` has to tolerate a null tile.
        BoardState.setHeroTile('hero_1', null);

        StatusEffectSystem.applyToHero('hero_1', 'burning', 3);
        statusTick();

        expect(hero.status).toBe('wounded');
        expect(applyDefeatPenalties).toHaveBeenCalledWith('hero_1');
    });
});
