import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { StationSlotManager } from '../systems/loop/StationSlotManager.js';
import { getGlobalAggregator, clearGlobalAggregator, normalizeAuras } from '../systems/loop/GlobalModifiers.js';
import { getAreaAggregator } from '../systems/loop/AreaModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { combinePercentages } from '../systems/effects/ModifierAggregator.js';
import * as OutpostManager from '../systems/loop/OutpostManager.js';

// Locks the global aura system (C-11, D-16/D-23): an Outpost card's aura
// reaches every area, duplicates stack ADDITIVELY rather than compounding, and
// the aggregator survives a reload.

const SMITHY = {
    id: 'st_smithy', name: 'Smithy', cardType: 'station', hasCraftingQueue: false,
    requiresHero: true,
    passiveBuff: { type: EFFECT_TYPES.SPEED, target: { category: 'mining' }, bucket: 'percentage', value: 0.2 }
};
const TWO_AURA = {
    id: 'st_post', name: 'Post', cardType: 'station', hasCraftingQueue: false,
    requiresHero: true,
    passiveBuff: [
        { type: EFFECT_TYPES.SPEED, target: { category: 'woodcutting' }, bucket: 'percentage', value: 0.15 },
        { type: EFFECT_TYPES.SPEED, target: { category: 'fishing' }, bucket: 'percentage', value: 0.08 }
    ]
};
const PLAIN = { id: 'st_kiln', name: 'Kiln', cardType: 'station', hasCraftingQueue: true, passiveBuff: null };

const TABLE = { st_smithy: SMITHY, st_post: TWO_AURA, st_kiln: PLAIN };

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => TABLE[id] || null),
    getAllCards: vi.fn(() => TABLE),
    getCardsByAreaSet: vi.fn(() => []),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

/** The percentage factor the global aggregator contributes for a skill. */
const globalFactor = (skill) =>
    combinePercentages(getGlobalAggregator().collectPercentages(EFFECT_TYPES.SPEED, skill));

function seed() {
    GameState.initNew();
    GameState.state.outposts = undefined;
    GameState.state.playmatOrder = undefined;
    GameState.state.collection.unlockedAreaSets = ['area_a', 'area_b'];
    GameState.state.areaStates = {
        area_a: { deckSlots: [], assignedHeroId: null },
        area_b: { deckSlots: [], assignedHeroId: null }
    };
    // Own two copies of everything — slotStation refuses cards you don't own,
    // and a refusal here would silently register no aura at all.
    GameState.state.collection.playsets = { st_smithy: 2, st_post: 2, st_kiln: 2 };
    clearGlobalAggregator();
    OutpostManager.getOutposts();          // create outpost_1
    OutpostManager.unlockOutpost();        // + outpost_2
}

/** Slot a station and fail loudly if the engine refused it. */
function install(outpostId, templateId) {
    const result = StationSlotManager.slotStation(outpostId, templateId);
    expect(result).toEqual({ success: true });
}

beforeEach(seed);

describe('normalizeAuras — one or many (free-form authoring)', () => {
    it('reads a single modifier, a list, and nothing at all', () => {
        expect(normalizeAuras(null)).toEqual([]);
        expect(normalizeAuras(SMITHY.passiveBuff)).toHaveLength(1);
        expect(normalizeAuras(TWO_AURA.passiveBuff)).toHaveLength(2);
    });
});

describe('Outpost auras are global (D-16)', () => {
    it('a Smithy in ONE Outpost boosts mining everywhere', () => {
        install('outpost_1', 'st_smithy');

        // The aura is on the global aggregator, so it is not tied to an area…
        expect(globalFactor('mining')).toBeCloseTo(1.2);
        // …and no area aggregator carries it.
        expect(getAreaAggregator('area_a').collectPercentages(EFFECT_TYPES.SPEED, 'mining')).toEqual([]);
        expect(getAreaAggregator('area_b').collectPercentages(EFFECT_TYPES.SPEED, 'mining')).toEqual([]);
    });

    it('leaves unrelated skills alone', () => {
        install('outpost_1', 'st_smithy');
        expect(globalFactor('fishing')).toBeCloseTo(1.0);
    });

    it('registers every modifier of a multi-aura card', () => {
        install('outpost_1', 'st_post');
        expect(globalFactor('woodcutting')).toBeCloseTo(1.15);
        expect(globalFactor('fishing')).toBeCloseTo(1.08);
    });

    it('a station with no passiveBuff contributes nothing', () => {
        install('outpost_1', 'st_kiln');
        expect(globalFactor('mining')).toBeCloseTo(1.0);
    });
});

describe('Duplicate auras stack additively (D-23)', () => {
    it('two Smithies give +40%, NOT the compounded +44%', () => {
        install('outpost_1', 'st_smithy');
        install('outpost_2', 'st_smithy');

        // 1 + 0.2 + 0.2 = 1.4. Compounding would give 1.2 × 1.2 = 1.44 — the
        // bug the three-bucket rule exists to prevent (§15.3).
        expect(globalFactor('mining')).toBeCloseTo(1.4);
        expect(globalFactor('mining')).not.toBeCloseTo(1.44);
    });

    it('un-installing one copy leaves the other standing', () => {
        install('outpost_1', 'st_smithy');
        install('outpost_2', 'st_smithy');

        StationSlotManager.unslotStation('outpost_1');

        // Sourcing per-outpost is what makes this work — a bare template id
        // would have stripped both entries here.
        expect(globalFactor('mining')).toBeCloseTo(1.2);
    });

    it('re-slotting the same card twice does not double-count it', () => {
        install('outpost_1', 'st_smithy');
        install('outpost_1', 'st_smithy');
        expect(globalFactor('mining')).toBeCloseTo(1.2);
    });
});

describe('Rehydration after a reload', () => {
    it('rebuilds every installed aura from the outpost list', () => {
        install('outpost_1', 'st_smithy');
        install('outpost_2', 'st_post');
        expect(globalFactor('mining')).toBeCloseTo(1.2);

        // Simulate a load: the aggregator is runtime-only and comes back empty.
        clearGlobalAggregator();
        expect(globalFactor('mining')).toBeCloseTo(1.0);

        StationSlotManager.rehydrateBuffs();

        // A silently-empty aggregator after reload is the classic failure this
        // pins — it must read the OUTPOST list, not areaStates.
        expect(globalFactor('mining')).toBeCloseTo(1.2);
        expect(globalFactor('woodcutting')).toBeCloseTo(1.15);
        expect(globalFactor('fishing')).toBeCloseTo(1.08);
    });

    it('keeps duplicate stacking intact through a rehydrate', () => {
        install('outpost_1', 'st_smithy');
        install('outpost_2', 'st_smithy');

        StationSlotManager.rehydrateBuffs();

        expect(globalFactor('mining')).toBeCloseTo(1.4);
    });

    it('does not resurrect an aura for an outpost that has no card', () => {
        install('outpost_1', 'st_smithy');
        StationSlotManager.unslotStation('outpost_1');

        StationSlotManager.rehydrateBuffs();

        expect(globalFactor('mining')).toBeCloseTo(1.0);
    });
});

describe('Staffing is a per-card property (D-22)', () => {
    it('an unstaffed Outpost still emits its aura', () => {
        install('outpost_1', 'st_smithy');
        expect(OutpostManager.getOutpost('outpost_1').assignedHeroId).toBeNull();

        // The aura rides on the card being INSTALLED, not on the hero — which
        // is what lets a special passive run with nobody on it at all.
        expect(globalFactor('mining')).toBeCloseTo(1.2);
    });
});
