// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setHintTarget } from '../ui/components/board/dragHints.js';
import { HeroDragMarks, MARK_SCREEN_PX, markArtSteps, markMatPx, FAIL_FILTER } from '../ui/components/board/DragMarks.jsx';
import { boardArtSteps } from '../ui/components/base/TokenSprite.jsx';
import { spriteTopMiddle } from '../ui/components/board/OrderDragLine.jsx';

/**
 * ⭐ How the drag hint marks are drawn: 1x art, the skill icon over its level, a failing mark
 * much darker, and the carried hero's marks centred over the Token's drawn sprite.
 */

registerItems({
    dm_pick: { id: 'dm_pick', name: 'dm_pick', type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', tool: { kind: 'pickaxe', tier: 1 } }
});
registerTokenTypes({
    dm_vein: {
        id: 'dm_vein', name: 'dm_vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 10, size: 1, sprite: 's_nature',
        needsTool: { kind: 'pickaxe', minTier: 1 },
        config: { skill: 'mining', skillRequired: 20, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    }
});

const hero = (id, level, equipment) => ({
    id, name: id, status: 'idle', level: 1, skills: { mining: { level, xp: 0 } }, hp: { current: 10, max: 10 },
    equipment, heldCopies: equipment.map(Boolean)
});

const h = React.createElement;
beforeEach(() => { GameState.initNew(); setHintTarget(null); });
afterEach(() => { cleanup(); act(() => setHintTarget(null)); });

describe('the marks', () => {
    it('draw at 1x off the mat; on the mat at half the Tokens\' step, whole, never below 1x', () => {
        expect(MARK_SCREEN_PX).toBe(32);
        expect(markArtSteps(1)).toBe(1);
        for (const fit of [0.3, 0.6, 0.9, 1, 1.4, 1.8, 2.2]) {
            const steps = markArtSteps(fit);
            expect(Number.isInteger(steps)).toBe(true);
            expect(steps).toBeGreaterThanOrEqual(1);
            expect(steps).toBeLessThanOrEqual(Math.max(1, boardArtSteps(fit) / 2));
            // Through the mat's transform a mark lands on whole pixels: steps x 32.
            expect(markMatPx(fit) * fit).toBeCloseTo(32 * steps, 6);
        }
        expect(markArtSteps(2)).toBe(2);
    });

    it('the skill mark is its icon with the level under it; a failing mark is drawn darker', () => {
        GameState.state.heroes = [hero('a', 3, ['dm_pick'])];
        const { container } = render(h(HeroDragMarks, { heroId: 'a', size: MARK_SCREEN_PX }));
        expect(container.querySelector('[data-drag-marks]')).toBeNull();
        act(() => setHintTarget({ id: 'v1', typeId: 'dm_vein', x: 0, y: 0 }));

        const skill = container.querySelector('[data-drag-mark-skill]');
        const [icon, level] = skill.children;
        expect(icon.getAttribute('data-drag-mark')).toBe('skill');
        expect(level.hasAttribute('data-drag-mark-level')).toBe(true);
        expect(level.textContent).toBe('3');
        expect(skill.className).toContain('flex-col');

        for (const mark of container.querySelectorAll('[data-drag-mark]')) {
            expect(mark.style.width).toBe('32px');
        }
        expect(icon.getAttribute('data-drag-mark-pass')).toBe('false');
        expect(icon.querySelector('img').style.filter).toBe(FAIL_FILTER);
        expect(Number(FAIL_FILTER.match(/^brightness\(([\d.]+)\)$/)[1])).toBeLessThan(0.5);
        const tool = container.querySelector('[data-drag-mark="tool"]');
        expect(tool.getAttribute('data-drag-mark-pass')).toBe('true');
        expect(tool.querySelector('img').style.filter).toBe('');
    });
});

describe('over the aimed Token', () => {
    const at = { x: 500, y: 300 };

    it('without the picture\'s opaque part: the middle of the art\'s top edge', () => {
        expect(spriteTopMiddle(at, 64)).toEqual({ x: 500, top: 268 });
        expect(spriteTopMiddle(at, 128)).toEqual({ x: 500, top: 236 });
    });

    it('over the opaque part of the picture, so a sprite drawn off-centre still gets the marks over its middle', () => {
        const bounds = { left: 0.5, top: 0.25, right: 1, bottom: 1 };
        expect(spriteTopMiddle(at, 64, bounds)).toEqual({ x: 516, top: 284 });
    });
});
