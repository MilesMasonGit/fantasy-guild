// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

// The gear's recipe preview is the shared tooltip, portalled out of the mat: drawn inside the
// Token's box it sat under the work plate's layer.
describe('the recipe gear tooltip', () => {
    afterEach(cleanup);
    const recipe = {
        id: 'r_mid', name: 'Roast',
        inputs: [{ itemId: 'fixture_carrot', quantity: 2 }],
        outputs: [{ itemId: 'fixture_carrot', minQty: 1, maxQty: 1, chance: 100 }]
    };

    it('opens as the shared tooltip outside the mat, and nothing of it is drawn on the mat', () => {
        const { container } = render(React.createElement(StationGearBadge, { isDragging: false, recipe, onClick: () => {} }));
        expect(container.textContent).not.toContain('Roast');
        fireEvent.pointerEnter(container.querySelector('[data-station-gear]'), { clientX: 10, clientY: 10 });
        const tip = document.body.querySelector('[data-tooltip]');
        expect(tip).toBeTruthy();
        expect(container.contains(tip)).toBe(false);
        expect(tip.className).toContain('z-(--z-tooltip)');
        expect(tip.textContent).toContain('Roast');
        expect(tip.textContent).toContain('Makes 1× Carrot');
        expect(tip.textContent).toContain('Needs 2× Carrot');
        fireEvent.pointerLeave(container.querySelector('[data-station-gear]'));
        expect(document.body.querySelector('[data-tooltip]')).toBeNull();
    });
});
