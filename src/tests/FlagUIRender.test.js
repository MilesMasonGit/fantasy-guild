import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tileCentre } from '../config/boardGeometry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { BoardTile } from '../ui/components/board/BoardTile.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { dockStatusLine, flagTooltip } from '../ui/components/board/flagText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Free Playmat slice 1.5 — the flag UI as drawn: the idle mark, the reach
 * ring and the disallow toggle. The engine hooks are in `FlagUI.test.js`. The
 * skill picker is gone since slice 1.5b (FP-71): a flag has no skill.
 */

const C = (tile) => tileCentre(tile);
const h = React.createElement;

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId) {
    Placement.placeToken(tile, BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)));
    return BoardState.getToken(tile);
}

/** Render inside the two providers every board component expects. */
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
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
        hero('h1', { logging: 50, mining: 40 }),
        hero('fighter', { logging: 20, melee: 10 })
    ];
});

describe('the idle mark (FP-29)', () => {
    const tileWithHero = (heroIdle) => h(BoardTile, {
        index: 15,
        token: {
            typeId: 'fixture_producer', usesRemaining: 10, alert: null, size: 1,
            isAnchor: true, anchorTile: 15, heroId: 'h1', heroName: 'h1', heroIdle
        },
        heroName: 'h1'
    });

    it('draws no idle glow on a board hero who is not working', () => {
        const { container } = mount(tileWithHero(true));
        expect(container.querySelector('[data-board-hero="h1"]')).toBeTruthy();
        expect(container.querySelector('.gi-glow-idle')).toBeNull();
        expect(container.querySelector('.gi-glow-active')).toBeNull();
    });

    it('keeps the working glow', () => {
        const { container } = mount(tileWithHero(false));
        expect(container.querySelector('[data-board-hero="h1"]').className).toContain('gi-glow-active');
    });

    it('an idle flag shows a grey pennant with a "…" chip and its hero small beside it', () => {
        Flags.plant('h1', C(20));                             // bare ground, nothing in range
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(FlagLayer));
        const pennant = container.querySelector('[data-flag-pennant="h1"]');
        expect(pennant.getAttribute('data-flag-state')).toBe('idle');
        expect(pennant.querySelector('[data-flag-idle-chip]')).toBeTruthy();
        expect(container.querySelector('[data-flag-idle-hero="h1"]')).toBeTruthy();
    });

    it('a working flag shows no chip and leaves its hero to the Token tile', () => {
        put(15, 'fixture_producer');
        Flags.plant('h1', C(14));
        expect(Flags.statusOf('h1').state).toBe('working');

        const { container } = mount(h(FlagLayer));
        const pennant = container.querySelector('[data-flag-pennant="h1"]');
        expect(pennant.getAttribute('data-flag-state')).toBe('working');
        expect(pennant.querySelector('[data-flag-idle-chip]')).toBeNull();
        expect(container.querySelector('[data-flag-idle-hero="h1"]')).toBeNull();
    });

    it('fans two flags on one tile 12 px apart', () => {
        Flags.plant('h1', C(20));
        Flags.plant('fighter', C(20));
        const { container } = mount(h(FlagLayer));
        const a = container.querySelector('[data-flag-pennant="h1"]');
        const b = container.querySelector('[data-flag-pennant="fighter"]');
        expect(parseFloat(b.style.left) - parseFloat(a.style.left)).toBe(12);
        expect(b.style.top).toBe(a.style.top);
    });
});

describe('the reach ring (FP-64, A-4)', () => {
    beforeEach(() => { Flags.plant('h1', C(14)); });

    const ring = (container) => container.querySelector('[data-flag-ring="h1"]');

    it('is not drawn at rest', () => {
        const { container } = mount(h(FlagLayer));
        expect(container.querySelector('[data-flag-ring]')).toBeNull();
    });

    it('is drawn at the flag with the live radius while its hero is hovered', () => {
        setMatTuning('flagRadius', 450);
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        expect(ring(container).getAttribute('r')).toBe('450');
        expect(ring(container).getAttribute('cx')).toBe(String(C(14).x));
    });

    it('is drawn while the hero is inspected', () => {
        const { container } = mount(h(FlagLayer, { inspectedHeroId: 'h1' }));
        expect(ring(container)).toBeTruthy();
    });

    it('follows a drag to where the flag would land', () => {
        const { container } = mount(h(FlagLayer, { dragRing: { heroId: 'h1', ...C(30) } }));
        expect(ring(container).getAttribute('cy')).toBe(String(C(30).y));
    });

    it('hovering the pennant itself draws it', () => {
        let hovered = null;
        const { container, rerender } = mount(h(FlagLayer, { onHoverHero: (id) => { hovered = id; } }));
        fireEvent.mouseEnter(container.querySelector('[data-flag-pennant="h1"]'));
        expect(hovered).toBe('h1');
        rerender(h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null, h(FlagLayer, { hoverHeroId: hovered }))));
        expect(ring(container)).toBeTruthy();
    });
});

describe('the pennant has no skill since slice 1.5b (FP-71)', () => {
    it('draws no skill disc, clicking it opens nothing, and its tooltip title is the hero name', () => {
        Flags.plant('h1', C(20));
        const { container } = mount(h(FlagLayer));
        const pennant = container.querySelector('[data-flag-pennant="h1"]');
        expect(pennant.querySelector('[data-flag-skill]')).toBeNull();

        fireEvent.click(pennant);
        expect(document.querySelector('[role="menu"]')).toBeNull();

        expect(flagTooltip('h1').title).toBe('h1');
    });
});

describe('"Heroes may work this" (FP-35, FPP-8)', () => {
    const toggle = (container) => container.querySelector('[data-heroes-may-work]');

    it('unticking marks the Token disallowed and the hero working it leaves', async () => {
        const forest = put(15, 'fixture_producer');
        Flags.plant('h1', C(15));
        expect(BoardState.workTileOf('h1')).toBe(15);

        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', tile: 15 }));
        const box = toggle(container).querySelector('input[type="checkbox"]');
        expect(box.checked).toBe(true);

        await act(async () => { fireEvent.click(box); });

        expect(Flags.isDisallowed(forest)).toBe(true);
        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(toggle(container).getAttribute('data-heroes-may-work')).toBe('no');
    });

    it('is offered only for a board Token a hero could work', () => {
        put(15, 'fixture_passive');
        put(16, 'fixture_enemy');
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_passive', tile: 15 })).container)).toBeNull();
        cleanup();
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_enemy', tile: 16 })).container)).toBeTruthy();
        cleanup();
        // Not opened from the board (the Vault, the Tray): no toggle.
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_enemy' })).container)).toBeNull();
    });

    it('a disallowed Token shows a dim ⊘ on its tile', () => {
        const { container } = mount(h(BoardTile, {
            index: 15,
            token: { typeId: 'fixture_producer', usesRemaining: 10, alert: null, size: 1, isAnchor: true, anchorTile: 15, disallowed: true }
        }));
        expect(container.querySelector('[data-tile-disallowed]').textContent).toContain('⊘');
    });
});

describe('the Dock tab status line (FPP-15)', () => {
    it('says what the hero is doing', () => {
        expect(dockStatusLine({ state: 'working', typeId: 'fixture_producer' })).toBe('Working: Fixture Producer');
        expect(dockStatusLine({ state: 'waiting' })).toBe('Waiting');
        expect(dockStatusLine({ state: 'idle' })).toBe('Idle at flag');
        expect(dockStatusLine({ state: 'docked' })).toBe('Idle in Guild');
    });
});
