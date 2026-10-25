// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { StationGearBadge } from '../ui/components/board/TokenBadges.jsx';

/**
 * A Field's gear (brief 230 S4): the crop is picked with the station's gear and recipe list, so the
 * gear says so in a Field's words: "Choose crop", "No crop picked", and its preview says what a
 * sowing costs ("Sown for"), not what each harvest needs. Every other station is unchanged.
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

    it('previews the crop as sown for its seed; a station still says Needs', async () => {
        const field = render(h(StationGearBadge, { isDragging: false, recipe: wheat, isField: true, onClick: () => {} }));
        fireEvent.pointerEnter(field.container.querySelector('[data-station-gear]'));
        fireEvent.mouseEnter(field.container.querySelector('[data-station-gear]'));
        const sown = await screen.findByText(/Sown for/);
        expect(sown.textContent).toMatch(/Sown for 1/);
        cleanup();

        const station = render(h(StationGearBadge, { isDragging: false, recipe: wheat, onClick: () => {} }));
        expect(station.container.querySelector('button').getAttribute('aria-label')).toBe('Choose recipe');
        fireEvent.pointerEnter(station.container.querySelector('[data-station-gear]'));
        fireEvent.mouseEnter(station.container.querySelector('[data-station-gear]'));
        expect((await screen.findByText(/Needs/)).textContent).toMatch(/Needs 1/);
    });
});
