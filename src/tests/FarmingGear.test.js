// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

/**
 * A Field's gear (brief 230 S4): the crop is picked with the station's gear and recipe list, so the
 * gear says so in a Field's words: "Choose crop". Every other station is unchanged.
 */

const h = React.createElement;
const wheat = {
    id: 'r_wheat', name: 'Wheat',
    inputs: [{ itemId: 'item_wheat_seed', quantity: 1 }],
    outputs: [{ itemId: 'item_wheat', chance: 100, minQty: 1, maxQty: 1 }]
};

afterEach(() => cleanup());

describe('the gear on a Field', () => {
    it('asks for a crop while nothing is picked', () => {
        const { container } = render(h(StationGearBadge, { isDragging: false, recipe: null, pulsing: true, isField: true, onClick: () => {} }));
        expect(container.querySelector('button').getAttribute('aria-label')).toBe('Choose crop');
    });

    it('shows no preview on the mat: the crop chosen is the card’s to say (brief 830 D3)', () => {
        const { container } = render(h(StationGearBadge, { isDragging: false, recipe: wheat, isField: true, onClick: () => {} }));
        fireEvent.pointerEnter(container.querySelector('[data-station-gear]'));
        fireEvent.mouseEnter(container.querySelector('[data-station-gear]'));
        expect(screen.queryByText(/Sown for/)).toBeNull();
        expect(container.querySelector('button').getAttribute('aria-label')).toBe('Choose crop');
    });
});
