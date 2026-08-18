import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { GICard } from '../ui/components/base/GICard.jsx';

/**
 * The hook-order safety net for `GICard` (CR2-034).
 *
 * The parallax layer's two `useTransform` calls used to sit **inside** the
 * `imageSrc && (…)` block. React matches hooks up by call order, so a card
 * whose art appeared or disappeared while it was on screen ran a different
 * number of hooks between renders and React tore the UI down with "rendered
 * more hooks than during the previous render".
 *
 * `GICard` currently has no live caller in the game — it is reachable only from
 * here — so this suite is the only thing that will notice if the hooks slide
 * back inside the conditional.
 */
describe('GICard survives its art appearing and disappearing (CR2-034)', () => {
    const card = (props) => React.createElement(
        GICard,
        { id: 'probe', ...props },
        React.createElement('span', null, 'contents')
    );

    it('renders with and without art', () => {
        const withArt = render(card({ imageSrc: '/art/probe.png' }));
        expect(withArt.container.querySelector('[data-card-id="probe"]')).toBeTruthy();
        withArt.unmount();

        const without = render(card({}));
        expect(without.container.querySelector('[data-card-id="probe"]')).toBeTruthy();
        without.unmount();
    });

    it('draws the parallax layer only when there is art', () => {
        const { container, rerender } = render(card({}));
        const hasLayer = () => !!container.querySelector('[style*="background-image"]');

        expect(hasLayer()).toBe(false);
        rerender(card({ imageSrc: '/art/probe.png' }));
        expect(hasLayer()).toBe(true);
    });

    it('does not change its hook count when art is added or taken away', () => {
        // The regression itself: toggling `imageSrc` on a MOUNTED card. Before
        // the fix this threw on the second render.
        const { container, rerender } = render(card({}));

        expect(() => {
            rerender(card({ imageSrc: '/art/probe.png' }));
            rerender(card({}));
            rerender(card({ imageSrc: '/art/other.png' }));
        }).not.toThrow();

        expect(container.querySelector('[data-card-id="probe"]')).toBeTruthy();
    });
});
