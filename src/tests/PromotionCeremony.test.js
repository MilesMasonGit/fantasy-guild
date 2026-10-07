// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, renderHook, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardPromotion from '../systems/board/BoardPromotion.js';
import * as PromotionSystem from '../systems/hero/PromotionSystem.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getPromotionCost, getPromotionGateSkills } from '../config/registries/jobRegistry.js';

vi.mock('../ui/hooks/useEngine.js', () => ({ useEngine: vi.fn() }));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

import { useEngine } from '../ui/hooks/useEngine.js';
import { PromotionCeremonyModal } from '../ui/modals/PromotionCeremonyModal.jsx';
import { useUIModals, standingPromotionOffer } from '../ui/hooks/useUIModals.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * this names one spot on the mat for the Academy to stand on.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** Which spot the Token a hero works stands on, or null. */
function workTileOf(heroId) {
    const instance = BoardState.getTokenById(BoardState.workTokenOf(heroId));
    if (!instance) return null;
    const col = Math.round((instance.x - 400) / 160);
    const row = Math.round((instance.y - 200) / 160);
    return row * 6 + col;
}

/**
 * ⭐ **The promotion ceremony** (Promotes rule P4).
 */

const TILE = 24;
const engine = { HeroManager, PromotionSystem, BoardPromotion, BoardState, EventBus };

function qualifiedHero() {
    const hero = generateHero({ name: 'Ada' });
    HeroManager.addHero(hero);
    const cost = getPromotionCost('fighter');
    for (const skillId of getPromotionGateSkills('fighter')) {
        if (!hero.skills[skillId]) hero.skills[skillId] = { xp: 0, level: 0 };
        hero.skills[skillId].level = cost.skillLevel;
    }
    return hero;
}

/** Train a hero to the offer on a fixture Token; returns the offer. */
function standingOffer(hero, { typeId = 'fixture_promotion', uses = 2 } = {}) {
    BoardState.addToken({ typeId, usesRemaining: uses, cycleElapsedMs: 0 }, C(TILE).x, C(TILE).y);
    Placement.plantFlagAt(hero.id, C(TILE));
    for (let i = 0; i < 25 && !BoardPromotion.getOffer(idAt(TILE)); i++) {
        BoardPromotion.tickToken(tokenAt(TILE), 1000, hero.id);
    }
    return BoardPromotion.getOffer(idAt(TILE));
}

const button = (label) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(label));

beforeEach(() => {
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    GameState.state.heroes = [];
    BoardState.init?.();
    useEngine.mockReturnValue(engine);
});
afterEach(() => cleanup());

describe('asking', () => {
    it('says who is becoming what, and shows the trade, before anything changes', () => {
        const hero = qualifiedHero();
        const offer = standingOffer(hero);
        render(React.createElement(PromotionCeremonyModal, { offer, onClose: () => {} }));

        const body = document.body.textContent;
        expect(body).toContain('Training complete');
        expect(body).toContain('Ada has finished training');
        expect(body).toContain('Sets aside');
        expect(body).toContain('Takes up');
        expect(button('Become Fighter')).toBeTruthy();
        expect(hero.jobId).toBe('recruit');
    });

    it('names its buttons by what they say, not by their tooltips', () => {
        const hero = qualifiedHero();
        render(React.createElement(PromotionCeremonyModal, { offer: standingOffer(hero), onClose: () => {} }));
        // A `title` alone made the browser expose "Not yet" as "Nothing is spent…".
        expect(document.body.querySelector('button[aria-label="Not yet"]')).toBeTruthy();
        expect(button('Become Fighter').getAttribute('aria-label')).toBeNull();
    });

    it('has no corner close — declining must be a button the player pressed', () => {
        const hero = qualifiedHero();
        render(React.createElement(PromotionCeremonyModal, { offer: standingOffer(hero), onClose: () => {} }));
        const labels = [...document.body.querySelectorAll('button')].map((b) => b.textContent.trim());
        expect(labels.some((l) => l.includes('Not yet'))).toBe(true);
        expect(labels.some((l) => /^(×|✕|Close)$/.test(l))).toBe(false);
    });
});

describe('accepting', () => {
    it('promotes, spends the Token, and says so', () => {
        const hero = qualifiedHero();
        render(React.createElement(PromotionCeremonyModal, { offer: standingOffer(hero), onClose: () => {} }));

        fireEvent.click(button('Become Fighter'));

        expect(hero.jobId).toBe('fighter');
        expect(tokenAt(TILE).usesRemaining).toBe(1);
        expect(document.body.textContent).toContain('Promotion complete');
        expect(document.body.textContent).toContain('Ada is now a Fighter');
    });

    /** ⚠️ The branch's first play-found bug: the answered window went blank. */
    it('still shows what was set aside AFTER the promotion — the snapshot, not a re-read', () => {
        const hero = qualifiedHero();
        render(React.createElement(PromotionCeremonyModal, { offer: standingOffer(hero), onClose: () => {} }));
        const aside = document.body.querySelector('[data-promotion-trade]').textContent;

        fireEvent.click(button('Become Fighter'));

        expect(document.body.querySelector('[data-from-job]').textContent).toBe('Recruit');
        expect(document.body.querySelector('[data-promotion-trade]').textContent).toBe(aside);
        // A re-read AFTER the promotion would say "nothing new" in the Takes
        // up column; the snapshot still lists the two skills that arrived.
        expect(document.body.textContent).toContain('nothing — this hero keeps everything');
        expect(document.body.textContent).not.toContain('nothing new');
    });

    it('explains a refusal in words, beside the button, and leaves the offer standing', () => {
        const hero = qualifiedHero();
        const offer = standingOffer(hero, { typeId: 'fixture_promotion_costly', uses: 3 });
        render(React.createElement(PromotionCeremonyModal, { offer, onClose: () => {} }));

        // The Token is drained while the window sits open.
        tokenAt(TILE).usesRemaining = 1;
        fireEvent.click(button('Become Fighter'));

        expect(hero.jobId).toBe('recruit');
        expect(document.body.querySelector('[data-promotion-refusal]').textContent)
            .toBe('This Token no longer has the charges to pay for it.');
        expect(BoardPromotion.getOffer(idAt(TILE))).not.toBeNull();
    });
});

describe('declining', () => {
    it('spends nothing, keeps the hero, and closes', () => {
        const hero = qualifiedHero();
        const onClose = vi.fn();
        render(React.createElement(PromotionCeremonyModal, { offer: standingOffer(hero), onClose }));

        fireEvent.click(button('Not yet'));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(hero.jobId).toBe('recruit');
        expect(tokenAt(TILE).usesRemaining).toBe(2);
        expect(workTileOf(hero.id)).toBe(TILE);
    });
});

describe('⭐ the game opens it', () => {
    it('opens when training completes', () => {
        const hero = qualifiedHero();
        const { result } = renderHook(() => useUIModals(engine));
        expect(result.current.dock.promotionOffer).toBeNull();

        act(() => { standingOffer(hero); });

        expect(result.current.dock.promotionOffer).toMatchObject({ instanceId: idAt(TILE), heroId: hero.id, jobId: 'fighter' });
        act(() => result.current.dock.closePromotion());
        expect(result.current.dock.promotionOffer).toBeNull();
    });

    it('⚠️ re-finds an unanswered offer when a save loads', () => {
        const hero = qualifiedHero();
        standingOffer(hero);
        const { result } = renderHook(() => useUIModals(engine));

        act(() => { EventBus.publish('game_loaded', { slot: 0 }); });

        expect(result.current.dock.promotionOffer).toMatchObject({ instanceId: idAt(TILE), heroId: hero.id });
    });

    it('⚠️ never re-asks about an offer the player declined', () => {
        const hero = qualifiedHero();
        standingOffer(hero);
        BoardPromotion.decline(idAt(TILE));

        expect(standingPromotionOffer(engine)).toBeNull();
        const { result } = renderHook(() => useUIModals(engine));
        act(() => { EventBus.publish('game_loaded', { slot: 0 }); });
        expect(result.current.dock.promotionOffer).toBeNull();
    });

    it('finds nothing — and does not throw — with no game in progress', () => {
        expect(standingPromotionOffer({})).toBeNull();
        // ⚠️ Stubs the reader `standingPromotionOffer` actually calls. It used to
        // stub `occupiedTiles`, which the guard never reached — so the try/catch
        // this is named for was never exercised at all.
        expect(standingPromotionOffer({ BoardState: { tokens: () => { throw new Error('no board'); } }, BoardPromotion })).toBeNull();
    });
});
