import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { SKIP_HINT, skipHint } from '../ui/components/board/boardConstants.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Free Playmat slice 1.5 — the engine hooks and plain helpers the flag UI
 * stands on. The React pieces are pinned in `FlagUIRender.test.js`.
 *
 * Geometry: 6×6, one tile step 160 u. ⚠️ Laid out on the old flag radius
 * (400 u), set in `beforeEach`; it ships at 240 u.
 */

registerTokenTypes({
    /** A worked Token with a blank skill's case. */
    ft_ui_blank: {
        id: 'ft_ui_blank', name: 'Blank Bush', uses: 100, requiresHero: true,
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, inputs: [], outputs: [] }
    }
});

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * a lattice of mat points 160 u apart, inside the 400 u flag radius set below.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** Which spot the Token a hero works stands on, or null. */
function workTileOf(heroId) {
    const instance = BoardState.getTokenById(BoardState.workTokenOf(heroId));
    if (!instance) return null;
    const col = Math.round((instance.x - 400) / 160);
    const row = Math.round((instance.y - 200) / 160);
    return row * 6 + col;
}

function hero(id, skills = { forestry: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        hero('h1', { forestry: 50, mining: 50 }),
        hero('h2', { forestry: 50 }),
        hero('fighter', { forestry: 20, melee: 10 })
    ];
    GameState.state.inventory.maxSlots = 50;
});

describe('hero_deployed is published by every new order (slice 1.5)', () => {
    function counting(fn) {
        let n = 0;
        const unsub = EventBus.subscribe('hero_deployed', () => { n++; });
        try { fn(); } finally { unsub(); }
        return n;
    }

    it('fires exactly once for a hero dropped on a Token', () => {
        put(15, 'fixture_producer');
        expect(counting(() => Orders.orderAt('h1', C(15)))).toBe(1);
    });

    it('fires for an order to bare ground and a pennant move, but not for an unchanged order', () => {
        expect(counting(() => Orders.orderAt('h1', C(20)))).toBe(1);
        expect(counting(() => Orders.orderAt('h1', C(20)))).toBe(0);
        expect(counting(() => Orders.orderAt('h1', C(8)))).toBe(1);
    });
});

/** Dragging a pennant lands through `Orders.orderAt`, the one route an order changes by. */
describe('dragging the pennant (FLAG) gives a new order (FP-71)', () => {
    it('onto bare ground: a spot, with no skill written on it', () => {
        Orders.orderAt('h1', C(14));
        expect(Orders.orderAt('h1', C(20)).success).toBe(true);
        expect(BoardState.flagOf('h1')).toEqual({ ...C(20), spot: true, plantedAt: expect.any(Number) });
    });

    it('on a Token, the hero works it if they hold its skill, and not otherwise', () => {
        put(13, 'fixture_producer_alt');                     // mining
        Orders.orderAt('h1', C(20));
        Orders.orderAt('h2', C(20));

        Orders.orderAt('h1', C(13));                  // h1 holds mining
        expect(workTileOf('h1')).toBe(13);

        Placement.recallHeroById('h1');
        Orders.orderAt('h2', C(13));                  // h2 holds only forestry
        expect(workTileOf('h2')).toBeNull();
    });
});

describe('Flags.skipsOfHero — the pennant hover lines', () => {
    it('lists what the order passed over, with the Token: here, one another hero works', () => {
        const busy = put(16, 'fixture_producer');
        Orders.orderAt('h2', C(16));
        expect(workTileOf('h2')).toBe(16);
        Orders.orderAt('h1', C(16));
        expect(workTileOf('h1')).toBeNull();
        expect(Flags.skipsOfHero('h1')).toEqual([
            { instanceId: busy.id, reason: Flags.SKIP.CLAIMED, typeId: 'fixture_producer' }
        ]);
    });
});

describe('Flags.isHeroWorkable — where the disallow toggle is offered', () => {
    it('is true for a worked Token and an enemy, false for a passive or blank-skill Token', () => {
        expect(Flags.isHeroWorkable(put(1, 'fixture_producer'))).toBe(true);
        expect(Flags.isHeroWorkable(put(2, 'fixture_enemy'))).toBe(true);
        expect(Flags.isHeroWorkable(put(3, 'fixture_passive'))).toBe(false);
        expect(Flags.isHeroWorkable(put(4, 'ft_ui_blank'))).toBe(false);
    });
});

describe('Flags.setDisallowed — the engine holds the rule', () => {
    it('refuses to disallow a Token no hero works, and says why', () => {
        const passive = put(3, 'fixture_passive');
        const result = Flags.setDisallowed(passive.id, true);
        expect(result).toEqual({ success: false, reason: Flags.NO_HERO_WORKS });
        expect(Flags.isDisallowed(passive)).toBe(false);
        expect(Flags.disallowRefusalOf(passive)).toBe(Flags.NO_HERO_WORKS);
    });

    it('disallows a Token a hero works', () => {
        const producer = put(1, 'fixture_producer');
        expect(Flags.disallowRefusalOf(producer)).toBeNull();
        expect(Flags.setDisallowed(producer.id, true)).toEqual({ success: true });
        expect(Flags.isDisallowed(producer)).toBe(true);
    });

    it('always lets a disallowed Token be allowed again, workable or not', () => {
        const passive = put(3, 'fixture_passive');
        passive.disallowed = true;
        expect(Flags.setDisallowed(passive.id, false)).toEqual({ success: true });
        expect(Flags.isDisallowed(passive)).toBe(false);
    });
});

describe('every skip reason the engine can record has hover text', () => {
    /**
     * Derived from the engine, not listed by hand: `Flags.SKIP` holds the
     * reasons only flags record, and every `ALERT` value is a reason
     * `WorkCheck` or promotion can return. A new reason fails here until it
     * has a sentence.
     */
    const REASONS = [...Object.values(Flags.SKIP), ...Object.values(ALERT)];

    it.each(REASONS)('"%s" has its own sentence', (reason) => {
        expect(SKIP_HINT[reason], `no hover text for skip reason "${reason}"`).toBeTruthy();
    });

    it('names the hero holding a claimed Token', () => {
        expect(skipHint(Flags.SKIP.CLAIMED, { holder: 'Aria' })).toBe('being worked by Aria');
        expect(skipHint(Flags.SKIP.NO_SKILL)).toBe('names no skill');
    });
});
