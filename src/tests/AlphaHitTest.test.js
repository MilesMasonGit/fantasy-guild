import { describe, it, expect, beforeEach } from 'vitest';
import { isPointOpaque, isElementOpaqueAtPoint, resolveTopOpaqueElement } from '../ui/utils/alphaHitTest.js';

describe('Pixel-Perfect Alpha Hit-Testing (alphaHitTest.js)', () => {
    it('returns true optimistically if image mask is not yet cached or src is missing', () => {
        expect(isPointOpaque(null, 0.5, 0.5)).toBe(true);
        expect(isPointOpaque('some_uncached_sprite.png', 0.5, 0.5)).toBe(true);
    });

    it('rejects out of bounds UV coordinates', () => {
        expect(isPointOpaque('some_sprite.png', -0.1, 0.5)).toBe(false);
        expect(isPointOpaque('some_sprite.png', 1.1, 0.5)).toBe(false);
        expect(isPointOpaque('some_sprite.png', 0.5, -0.1)).toBe(false);
        expect(isPointOpaque('some_sprite.png', 0.5, 1.1)).toBe(false);
    });

    it('performs circular / radial hit-testing on circular elements', () => {
        const circleElement = {
            hasAttribute: (attr) => attr === 'data-alpha-circle',
            dataset: { alphaCircle: 'true' },
            getBoundingClientRect: () => ({
                left: 100,
                top: 100,
                right: 200,
                bottom: 200,
                width: 100,
                height: 100
            })
        };

        // Center (150, 150): radius is 50, dist from center is 0 <= 50 -> true
        expect(isElementOpaqueAtPoint(circleElement, 150, 150)).toBe(true);

        // Near edge inside circle (180, 150): dist is 30 <= 50 -> true
        expect(isElementOpaqueAtPoint(circleElement, 180, 150)).toBe(true);

        // Corner of the bounding box (105, 105): dist is ~63.6 > 50 -> false
        expect(isElementOpaqueAtPoint(circleElement, 105, 105)).toBe(false);

        // Far outside (300, 300) -> false
        expect(isElementOpaqueAtPoint(circleElement, 300, 300)).toBe(false);
    });

    it('handles null / missing element gracefully', () => {
        expect(isElementOpaqueAtPoint(null, 100, 100)).toBe(false);
    });
});
