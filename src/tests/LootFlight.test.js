import { describe, it, expect, beforeEach } from 'vitest';
import {
    lootFlightTarget, lootSpriteMatPx, lootSpriteScreenPx, HALL_SELECTOR
} from '../ui/utils/lootFlight.js';

/**
 * Q5 (FB-16, FB-17): collected loot flies to the Guild Hall Token on the mat,
 * falling back to the Bank bubble, and keeps its floor size in flight.
 */

const rectOf = (left, top, size) => ({
    left, top, width: size, height: size, right: left + size, bottom: top + size
});

function setRect(el, r) {
    el.getBoundingClientRect = () => r;
}

const VIEW = { width: 1000, height: 800 };

describe('lootFlightTarget', () => {
    let hall;
    let bank;
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="bank-bubble-target">Bank</div>
            <div data-token-art="true" data-guild-hall="true">Hall</div>
            <div data-token-art="true">Oak Tree</div>`;
        hall = document.querySelector(HALL_SELECTOR);
        bank = document.getElementById('bank-bubble-target');
        setRect(hall, rectOf(400, 300, 128));
        setRect(bank, rectOf(10, 10, 40));
    });

    it('targets the Guild Hall on the mat', () => {
        const t = lootFlightTarget(document, VIEW);
        expect(t.target).toBe('hall');
        expect(t.rect.left).toBe(400);
    });

    it('follows the Hall wherever it is now (read live)', () => {
        setRect(hall, rectOf(700, 100, 128));
        expect(lootFlightTarget(document, VIEW).rect.left).toBe(700);
    });

    it('falls back to the Bank when the Hall is not on the mat', () => {
        hall.remove();
        const t = lootFlightTarget(document, VIEW);
        expect(t.target).toBe('bank');
        expect(t.rect.left).toBe(10);
    });

    it('falls back to the Bank when the Hall is off screen', () => {
        setRect(hall, rectOf(1200, 300, 128));
        expect(lootFlightTarget(document, VIEW).target).toBe('bank');
    });

    it('falls back to the Bank while the Hall is in the hand (hidden)', () => {
        hall.style.visibility = 'hidden';
        expect(lootFlightTarget(document, VIEW).target).toBe('bank');
    });

    it('falls back to the Bank when the Hall has no size', () => {
        setRect(hall, rectOf(400, 300, 0));
        expect(lootFlightTarget(document, VIEW).target).toBe('bank');
    });

    it('is null with neither the Hall nor the Bank', () => {
        document.body.innerHTML = '';
        expect(lootFlightTarget(document, VIEW)).toBeNull();
    });
});

describe('loot sprite size (FB-17)', () => {
    it('is 64 mat units at a fit of 1 (the natural 2x)', () => {
        expect(lootSpriteMatPx(1)).toBe(64);
        expect(lootSpriteScreenPx(1)).toBe(64);
    });

    it('lands on a whole multiple of the 32px art on screen at any fit', () => {
        for (const fit of [0.21, 0.4, 0.6, 0.75, 1, 1.3, 1.6]) {
            const px = lootSpriteScreenPx(fit);
            expect(px % 32).toBe(0);
            // the flight size is the floor size through the mat's transform
            expect(px).toBeCloseTo(lootSpriteMatPx(fit) * fit, 6);
        }
    });

    it('treats a missing or bad fit as 1', () => {
        expect(lootSpriteScreenPx(NaN)).toBe(64);
        expect(lootSpriteScreenPx(0)).toBe(64);
    });
});
