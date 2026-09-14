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
import { tileCentre } from '../config/boardGeometry.js';
import { tokenStartingUses, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
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
 * Geometry: 6×6, one tile step 160 u, default flag radius 400.
 */

registerTokenTypes({
    /** A worked Token with a blank skill — FP-47's case. */
    ft_ui_blank: {
        id: 'ft_ui_blank', name: 'Blank Bush', uses: 100, requiresHero: true,
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, inputs: [], outputs: [] }
    }
});

const C = (tile) => tileCentre(tile);

function hero(id, skills = { logging: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
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
        hero('h1', { logging: 50, mining: 50 }),
        hero('h2', { logging: 50 }),
        hero('fighter', { logging: 20, melee: 10 })
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
        expect(counting(() => Placement.placeHero('h1', 15))).toBe(1);
    });

    it('fires for a plant on bare ground and a pennant move, but not for an unchanged plant', () => {
        expect(counting(() => Flags.plant('h1', C(20), { skill: 'logging' }))).toBe(1);
        expect(counting(() => Flags.plant('h1', C(20), { skill: 'logging' }))).toBe(0);
        expect(counting(() => Placement.moveFlag('h1', 8))).toBe(1);
    });
});

describe('Flags.setSkill — the skill picker is a re-plant (FP-68)', () => {
    it('lets go of the claim, resets its progress, and chooses again with the new skill', () => {
        const forest = put(15, 'fixture_producer');         // logging
        put(13, 'fixture_producer_alt');                     // mining, just as near
        Flags.plant('h1', C(14), { skill: 'logging' });
        expect(BoardState.workTileOf('h1')).toBe(15);

        run(3000);
        expect(forest.cycleElapsedMs).toBeGreaterThan(0);

        const res = Flags.setSkill('h1', 'mining');
        expect(res.success).toBe(true);
        expect(BoardState.flagOf('h1').skill).toBe('mining');
        expect(forest.cycleElapsedMs).toBe(0);
        expect(BoardState.heroOfInstance(forest.id)).toBeNull();
        expect(BoardState.workTileOf('h1')).toBe(13);
    });

    it('refuses a skill the hero does not hold, and a hero with no flag', () => {
        Flags.plant('h2', C(14), { skill: 'logging' });
        expect(Flags.setSkill('h2', 'mining').success).toBe(false);
        expect(BoardState.flagOf('h2').skill).toBe('logging');
        expect(Flags.setSkill('h1', 'logging').success).toBe(false);
    });
});

describe('Flags.skillOptionsFor — what the picker lists', () => {
    it('omits Fight for a hero with no combat skill', () => {
        const options = Flags.skillOptionsFor('h1');
        expect(options.map(o => o.skill).sort()).toEqual(['logging', 'mining']);
        expect(options.some(o => o.skill === Flags.COMBAT_FLAG)).toBe(false);
    });

    it('adds one Fight row, last, for a hero holding a combat skill — and lists no combat skill itself', () => {
        const options = Flags.skillOptionsFor('fighter');
        expect(options.map(o => o.skill)).toEqual(['logging', Flags.COMBAT_FLAG]);
        expect(options[1].name).toBe('Fight');
    });
});

describe('dragging the pennant (FLAG) — Placement.moveFlag (FPP-3)', () => {
    it('keeps the flag skill on bare ground', () => {
        // Mining, not logging: h1's best skill is logging (a 50/50 tie broken
        // alphabetically), and a flag that lost its skill would be refilled
        // with exactly that (FPP-7) — which would hide a skill that was dropped.
        Flags.plant('h1', C(14), { skill: 'mining' });
        expect(Placement.moveFlag('h1', 20).success).toBe(true);
        expect(BoardState.flagOf('h1')).toMatchObject({ ...C(20), skill: 'mining' });
    });

    it('switches to a Token skill the hero holds, and keeps its own when the hero lacks it', () => {
        put(13, 'fixture_producer_alt');                     // mining
        Flags.plant('h1', C(20), { skill: 'logging' });
        Flags.plant('h2', C(20), { skill: 'logging' });

        Placement.moveFlag('h1', 13);
        expect(BoardState.flagOf('h1').skill).toBe('mining');

        Placement.moveFlag('h2', 13);
        expect(BoardState.flagOf('h2').skill).toBe('logging');
    });

    it('refuses a hero with no flag (a pennant always belongs to one)', () => {
        expect(Placement.moveFlag('h1', 20).success).toBe(false);
        expect(BoardState.flagOf('h1')).toBeNull();
    });
});

describe('dropping on the Dock recalls (dockRecall)', () => {
    it.each([
        ['a hero sprite from a Token', { kind: DRAG_KIND.HERO, heroId: 'h1', from: { tile: 15 } }],
        ['an idle hero beside their flag', { kind: DRAG_KIND.HERO, heroId: 'h1', from: { flag: true } }],
        ['a pennant', { kind: DRAG_KIND.FLAG, heroId: 'h1', skill: 'logging' }]
    ])('furls the flag for %s', (_label, payload) => {
        put(15, 'fixture_producer');
        Placement.placeHero('h1', 15);
        expect(BoardState.flagOf('h1')).not.toBeNull();

        expect(isRecallDrop(payload)).toBe(true);
        recallFromDrop(Placement, payload);

        expect(BoardState.flagOf('h1')).toBeNull();
        expect(BoardState.workTileOf('h1')).toBeNull();
    });

    it('is not a recall for a hero dragged out of the Dock itself (that is a reorder)', () => {
        Flags.plant('h1', C(20), { skill: 'logging' });
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
        Flags.plant('h1', C(14), { skill: 'logging' });
        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(Flags.skipsOfHero('h1')).toEqual([
            { instanceId: blank.id, reason: Flags.SKIP.NO_SKILL, typeId: 'ft_ui_blank', tile: 15 }
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
});
