import { describe, it, expect } from 'vitest';

/**
 * ⭐ **Loot's sparkles** (owner, after the base trail): a light sprinkle behind the flying item, the
 * same for every stack, and a shower spilling out of the item notice it lands on, longer and denser
 * for a bigger stack, on the shadows' seven stack steps. Nothing random, nothing over the notice.
 */

import {
    FLIGHT_SPARKLE_EVERY_MS, FLIGHT_SPARKLE_LIFE_MS, LANDING_SHOWER_MS, LANDING_SHOWER_PER_BEAT,
    SHOWER_REACH, SHOWER_SPARKLE_LIFE_MS, SPARKLE_ART_PX, SPARKLE_EMIT_STEP_MS, STACK_SPARKLE_COLOURS,
    flightSparkleCount, forEachFlightSparkle, forEachShowerSparkle, showerLengthMs, showerSparkleCount,
    sparkleColours
} from '../ui/utils/lootSparkles.js';
import { TRAIL_MAX_SHADOWS, trailShadowCount } from '../ui/utils/lootTrail.js';

const STEPS = [1, 2, 3, 4, 5, 6, 7];
const shower = (t, step, seed = 3) => { const out = []; forEachShowerSparkle(t, step, seed, (x, y, s) => out.push({ x, y, s })); return out; };
const line = (k) => ({ x: 100 + k * 400, y: 500 - k * 300 });
const flight = (t, dur, seed = 3) => { const out = []; forEachFlightSparkle(t, dur, 64, seed, line, (x, y, s) => out.push({ x, y, s })); return out; };

describe('the landing shower by stack step', () => {
    it('has one length and one density per shadow count', () => {
        expect(LANDING_SHOWER_MS).toHaveLength(TRAIL_MAX_SHADOWS);
        expect(LANDING_SHOWER_PER_BEAT).toHaveLength(TRAIL_MAX_SHADOWS);
    });

    it('each step is longer and spills more sparkles than the one before', () => {
        for (let i = 1; i < STEPS.length; i++) {
            expect(LANDING_SHOWER_MS[i]).toBeGreaterThan(LANDING_SHOWER_MS[i - 1]);
            expect(LANDING_SHOWER_PER_BEAT[i]).toBeGreaterThanOrEqual(LANDING_SHOWER_PER_BEAT[i - 1]);
            expect(showerSparkleCount(STEPS[i])).toBeGreaterThan(showerSparkleCount(STEPS[i - 1]));
        }
    });

    it.each([[5, 1], [40, 2], [300, 3], [2500, 4], [12000, 5], [400000, 6], [3000000, 7]])(
        'a stack of %i showers at step %i', (qty, step) => {
            expect(trailShadowCount(qty)).toBe(step);
            // Spills its own number on each beat, for its own length, then the last fade.
            expect(shower(0, step)).toHaveLength(LANDING_SHOWER_PER_BEAT[step - 1]);
            const lastBeat = Math.floor((LANDING_SHOWER_MS[step - 1] - 1) / SPARKLE_EMIT_STEP_MS) * SPARKLE_EMIT_STEP_MS;
            expect(shower(lastBeat, step).length).toBeGreaterThan(0);
            expect(shower(showerLengthMs(step) - 1, step).length).toBeGreaterThan(0);
            expect(shower(showerLengthMs(step), step)).toEqual([]);
        });

    it('every sparkle stays under the notice (never over its count) and inside its reach', () => {
        for (const step of STEPS) {
            for (let t = 0; t < showerLengthMs(step); t += 7) {
                for (const p of shower(t, step)) {
                    expect(p.y).toBeGreaterThanOrEqual(0);
                    expect(p.y).toBeLessThanOrEqual(SHOWER_REACH.down - 2 * SPARKLE_ART_PX);
                    expect(p.x).toBeGreaterThanOrEqual(-SHOWER_REACH.left + 2 * SPARKLE_ART_PX);
                    expect(p.x).toBeLessThanOrEqual(SHOWER_REACH.right - 2 * SPARKLE_ART_PX);
                }
            }
        }
    });

    it('steps through the plus, the pixel and the dimmer pixel', () => {
        expect(shower(0, 1)[0].s).toBe(0);
        expect(shower(Math.round(SHOWER_SPARKLE_LIFE_MS * 0.6), 1)[0].s).toBe(1);
        expect(shower(SHOWER_SPARKLE_LIFE_MS - 1, 1)[0].s).toBe(2);
    });

    it('the same flight showers the same pixels; another flight elsewhere', () => {
        expect(shower(200, 7, 11)).toEqual(shower(200, 7, 11));
        expect(shower(200, 7, 12)).not.toEqual(shower(200, 7, 11));
    });
});

describe('the flight sprinkle', () => {
    it('one sparkle per beat of its own, whatever the stack', () => {
        for (const dur of [280, 468, 800]) {
            // Just before landing, every sparkle given out so far is still alive.
            const t = Math.min(dur - 1, FLIGHT_SPARKLE_LIFE_MS - 1);
            expect(flight(t, dur)).toHaveLength(Math.floor(t / FLIGHT_SPARKLE_EVERY_MS) + 1);
            expect(flightSparkleCount(dur)).toBe(Math.ceil(dur / FLIGHT_SPARKLE_EVERY_MS));
        }
    });

    it('is lighter than the lightest shower: sparser, and never the bright plus', () => {
        expect(1 / FLIGHT_SPARKLE_EVERY_MS).toBeLessThan(LANDING_SHOWER_PER_BEAT[0] / SPARKLE_EMIT_STEP_MS);
        for (let t = 0; t < 800 + FLIGHT_SPARKLE_LIFE_MS; t += 5) for (const p of flight(t, 800)) expect(p.s).not.toBe(0);
    });

    it('gives none out after the landing, and the last are gone a life later', () => {
        expect(flight(800 + FLIGHT_SPARKLE_LIFE_MS, 800)).toEqual([]);
        const late = flight(800 + FLIGHT_SPARKLE_LIFE_MS - 60, 800);
        expect(late.length).toBeGreaterThan(0);
        expect(late.length).toBeLessThanOrEqual(2);
    });
});

describe('the sparkles colours', () => {
    const luma = (hex) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);

    it('are the colour lightened toward white: heart lightest, then the plus and pixel, the dim pixel the colour itself', () => {
        const c = sparkleColours([206, 123, 45]);
        expect(c.dim).toBe('#ce7b2d');
        expect(luma(c.light)).toBeGreaterThan(luma(c.dim));
        expect(luma(c.heart)).toBeGreaterThan(luma(c.light));
    });

    it('the stack colours stand ready as the other choice, one per step', () => {
        expect(STACK_SPARKLE_COLOURS).toHaveLength(TRAIL_MAX_SHADOWS);
        expect(STACK_SPARKLE_COLOURS[0].dim).toBe('#a0a0a0');
        expect(STACK_SPARKLE_COLOURS[4].dim).toBe('#ff2d55');
    });
});
