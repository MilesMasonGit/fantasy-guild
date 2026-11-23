// @vitest-environment jsdom
// Three small calls: a place's own Tokens stand outside the Token cap, the hero sheet's header
// says the hero's level, and Settings can switch Limes's lessons off and on.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { clearMat } from './fixtures/mat.js';
import { calculateHeroLevel } from '../systems/hero/HeroGenerator.js';
import * as LimesLessons from '../systems/quests/LimesLessons.js';
import * as LimesGuide from '../systems/quests/LimesGuide.js';
import { allSteps } from '../systems/quests/lessonPlan.js';
import { SettingsModal } from '../ui/modals/SettingsModal.jsx';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

const h = React.createElement;

function put(typeId, i, fixture) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED);
    if (fixture) instance.fixture = fixture;
    return BoardState.addToken(instance, 100 + (i % 40) * 50, 100 + Math.floor(i / 40) * 50);
}

beforeEach(() => {
    vi.stubGlobal('__APP_VERSION__', '0.0.0-test');
    GameState.initNew();
    clearMat();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('a place\'s own Tokens stand outside the cap', () => {
    it('a map\'s nodes and the camp\'s Tokens do not count; a Token the player adds does', () => {
        const map = put('fixture_producer', 0, BoardState.FIXTURE.MAP);
        const camp = put('fixture_producer', 1, BoardState.FIXTURE.CAMP);
        const own = put('fixture_producer', 2);
        expect(MatCap.countsTowardCap(map)).toBe(false);
        expect(MatCap.countsTowardCap(camp)).toBe(true);
        expect(MatCap.countsTowardCap(own)).toBe(true);
        expect(MatCap.tokenCount()).toBe(2);
    });

    it('a place that starts over the cap refuses additions until the player is under it, and removes nothing', () => {
        const cap = MatCap.matCap();
        const fixtures = [];
        for (let i = 0; i < cap + 20; i++) fixtures.push(put('fixture_producer', i, BoardState.FIXTURE.MAP));
        expect(MatCap.tokenCount()).toBe(0);
        expect(MatCap.canPlaceMore()).toBe(true);
        for (let i = 0; i < cap; i++) put('fixture_producer', cap + 20 + i);
        expect(MatCap.tokenCount()).toBe(cap);
        expect(MatCap.canPlaceMore()).toBe(false);
        // Taking a fixture away changes nothing about the count; nothing was ever removed for the cap.
        BoardState.removeToken(fixtures[0].id);
        expect(MatCap.tokenCount()).toBe(cap);
        expect(BoardState.tokens().length).toBe(2 * cap + 19);
    });

    it('the mark is saved with the Token, so a load keeps it', () => {
        const map = put('fixture_producer', 0, BoardState.FIXTURE.MAP);
        const copy = JSON.parse(JSON.stringify(GameState.state.board.tokens[map.id]));
        expect(copy.fixture).toBe(true);
        expect(MatCap.countsTowardCap(copy)).toBe(false);
    });
});

describe('the hero sheet\'s header says the hero\'s level', () => {
    it('the average of the skills the hero holds, by the one formula', () => {
        const skills = { mining: { level: 3, xp: 0 }, forestry: { level: 6, xp: 0 } };
        GameState.state.heroes = [{
            id: 'h1', name: 'Aldric', spriteId: 'hn_recruit_por', hp: { current: 80, max: 100 },
            status: 'idle', equipment: {}, skills
        }];
        setLiveMatFit(1);
        const r = render(h(DeckDndProvider, null, h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1' })));
        const level = r.container.querySelector('[data-hero-drawer-header] [data-hero-panel-level]');
        expect(calculateHeroLevel(skills)).toBe(4.5);
        expect(level.textContent).toBe('Level 4.5');
    });
});

describe('Settings holds a Lessons switch', () => {
    const lessonsToggle = () => document.querySelector('[data-setting="lessons"]');
    const openGame = () => fireEvent.click(document.querySelector('[data-settings-tab="game"]'));

    it('off hides the lessons, on brings them back at the first step not yet done, saved with the game', () => {
        GameState.state.meta = { guildName: 'Test' };
        LimesLessons.startLessons();
        LimesGuide.setLessons(true);
        const first = allSteps()[0];
        LimesLessons.report(first.targetType, 1, { ...(first.match || {}) });
        const stepBefore = LimesLessons.currentStep().id;

        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        openGame();
        expect(lessonsToggle()).not.toBeNull();
        const button = lessonsToggle().querySelector('button');

        fireEvent.click(button);
        expect(LimesGuide.lessonsOn()).toBe(false);
        expect(JSON.parse(JSON.stringify(GameState.state.guide)).lessons).toBe(false);

        // Progress keeps counting while they are off.
        const next = LimesLessons.currentStep();
        LimesLessons.report(next.targetType, next.count || 1, { ...(next.match || {}) });
        const stepAfter = LimesLessons.currentStep().id;

        fireEvent.click(button);
        expect(LimesGuide.lessonsOn()).toBe(true);
        expect(LimesLessons.currentStep().id).toBe(stepAfter);
        expect(stepAfter).not.toBe(stepBefore);
    });

    it('is not offered in a game with no lessons', () => {
        GameState.state.meta = { guildName: 'Test' };
        GameState.state.guide = { limesSpot: null, lessons: true };
        render(h(SettingsModal, { isOpen: true, onClose: () => {} }));
        openGame();
        expect(lessonsToggle()).toBeNull();
    });
});
