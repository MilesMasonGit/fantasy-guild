import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
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
import { isRecallDrop, recallFromDrop } from '../ui/components/dock/dockRecall.js';
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
 * (400 u), set in `beforeEach`; it has shipped at 164 u.
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
    setMatTuning('flagRadius', 400);
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

describe('hero_deployed is published by planting a flag (slice 1.5)', () => {
    function counting(fn) {
        let n = 0;
        const unsub = EventBus.subscribe('hero_deployed', () => { n++; });
        try { fn(); } finally { unsub(); }
        return n;
    }

    it('fires exactly once for a hero dropped on a Token', () => {
        put(15, 'fixture_producer');
        expect(counting(() => Placement.plantFlagAt('h1', C(15)))).toBe(1);
    });

    it('fires for a plant on bare ground and a pennant move, but not for an unchanged plant', () => {
        expect(counting(() => Flags.plant('h1', C(20)))).toBe(1);
        expect(counting(() => Flags.plant('h1', C(20)))).toBe(0);
        expect(counting(() => Placement.plantFlagAt('h1', C(8)))).toBe(1);
    });
});

/**
 * ⚠️ `Placement.moveFlag` went with the index adapters in slice 1.6d-2. Dragging
 * a pennant lands through `plantFlagAt`, which is the one route a flag moves by
 * — so these say the same things through it. The third case, that `moveFlag`
 * refused a hero with no flag planted, pinned that adapter's own guard and went
 * with it: planting is always allowed.
 */
describe('dragging the pennant (FLAG) just moves the point (FP-71)', () => {
    it('moves the flag to the spot, with no skill written on it', () => {
        Flags.plant('h1', C(14));
        expect(Placement.plantFlagAt('h1', C(20)).success).toBe(true);
        expect(BoardState.flagOf('h1')).toEqual({ ...C(20), plantedAt: expect.any(Number) });
    });

    it('on a Token, the hero works it if they hold its skill, and not otherwise', () => {
        put(13, 'fixture_producer_alt');                     // mining
        Flags.plant('h1', C(20));
        Flags.plant('h2', C(20));

        Placement.plantFlagAt('h1', C(13));                  // h1 holds mining
        expect(workTileOf('h1')).toBe(13);

        Placement.recallHeroById('h1');
        Placement.plantFlagAt('h2', C(13));                  // h2 holds only forestry
        expect(workTileOf('h2')).toBeNull();
    });
});

describe('dropping on the Dock recalls (dockRecall)', () => {
    // Since slice 1.5b-ii a hero picked up on the board drags their FLAG, so
    // every recall drop is a FLAG payload — these are the three shapes the board
    // produces (`BoardTile`'s hero, `FlagLayer`'s idle hero, the flag).
    it.each([
        ['a hero on a Token (drags the flag)', { kind: DRAG_KIND.FLAG, heroId: 'h1', from: { hero: true } }],
        ['an idle hero beside their flag (drags the flag)', { kind: DRAG_KIND.FLAG, heroId: 'h1', from: { flag: true, hero: true } }],
        ['the flag itself', { kind: DRAG_KIND.FLAG, heroId: 'h1', from: { flag: true } }]
    ])('furls the flag for %s', (_label, payload) => {
        put(15, 'fixture_producer');
        Placement.plantFlagAt('h1', C(15));
        expect(BoardState.flagOf('h1')).not.toBeNull();

        expect(isRecallDrop(payload)).toBe(true);
        recallFromDrop(Placement, payload);

        expect(BoardState.flagOf('h1')).toBeNull();
        expect(workTileOf('h1')).toBeNull();
    });

    it('is not a recall for a hero dragged out of the Dock itself (that is a reorder)', () => {
        Flags.plant('h1', C(20));
        const payload = { kind: DRAG_KIND.HERO, heroId: 'h1', from: { dock: true } };
        expect(isRecallDrop(payload)).toBe(false);
        recallFromDrop(Placement, payload);
        expect(BoardState.flagOf('h1')).not.toBeNull();
    });
});

describe('Flags.skipsOfHero — the pennant hover lines', () => {
    it('lists what the flag passed over, nearest first, with the Token', () => {
        const blank = put(15, 'ft_ui_blank');
        put(16, 'fixture_producer');
        Flags.plant('h1', C(14));
        expect(workTileOf('h1')).toBe(16);
        expect(Flags.skipsOfHero('h1')).toEqual([
            { instanceId: blank.id, reason: Flags.SKIP.NO_SKILL, typeId: 'ft_ui_blank' }
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

    it('names the hero whose rules switched a skill off (FPP-18)', () => {
        expect(skipHint(Flags.SKIP.RULE_OFF, { hero: 'Aria' })).toBe('off in Aria’s rules');
        expect(skipHint(Flags.SKIP.RULE_OFF)).toBe('off in the hero’s rules');
    });
});
