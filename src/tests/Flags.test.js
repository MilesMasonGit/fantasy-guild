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
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Orders claim the work: a hero sent to a Token works only it (hero orders, brief 260).
 *
 * ⚠️ Laid out on Near 272 u, which `beforeEach` sets explicitly.
 */

registerTokenTypes({
    /** A worked Token with a blank skill's case. */
    ft_blank: {
        id: 'ft_blank', name: 'Blank Bush', uses: 100, requiresHero: true,
        config: { skill: '', skillRequired: 1, cycleTimeMs: 12000, inputs: [], outputs: [] }
    },
    /** Worked with a skill cut from the game: every hero holds every other skill, so no hero holds this. */
    ft_cut_skill: {
        id: 'ft_cut_skill', name: 'Snare', uses: 100, requiresHero: true,
        config: { skill: 'trapping', skillRequired: 1, cycleTimeMs: 12000, inputs: [], outputs: [] }
    },
    /**
     * A forestry Token that needs coal — stuck for a fixable reason. Coal, not
     * wood: the fixture Forests drop wood on the floor, which would feed it.
     */
    ft_hungry: {
        id: 'ft_hungry', name: 'Hungry Mill', uses: 100, requiresHero: true,
        config: {
            skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'fixture_glowcap', quantity: 1, chance: 100 }]
        }
    }
});

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * This is a lattice of mat points 160 u apart — the step the old board had — so
 * every distance these scenarios turn on is the one they were written for: a
 * side neighbour 160 u, a diagonal 226 u, two steps 320 u, three steps 480 u.
 * The numbers below are shorthand for spots on that lattice, nothing more.
 *
 * ⚠️ The rows start at y = 200 so that the lowest one used here still leaves a
 * Token's art circle fully inside the 1126 u mat.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

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

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeTokenAt(instance, C(tile));
    return instance;
}

const sendTo = (heroId, tile) => Orders.orderAt(heroId, C(tile));
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('nearRadius', 272);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1'), hero('h2'), hero('h3')];
    GameState.state.inventory.maxSlots = 50;
});

describe('an order onto a Token the hero cannot work is refused (FP-47, FP-60, FP-71)', () => {
    // Rewritten with classless heroes: a hero the game reads holds every skill it has, so the skill
    // a hero lacks is a cut one.
    it('a blank-skill Token is nothing to work; a skill the hero lacks is unskilled', () => {
        const blank = put(15, 'ft_blank');
        const mine = put(13, 'ft_cut_skill');              // trapping: cut, so no hero holds it

        expect(sendTo('h1', 15)).toMatchObject({ success: false, reason: 'Nothing to work here', instanceId: blank.id });
        expect(Flags.orderRefusal('h1', blank)).toEqual({ reason: Flags.ORDER_NOTHING });
        expect(sendTo('h1', 13)).toMatchObject({ success: false, instanceId: mine.id });
        expect(Flags.orderRefusal('h1', mine)).toEqual({ reason: ALERT.UNSKILLED });
        expect(BoardState.flagOf('h1')).toBeNull();
    });

    it('a passive Token is nothing to work', () => {
        const passive = put(15, 'fixture_passive');
        expect(sendTo('h1', 15)).toMatchObject({ success: false, reason: 'Nothing to work here', instanceId: passive.id });
    });

    it('a Token the hero is too low for is refused, and leaves no red mark (FP-48)', () => {
        GameState.state.heroes = [hero('h1', { mining: 5 })];
        const gated = put(15, 'fixture_gated');            // wants mining 25
        expect(sendTo('h1', 15).success).toBe(false);
        expect(Flags.orderRefusal('h1', gated)).toEqual({ reason: ALERT.ACCESS });
        run(2000);
        expect(workTileOf('h1')).toBeNull();
        expect(gated.alert ?? null).toBeNull();
    });
});

// Rewritten with classless heroes: the Promotes rule is retired, so a Promotion Token is nothing a
// hero works, and sending one there is refused.
describe('a Promotion Token is nothing to work (FP-61 retired with jobs)', () => {
    it('sending a hero to it is refused, and they work nothing', () => {
        const academy = put(20, 'fixture_promotion');
        expect(sendTo('h1', 20)).toMatchObject({ success: false, reason: 'Nothing to work here', instanceId: academy.id });
        expect(Flags.orderRefusal('h1', academy)).toEqual({ reason: Flags.ORDER_NOTHING });
        expect(workTileOf('h1')).toBeNull();
    });
});

describe('one hero per Token (FP-25)', () => {
    it('a second hero sent to a worked Token skips it as claimed and waits beside it', () => {
        const forest = put(15, 'fixture_producer');
        sendTo('h1', 15);
        sendTo('h2', 15);

        expect(workTileOf('h1')).toBe(15);
        expect(workTileOf('h2')).toBeNull();
        expect(Flags.skipsOf(forest.id)).toEqual([{ heroId: 'h2', reason: Flags.SKIP.CLAIMED }]);
        expect(Flags.waitingOf('h2')).toEqual({ instanceId: forest.id, kind: 'busy' });
    });
});

describe('order of orders, and claims are sticky', () => {
    it('the earlier order claims first when two heroes are sent to one Token in the same pass', () => {
        const forest = put(15, 'fixture_producer');
        // Written straight to storage so both claim in the same pass.
        BoardState.setFlag('h1', { ...C(15), plantedAt: 5, pinnedTo: forest.id });
        BoardState.setFlag('h2', { ...C(15), plantedAt: 2, pinnedTo: forest.id });
        Flags.markDirty();
        Flags.assign(0);

        expect(workTileOf('h2')).toBe(15);
        expect(workTileOf('h1')).toBeNull();

        put(14, 'fixture_producer');     // a free Token beside them: not h1's order
        Flags.markDirty();
        Flags.assign(0);

        expect(workTileOf('h2')).toBe(15);
        expect(workTileOf('h1')).toBeNull();
    });
});

describe('⭐ leaving resets progress; a moved Token keeps it (FP-68)', () => {
    it('a worked Token moved 3 steps away keeps its hero and its progress', () => {
        const forest = put(14, 'fixture_producer');
        sendTo('h1', 14);
        run(5000);
        const progress = forest.cycleElapsedMs;
        expect(progress).toBeGreaterThan(0);

        Placement.moveTokenTo(forest.id, C(17));           // 480 u away
        run(100);

        expect(workTileOf('h1')).toBe(17);
        expect(forest.cycleElapsedMs).toBeGreaterThanOrEqual(progress);
    });

    it('a new order zeroes the Token left behind', () => {
        const forest = put(14, 'fixture_producer');
        sendTo('h1', 14);
        run(5000);
        sendTo('h1', 0);
        expect(forest.cycleElapsedMs).toBe(0);
    });

    it('a recall zeroes it', () => {
        const forest = put(14, 'fixture_producer');
        sendTo('h1', 14);
        run(5000);
        Placement.recallHeroById('h1');
        expect(forest.cycleElapsedMs).toBe(0);
    });

    it('letting go by themselves zeroes it', () => {
        const forest = put(14, 'fixture_producer');
        sendTo('h1', 14);
        run(5000);
        GameState.state.heroes[0].skills.forestry.level = 0;  // now below skillRequired 1
        run(300);

        expect(workTileOf('h1')).toBeNull();
        expect(forest.cycleElapsedMs).toBe(0);
    });
});

describe('fixable problems (FP-69, FPP-1, FPP-2, FPP-5)', () => {
    it('a worked Token that runs out of an input keeps its hero, silently, and keeps its red alert', () => {
        InventoryManager.addItem('item_coal', 10);
        const hungry = put(14, 'ft_hungry');
        put(16, 'fixture_producer');       // free work nearby: not this hero's order
        sendTo('h1', 14);
        run(1000);
        expect(workTileOf('h1')).toBe(14);

        InventoryManager.removeItem('item_coal', 10);
        run(3000);
        expect(workTileOf('h1')).toBe(14);
        expect(hungry.alert).toBe(ALERT.INPUTS);
        expect(NotificationSystem.warning).not.toHaveBeenCalled();

        InventoryManager.addItem('item_coal', 10);
        run(1500);
        expect(workTileOf('h1')).toBe(14);
        expect(hungry.alert ?? null).toBeNull();
    });
});

describe('⭐ a hero whose Token is gone for good needs a job (SP-55, 9.2)', () => {
    it('takes no other work, and is idle with the "needs a job" mark', () => {
        const first = put(14, 'fixture_producer', 1);
        put(20, 'fixture_producer');
        sendTo('h1', 14);
        expect(workTileOf('h1')).toBe(14);

        Charges.destroyToken(first, { heroId: 'h1' });
        Flags.assign(0);

        expect(workTileOf('h1')).toBeNull();
        expect(Flags.statusOf('h1')).toMatchObject({ state: 'idle', needsJob: true });
        expect(BoardRunner.isHeroIdle('h1')).toBe(true);
    });
});

describe('dropping a hero gives an order, which carries no skill (FP-71)', () => {
    it('dropped on an enemy, a hero who can fight fights it (FP-74)', () => {
        GameState.state.heroes = [hero('h1', { forestry: 50, melee: 30 })];
        put(14, 'fixture_enemy');
        Orders.orderAt('h1', C(14));
        expect(BoardState.flagOf('h1')).toEqual({ ...C(14), plantedAt: expect.any(Number), pinnedTo: idAt(14) });
        expect(BoardState.workerOf(idAt(14))).toBe('h1');
    });

    it('dropped on bare ground, they idle there: a spot with no skill', () => {
        Orders.orderAt('h1', C(14));
        expect(BoardState.flagOf('h1')).toEqual({ ...C(14), plantedAt: expect.any(Number), spot: true });
        expect(BoardState.flagOf('h1').skill).toBeUndefined();
    });
});

describe('⭐ no rebuild storms', () => {
    it('publishes zero HERO_MOVED over 100 stable ticks', () => {
        put(0, 'fixture_producer');
        put(35, 'fixture_producer');
        sendTo('h1', 0);
        sendTo('h2', 35);
        sendTo('h3', 18);          // bare ground: idle there

        let moved = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, () => { moved++; });
        try { run(10000); } finally { off?.(); }

        expect(moved).toBe(0);
    });
});
