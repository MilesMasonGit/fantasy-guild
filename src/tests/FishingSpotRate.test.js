import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as FishingSpots from '../systems/board/FishingSpots.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { spotRateOf, SPOT_RATE_MAX } from '../config/registries/fishingSpots.js';
import { reachRadius, distanceSq } from '../systems/board/nearby.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { standOnWater, LAKE_POINT, LAND_POINT } from './fixtures/fishingWater.js';

/**
 * ⭐ A building raises the spot rate in its reach (plan point 19). Any Token type may carry a
 * spot-rate block, `spotRate: { percent }`: on the water in its reach, spots arrive that much more
 * often (100: twice as often there). The kind's one clock runs faster by the share of its water the
 * raisers cover, and its landings favour that water by the same weights, so the water beyond every
 * reach sees spots exactly as often as before. Raisers add up; one marked for demolition raises
 * nothing; with none on the mat, arrivals draw and land exactly as they did.
 */

const WORK = { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
const spotKind = (id, spot) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_fish_spot', requiresHero: true,
    uses: null, standsOn: ['water'], spot, catchPools: [], config: { ...WORK }
});
const building = (id, spotRate) => ({
    id, name: id, tokenType: 'passive', rarity: 'common', theme: 'fixture', sprite: 't_market_fish', uses: null,
    requiresHero: false, ...(spotRate === undefined ? {} : { spotRate })
});

registerTokenTypes({
    // Fresh water only (the lake), one a minute, room for many, never leaving.
    sr_lake_spot: spotKind('sr_lake_spot', { water: ['fresh'], everyMinutes: 1, most: 500 }),
    // The sea only.
    sr_sea_spot: spotKind('sr_sea_spot', { water: ['sea'], everyMinutes: 1, most: 500 }),
    sr_chum: building('sr_chum', { percent: 100 }),
    sr_small_chum: building('sr_small_chum', { percent: 50 }),
    sr_shed: building('sr_shed')
});

const MINUTE = 60000;
/** A seeded stream (mulberry32). */
function seeded(seed = 1) {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const clockOf = (typeId) => GameState.state.board.spotClocks?.[typeId] ?? null;
const spotsOf = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    clearMat();
    standOnWater();
});
afterAll(() => resetMatTuning());

describe('the spot-rate block, as content', () => {
    it('reads its percent; none, nothing, or nonsense is 0; it is capped', () => {
        expect(spotRateOf({ spotRate: { percent: 100 } })).toBe(100);
        expect(spotRateOf({ spotRate: { percent: '40' } })).toBe(40);
        expect(spotRateOf({})).toBe(0);
        expect(spotRateOf(null)).toBe(0);
        expect(spotRateOf({ spotRate: { percent: -50 } })).toBe(0);
        expect(spotRateOf({ spotRate: [] })).toBe(0);
        expect(spotRateOf({ spotRate: { percent: 1e9 } })).toBe(SPOT_RATE_MAX);
    });
});

describe('⭐ a raiser makes its water\'s spots arrive more often', () => {
    it('covering all of a kind\'s water at +100%, the kind\'s clock runs twice as fast', () => {
        placeAt('sr_chum', LAKE_POINT.x, LAKE_POINT.y);
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBe(2);
        FishingSpots.tick(1000, () => 0.5);
        expect(clockOf('sr_lake_spot').ms).toBe(2000);
    });

    it('covering part of it, by the share it covers; the sea\'s kind, out of its reach, runs as before', () => {
        // On the lake's rim: some of the lake in reach, none of the sea.
        placeAt('sr_chum', LAKE_POINT.x + 240, LAKE_POINT.y);
        const rate = FishingSpots.raisedRateOf('sr_lake_spot');
        expect(rate).toBeGreaterThan(1.05);
        expect(rate).toBeLessThan(2);
        expect(FishingSpots.raisedRateOf('sr_sea_spot')).toBe(1);
        FishingSpots.tick(1000, () => 0.5);
        expect(clockOf('sr_lake_spot').ms).toBeCloseTo(1000 * rate, 6);
        expect(clockOf('sr_sea_spot').ms).toBe(1000);
    });

    it('raisers add up; one marked for demolition, and a Token with no block, raise nothing', () => {
        placeAt('sr_chum', LAKE_POINT.x, LAKE_POINT.y);
        placeAt('sr_small_chum', LAKE_POINT.x, LAKE_POINT.y + 10);
        placeAt('sr_shed', LAKE_POINT.x, LAKE_POINT.y - 10);
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBeCloseTo(2.5, 9);
        const small = spotsOf('sr_small_chum')[0];
        small.demolish = true;
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBe(2);
    });

    it('a raiser moved follows its new place', () => {
        const chum = placeAt('sr_chum', LAKE_POINT.x, LAKE_POINT.y);
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBe(2);
        expect(Placement.moveTokenTo(chum.id, LAND_POINT)?.success).not.toBe(false);
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBe(1);
    });
});

describe('⭐ and land in its reach more often', () => {
    it('on the sea, a raiser at one end draws more of the landings into its reach', () => {
        const CHUM = { x: 300, y: 760 };
        const inReach = (t) => distanceSq(CHUM, { x: t.x, y: t.y }) <= reachRadius() ** 2;
        // Each spot is fished out the moment it lands, so the sea never fills: every landing counts.
        const share = (withRaiser) => {
            clearMat();
            GameState.state.board.spotClocks = {};
            if (withRaiser) placeAt('sr_chum', CHUM.x, CHUM.y);
            const landed = [];
            const off = EventBus.subscribe(BOARD_EVENTS.SPOT_LANDED, (p) => {
                if (p.typeId === 'sr_sea_spot') landed.push(p);
                BoardState.removeToken(p.instanceId);
            });
            const random = seeded(7);
            try {
                for (let t = 0; t < 600 * MINUTE; t += 1000) FishingSpots.tick(1000, random);
            } finally { off(); }
            return { n: landed.length, near: landed.filter(inReach).length };
        };
        const before = share(false);
        const after = share(true);
        console.error('SHARE', JSON.stringify(before), JSON.stringify(after), FishingSpots.raisedRateOf('sr_sea_spot'));
        expect(after.n).toBeGreaterThan(before.n);
        // The water beyond its reach sees about as many as before; its reach about twice as many.
        expect(after.near).toBeGreaterThan(before.near * 1.5);
        expect(Math.abs((after.n - after.near) - (before.n - before.near))).toBeLessThan((before.n - before.near) * 0.25);
    });
});

describe('⭐ with no raiser, nothing changes', () => {
    it('the same draws land the same spots at the same points, and the clocks stay whole', () => {
        const runOnce = (place) => {
            clearMat();
            GameState.state.board.spotClocks = {};
            place();
            const random = seeded(3);
            for (let t = 0; t < 30 * MINUTE; t += 1000) FishingSpots.tick(1000, random);
            return {
                spots: spotsOf('sr_lake_spot').concat(spotsOf('sr_sea_spot')).map(t => [t.typeId, t.x, t.y]),
                clocks: structuredClone(GameState.state.board.spotClocks)
            };
        };
        const bare = runOnce(() => {});
        // A Token with no block, and a raiser whose reach touches no water at all.
        const other = runOnce(() => { placeAt('sr_shed', LAND_POINT.x, LAND_POINT.y); placeAt('sr_chum', 1500, 520); });
        expect(FishingSpots.raisedRateOf('sr_lake_spot')).toBe(1);
        expect(other).toEqual(bare);
        expect(bare.spots.length).toBeGreaterThan(10);
        for (const c of Object.values(bare.clocks)) expect(Number.isInteger(c.ms)).toBe(true);
    });
});
