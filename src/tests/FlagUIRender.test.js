// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { dockStatusLine, flagTooltip } from '../ui/components/board/flagText.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Free Playmat slice 1.5 — the flag UI as drawn: the idle mark, the reach
 * ring and the disallow mark. The engine hooks are in `FlagUI.test.js`. The
 * skill picker is gone since slice 1.5b: a flag has no skill.
 */

/**
 * The scene, in mat units. `BESIDE` and `SECOND` sit 160 u either side of
 * `TOKEN` — inside the live Near radius (164 u) — so a flag planted at `BESIDE`
 * can claim the Token at `TOKEN`. `BARE` is open ground with nothing in range.
 */
const TOKEN = { x: 400, y: 300 };
const BESIDE = { x: 240, y: 300 };
const BARE = { x: 1200, y: 800 };

const h = React.createElement;

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

/** Render inside the two providers every board component expects. */
const mount = (el) => render(
    h(DndContext, null, el)
);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        hero('h1', { forestry: 50, mining: 40 }),
        hero('fighter', { forestry: 20, melee: 10 })
    ];
});

describe('the idle mark (FP-29)', () => {
    it('draws no idle glow on a board hero whose Token is stuck', () => {
        const forest = put(TOKEN,'fixture_producer');
        Orders.orderAt('h1', TOKEN);
        expect(Flags.statusOf('h1').state).toBe('working');

        // A hero on a Token that cannot run gets no glow: the Token's own red
        // badge says it alone.
        forest.alert = ALERT.INPUTS;

        const { container } = mount(h(MatBoard));
        const drawn = container.querySelector('[data-board-hero="h1"]');
        expect(drawn).toBeTruthy();
        // Wave 5: the glow is a green outline now — and still not on a stuck hero.
        expect(drawn.getAttribute('data-outline')).toBeNull();
        expect(container.querySelector('.gi-glow-idle')).toBeNull();
    });

    it('keeps the working glow — as a green outline (Wave 5)', () => {
        put(TOKEN,'fixture_producer');
        Orders.orderAt('h1', TOKEN);

        const { container } = mount(h(MatBoard));
        const hero = container.querySelector('[data-board-hero="h1"]');
        expect(hero.getAttribute('data-outline')).toBe('work');
        expect(hero.className).not.toContain('gi-glow-active');
    });

    it('an idle flag is the job flag, has no chip, and its hero stands beside it at 128 px with no glow', () => {
        GameState.state.heroes[0].spriteId = 'hero_recruit_0';   // rehydration's default portrait
        Orders.orderAt('h1', BARE);                             // bare ground, nothing in range
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-flag-state')).toBe('idle');
        expect(flag.querySelector('[data-flag-mark]')).toBeTruthy();
        expect(flag.querySelector('[data-flag-idle-chip]')).toBeNull();

        // ⭐ The hero is drawn by MatBoard, like every hero in every state
        // (Hero Movement M2) — never by the flag layer.
        expect(container.querySelector('[data-board-hero="h1"]')).toBeNull();
        const board = mount(h(MatBoard)).container;
        const idle = board.querySelector('[data-board-hero="h1"]');
        expect(idle).not.toBeNull();
        // The drawn frame, animated sheet or still portrait alike, is 128 px —
        // an animated sheet's <img> is the whole 8-frame strip, so it is the
        // frame box that is measured, not the image.
        expect(idle.querySelector('div[style*="width: 128px"]')).not.toBeNull();
        expect(idle.getAttribute('data-outline')).toBeNull();
        expect(board.querySelector('.gi-glow-idle')).toBeNull();
    });

    it('a working flag shows no chip and leaves its hero to the Token', () => {
        put(TOKEN,'fixture_producer');
        Orders.orderAt('h1', BESIDE);
        expect(Flags.statusOf('h1').state).toBe('working');

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-flag-state')).toBe('working');
        expect(flag.querySelector('[data-flag-idle-chip]')).toBeNull();
    });

    it('⭐ two flags planted on one point simply overlap — no fan-out (FP-83)', () => {
        Orders.orderAt('h1', BARE);
        Orders.orderAt('fighter', BARE);
        const { container } = mount(h(FlagLayer));
        const a = container.querySelector('[data-flag="h1"]');
        const b = container.querySelector('[data-flag="fighter"]');

        expect(drawnPoint(b).x).toBe(drawnPoint(a).x);
        expect(drawnPoint(b).y).toBe(drawnPoint(a).y);
        // Later plantings draw in front; nothing is pushed aside or hidden.
        expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
        expect(container.querySelector('[data-flag-more]')).toBeNull();
    });
});

describe('no reach ring (hero orders, brief 260 O1)', () => {
    it('is never drawn: hovered, inspected or dragged, an order has no reach', () => {
        Orders.orderAt('h1', BESIDE);
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h1', inspectedHeroId: 'h1' }));
        expect(container.querySelector('[data-flag-ring]')).toBeNull();
    });
});

describe('the flag is just something to drag (brief 30 H4)', () => {
    /**
     * The work rules open from the hero bar; the flag carries no gear and no idle chip (the
     * hero's own 'No work in range.' line says it, `Callouts.test.js`).
     */
    const extras = () => document.body.querySelector('[data-flag-gear], [data-flag-idle-chip]');

    it('draws no gear and no idle chip, idle, hovered or inspected', () => {
        Orders.orderAt('h1', BARE);
        expect(Flags.statusOf('h1').state).toBe('idle');
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h1', inspectedHeroId: 'h1' }));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(extras()).toBeNull();
        fireEvent.mouseEnter(flag);
        expect(extras()).toBeNull();
        expect(container.querySelectorAll('button')).toHaveLength(1);
    });

    it('on hover shows the hard outline and the hero name, and clears them on leave', () => {
        GameState.state.heroes[0].name = 'Aela';
        Orders.orderAt('h1', BESIDE);
        const Hovering = () => {
            const [id, setId] = React.useState(null);
            return h(FlagLayer, { hoverHeroId: id, onHoverHero: setId });
        };
        const { container } = mount(h(Hovering));
        const flag = container.querySelector('[data-flag="h1"]');
        const tip = () => document.body.querySelector('[data-flag-tooltip="h1"]');
        expect(flag.querySelector('[data-sprite-outline]')).toBeNull();
        expect(tip()).toBeNull();

        fireEvent.mouseEnter(flag);
        expect(flag.querySelector('[data-sprite-outline="hover"]')).toBeTruthy();
        expect(flag.innerHTML).not.toContain('gi-glow');
        expect(tip().querySelector('.text-gi-gold').textContent).toBe('Aela');

        fireEvent.mouseLeave(flag);
        expect(flag.querySelector('[data-sprite-outline]')).toBeNull();
        expect(tip()).toBeNull();
    });
});

describe('the flag has no skill since slice 1.5b (FP-71)', () => {
    it('draws no skill disc, clicking it opens nothing, and its tooltip title is the hero name', () => {
        Orders.orderAt('h1', BARE);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.querySelector('[data-flag-skill]')).toBeNull();

        fireEvent.click(flag);
        expect(document.querySelector('[role="menu"]')).toBeNull();

        expect(flagTooltip('h1').title).toBe('h1');
    });
});

describe('the disallow mark on the mat (FP-35, FPP-8)', () => {
    it('a disallowed Token shows the red disallow sprite in its middle row on the mat (FB-33)', () => {
        const forest = put(TOKEN,'fixture_producer');
        Flags.setDisallowed(forest.id, true);

        const { container } = mount(h(MatBoard));
        const mark = container.querySelector('[data-tile-disallowed]');
        expect(mark.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_disallow_red.png');
        expect(mark.closest('[data-bubble-row="middle"]')).not.toBeNull();
        expect(mark.closest('[data-bubble="disallow"]')).not.toBeNull();
        expect(mark.textContent).not.toContain('⊘');
    });
});

describe('the roster status line (brief 260 O1)', () => {
    it('says what the hero is doing', () => {
        expect(dockStatusLine({ state: 'working', typeId: 'fixture_producer' })).toBe('Working: Fixture Producer');
        expect(dockStatusLine({ state: 'idle', order: 'spot' })).toBe('Idle here');
        expect(dockStatusLine({ state: 'idle', order: 'token', waitingFor: 'fixture_producer' })).toBe('Waiting for Fixture Producer');
        expect(dockStatusLine({ state: 'idle', order: 'spot', needsJob: true })).toBe('Needs a job');
        expect(dockStatusLine({ state: 'docked' })).toBe('At the Guild Hall');
    });
});
