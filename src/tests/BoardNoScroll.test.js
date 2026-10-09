// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { Board } from '../ui/components/board/Board.jsx';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **The mat never scrolls.** The mat is fitted to its cell's whole box, padding included, so
 * on a tall window it overhangs the cell by up to the padding (measured: 30 px down, 25 px
 * across at 1600 × 1000). A clipping box that can still scroll was scrolled by the browser
 * whenever something on the mat took focus while partly outside it (React hands focus back to
 * a pressed flag or hero after a drag), and the whole mat jumped up under the top bar until
 * the next reload. The cell clips without being a scroll container.
 */
describe('⭐ the mat\'s cell clips its overhang and cannot be scrolled', () => {
    beforeEach(() => { GameState.initNew(); clearMat(); });
    afterEach(() => cleanup());

    it('the box the mat is fitted into clips (overflow: clip), never hides (a scroll container)', () => {
        const { container } = render(
            React.createElement(EngineContext.Provider, { value: { GameState, EventBus } },
                React.createElement(DndContext, null, React.createElement(Board)))
        );
        const mat = container.querySelector('[data-board-origin]');
        const cell = mat.parentElement.parentElement;
        expect(cell.querySelector('[data-board-origin]')).toBe(mat);
        expect(cell.className.split(/\s+/)).toContain('overflow-clip');
        expect(cell.className.split(/\s+/)).not.toContain('overflow-hidden');
    });
});
