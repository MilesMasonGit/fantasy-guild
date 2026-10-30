// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

import { TestDashboard } from '../ui/components/TestDashboard.jsx';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';

/** A fresh game with `existing` heroes and a roster cap that holds exactly them. */
function rosterOf(existing) {
    GameState.initNew();
    GameState.state.heroes = [];
    GuildUpgradeManager.getRanks().roster_size = existing;
    GuildUpgradeManager.recompute();
    for (let i = 0; i < existing; i++) HeroManager.addHero(generateHero());
    expect(HeroManager.isRosterFull()).toBe(true);
    return { heroes: () => GameState.state.heroes, ranks: GuildUpgradeManager.getRanks() };
}

describe('QA panel: Hire Random Hero', () => {
    afterEach(() => cleanup());

    function hire() {
        const view = render(React.createElement(TestDashboard));
        fireEvent.click(view.getByTitle('Open QA Dashboard'));
        fireEvent.click(view.getByText('Hire Random Hero'));
    }

    it('adds a hero on a fresh game with a roster cap of 0', () => {
        const game = rosterOf(0);
        hire();
        expect(game.heroes()).toHaveLength(1);
        expect(game.ranks.roster_size).toBe(1);
    });

    it('adds a hero to a full roster, raising the cap by exactly one', () => {
        const game = rosterOf(3);
        hire();
        expect(game.heroes()).toHaveLength(4);
        expect(game.ranks.roster_size).toBe(4);
    });
});
