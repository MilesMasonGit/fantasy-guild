import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as World from '../systems/world/World.js';
import { SETTLE_TEXT } from '../systems/world/Settling.js';
import { CELL_STATE } from '../systems/world/frontier.js';
import { ringLock, ringStarsOf, ringOfStar } from '../systems/world/ringStars.js';
import { normaliseStar, normaliseHallSky } from '../config/hallStars.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { starSentence, starAmount, RING_STAR_TEXT } from '../systems/progression/hallStarText.js';
import { outlineSpriteName } from '../ui/components/board/hallStarOutline.js';
import { worldView } from '../ui/components/atlas/worldView.js';
import { CELL_LOOK } from '../ui/components/atlas/worldMapLayout.js';
import { lockWords } from '../ui/components/atlas/WorldPanel.jsx';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A Guild Hall star per ring (brief 380 M4): ring 1 is open from the start; a ring star bought
 * to its first rank lets the guild settle its ring; a cell behind one reads as locked and says why;
 * a ring no star opens is left open.
 */

const SEED = 4242;
const RING_PRICE = 7;

/** A sky with a ring star for rings 2 and 3, chained from the Hall, each paid in Oak Wood. */
function ringSky() {
    const star = (ring, links) => ({
        id: `star_ring_${ring}`, constellation: 'compass', name: `Ring ${ring} Star`, description: 'Opens the next ring.',
        node: { x: -ring / 2, y: -0.2 }, links, opensRing: ring,
        ranks: [{ tier: ring - 1, price: [{ itemId: 'item_oak_wood', quantity: RING_PRICE * ring }], rules: [], lines: [] }]
    });
    return {
        constellations: { compass: { id: 'compass', name: 'The Compass', label: { x: -1, y: 0.2 } } },
        stars: { star_ring_2: star(2, ['hall']), star_ring_3: star(3, ['star_ring_2']) }
    };
}

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: SEED });
}

/** A hero at every level the price of `cell` asks, and its items in the Bank. */
function meet(cell) {
    GameState.state.progress.rosterLimit = 4;
    const hero = HeroManager.getAllHeroes().find(h => !h.isVillager) || HeroManager.addHero(generateHero());
    for (const { skill, level } of cell.requires.skills) {
        const xp = hero.skills[skill]?.xp || 0;
        if (xp < xpForLevel(level)) addXP(hero.id, skill, xpForLevel(level) - xp);
    }
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
}

const world = () => World.currentWorld();
const stateOf = (id) => World.cellStatesNow().get(id);
/** A ring-1 cell settled, and a ring-2 cell on the frontier beside it. */
function ringTwoFrontier() {
    const first = world().cells.find(c => c.ring === 1);
    meet(first);
    expect(World.settleCell(first.id).success).toBe(true);
    const next = world().cells.find(c => c.ring === 2 && stateOf(c.id) === CELL_STATE.FRONTIER);
    expect(next).toBeTruthy();
    return { first, next };
}

beforeEach(() => {
    resetMatTuning();
    registerHallSky(ringSky());
    newGame();
});
afterEach(() => {
    resetMatTuning();
    vi.restoreAllMocks();
});
afterAll(() => {
    registerHallSky(null);
});

describe('which ring a star opens, and whether a ring is open (pure)', () => {
    const sky = normaliseHallSky(ringSky()).stars;

    it('a star keeps a whole ring from 2 as opensRing; anything else is no ring star', () => {
        const raw = ringSky().stars.star_ring_2;
        expect(normaliseStar(raw).opensRing).toBe(2);
        for (const bad of [1, 0, -2, 2.5, 'x', null]) expect(normaliseStar({ ...raw, opensRing: bad }).opensRing, String(bad)).toBeUndefined();
        expect(normaliseStar({ ...raw, opensRing: '3' }).opensRing).toBe(3);
        expect(ringOfStar(normaliseStar({ ...raw, opensRing: undefined }))).toBeNull();
        expect([...ringStarsOf(sky).keys()]).toEqual([2, 3]);
    });

    it('ring 1 is always open; a ring is locked until a star that opens it has a rank', () => {
        const none = () => 0;
        expect(ringLock(1, sky, none)).toBeNull();
        expect(ringLock(0, sky, none)).toBeNull();
        expect(ringLock(2, sky, none)).toEqual({ ring: 2, stars: [{ id: 'star_ring_2', name: 'Ring 2 Star' }] });
        expect(ringLock(2, sky, (id) => (id === 'star_ring_2' ? 1 : 0))).toBeNull();
        expect(ringLock(3, sky, (id) => (id === 'star_ring_2' ? 1 : 0))).toMatchObject({ ring: 3 });
    });

    it('a ring no star opens is left open, and any one of two stars opens a ring', () => {
        expect(ringLock(4, sky, () => 0)).toBeNull();
        const two = [...sky, { ...sky[0], id: 'star_ring_2b', name: 'Other' }];
        expect(ringLock(2, two, () => 0).stars.map(s => s.id)).toEqual(['star_ring_2', 'star_ring_2b']);
        expect(ringLock(2, two, (id) => (id === 'star_ring_2b' ? 1 : 0))).toBeNull();
    });
});

describe('⭐ settling behind a ring star', () => {
    it('⭐ ring 1 settles with no star, as the tutorial does', () => {
        const first = world().cells.find(c => c.ring === 1);
        expect(World.ringLockOf(first)).toBeNull();
        meet(first);
        expect(World.settleCell(first.id).success).toBe(true);
    });

    it('⭐ a ring-2 cell on the frontier is refused until its star is bought, taking nothing; then it settles', () => {
        const { next } = ringTwoFrontier();
        meet(next);
        const ids = next.requires.items.map(i => i.itemId);
        const before = Object.fromEntries(ids.map(id => [id, InventoryManager.getItemCount(id)]));
        const regions = Object.keys(GameState.state.atlas.regions).length;

        const refused = World.settleCell(next.id);
        expect(refused).toMatchObject({ success: false, reason: SETTLE_TEXT.RING_LOCKED, lock: { ring: 2, stars: [{ id: 'star_ring_2', name: 'Ring 2 Star' }] } });
        expect(Object.fromEntries(ids.map(id => [id, InventoryManager.getItemCount(id)]))).toEqual(before);
        expect(Object.keys(GameState.state.atlas.regions)).toHaveLength(regions);

        InventoryManager.addItem('item_oak_wood', RING_PRICE * 2);
        expect(GuildUpgradeManager.purchase('star_ring_2')).toEqual({ success: true });
        expect(World.ringLockOf(next)).toBeNull();
        expect(World.settleCell(next.id).success).toBe(true);
    });

    it('the ring-3 star opens only once the ring-2 star is lit (the sky\'s neighbour rule)', () => {
        InventoryManager.addItem('item_oak_wood', 100);
        expect(GuildUpgradeManager.purchase('star_ring_3').success).toBe(false);
        expect(GuildUpgradeManager.purchase('star_ring_2').success).toBe(true);
        expect(GuildUpgradeManager.purchase('star_ring_3').success).toBe(true);
        const ringThree = world().cells.find(c => c.ring === 3);
        expect(World.ringLockOf(ringThree)).toBeNull();
    });

    it('a sky with no ring star leaves every ring open', () => {
        registerHallSky({ constellations: {}, stars: {} });
        try {
            const { next } = ringTwoFrontier();
            expect(World.ringLockOf(next)).toBeNull();
            meet(next);
            expect(World.settleCell(next.id).success).toBe(true);
        } finally {
            registerHallSky(ringSky());
        }
    });
});

describe('the world map reads a locked ring', () => {
    it('a frontier cell behind a ring star is darkened however rich the guild, with its star named; bought, it is ready', () => {
        const { next } = ringTwoFrontier();
        meet(next);
        let cell = worldView().cells.find(c => c.id === next.id);
        expect(cell.price.met).toBe(true);
        expect(cell.look).toBe(CELL_LOOK.DARK);
        expect(cell.lock).toEqual({ ring: 2, stars: [{ id: 'star_ring_2', name: 'Ring 2 Star' }] });
        expect(lockWords(cell.lock)).toBe("Light the Guild Hall's Ring 2 Star star to settle here");

        InventoryManager.addItem('item_oak_wood', RING_PRICE * 2);
        GuildUpgradeManager.purchase('star_ring_2');
        cell = worldView().cells.find(c => c.id === next.id);
        expect(cell.lock).toBeNull();
        expect(cell.look).toBe(CELL_LOOK.READY);
        // A settled cell carries no lock; ring 1 never does.
        for (const c of worldView().cells.filter(x => x.ring <= 1)) expect(c.lock, c.id).toBeNull();
    });
});

describe('the ring star in the Hall', () => {
    it('says what it does with no ring number, and wears a map', () => {
        const def = getUpgradeDef('star_ring_2');
        expect(def.star.opensRing).toBe(2);
        expect(starSentence(def)).toBe(RING_STAR_TEXT.sentence);
        expect(starSentence(def)).not.toMatch(/\d/);
        expect(starAmount(def, 0)).toBeNull();
        expect(starAmount(def, 1)).toBe(RING_STAR_TEXT.amount);
        expect(def.statLabel(1)).toBe(RING_STAR_TEXT.amount);
        expect(outlineSpriteName(def)).toBe('t_map_base');
        expect(outlineSpriteName({ ...def, star: { ...def.star, outline: 'i_feather' } })).toBe('i_feather');
    });
});
