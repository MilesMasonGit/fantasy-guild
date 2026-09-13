import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, renderHook, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
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
 * ⭐ **The promotion ceremony** (Promotes rule P4).
 *
 * The window that asks "become a Fighter?" at the end of training — ported from
 * the unmerged `promotion-tokens` branch — driven the way a player drives it,
 * against the real engine modules (only `useEngine` is stood in, to hand them
 * over without booting the whole game).
 *
 * The branch found two bugs only by playing; both have a test here:
 * the answered window going blank ("Fighter → Fighter, sets aside nothing"),
 * and a previous answer surviving into the next offer.
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
    BoardState.setToken(TILE, { typeId, usesRemaining: uses, cycleElapsedMs: 0 });
    BoardState.setHeroTile(hero.id, TILE);
    for (let i = 0; i < 25 && !BoardPromotion.getOffer(TILE); i++) {
        BoardPromotion.tickTile(TILE, BoardState.getToken(TILE), 1000, hero.id);
    }
    return BoardPromotion.getOffer(TILE);
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
        expect(BoardState.getToken(TILE).usesRemaining).toBe(1);
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
        expect(document.body.textContent).not.toContain('nothing — this hero keeps everything');
    });

    it('explains a refusal in words, beside the button, and leaves the offer standing', () => {
        const hero = qualifiedHero();
        const offer = standingOffer(hero, { typeId: 'fixture_promotion_costly', uses: 3 });
        render(React.createElement(PromotionCeremonyModal, { offer, onClose: () => {} }));

        // The Token is drained while the window sits open.
        BoardState.getToken(TILE).usesRemaining = 1;
        fireEvent.click(button('Become Fighter'));

        expect(hero.jobId).toBe('recruit');
        expect(document.body.querySelector('[data-promotion-refusal]').textContent)
            .toBe('This Token no longer has the charges to pay for it.');
        expect(BoardPromotion.getOffer(TILE)).not.toBeNull();
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
        expect(BoardState.getToken(TILE).usesRemaining).toBe(2);
        expect(BoardState.tileOfHero(hero.id)).toBe(TILE);
    });
});

describe('⭐ the game opens it', () => {
    it('opens when training completes', () => {
        const hero = qualifiedHero();
        const { result } = renderHook(() => useUIModals(engine));
        expect(result.current.dock.promotionOffer).toBeNull();

        act(() => { standingOffer(hero); });

        expect(result.current.dock.promotionOffer).toMatchObject({ tile: TILE, heroId: hero.id, jobId: 'fighter' });
        act(() => result.current.dock.closePromotion());
        expect(result.current.dock.promotionOffer).toBeNull();
    });

    it('⚠️ re-finds an unanswered offer when a save loads', () => {
        const hero = qualifiedHero();
        standingOffer(hero);
        const { result } = renderHook(() => useUIModals(engine));

        act(() => { EventBus.publish('game_loaded', { slot: 0 }); });

        expect(result.current.dock.promotionOffer).toMatchObject({ tile: TILE, heroId: hero.id });
    });

    it('⚠️ never re-asks about an offer the player declined', () => {
        const hero = qualifiedHero();
        standingOffer(hero);
        BoardPromotion.decline(TILE);

        expect(standingPromotionOffer(engine)).toBeNull();
        const { result } = renderHook(() => useUIModals(engine));
        act(() => { EventBus.publish('game_loaded', { slot: 0 }); });
        expect(result.current.dock.promotionOffer).toBeNull();
    });

    it('finds nothing — and does not throw — with no game in progress', () => {
        expect(standingPromotionOffer({})).toBeNull();
        expect(standingPromotionOffer({ BoardState: { occupiedTiles: () => { throw new Error('no board'); } }, BoardPromotion })).toBeNull();
    });
});
