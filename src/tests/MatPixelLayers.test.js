// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EngineContext } from '../ui/context/EngineContext';
import { Board } from '../ui/components/board/Board.jsx';
import { GuildHallBoard } from '../ui/components/board/GuildHallBoard.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A sprite on the mat is always drawn the one crisp way.** The mat is scaled to fit the
 * window, so a Token stands at a fractional screen position. Painted into the mat's own layer it
 * lands crisp. But Chrome puts every compositor-run animation on a layer of its own, and then
 * every Token drawn after it must be a layer too ("overlap"); Chrome draws those layers at their
 * fractional offset by resampling, so the Tokens go soft and shift a pixel, and snap back when
 * the animation ends. Any -1 floater, landing hop, Hall flash, spawn or walking enemy behind
 * them did it. `will-change: contents` on the scaled board keeps every animation inside it on
 * the main thread, so no layer ever splits the mat's sprites off.
 * Chrome's layers cannot be seen from jsdom (`npm run bench:crisp` checks them in Chrome): these
 * guard the property that keeps them away.
 */

const h = React.createElement;
const STYLESHEET = resolve(__dirname, '../styles/main.css');

let sheet;
beforeAll(() => {
    sheet = document.createElement('style');
    sheet.textContent = readFileSync(STYLESHEET, 'utf8');
    document.head.appendChild(sheet);
});
afterAll(() => sheet.remove());

beforeEach(() => { GameState.initNew(); InventoryManager.init(); clearMat(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const engine = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));

/** The element that scales a board to fit: it carries the board's `scale(…)` transform. */
function scaledBoardOf(container) {
    const el = container.querySelector('[data-board-origin]');
    expect(el, 'the board origin').toBeTruthy();
    expect(el.style.transform).toMatch(/^scale\(/);
    return el;
}

describe('⭐ no animation on the mat is composited on its own layer', () => {
    it('the mat, the element that scales it, keeps its animations on the main thread', () => {
        const { container } = render(engine(h(Board)));
        expect(getComputedStyle(scaledBoardOf(container)).willChange).toBe('contents');
    });

    it('so does the Guild Hall web, the other scaled pixel board', () => {
        const { container } = render(engine(h(GuildHallBoard)));
        expect(getComputedStyle(scaledBoardOf(container)).willChange).toBe('contents');
    });

    it('nothing on the mat asks for a layer of its own', () => {
        placeAt('fixture_producer', 400, 400);
        placeAt('fixture_producer_alt', 520, 640);
        const { container } = render(engine(h(Board)));
        const mat = scaledBoardOf(container);
        expect(mat.querySelectorAll('[data-token-art]').length).toBe(2);
        for (const el of mat.querySelectorAll('*')) {
            const wc = el.style.willChange;
            if (wc) expect(wc, el.outerHTML.slice(0, 120)).toBe('contents');
        }
    });
});
