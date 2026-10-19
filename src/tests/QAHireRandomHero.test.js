// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../ui/hooks/useEngine.js', () => ({ useEngine: vi.fn() }));

import { useEngine } from '../ui/hooks/useEngine.js';
import { TestDashboard } from '../ui/components/TestDashboard.jsx';

/** An engine whose roster cap follows `roster_size` and whose addHero refuses a full roster. */
function capEngine(existing) {
    const heroes = Array.from({ length: existing }, (_, i) => ({ id: `h${i}` }));
    const ranks = { roster_size: existing };
    let limit = existing;
    return {
        heroes,
        ranks,
        EventBus: { subscribe: () => () => {}, publish: () => {} },
        GameState: { state: { board: { tokens: {}, sprites: [] }, heroes } },
        GuildUpgradeManager: {
            getRanks: () => ranks,
            recompute: () => { limit = ranks.roster_size; }
        },
        HeroManager: {
            addHero: (hero) => {
                if (heroes.length >= limit) return null;
                heroes.push(hero);
                return hero;
            }
        }
    };
}

describe('QA panel: Hire Random Hero', () => {
    afterEach(() => cleanup());

    function hire(engine) {
        useEngine.mockReturnValue(engine);
        const view = render(React.createElement(TestDashboard));
        fireEvent.click(view.getByTitle('Open QA Dashboard'));
        fireEvent.click(view.getByText('Hire Random Hero'));
    }

    it('adds a Recruit on a fresh game with a roster cap of 0', () => {
        const engine = capEngine(0);
        hire(engine);
        expect(engine.heroes).toHaveLength(1);
        expect(engine.ranks.roster_size).toBe(1);
    });

    it('adds a Recruit to a full roster, raising the cap by exactly one', () => {
        const engine = capEngine(3);
        hire(engine);
        expect(engine.heroes).toHaveLength(4);
        expect(engine.ranks.roster_size).toBe(4);
    });
});
