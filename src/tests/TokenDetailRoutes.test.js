// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { useTokenDetail } from '../ui/components/board/useTokenDetail.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **one test per `MatToken` detail field, each driven by the real engine
 * command that changes it**, and none of them publishing anything by hand. A
 * Token's details are routed to it alone (by its instance id, by the hero
 * working it, or — for the few Tokens that read other Tokens — by a
 * broadcast); a route lost here is a Token that silently stops updating, the
 * CR-044 trap. Each test reads the probe AFTER the command, so a missing route
 * shows as the old value.
 */

registerTokenTypes({
    tdr_grove: {
        id: 'tdr_grove', name: 'TDR Grove', tokenType: 'resource', uses: null, requiresHero: false,
        spawner: { spawns: [{ typeId: 'tdr_sapling', weight: 1 }], allowance: 5, intervalMs: 99999999, upkeep: [] }
    },
    tdr_sapling: { id: 'tdr_sapling', name: 'TDR Sapling', tokenType: 'resource', uses: null }
});

const P = (x, y) => ({ x, y });
const h = React.createElement;

function hero(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 }, smithing: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
}

function put(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, point);
    expect(res.success).toBe(true);
    return instance;
}

function Probe({ id, typeId }) {
    const detail = useTokenDetail(id, getTokenType(typeId));
    return h('pre', { 'data-probe': id }, JSON.stringify(detail));
}

/**
 * Mount a probe per Token and let its mount settle; `read(inst)` is that
 * Token's detail as the screen holds it. (Settling matters: a read still
 * pending from the mount would otherwise pick up a change made right after
 * it, and hide a missing route.)
 */
async function probe(...instances) {
    let container;
    await act(async () => {
        ({ container } = render(h(EngineContext.Provider, { value: { GameState, EventBus } },
            ...instances.map(i => h(Probe, { key: i.id, id: i.id, typeId: i.typeId })))));
    });
    return (inst) => JSON.parse(container.querySelector(`[data-probe="${inst.id}"]`).textContent);
}

/** Run an engine command, then let the routed refresh commit. */
async function doing(fn) {
    let out;
    await act(async () => { out = fn(); });
    return out;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    SpawnerSystem.resetAlerts();
    GameState.state.heroes = [hero('h1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => cleanup());

describe('each MatToken detail field updates on its own event (CR3-304)', () => {
    it('usesRemaining — a charge spent (TOKEN_CHARGES_CHANGED by id)', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        const read = await probe(t);
        const before = read(t).usesRemaining;
        expect(before).toBeGreaterThan(1);
        await doing(() => Charges.applyDelta(t, -1));
        expect(read(t).usesRemaining).toBe(before - 1);
    });

    it('alert — a worked station with nothing chosen raises its alert (ALERT_CHANGED by id)', async () => {
        const station = put(P(600, 600), 'fixture_station');
        const read = await probe(station);
        expect(read(station).alert).toBeNull();
        await doing(() => { Placement.plantFlagAt('h1', P(600, 600)); run(1000); });
        expect(station.alert).toBeTruthy();
        expect(read(station).alert).toBe(station.alert);
    });

    it('disallowed — the player disallows it (TILE_CHANGED by id)', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        const read = await probe(t);
        expect(read(t).disallowed).toBe(false);
        await doing(() => Flags.setDisallowed(t.id, true));
        expect(read(t).disallowed).toBe(true);
    });

    it('heroId — a hero arrives to work it (HERO_MOVED by id)', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        const read = await probe(t);
        expect(read(t).heroId).toBeNull();
        await doing(() => Placement.plantFlagAt('h1', P(600, 600)));
        expect(read(t).heroId).toBe('h1');
    });

    it('heroId — the Token a hero LEAVES lets go of them (HERO_MOVED names only the hero)', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        await doing(() => Placement.plantFlagAt('h1', P(600, 600)));
        const read = await probe(t);
        expect(read(t).heroId).toBe('h1');
        await doing(() => Placement.recallHeroById('h1'));
        expect(BoardState.workerOf(t.id)).toBeNull();
        expect(read(t).heroId).toBeNull();
    });

    it('heroId — moving a hero flag to another Token updates both Tokens', async () => {
        const a = put(P(600, 600), 'fixture_producer');
        const b = put(P(1400, 600), 'fixture_producer');
        await doing(() => Placement.plantFlagAt('h1', P(600, 600)));
        const read = await probe(a, b);
        expect([read(a).heroId, read(b).heroId]).toEqual(['h1', null]);
        await doing(() => { Placement.plantFlagAt('h1', P(1400, 600)); run(1000); });
        expect(BoardState.workTokenOf('h1')).toBe(b.id);
        expect([read(a).heroId, read(b).heroId]).toEqual([null, 'h1']);
    });

    it('recipe — the player picks one (TILE_CHANGED by id, from setSelectedRecipe itself)', async () => {
        const station = put(P(600, 600), 'fixture_station');
        const read = await probe(station);
        expect(read(station).recipe).toBeNull();
        await doing(() => StationRecipe.setSelectedRecipe(station, 'recipe_a'));
        expect(read(station).recipe?.id).toBe('recipe_a');
    });

    it('spawnerCounts — a sibling of the family is placed and removed (other Tokens’ events)', async () => {
        const grove = put(P(600, 600), 'tdr_grove');
        const read = await probe(grove);
        expect(read(grove).spawnerCounts).toEqual({ count: 0, cap: 5 });
        const sapling = await doing(() => put(P(1400, 600), 'tdr_sapling'));
        expect(read(grove).spawnerCounts).toEqual({ count: 1, cap: 5 });
        await doing(() => Placement.removePlacedToken(sapling.id));
        expect(read(grove).spawnerCounts).toEqual({ count: 0, cap: 5 });
    });

    it('quest — progress is reported (QUESTS_UPDATED)', async () => {
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall'), 880, 560);
        QuestManager.init();
        try {
            const q = QuestTokens.spawnQuest({
                id: 'q_tdr', tutorial: false, title: 'Defeat 3 Goblins', type: 'hunt',
                targetType: 'enemy_hunted', enemyId: 'token_goblin', requiredCount: 3, currentCount: 1,
                rewardItems: [], done: false
            });
            const read = await probe(q);
            expect(read(q).quest.currentCount).toBe(1);
            await doing(() => QuestTokens.reportProgress('enemy_hunted', 1, { enemyId: 'token_goblin' }));
            expect(read(q).quest.currentCount).toBe(2);
        } finally { QuestManager.cleanup(); }
    });

    it('everything — a new game or a load (GAME_RESET)', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        const read = await probe(t);
        const before = read(t).usesRemaining;
        // A load replaces state wholesale; no per-Token event says so.
        t.usesRemaining = before - 3;
        await doing(() => EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }));
        expect(read(t).usesRemaining).toBe(before - 3);
    });

    it('type-derived fields (stationSkill, hasPool, isFoundation, isSpawner, turns) are read at mount', async () => {
        const station = put(P(600, 600), 'fixture_station');
        const grove = put(P(1400, 600), 'tdr_grove');
        const read = await probe(station, grove);
        expect(read(station)).toMatchObject({ stationSkill: 'fixture_station_skill', hasPool: true, isFoundation: false, isSpawner: false, turns: false });
        expect(read(grove)).toMatchObject({ stationSkill: null, isSpawner: true });
        // A Token never changes type in place: a transform is a new instance id,
        // so a new MatToken (EffectActions.transformInstance).
    });

    it('an event about another Token does not change this one', async () => {
        const a = put(P(600, 600), 'fixture_producer');
        const b = put(P(1400, 600), 'fixture_producer');
        const read = await probe(a, b);
        const aBefore = read(a);
        await doing(() => Charges.applyDelta(b, -1));
        expect(read(a)).toEqual(aBefore);
    });
});
