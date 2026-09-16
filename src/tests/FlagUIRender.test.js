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
import { ALERT } from '../systems/board/boardEvents.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
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
 *
 * Since slice 1.6c-2 the board these draw on is `MatBoard`, which draws every
 * Token and hero **at its mat point, by instance id** — there are no tiles to
 * hand a projected `token` prop to any more, so these mount the real mat over
 * real board state.
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
    it('draws no idle glow on a board hero whose Token is stuck', () => {
        const forest = put(15, 'fixture_producer');
        Flags.plant('h1', C(15));
        expect(Flags.statusOf('h1').state).toBe('working');

        // A hero on a Token that cannot run gets no glow: the Token's own red
        // badge says it alone (slice 1.5, FP-29).
        forest.alert = ALERT.INPUTS;

        const { container } = mount(h(MatBoard));
        const drawn = container.querySelector('[data-board-hero="h1"]');
        expect(drawn).toBeTruthy();
        expect(drawn.className).not.toContain('gi-glow-active');
        expect(container.querySelector('.gi-glow-idle')).toBeNull();
    });

    it('keeps the working glow', () => {
        put(15, 'fixture_producer');
        Flags.plant('h1', C(15));

        const { container } = mount(h(MatBoard));
        expect(container.querySelector('[data-board-hero="h1"]').className).toContain('gi-glow-active');
    });

    it('an idle flag keeps its colour, has a "…" chip, and its hero stands beside it at 128 px with no glow', () => {
        GameState.state.heroes[0].spriteId = 'hero_recruit_0';   // rehydration's default portrait
        Flags.plant('h1', C(20));                             // bare ground, nothing in range
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-flag-state')).toBe('idle');
        expect(flag.getAttribute('data-flag-colour')).not.toBe('base');
        expect(flag.querySelector('img').getAttribute('src')).toContain(`hero_flag_${flag.getAttribute('data-flag-colour')}.png`);
        expect(flag.querySelector('[data-flag-idle-chip]').textContent).toContain('…');

        const idle = container.querySelector('[data-flag-idle-hero="h1"]');
        expect(idle.style.width).toBe('128px');
        expect(idle.querySelector('img').style.width).toBe('128px');
        expect(container.querySelector('.gi-glow-idle')).toBeNull();
        expect(container.querySelector('.gi-glow-active')).toBeNull();
    });

    it('a working flag shows no chip and leaves its hero to the Token', () => {
        put(15, 'fixture_producer');
        Flags.plant('h1', C(14));
        expect(Flags.statusOf('h1').state).toBe('working');

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-flag-state')).toBe('working');
        expect(flag.querySelector('[data-flag-idle-chip]')).toBeNull();
        expect(container.querySelector('[data-flag-idle-hero="h1"]')).toBeNull();
    });

    it('⭐ two flags planted on one point simply overlap — no fan-out (FP-83)', () => {
        Flags.plant('h1', C(20));
        Flags.plant('fighter', C(20));
        const { container } = mount(h(FlagLayer));
        const a = container.querySelector('[data-flag="h1"]');
        const b = container.querySelector('[data-flag="fighter"]');

        expect(b.style.left).toBe(a.style.left);
        expect(b.style.top).toBe(a.style.top);
        // Later plantings draw in front; nothing is pushed aside or hidden.
        expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
        expect(container.querySelector('[data-flag-more]')).toBeNull();
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

    it('hovering the flag itself draws it', () => {
        let hovered = null;
        const { container, rerender } = mount(h(FlagLayer, { onHoverHero: (id) => { hovered = id; } }));
        fireEvent.mouseEnter(container.querySelector('[data-flag="h1"]'));
        expect(hovered).toBe('h1');
        rerender(h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null, h(FlagLayer, { hoverHeroId: hovered }))));
        expect(ring(container)).toBeTruthy();
    });
});

describe('the flag has no skill since slice 1.5b (FP-71)', () => {
    it('draws no skill disc, clicking it opens nothing, and its tooltip title is the hero name', () => {
        Flags.plant('h1', C(20));
        const opened = [];
        const unsub = EventBus.subscribe('ui:open_flag_rules', (p) => opened.push(p));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.querySelector('[data-flag-skill]')).toBeNull();

        fireEvent.click(flag);
        unsub();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        // Rules open only from the gear (FPP-20), never from the flag itself.
        expect(opened).toEqual([]);

        expect(flagTooltip('h1').title).toBe('h1');
    });
});

describe('"Heroes may work this" (FP-35, FPP-8)', () => {
    const toggle = (container) => container.querySelector('[data-heroes-may-work]');

    it('unticking marks the Token disallowed and the hero working it leaves', async () => {
        const forest = put(15, 'fixture_producer');
        Flags.plant('h1', C(15));
        expect(BoardState.workTokenOf('h1')).toBe(forest.id);

        const { container } = mount(h(TokenInspection, { typeId: 'fixture_producer', instanceId: forest.id }));
        const box = toggle(container).querySelector('input[type="checkbox"]');
        expect(box.checked).toBe(true);

        await act(async () => { fireEvent.click(box); });

        expect(Flags.isDisallowed(forest)).toBe(true);
        expect(BoardState.workTokenOf('h1')).toBeNull();
        expect(toggle(container).getAttribute('data-heroes-may-work')).toBe('no');
    });

    it('is offered only for a board Token a hero could work', () => {
        const passive = put(15, 'fixture_passive');
        const enemy = put(16, 'fixture_enemy');
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_passive', instanceId: passive.id })).container)).toBeNull();
        cleanup();
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_enemy', instanceId: enemy.id })).container)).toBeTruthy();
        cleanup();
        // Not opened from the board (the Vault, the Tray): no toggle.
        expect(toggle(mount(h(TokenInspection, { typeId: 'fixture_enemy' })).container)).toBeNull();
    });

    it('a disallowed Token shows a dim ⊘ on the mat', () => {
        const forest = put(15, 'fixture_producer');
        Flags.setDisallowed(forest.id, true);

        const { container } = mount(h(MatBoard));
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
