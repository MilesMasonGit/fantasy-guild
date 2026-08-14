import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * ⚠️ **Risk 13, measured rather than guessed** (Phase 10 §B).
 *
 * D-127 allocates inputs **first-come**: whichever Token's cycle completes
 * first takes what is in the Bank, and the others wait. That is deliberate and
 * it is what makes degradation emergent rather than per-cycle.
 *
 * But it carries a known hazard. **A Token needing 1 Coal can act sooner than
 * one needing 5**, so under sustained shortage the *deep, expensive* chains the
 * game most wants players to build are the ones that starve first — the
 * opposite of the pressure §6.2 intends.
 *
 * Phase 4 instrumented the allocator specifically so this phase could put a
 * number on it. **The roadmap's instruction is: do not guess — measure.** These
 * tests are that measurement, kept as a permanent regression net so a later
 * change to allocation cannot quietly make it worse.
 *
 * ## What the numbers below mean
 * The shallow consumer needs 2 inputs; the deep one needs 5. They are otherwise
 * identical — same cycle time, same everything. Supply is metered in at a rate
 * that covers roughly one of them but not both, which is precisely the
 * situation the design is worried about.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) {
        skills[s] = { level: 50, xp: 0 };
    }
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null) {
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

const SHALLOW = 'fixture_consumer';        // needs 2 oak wood → 1 glowcap
const DEEP = 'fixture_deep_consumer';      // needs 5 oak wood → 1 spider silk

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    InputAllocator.resetStarvationStats();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

/**
 * Run both consumers against a metered wood supply.
 *
 * @param {number} woodPerTick units added every 100ms tick
 * @param {number} durationMs how long to run
 */
function runShortage(woodPerTick, durationMs) {
    place(10, SHALLOW, 'hero_1');
    place(30, DEEP, 'hero_2');

    for (let elapsed = 0; elapsed < durationMs; elapsed += 100) {
        InventoryManager.addItem('item_oak_wood', woodPerTick);
        BoardRunner.tick(100);
    }

    const shallowCompletions = SpriteLayer.countOnBoard('item_glowcap');
    const deepCompletions = SpriteLayer.countOnBoard('item_spider_silk');

    return {
        shallowCompletions,
        deepCompletions,
        // ⚠️ **The number that actually answers risk 13.** Completions alone are
        // misleading: a chain costing 5 per cycle *should* complete less often
        // than one costing 2, and that is correct rather than unfair. The
        // question is whether the deep chain gets a fair share of the scarce
        // INPUT — so measure the wood each one actually consumed.
        shallowInput: shallowCompletions * 2,
        deepInput: deepCompletions * 5,
        starvation: InputAllocator.getStarvationStats()
    };
}

describe('⚠️ Risk 13 — does first-come allocation starve deep chains?', () => {
    it('MEASUREMENT: under a shortage covering roughly one consumer', () => {
        // 0.1 wood/tick = 1 wood/sec = 60 wood/min. The shallow consumer wants
        // 2 per 18s (6.7/min); the deep one wants 5 per 18s (16.7/min). Together
        // they want 23.4/min against 60 supplied — comfortable. Tighten it hard:
        // 0.02/tick = 12 wood/min, which covers neither fully.
        const result = runShortage(0.02, 180000);

        // Both should get *something* — the failure mode being watched for is
        // the deep chain getting nothing at all while the shallow one runs
        // freely, which is what would invert §6.2's intended pressure.
        expect(result.shallowCompletions + result.deepCompletions).toBeGreaterThan(0);

        const totalInput = result.shallowInput + result.deepInput;
        const deepShare = totalInput ? (result.deepInput / totalInput) : 0;

        // Recorded for the balance report. Not asserted as a target, because
        // there is no agreed target yet — the point is that the number exists.
        // eslint-disable-next-line no-console
        console.log(
            `[risk-13] completions  shallow=${result.shallowCompletions} deep=${result.deepCompletions}
` +
            `[risk-13] input used   shallow=${result.shallowInput} deep=${result.deepInput} ` +
            `(deep took ${Math.round(deepShare * 100)}% of the scarce material)
` +
            `[risk-13] starved ticks ${JSON.stringify(result.starvation)}`
        );
    });

    it('⚠️ the deep consumer completes fewer cycles — expected, not a fault', () => {
        // Fewer COMPLETIONS is correct: each one costs 2.5× more. The test
        // documents the behaviour so it cannot change silently, and exists
        // mainly to be read next to the input-share test below, which is the
        // one that actually judges fairness.
        const result = runShortage(0.02, 180000);
        expect(result.deepCompletions).toBeLessThanOrEqual(result.shallowCompletions);
    });

    it('⚠️ but it takes a FAIR SHARE of the scarce material — risk 13 is mild', () => {
        // The real finding of the Phase 10 measurement. First-come allocation
        // splits the scarce input roughly evenly by volume; the deep chain then
        // converts its half into fewer, more valuable outputs, which is exactly
        // what a deep chain is supposed to do.
        //
        // The feared failure was the deep chain being squeezed toward zero
        // while the shallow one ran freely. That is not what happens. If this
        // ever drops below ~30%, the hazard has become real and D-127 needs a
        // rule that favours deep chains.
        const result = runShortage(0.02, 180000);
        const share = result.deepInput / (result.shallowInput + result.deepInput);
        expect(share).toBeGreaterThan(0.3);
    });

    it('the deep consumer is NOT starved to zero — it degrades, not deadlocks', () => {
        // The line between "expensive chains are slower under shortage" (fine,
        // and arguably correct) and "expensive chains are pointless under
        // shortage" (a design failure). Given enough time the deep chain must
        // make progress.
        const result = runShortage(0.05, 240000);
        expect(result.deepCompletions).toBeGreaterThan(0);
    });

    it('with ample supply both run freely — the hazard is shortage-only', () => {
        // Confirms the effect is genuinely about contention rather than the
        // deep consumer being broken.
        const result = runShortage(1, 120000);
        expect(result.shallowCompletions).toBeGreaterThan(0);
        expect(result.deepCompletions).toBeGreaterThan(0);
    });

    it('records starvation per Token type, so the cause is attributable', () => {
        const result = runShortage(0.02, 60000);
        const starved = Object.keys(result.starvation);
        expect(starved.length).toBeGreaterThan(0);
    });
});

describe('Shortfall is per ITEM, so throttling cascades without cascade logic', () => {
    it('a wood shortage never stalls a producer that needs nothing', () => {
        place(10, SHALLOW, 'hero_1');                 // starved of wood
        place(30, 'fixture_producer_alt', 'hero_2');  // needs nothing

        for (let t = 0; t < 20000; t += 100) BoardRunner.tick(100);

        expect(SpriteLayer.countOnBoard('item_copper_ore')).toBeGreaterThan(0);
        expect(SpriteLayer.countOnBoard('item_glowcap')).toBe(0);
    });
});
