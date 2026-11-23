// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { GameState } from '../state/GameState.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { TokenInspectPopup } from '../ui/components/board/TokenInspectPopup.jsx';
import { tailPicture, tailPlacement, TAIL_POINT, TAIL_ART_PX, TAIL_INSET_PX } from '../ui/components/board/cardTail.js';
import { takeRecipeListRequest } from '../ui/components/board/recipeFlip.js';
import { Board } from '../ui/components/board/Board.jsx';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { pickRecipe } from './fixtures/stations.js';
import { restHover } from './fixtures/hoverRest.js';

const h = React.createElement;

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The Token card's tail (a speech bubble's point on the card's edge, aimed at its Token) and
 * the recipe choice inside the card, a Foundation's building choice the same way.
 */

registerTokenTypes({
    tail_cabin: { id: 'tail_cabin', name: 'Tail Cabin', rarity: 'common', theme: 'fixture', uses: 1 },
    tail_foundation: {
        id: 'tail_foundation', name: 'Tail Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'tailwood', skill: 'construction' }
    }
});
registerRecipePools({
    construction: [{
        id: 'tail_build_cabin', name: 'Build Tail Cabin', levelRequirement: 1, foundationKinds: ['tailwood'], inputs: [],
        outputs: [{ tokenId: 'tail_cabin', chance: 100, minQty: 1, maxQty: 1 }], durationMs: 3000, xp: 1
    }]
}, { takeOver: false });

afterEach(() => cleanup());
beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
});

function put(typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, { x: 400, y: 300 });
    return instance;
}

describe('the tail picture', () => {
    it('is the speech tail: 7 across its base, a stepped point 4 out, one way per side of the Token', () => {
        expect(TAIL_POINT).toEqual({ top: 'down', bottom: 'up', right: 'left', left: 'right' });
        for (const point of ['down', 'up', 'left', 'right']) {
            const { cells } = tailPicture(point);
            expect(cells.edge.length + cells.fill.length).toBe(7 + 5 + 3 + 1);
        }
        const down = tailPicture('down');
        expect([down.w, down.h]).toEqual([9, 6]);
        expect([down.baseX, down.baseY]).toEqual([3, 0]);
        const right = tailPicture('right');
        expect([right.w, right.h]).toEqual([6, 9]);
        expect([right.baseX, right.baseY]).toEqual([0, 3]);
    });

    it('its shadow falls down-right and never inside the card', () => {
        // Pointing up, the card is below the base row (y > 3); pointing left, right of it (x > 3).
        expect(tailPicture('up').cells.shadow.every(([, y]) => y <= 3)).toBe(true);
        expect(tailPicture('left').cells.shadow.every(([x]) => x <= 3)).toBe(true);
        expect(tailPicture('down').cells.shadow.length).toBeGreaterThan(0);
        expect(tailPicture('down').uri).toContain('%23977316');
    });
});

describe('where the tail goes', () => {
    const card = { left: 100, top: 50, w: 300, h: 400 };
    const tokenAt = (cx, cy) => ({ left: cx - 32, top: cy - 32, width: 64, height: 64 });

    it('card above its Token: on the card\'s foot, pointing down, its base over the frame line', () => {
        const t = tailPlacement('top', card, tokenAt(250, 500));
        expect(t.point).toBe('down');
        expect(t.top).toBe(card.h - TAIL_ART_PX);
        // The base's middle pixel sits on the Token's middle.
        const mid = t.left + 3 * TAIL_ART_PX + TAIL_ART_PX / 2;
        expect(Math.abs(mid - 150)).toBeLessThanOrEqual(TAIL_ART_PX);
    });

    it('card below: on its top edge pointing up; right of the Token: its left edge pointing left', () => {
        const below = tailPlacement('bottom', card, tokenAt(250, 10));
        expect(below.point).toBe('up');
        expect(below.top + 3 * TAIL_ART_PX).toBe(0);
        const right = tailPlacement('right', card, tokenAt(60, 200));
        expect(right.point).toBe('left');
        expect(right.left + 3 * TAIL_ART_PX).toBe(0);
        const mid = right.top + 3 * TAIL_ART_PX + TAIL_ART_PX / 2;
        expect(Math.abs(mid - 150)).toBeLessThanOrEqual(TAIL_ART_PX);
        const left = tailPlacement('left', card, tokenAt(450, 200));
        expect(left.point).toBe('right');
        expect(left.left).toBe(card.w - TAIL_ART_PX);
    });

    it('follows the Token along the edge, kept clear of the chamfered corners', () => {
        const a = tailPlacement('top', card, tokenAt(200, 500));
        const b = tailPlacement('top', card, tokenAt(260, 500));
        expect(b.left - a.left).toBe(60);
        const far = tailPlacement('top', card, tokenAt(900, 500));
        expect(far.along).toBe(card.w - TAIL_INSET_PX);
        const near = tailPlacement('top', card, tokenAt(-400, 500));
        expect(near.along).toBe(TAIL_INSET_PX);
    });

    it('lands on the frame\'s art grid, and is nothing with no Token to aim at', () => {
        for (const cx of [201, 202, 203.5]) expect(tailPlacement('top', card, tokenAt(cx, 500)).left % TAIL_ART_PX).toBe(0);
        expect(tailPlacement('top', card, null)).toBeNull();
        expect(tailPlacement('top', { ...card, w: 0 }, tokenAt(200, 500))).toBeNull();
    });
});

describe('the popup draws its tail at the Token', () => {
    it('a card placed above its Token has a tail on its foot, and it follows the Token when it moves', () => {
        const station = put('fixture_kitchen');
        const el = document.createElement('div');
        el.setAttribute('data-token-id', station.id);
        // Near the screen's right edge, so the card is held in by the edge and the Token moves under it.
        let rect = { left: 1440, top: 700, right: 1504, bottom: 764, width: 64, height: 64, x: 1440, y: 700 };
        el.getBoundingClientRect = () => rect;
        document.body.appendChild(el);
        try {
            Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
            render(React.createElement(TokenInspectPopup, { typeId: 'fixture_kitchen', instanceId: station.id, anchorRect: rect, onClose: () => {} }));
            const popup = document.querySelector('[data-token-card-popup]');
            expect(popup.dataset.tokenCardPopup).toBe('top');
            const tail = () => document.querySelector('[data-card-tail]');
            expect(tail().dataset.cardTail).toBe('down');
            expect(tail().getAttribute('aria-hidden')).toBe('true');
            expect(tail().className).toContain('pointer-events-none');
            const leftAt = parseFloat(tail().style.left);
            const popupLeftAt = parseFloat(popup.style.left);

            rect = { ...rect, left: 1480, right: 1544, x: 1480 };
            act(() => { window.dispatchEvent(new Event('resize')); });
            expect(parseFloat(popup.style.left)).toBe(popupLeftAt);
            expect(parseFloat(tail().style.left) - leftAt).toBe(40);
            const popupLeft = parseFloat(popup.style.left);
            const mid = popupLeft + parseFloat(tail().style.left) + 3 * TAIL_ART_PX + TAIL_ART_PX / 2;
            // Aimed at the Token's middle (or as near as the corners allow).
            expect(Math.abs(mid - 1512)).toBeLessThanOrEqual(TAIL_ART_PX);
        } finally {
            el.remove();
        }
    });
});

describe('the recipe choice lives in the card', () => {
    it('a Foundation with nothing chosen opens on its building list; chosen, on its face with Change building', () => {
        GameState.state.heroes = [{ id: 'b', name: 'B', skills: { construction: { level: 99, xp: 0 } } }];
        const found = put('tail_foundation');
        const first = render(React.createElement(TokenCard, { typeId: 'tail_foundation', instanceId: found.id }));
        expect(first.container.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
        fireEvent.click(first.container.querySelector('[data-recipe-id="tail_build_cabin"]'));
        expect(BoardState.getTokenById(found.id).selectedRecipeId).toBe('tail_build_cabin');
        expect(first.container.querySelector('[data-token-card]').dataset.cardView).toBe('card');
        cleanup();

        const again = render(React.createElement(TokenCard, { typeId: 'tail_foundation', instanceId: found.id }));
        expect(again.container.querySelector('[data-token-card]').dataset.cardView).toBe('card');
        const change = again.container.querySelector('[data-card-change-recipe]');
        expect(change.textContent).toBe('Change building');
        fireEvent.click(change);
        expect(again.container.querySelector('[data-token-card]').dataset.cardView).toBe('recipes');
    });

    it('a Token with no recipe to choose opens on its face', () => {
        const producer = put('fixture_producer');
        const { container } = render(React.createElement(TokenCard, { typeId: 'fixture_producer', instanceId: producer.id }));
        expect(container.querySelector('[data-token-card]').dataset.cardView).toBe('card');
    });
});

describe('the gear does what a right-click does', () => {
    it('a station with a recipe: the gear opens its card on its usual face, no list asked for', () => {
        vi.useFakeTimers();
        try {
            resetMatTuning();
            const kitchen = pickRecipe(placeAt('fixture_kitchen', 600, 600), 'pooled_stew');
            const onInspectToken = vi.fn();
            const view = render(h(DeckDndProvider, null, h(Board, { onInspectToken, onClearInspect: () => {} })));
            const root = view.container.querySelector('[data-mat-board]');
            root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
            fireEvent.pointerMove(root, { clientX: kitchen.x, clientY: kitchen.y });
            restHover();
            const gear = view.container.querySelector(`[data-token-overlay="${kitchen.id}"] [data-station-gear] button`);
            expect(gear).not.toBeNull();
            fireEvent.click(gear);
            expect(onInspectToken).toHaveBeenCalledWith('fixture_kitchen', expect.anything(), kitchen.id);
            // Nothing waits to flip the card to its list: it opens on its face, with Change.
            expect(takeRecipeListRequest(kitchen.id)).toBe(false);
        } finally {
            clearMat();
            vi.useRealTimers();
        }
    });
});
