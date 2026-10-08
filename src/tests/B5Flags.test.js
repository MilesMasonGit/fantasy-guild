// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Charges from '../systems/board/Charges.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { pinRefusedLineFor } from '../ui/components/board/heroBubbles.js';
import { flagTooltip } from '../ui/components/board/flagText.js';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { pinnedFlagPoint, POLE_BASE } from '../ui/components/board/flagGeometry.js';
import { EngineContext } from '../ui/context/EngineContext';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **B5 — flags: no hitbox, pinned flags** (Token Lifecycle
 * feedback).
 */

registerTokenTypes({
    /** A spawner — no hero works it itself (B5 spawner pin). */
    b5_spawner: {
        id: 'b5_spawner', name: 'B5 Grove', uses: null,
        spawner: { spawns: [{ typeId: 'fixture_producer', weight: 1 }], allowance: 1, intervalMs: 99999999, upkeep: [] }
    }
});

const P = (x, y) => ({ x, y });

function hero(id, skills = { forestry: 50, mining: 5 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(point, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    const res = Placement.placeTokenAt(instance, point);
    expect(res.success).toBe(true);
    return instance;
}

/**
 * The player's drop of `heroId`'s flag at `point` — the one route that pins: a
 * hero from the Dock the first time, their planted flag after that.
 */
const dropFlag = (heroId, point) => dropOnMat(
    BoardState.flagOf(heroId)
        ? { kind: DRAG_KIND.FLAG, heroId, from: { flag: true } }
        : { kind: DRAG_KIND.HERO, heroId },
    point
);
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const worked = (heroId) => BoardState.workTokenOf(heroId);

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1'), hero('h2')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// no hitbox
// ---------------------------------------------------------------------------

describe('FB-44 — a flag has no footprint', () => {
    it('a new Token dropped on a flag lands exactly there, not nudged', () => {
        Flags.plant('h1', P(900, 500));
        Flags.plant('h2', P(900, 500));
        const instance = BoardState.createTokenInstance('fixture_producer', 10);
        const res = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: 'fixture_producer', usesRemaining: 10 }, P(900, 500));
        expect(res.success).toBe(true);
        expect([res.x, res.y, res.nudged]).toEqual([900, 500, false]);
        expect(instance).toBeTruthy();
    });

    it('a Token on the mat moved onto a flag lands exactly there, and the flag does not move', () => {
        const t = put(P(500, 500), 'fixture_producer_alt');
        Flags.plant('h1', P(1000, 700));
        const res = dropOnMat({ kind: DRAG_KIND.TOKEN, typeId: t.typeId, from: { instanceId: t.id } }, P(1000, 700));
        expect(res.success).toBe(true);
        expect([t.x, t.y]).toEqual([1000, 700]);
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 1000, y: 700 });
    });

    it('spot-finding never counts flags: a crowd of flags changes no answer', () => {
        const before = MatPlacement.findSpotAnywhere('fixture_producer', P(700, 600));
        Flags.plant('h1', P(700, 600));
        Flags.plant('h2', P(720, 610));
        const after = MatPlacement.findSpotAnywhere('fixture_producer', P(700, 600));
        expect(after).toEqual(before);
        expect([after.x, after.y]).toEqual([700, 600]);
    });

    it('a flag dropped on a Token never moves the Token', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(610, 590));
        dropFlag('h2', P(640, 640));
        expect([t.x, t.y]).toEqual([600, 600]);
    });
});

// ---------------------------------------------------------------------------
// pinned flags
// ---------------------------------------------------------------------------

describe('FB-45 — dropping a flag on a Token the hero can work pins it', () => {
    it('pins, and the hero works only that Token — past a nearer one and a better priority', () => {
        const pinned = put(P(600, 600), 'fixture_producer');           // forestry
        const nearer = put(P(760, 600), 'fixture_producer');           // forestry, nearer the hero later
        const better = put(P(600, 760), 'fixture_producer_alt');       // mining, priority 1
        Flags.setRule('h1', 'mining', { priority: 1 });

        const res = dropFlag('h1', P(620, 610));                        // inside the art circle
        expect(res.success).toBe(true);
        expect(res.pinnedTo).toBe(pinned.id);
        expect(BoardState.flagOf('h1').pinnedTo).toBe(pinned.id);
        expect(Flags.pinnedIdOf('h1')).toBe(pinned.id);
        // A pinned flag stands on its Token's centre.
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 600, y: 600 });
        expect(worked('h1')).toBe(pinned.id);

        // Cycles end ( looks for better work) — still only the pinned Token.
        run(40000);
        expect(worked('h1')).toBe(pinned.id);
        expect([nearer.id, better.id]).not.toContain(worked('h1'));
    });

    it('a pinned hero never seeks other work, even when their Token cannot run', () => {
        // A station with no recipe chosen — fixable, so the pin is allowed.
        const station = put(P(600, 600), 'fixture_kitchen');
        put(P(760, 600), 'fixture_producer');
        GameState.state.heroes = [hero('h1', { forestry: 50, cooking: 50 })];

        const res = dropFlag('h1', P(600, 600));
        expect(res.pinnedTo).toBe(station.id);
        run(3000);
        // Nothing else in radius is taken: the hero waits by their Token.
        expect(worked('h1')).not.toBe(BoardState.tokensAtPoint(760, 600)[0].id);
        expect(Flags.statusOf('h1').state).not.toBe('working');
    });

    it('a plain plant (not the player\'s drop) stays an area flag', () => {
        const t = put(P(600, 600), 'fixture_producer');
        Placement.plantFlagAt('h1', P(600, 600));
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        expect(worked('h1')).toBe(t.id);
    });
});

describe('B5 bad pin — a Token the hero cannot work', () => {
    it('level too low: an area flag at the drop point, and the bubble says why', () => {
        const gated = put(P(600, 600), 'fixture_gated');                // mining 25; hero has 5
        const other = put(P(760, 600), 'fixture_producer');
        const refused = vi.fn();
        const off = EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, refused);

        const res = dropFlag('h1', P(610, 605));
        off();
        expect(res.pinnedTo).toBeNull();
        expect(res.pinRefused).toBe(ALERT.ACCESS);
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 610, y: 605 });
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        expect(refused).toHaveBeenCalledWith(expect.objectContaining({ heroId: 'h1', instanceId: gated.id, reason: ALERT.ACCESS }));
        // The same words the hero says when stuck on it (speech bubble line 7).
        expect(pinRefusedLineFor(gated.id, ALERT.ACCESS)).toMatch(/level is too low to work Fixture Gated\.$/);
        // An area flag: the hero works something else in range.
        expect(worked('h1')).toBe(other.id);
    });

    it('skill not held: an area flag, and the bubble says so', () => {
        const alchemy = put(P(600, 600), 'fixture_consumer');
        const refused = vi.fn();
        const off = EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, refused);
        const res = dropFlag('h1', P(600, 600));
        off();
        expect(res.pinRefused).toBe(ALERT.UNSKILLED);
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        expect(refused).toHaveBeenCalledTimes(1);
        expect(pinRefusedLineFor(alchemy.id, ALERT.UNSKILLED)).toMatch(/^I don’t have the .* skill to work /);
    });

    it('B5 spawner pin: a spawner is never pinned, and nothing is said', () => {
        const grove = put(P(600, 600), 'b5_spawner');
        const refused = vi.fn();
        const off = EventBus.subscribe(BOARD_EVENTS.PIN_REFUSED, refused);
        const res = dropFlag('h1', P(600, 600));
        off();
        expect(Flags.pinRefusal('h1', grove)).toMatchObject({ silent: true });
        expect(res.pinnedTo).toBeNull();
        expect(res.pinRefused).toBeNull();
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        expect(refused).not.toHaveBeenCalled();
    });
});

describe('B5 pin follows — a moved Token carries its flag', () => {
    it('the flag moves with the Token and the hero stays on it', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        const res = Placement.moveTokenTo(t.id, P(1100, 800));
        expect(res.success).toBe(true);
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 1100, y: 800, pinnedTo: t.id });
        run(200);
        expect(worked('h1')).toBe(t.id);
        // The hero's body stands beside the Token's new spot.
        const at = HeroMotion.heroPointOf('h1');
        expect(Math.abs(at.y - 800)).toBeLessThan(1);
        expect(Math.abs(Math.abs(at.x - 1100) - (artRadiusOf(t.typeId) + HeroMotion.STAND_GAP))).toBeLessThan(1);
    });
});

describe('TL-17 — the pinned Token is used up: the flag stays as an area flag', () => {
    it('depleted: the flag stands at its last spot, unpinned, and the hero takes other work', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        Placement.moveTokenTo(t.id, P(700, 650));
        const other = put(P(860, 650), 'fixture_producer');
        run(200);
        expect(worked('h1')).toBe(t.id);

        Charges.destroyToken(t);
        run(200);
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 700, y: 650 });
        expect(worked('h1')).toBe(other.id);
    });

    it('removed for good: unpinned the same way', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        Placement.removePlacedToken(t.id);
        run(100);
        expect(Flags.pinnedIdOf('h1')).toBeNull();
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 600, y: 600 });
    });

    it('transformed into something else (a fresh instance): unpinned, never re-pinned to the new Token', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        const next = EffectActions.transformInstance(t, 'fixture_producer_alt');
        expect(next).toBeTruthy();
        run(100);
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
        // An area flag again: the hero works whatever suits them in range — here the new Token (mining).
        expect(worked('h1')).toBe(next.id);
    });
});

describe('un-pinning and re-pinning by dragging', () => {
    it('dropping a pinned flag on empty mat un-pins it', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        expect(Flags.pinnedIdOf('h1')).toBe(t.id);
        dropFlag('h1', P(1200, 300));
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 1200, y: 300 });
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
    });

    it('dropping it on another workable Token re-pins it there', () => {
        const a = put(P(600, 600), 'fixture_producer');
        const b = put(P(900, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        expect(Flags.pinnedIdOf('h1')).toBe(a.id);
        dropFlag('h1', P(905, 610));
        expect(Flags.pinnedIdOf('h1')).toBe(b.id);
        expect(worked('h1')).toBe(b.id);
    });
});

describe('save and load', () => {
    async function saveAndReload() {
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });
    }

    it('a pin survives a save and load, and the hero still works only it', async () => {
        const t = put(P(600, 600), 'fixture_producer');
        const nearer = put(P(700, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        await saveAndReload();
        expect(BoardState.flagOf('h1').pinnedTo).toBe(t.id);
        run(200);
        expect(worked('h1')).toBe(t.id);
        expect(worked('h1')).not.toBe(nearer.id);
    });

    it('an older save (no pinnedTo) loads as an area flag', async () => {
        put(P(600, 600), 'fixture_producer');
        Flags.plant('h1', P(600, 600));
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(saved.state.board.flags.h1.pinnedTo).toBeUndefined();
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });
        expect(Flags.pinnedIdOf('h1')).toBeNull();
        run(100);
        expect(worked('h1')).toBeTruthy();
    });

    it('a saved pin naming a Token no longer on the mat lapses to an area flag', async () => {
        put(P(600, 600), 'fixture_producer');
        Flags.plant('h1', P(600, 600));
        BoardState.flagOf('h1').pinnedTo = 'tok_missing';
        await saveAndReload();
        run(100);
        expect(BoardState.flagOf('h1').pinnedTo).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// The drawn flag
// ---------------------------------------------------------------------------

describe('a pinned flag on the screen', () => {
    const h = React.createElement;
    const mount = (el) => render(
        h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
    );

    it('is drawn on its Token, marked data-flag-pinned, with no reach ring, and says "Working only"', () => {
        const t = put(P(600, 600), 'fixture_producer');
        dropFlag('h1', P(600, 600));
        const { container } = mount(h(FlagLayer, { inspectedHeroId: 'h1' }));
        const el = container.querySelector('[data-flag="h1"]');
        expect(el.getAttribute('data-flag-pinned')).toBe(t.id);
        const at = pinnedFlagPoint(t, artRadiusOf(t.typeId));
        expect(drawnPoint(el).x + POLE_BASE.x).toBeCloseTo(at.x);
        expect(drawnPoint(el).y + POLE_BASE.y).toBeCloseTo(at.y);
        expect(container.querySelector('[data-flag-ring="h1"]')).toBeNull();
        expect(flagTooltip('h1').pin).toBe('Working only Fixture Producer');
    });

    it('an area flag has no data-flag-pinned and keeps its ring', () => {
        put(P(600, 600), 'fixture_producer');
        Flags.plant('h1', P(900, 900));
        const { container } = mount(h(FlagLayer, { inspectedHeroId: 'h1' }));
        expect(container.querySelector('[data-flag="h1"]').hasAttribute('data-flag-pinned')).toBe(false);
        expect(container.querySelector('[data-flag-ring="h1"]')).not.toBeNull();
        expect(flagTooltip('h1').pin).toBeNull();
    });
});
