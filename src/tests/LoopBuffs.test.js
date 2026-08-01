import { describe, it, expect, beforeEach } from 'vitest';
import {
    applyCardBuffs,
    consumePendingNextCardBuff,
    releaseNextCardBuff,
    clearLoopBuffs,
    clearAllLoopBuffs,
    getActiveBuffSources,
    hasPendingNextCardBuff
} from '../systems/loop/LoopBuffs.js';
import { getAreaAggregator, clearAllAreaAggregators } from '../systems/loop/AreaModifiers.js';
import { EFFECT_REACH } from '../config/cards/effectRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

// D-10: a card's buff reaches OTHER cards in the loop. `reach` picks the
// archetype — an Aura covers the rest of the loop, a Next-Card buff covers
// exactly one card. Neither buffs the card carrying it.

const AREA = 'area_test';

/** +25% speed, as a card would author it. */
const speedBuff = (reach, value = 0.25) => ({
    kind: 'buff',
    reach,
    modifiers: [{ type: EFFECT_TYPES.SPEED, value, bucket: 'percentage' }]
});

/** The area's resolved speed percentage bucket: 1 + Σ fractions. */
const speedBucket = () => getAreaAggregator(AREA).getPercentageBucket(EFFECT_TYPES.SPEED);

beforeEach(() => {
    clearAllLoopBuffs();
    clearAllAreaAggregators();
});

describe('Aura buffs (reach: loop)', () => {
    it('registers on the area the moment the hero reaches the card', () => {
        expect(speedBucket()).toBe(1);
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        expect(speedBucket()).toBeCloseTo(1.25);
    });

    it('stays active across later cards', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        // Three more cards resolve; none carries a buff.
        for (let i = 1; i <= 3; i++) applyCardBuffs(AREA, `card_${i}`, i, []);
        expect(speedBucket()).toBeCloseTo(1.25);
    });

    it('is wiped when the loop wraps', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        clearLoopBuffs(AREA);
        expect(speedBucket()).toBe(1);
        expect(getActiveBuffSources(AREA)).toEqual([]);
    });

    // The failure mode the roadmap called out: a buff that survives the wrap
    // makes the area silently faster forever.
    it('does NOT compound across loops', () => {
        for (let loop = 0; loop < 5; loop++) {
            applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
            expect(speedBucket()).toBeCloseTo(1.25);
            clearLoopBuffs(AREA);
        }
        expect(speedBucket()).toBe(1);
    });

    it('re-registering the same card in the same slot does not stack', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        expect(speedBucket()).toBeCloseTo(1.25);
    });

    it('two different aura cards stack with each other', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        applyCardBuffs(AREA, 'card_totem', 1, [speedBuff(EFFECT_REACH.LOOP, 0.1)]);
        expect(speedBucket()).toBeCloseTo(1.35);
    });
});

describe('Next-Card buffs (reach: next_card)', () => {
    it('arms without taking effect — it must not buff its own card', () => {
        applyCardBuffs(AREA, 'card_whetstone', 0, [speedBuff(EFFECT_REACH.NEXT_CARD)]);
        expect(hasPendingNextCardBuff(AREA)).toBe(true);
        expect(speedBucket()).toBe(1);
    });

    it('applies when the next card activates', () => {
        applyCardBuffs(AREA, 'card_whetstone', 0, [speedBuff(EFFECT_REACH.NEXT_CARD)]);
        expect(consumePendingNextCardBuff(AREA)).toBe(true);
        expect(speedBucket()).toBeCloseTo(1.25);
    });

    it('covers exactly one card, then retires', () => {
        applyCardBuffs(AREA, 'card_whetstone', 0, [speedBuff(EFFECT_REACH.NEXT_CARD)]);
        consumePendingNextCardBuff(AREA);          // card 1 activates — buffed
        expect(speedBucket()).toBeCloseTo(1.25);

        releaseNextCardBuff(AREA);                 // card 1 completes
        expect(speedBucket()).toBe(1);

        consumePendingNextCardBuff(AREA);          // card 2 activates — nothing armed
        expect(speedBucket()).toBe(1);
    });

    it('reports nothing to consume when none was armed', () => {
        expect(consumePendingNextCardBuff(AREA)).toBe(false);
        expect(speedBucket()).toBe(1);
    });

    it('releasing when nothing is applied is harmless', () => {
        expect(() => releaseNextCardBuff(AREA)).not.toThrow();
        expect(speedBucket()).toBe(1);
    });

    it('an armed but never-consumed buff dies at the wrap', () => {
        applyCardBuffs(AREA, 'card_whetstone', 3, [speedBuff(EFFECT_REACH.NEXT_CARD)]);
        clearLoopBuffs(AREA);
        expect(hasPendingNextCardBuff(AREA)).toBe(false);
        expect(consumePendingNextCardBuff(AREA)).toBe(false);
    });
});

describe('placement matters (D-10)', () => {
    it('an Aura in the last slot buffs nothing before the wrap', () => {
        // Slots 0-2 run unbuffed, the Aura lands in slot 3, then the loop wraps.
        for (let i = 0; i < 3; i++) {
            applyCardBuffs(AREA, `card_${i}`, i, []);
            expect(speedBucket()).toBe(1);
        }
        applyCardBuffs(AREA, 'card_shrine', 3, [speedBuff(EFFECT_REACH.LOOP)]);
        clearLoopBuffs(AREA);
        expect(speedBucket()).toBe(1);
    });

    it('the same Aura in the first slot covers the whole deck', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        for (let i = 1; i < 4; i++) {
            applyCardBuffs(AREA, `card_${i}`, i, []);
            expect(speedBucket()).toBeCloseTo(1.25);
        }
    });
});

describe('area isolation', () => {
    it('a buff in one area never leaks into another', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        expect(getAreaAggregator('area_other').getPercentageBucket(EFFECT_TYPES.SPEED)).toBe(1);
    });

    it('clearing one area leaves the other running', () => {
        applyCardBuffs(AREA, 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        applyCardBuffs('area_other', 'card_shrine', 0, [speedBuff(EFFECT_REACH.LOOP)]);
        clearLoopBuffs(AREA);
        expect(speedBucket()).toBe(1);
        expect(getAreaAggregator('area_other').getPercentageBucket(EFFECT_TYPES.SPEED)).toBeCloseTo(1.25);
    });
});

describe('the hybrid card (D-60)', () => {
    it('a card that yields AND buffs registers its buff like any other', () => {
        // The work_output half is resolved elsewhere; what matters here is that
        // a buff riding a Task card is not treated differently.
        applyCardBuffs(AREA, 'task_sharpening_quarry', 0, [speedBuff(EFFECT_REACH.NEXT_CARD)]);
        expect(hasPendingNextCardBuff(AREA)).toBe(true);
    });

    it('ignores non-buff effects handed to it', () => {
        applyCardBuffs(AREA, 'card_mixed', 0, []);
        expect(speedBucket()).toBe(1);
        expect(getActiveBuffSources(AREA)).toEqual([]);
    });
});
