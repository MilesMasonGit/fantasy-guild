// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { ReachRing } from '../ui/components/board/CampReachRing.jsx';
import { TokenNameBadge, NAME_SHIMMER } from '../ui/components/board/TokenBadges.jsx';
import { ProblemLine } from '../ui/components/board/TokenCard.jsx';
import { REACH_DOT, REACH_DOT_PATHS, REACH_DOT_COLOUR, REACH_DOT_BACKING_PX } from '../ui/components/board/reachDot.js';
import { RING_GROW_MS } from '../ui/components/board/growRing.js';
import { clearMat } from './fixtures/mat.js';
import { manualFrames } from './fixtures/manualFrames.js';
import { restHover } from './fixtures/hoverRest.js';
import { SRC, readSource, codeOf, setScanTimeout } from './fixtures/sourceScan.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Marks on the mat (brief 830 D3, concept_playmat_declutter §11, §14): names and reach dots sit
 * on a see-through dark backing (the owner's pick, look A); a rainbow across a name's letters (look
 * F) is built and switched off in one place; nothing on the mat has a hover tooltip, and the
 * Token card says what is wrong instead.
 */

const h = React.createElement;
setScanTimeout();

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** The cells of a path made of `M{x} {y}h{n}v1h-{n}z` runs, as "x,y" strings. */
function cellsOf(d) {
    const out = new Set();
    for (const [, x, y, n] of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v1h-\d+z/g)) {
        for (let i = 0; i < Number(n); i++) out.add(`${Number(x) + i},${y}`);
    }
    return out;
}

describe('⭐ the reach dot’s dark backing', () => {
    it('covers every cell within two side-by-side steps of the dot, and none of the dot', () => {
        const dot = new Set();
        REACH_DOT.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') dot.add(`${x},${y}`); }));
        // Steps from the dot's shape, moving side by side (not corner to corner).
        const dist = new Map([...dot].map(c => [c, 0]));
        let edge = [...dot];
        for (let d = 1; d <= REACH_DOT_BACKING_PX; d++) {
            const next = [];
            for (const c of edge) {
                const [x, y] = c.split(',').map(Number);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const k = `${x + dx},${y + dy}`;
                    if (!dist.has(k)) { dist.set(k, d); next.push(k); }
                }
            }
            edge = next;
        }
        const expected = new Set([...dist].filter(([, d]) => d > 0).map(([c]) => c));
        expect(REACH_DOT_BACKING_PX).toBe(2);
        expect([...cellsOf(REACH_DOT_PATHS.backing)].sort()).toEqual([...expected].sort());
        expect(REACH_DOT_COLOUR.backing).toBe('var(--color-mat-backing)');
    });

    it('⭐ each dot draws its backing first, under its shadow and its colours', () => {
        const frames = manualFrames();
        const { container } = render(h(ReachRing, { ring: { x: 300, y: 300, r: 200, key: 'k' }, dots: [{ id: 't1', x: 320, y: 300 }] }));
        frames.run(RING_GROW_MS + 32);
        const dot = container.querySelector('[data-reach-dot="t1"]');
        expect(dot).not.toBeNull();
        const first = dot.firstElementChild;
        expect(first.hasAttribute('data-reach-dot-backing')).toBe(true);
        expect(first.getAttribute('fill')).toBe('var(--color-mat-backing)');
        expect(first.getAttribute('d')).toBe(REACH_DOT_PATHS.backing);
    });
});

describe('⭐ the name label', () => {
    it('sits on the see-through dark backing; the rainbow is off', () => {
        const { container } = render(h(TokenNameBadge, { name: 'Oak Tree', shown: true }));
        const span = container.querySelector('[data-token-name] span');
        expect(span.className).toContain('gi-name-backing');
        expect(NAME_SHIMMER).toBe(false);
        expect(span.className).not.toContain('gi-name-shimmer');
        expect(span.getAttribute('data-text')).toBeNull();
    });

    it('the backing and the rainbow are written once, in the style sheet, the rainbow paused while minimised', () => {
        const css = fs.readFileSync(path.resolve(SRC, 'tailwind.css'), 'utf8');
        expect(css).toMatch(/--color-mat-backing: rgba\(10, 8, 6, 0\.58\);/);
        expect(css).toMatch(/\.gi-name-backing \{\s*background: var\(--color-mat-backing\);/);
        expect(css).toMatch(/\.gi-name-shimmer::after \{[^}]*content: attr\(data-text\);[^}]*#ff4d4d[^}]*steps\(28\)/);
        expect(css).toMatch(/body\[data-paused\] \.gi-name-shimmer::after \{\s*animation-play-state: paused;/);
    });
});

describe('⭐ the Token card says what is wrong', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [];
        clearMat();
    });

    const put = (typeId, at = { x: 600, y: 500 }) => {
        const t = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
        Placement.placeTokenAt(t, at);
        return t;
    };

    it('the reason behind the ’!’, in its colour; nothing when nothing is wrong', () => {
        const t = put('fixture_consumer');
        const { container, rerender } = render(h(ProblemLine, { instanceId: t.id }));
        expect(container.querySelector('[data-card-block="problem"]')).toBeNull();
        t.alert = ALERT.NO_ROOM;
        rerender(h(ProblemLine, { instanceId: t.id }));
        const line = container.querySelector('[data-card-problem]');
        expect(line.getAttribute('data-card-problem')).toBe(ALERT.NO_ROOM);
        expect(line.textContent).toBe('No room for what it makes');
        expect(line.querySelector('span').style.color).toBe('var(--color-ui-red)');
        t.alert = ALERT.INPUTS;
        rerender(h(ProblemLine, { instanceId: t.id }));
        expect(container.querySelector('[data-card-problem]').textContent).toMatch(/^Needs /);
        expect(container.querySelector('[data-card-problem] span').style.color).toBe('var(--color-ui-gold)');
    });

    it('⭐ resting on an enemy shows no enemy card by the pointer', () => {
        vi.useFakeTimers();
        GameState.state.heroes = [];
        const e = put('fixture_enemy', { x: 700, y: 500 });
        const { container } = render(h(DndContext, null, h(MatBoard)));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });
        fireEvent.pointerMove(root, { clientX: e.x, clientY: e.y });
        restHover();
        expect(container.querySelector(`[data-token-overlay="${e.id}"] [data-token-name]`)).not.toBeNull();
        expect(document.body.querySelector('[data-enemy-card-tip], [data-tooltip]')).toBeNull();
    });
});

describe('⭐ no hover tooltip on the mat (guard)', () => {
    /** What the mat draws on and over its Tokens, heroes aside (off the mat panels keep theirs). */
    const MAT_FILES = [
        'ui/components/board/MatBoard.jsx', 'ui/components/board/MatToken.jsx', 'ui/components/board/TokenBubbles.jsx',
        'ui/components/board/TokenBadges.jsx', 'ui/components/board/ProblemMark.jsx', 'ui/components/board/Bubble.jsx',
        'ui/components/board/FlagLayer.jsx', 'ui/components/board/WorkBarLayer.jsx', 'ui/components/board/RecipeBubble.jsx',
        'ui/components/board/CampReachRing.jsx'
    ];

    it.each(MAT_FILES)('%s imports no tooltip and writes no title text', (file) => {
        const code = codeOf(readSource(`${SRC}/${file}`));
        expect(code).not.toMatch(/\b(Tooltip|FloatingTip|BubbleTip|EnemyCardTip|PassiveProductionTooltip|FlagTooltip)\b/);
        expect(code).not.toMatch(/\btitle=\{/);
    });

    it('the retired plates and tips are gone from the tree', () => {
        for (const gone of ['WorkPlateLayer.jsx', 'workPlate.js', 'IdlePlate.jsx', 'idlePlate.js', 'PassiveProductionTooltip.jsx']) {
            expect(fs.existsSync(path.resolve(SRC, 'ui/components/board', gone)), gone).toBe(false);
        }
    });
});
