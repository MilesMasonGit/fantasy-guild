// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup, screen } from '@testing-library/react';
import { CardPips } from '../ui/components/card-modules/CardPips.jsx';

// createElement rather than JSX: this project's vitest include is
// `src/**/*.{test,spec}.{js,mjs}`, so a .jsx test file is never collected.

afterEach(cleanup);

const pips = (props) => render(createElement(CardPips, props));

/** The rendered pip states, left to right. */
function pipStates() {
    const row = screen.getByTitle(/collected/);
    return [...row.children].map(pip => {
        const cls = pip.className || '';
        if (cls.includes('bg-gi-primary')) return 'deployed';
        if (cls.includes('bg-white/85')) return 'owned';
        return 'empty';
    });
}

describe('CardPips — the binder copy indicator (D-45)', () => {
    it('shows one pip per possible copy', () => {
        pips({ owned: 0, deployed: 0, max: 4 });
        expect(pipStates()).toHaveLength(4);
    });

    it('renders an uncollected card as all empty', () => {
        pips({ owned: 0, deployed: 0, max: 4 });
        expect(pipStates()).toEqual(['empty', 'empty', 'empty', 'empty']);
    });

    it('distinguishes owned-and-free from owned-and-deployed', () => {
        pips({ owned: 3, deployed: 1, max: 4 });
        expect(pipStates()).toEqual(['deployed', 'owned', 'owned', 'empty']);
    });

    it('renders a fully deployed playset as all coloured', () => {
        pips({ owned: 4, deployed: 4, max: 4 });
        expect(pipStates()).toEqual(['deployed', 'deployed', 'deployed', 'deployed']);
    });

    it('summarises state in the tooltip', () => {
        pips({ owned: 3, deployed: 1, max: 4 });
        expect(screen.getByTitle('3 of 4 collected · 1 in deck')).toBeTruthy();
    });

    it('omits the deck clause when nothing is slotted', () => {
        pips({ owned: 2, deployed: 0, max: 4 });
        expect(screen.getByTitle('2 of 4 collected')).toBeTruthy();
    });

    // D-49: the pip count is the card's OWN maximum, so a unique reads as a
    // one-of rather than as a playset you have failed to complete.
    it('renders a unique as a single pip', () => {
        pips({ owned: 1, deployed: 0, max: 1 });
        expect(pipStates()).toEqual(['owned']);
    });

    it('renders an uncollected unique as a single empty pip', () => {
        pips({ owned: 0, deployed: 0, max: 1 });
        expect(pipStates()).toEqual(['empty']);
    });

    it('renders nothing when a card can have no copies', () => {
        const { container } = pips({ owned: 0, deployed: 0, max: 0 });
        expect(container.firstChild).toBeNull();
    });
});
