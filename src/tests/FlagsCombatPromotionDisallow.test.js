import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardPromotion from '../systems/board/BoardPromotion.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as Managers from '../systems/board/Managers.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { tileCentre } from '../config/boardGeometry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getPromotionCost, getPromotionGateSkills } from '../config/registries/jobRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { isCombatSkill } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
/** What a defeat costs is `DefeatPenalties.test.js`'s business; here it just names a loss. */
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => ['Sword'])
}));

/**
 * ⭐ Free Playmat slice 1.4c — combat flags, promotion offers, disallow.
 *
 * Geometry: 6×6, one tile step is 160 u. From tile 14, tile 15 is 160 u away,
 * 16 is 320, 17 is 480; tile 0 is 452 away.
 *
 * ⚠️ Laid out on the old reaches — flag radius 400 u, Near 272 u (a Manager on a
 * diagonal) — so `beforeEach` sets both. Both ship at 164 u since FP-75.
 * Since FP-71 a flag has no skill: "fighting" is just planting a hero who can
 * fight near an enemy, with nothing better in range.
 */

registerTokenTypes({
    /** A Manager for the Promotion fixture, for the last-charge case. */
    ft_academy_manager: {
        id: 'ft_academy_manager', name: 'Academy Steward', tokenType: 'manager',
        uses: null, manages: ['fixture_promotion']
    }
});

const C = (tile) => tileCentre(tile);

/** A hero who holds a combat skill, and so can fight. */
function fighter(id, { level = 50, hp = 100 } = {}) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: hp, max: 100 };
    hero.skills.melee = { level, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = level; });
    return hero;
}

/** A Recruit: no combat skill at all. */
function recruit(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    return hero;
}

/** A hero the Promotion fixture would make a Fighter. */
function qualified(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    const cost = getPromotionCost('fighter');
    for (const skill of getPromotionGateSkills('fighter')) {
        if (!hero.skills[skill]) hero.skills[skill] = { xp: 0, level: 0 };
        hero.skills[skill].level = cost.skillLevel;
    }
    return hero;
}

/** A plain logger, as in `Flags.test.js`. */
function logger(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
}

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

const fightAt = (heroId, tile) => Flags.plant(heroId, C(tile));
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const reasons = (instance) => Flags.skipsOf(instance.id).map(s => s.reason);

/** Tick until the hero's enemy has taken damage; returns the fight. */
function untilDamaged(heroId) {
    for (let i = 0; i < 600; i++) {
        run(100);
        const fight = BoardCombat.fightOfHero(heroId);
        if (fight && fight.combat.enemyHp.current < fight.combat.enemyHp.max) return fight;
    }
    throw new Error('the enemy never took damage');
}

/** Tick the real board until a Promotion Token offers; returns the offers. */
function train(ms = 40000) {
    const offers = [];
    const off = EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, d => offers.push(d));
    try {
        for (let t = 0; t < ms && !offers.length; t += 1000) BoardRunner.tick(1000);
    } finally {
        off?.();
    }
    return offers;
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    setMatTuning('nearRadius', 272);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [fighter('h1'), fighter('h2')];
    GameState.state.inventory.maxSlots = 50;
});

// ---------------------------------------------------------------------------

describe('⭐ combat flags roam their radius (FP-32)', () => {
    it('fights the nearest enemy in range, then the next once the first is cleared out', () => {
        put(16, 'fixture_enemy');                 // 320 u
        const near = put(15, 'fixture_enemy', 1); // 160 u, one kill and it is gone

        fightAt('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(15);

        for (let i = 0; i < 600 && BoardState.findTokenById(near.id); i++) run(100);
        expect(BoardState.getToken(15)).toBeNull();
        run(1000);

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(BoardCombat.fightOfHero('h1')?.tile).toBe(16);
    });

    it('never claims an enemy outside the radius', () => {
        put(3, 'fixture_enemy');                  // 480 u from tile 0
        fightAt('h1', 0);
        run(1000);
        expect(BoardState.workTileOf('h1')).toBeNull();
    });

    it('skips a disallowed enemy as disallowed (FP-35)', () => {
        const near = put(15, 'fixture_enemy');
        put(16, 'fixture_enemy');
        Flags.setDisallowed(15, true);

        fightAt('h1', 14);

        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(reasons(near)).toEqual([Flags.SKIP.DISALLOWED]);
    });

    it('skips an enemy another hero holds as claimed (FP-25)', () => {
        const bear = put(15, 'fixture_enemy');
        fightAt('h1', 14);
        fightAt('h2', 14);

        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(BoardState.workTileOf('h2')).toBeNull();
        expect(Flags.skipsOf(bear.id)).toEqual([{ heroId: 'h2', reason: Flags.SKIP.CLAIMED }]);
    });

    it('a hero who cannot fight skips every enemy as unskilled, with no red mark (FP-60)', () => {
        GameState.state.heroes = [recruit('r1')];
        const a = put(15, 'fixture_enemy');
        const b = put(16, 'fixture_enemy');

        fightAt('r1', 14);
        run(2000);

        expect(BoardState.workTileOf('r1')).toBeNull();
        expect(reasons(a)).toEqual([ALERT.UNSKILLED]);
        expect(reasons(b)).toEqual([ALERT.UNSKILLED]);
        expect(a.alert ?? null).toBeNull();
        expect(b.alert ?? null).toBeNull();
        expect(BoardCombat.getFight(15)).toBeNull();
    });

    it('keeps its enemy through the rest after a kill, even when a nearer one appears (FP-57)', () => {
        put(16, 'fixture_enemy');
        fightAt('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(16);
        const nearer = put(15, 'fixture_enemy');

        const kills = [];
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, p => { if (p.outcome === 'victory') kills.push(p); });
        try {
            for (let i = 0; i < 600 && !kills.length; i++) run(100);
            run(100);                             // inside the post-kill rest
        } finally {
            off?.();
        }

        expect(kills.length).toBeGreaterThan(0);
        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(BoardState.heroOfInstance(nearer.id)).toBeNull();
    });

    it('a cleared-out camp waits for its Manager, then fights the restock (FP-70)', () => {
        put(21, 'fixture_enemy_manager');          // 226 u from the camp
        const camp = put(14, 'fixture_enemy', 1);
        TokenBank.deposit(BoardState.createTokenInstance('fixture_enemy', 20));
        fightAt('h1', 14);
        expect(BoardState.workTileOf('h1')).toBe(14);

        for (let i = 0; i < 600 && BoardState.getToken(14); i++) run(100);
        expect(BoardState.getToken(14)).toBeNull();
        Flags.assign(0);

        expect(BoardState.waitOfHero('h1')).toEqual({ tile: 14, typeId: 'fixture_enemy' });
        expect(BoardCombat.fightOfHero('h1')).toBeNull();

        Managers.sweep();
        Flags.assign(0);

        expect(BoardState.workTileOf('h1')).toBe(14);
        expect(BoardState.getToken(14).id).not.toBe(camp.id);
    });
});

describe('⭐ a moved enemy keeps its HP (FPP-4)', () => {
    beforeEach(() => {
        GameState.state.heroes = [fighter('h1', { level: 10 })];
    });

    it('dragged mid-fight, the fight goes with it and fightOfHero still finds it', () => {
        put(14, 'fixture_enemy');
        fightAt('h1', 14);
        const fight = untilDamaged('h1');
        const hp = fight.combat.enemyHp.current;

        expect(Placement.moveToken(14, 17).success).toBe(true);

        expect(BoardCombat.getFight(14)).toBeNull();
        expect(BoardCombat.getFight(17)).toBe(fight);
        expect(fight.tile).toBe(17);
        expect(fight.combat.enemyHp.current).toBe(hp);
        expect(BoardCombat.fightOfHero('h1')).toBe(fight);

        run(100);
        expect(BoardCombat.getFight(17)).toBe(fight);
        expect(BoardState.workTileOf('h1')).toBe(17);
    });

    it('shoved aside by a Token dropped on it, the fight goes too', () => {
        const bear = put(14, 'fixture_enemy');
        fightAt('h1', 14);
        const fight = untilDamaged('h1');
        const hp = fight.combat.enemyHp.current;

        Placement.placeToken(14, BoardState.createTokenInstance('fixture_producer', 5000));
        const landed = BoardState.findTokenById(bear.id);

        expect(landed).not.toBeNull();
        expect(landed.anchor).not.toBe(14);
        expect(BoardCombat.getFight(landed.anchor)).toBe(fight);
        expect(fight.combat.enemyHp.current).toBe(hp);
        expect(BoardCombat.fightOfHero('h1')).toBe(fight);
    });
});

describe('⭐ recall mid-fight (FP-43, G-4)', () => {
    beforeEach(() => {
        GameState.state.heroes = [fighter('h1', { level: 10 })];
    });

    it('ends the fight in the same call, and the next engagement meets a whole enemy', () => {
        put(14, 'fixture_enemy');
        fightAt('h1', 14);
        untilDamaged('h1');

        Placement.recallHeroById('h1');

        expect(BoardCombat.fightOfHero('h1')).toBeNull();
        expect(BoardCombat.getFight(14)).toBeNull();

        Placement.placeHero('h1', 14);
        run(100);
        const fresh = BoardCombat.getFight(14).combat.enemyHp;
        expect(fresh.current).toBe(fresh.max);
    });

    it('moving the flag off its enemy ends the fight; planting back on it starts afresh (FP-49)', () => {
        put(14, 'fixture_enemy');
        fightAt('h1', 14);
        untilDamaged('h1');

        fightAt('h1', 0);                          // 452 u away

        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
        expect(BoardCombat.getFight(14)).toBeNull();

        fightAt('h1', 14);
        run(100);
        const fresh = BoardCombat.getFight(14).combat.enemyHp;
        expect(fresh.current).toBe(fresh.max);
    });
});

describe('⭐ defeat furls the flag, with one notification (FP-42)', () => {
    it('takes the flag down and sends exactly one message naming what was lost', () => {
        const weak = fighter('Weakling', { level: 1, hp: 1 });
        GameState.state.heroes = [weak];
        put(14, 'fixture_enemy');
        fightAt('Weakling', 14);

        run(30000);

        expect(weak.status).toBe('wounded');
        expect(BoardState.flagOf('Weakling')).toBeNull();
        expect(applyDefeatPenalties).toHaveBeenCalledTimes(1);
        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
        expect(NotificationSystem.warning.mock.calls[0][0])
            .toBe('Weakling was defeated and carried home, injured. Lost: Sword.');
    });

    it('says so when nothing was lost', () => {
        applyDefeatPenalties.mockReturnValueOnce([]);
        const weak = fighter('Weakling', { level: 1, hp: 1 });
        GameState.state.heroes = [weak];
        put(14, 'fixture_enemy');
        fightAt('Weakling', 14);

        run(30000);

        expect(NotificationSystem.warning).toHaveBeenCalledTimes(1);
        expect(NotificationSystem.warning.mock.calls[0][0]).toMatch(/Nothing was lost\.$/);
    });
});

describe('⭐ promotion offers are never wiped by a gap (PR-7, FP-61)', () => {
    function declined(heroId = 'h1', uses = 2) {
        const academy = put(14, 'fixture_promotion', uses);
        Placement.placeHero(heroId, 14);
        expect(train()).toHaveLength(1);
        BoardPromotion.decline(14);
        return academy;
    }

    beforeEach(() => {
        GameState.state.heroes = [qualified('h1'), qualified('h2')];
    });

    it('a declined offer survives a tick with nobody claiming the Token, and is not asked again', () => {
        const academy = declined();

        // What the runner does for a Token nobody claims this tick.
        BoardState.setClaim('h1', null);
        BoardPromotion.tickTile(14, academy, 100, null);

        expect(BoardPromotion.isPaused(academy)).toBe(true);
        expect(BoardPromotion.isDeclined(academy)).toBe(true);

        expect(train(60000)).toHaveLength(0);
        expect(BoardState.workTileOf('h1')).toBe(14);
        expect(BoardPromotion.isDeclined(academy)).toBe(true);
    });

    it('a flag planted on it asks again — even on the spot it already stands on', () => {
        const academy = declined();

        Placement.placeHero('h1', 14);

        expect(BoardPromotion.isPaused(academy)).toBe(false);
        expect(train()).toHaveLength(1);
    });

    it('a different hero claiming it asks again', () => {
        const academy = declined();
        Placement.recallHeroById('h1');
        expect(BoardPromotion.isPaused(academy)).toBe(true);   // recall alone does not

        BoardState.setFlag('h2', { ...C(14), plantedAt: 99 });
        Flags.markDirty();
        Flags.assign(0);

        expect(BoardState.workTileOf('h2')).toBe(14);
        expect(BoardPromotion.isPaused(academy)).toBe(false);
    });

    it('after accepting, the hero skips the Token and works normally (PR-8)', () => {
        const academy = put(14, 'fixture_promotion', 2);
        Placement.placeHero('h1', 14);
        expect(train()).toHaveLength(1);
        expect(BoardPromotion.accept(14).success).toBe(true);

        // Any work skill the promoted hero holds: since FP-71 they work them all.
        const skill = Object.keys(GameState.state.heroes[0].skills).find(s => !isCombatSkill(s));
        registerTokenTypes({
            ft_after_promotion: {
                id: 'ft_after_promotion', name: 'Ordinary Work', uses: 100, requiresHero: true,
                config: { skill, skillRequired: 0, cycleTimeMs: 12000, xp: 1, inputs: [],
                    outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
            }
        });
        put(15, 'ft_after_promotion');

        Flags.markDirty();
        Flags.assign(0);

        expect(BoardState.workTileOf('h1')).toBe(15);
        expect(reasons(academy)).toContain(Flags.SKIP.SAME_JOB);
    });

    it('accepting with the last charge does not wait for a restock that would not train them (FP-70)', () => {
        put(21, 'ft_academy_manager');
        put(14, 'fixture_promotion', 1);
        TokenBank.deposit(BoardState.createTokenInstance('fixture_promotion', 1));
        Placement.placeHero('h1', 14);
        expect(train()).toHaveLength(1);

        expect(BoardPromotion.accept(14).success).toBe(true);
        expect(BoardState.getToken(14)).toBeNull();
        // Everything FP-70 asks for is there — only the hero has no use for it.
        expect(BoardState.getVacancy(14)?.typeId).toBe('fixture_promotion');
        expect(Managers.managerFor(14, 'fixture_promotion')).not.toBeNull();
        expect(BoardState.tokenBankCopies('fixture_promotion').length).toBe(1);

        Flags.assign(0);

        expect(BoardState.waitOfHero('h1')).toBeNull();
        expect(BoardState.workTileOf('h1')).toBeNull();
    });
});

describe('⭐ disallow (FP-35)', () => {
    beforeEach(() => {
        GameState.state.heroes = [logger('h1')];
    });

    it('releases the hero at once, resets progress, announces itself, and the hero works elsewhere', () => {
        const forest = put(14, 'fixture_producer');
        put(16, 'fixture_producer');
        Flags.plant('h1', C(14));
        run(5000);
        expect(forest.cycleElapsedMs).toBeGreaterThan(0);

        const changed = [];
        let stateChanges = 0;
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, p => changed.push(p)),
            EventBus.subscribe('state_changed', () => { stateChanges++; })
        ];
        let result;
        try {
            result = Flags.setDisallowed(14, true);
        } finally {
            offs.forEach(off => off?.());
        }

        expect(result.success).toBe(true);
        expect(forest.disallowed).toBe(true);
        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(forest.cycleElapsedMs).toBe(0);
        expect(changed).toContainEqual({ tile: 14, typeId: 'fixture_producer' });
        expect(stateChanges).toBeGreaterThan(0);

        run(100);
        expect(BoardState.workTileOf('h1')).toBe(16);
        expect(reasons(forest)).toEqual([Flags.SKIP.DISALLOWED]);

        Flags.setDisallowed(14, false);
        expect(forest.disallowed).toBeUndefined();
    });

    it('is never claimed as a Promotion Token either', () => {
        GameState.state.heroes = [qualified('h1')];
        const academy = put(14, 'fixture_promotion', 2);
        Flags.setDisallowed(14, true);

        Placement.placeHero('h1', 14);

        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(reasons(academy)).toEqual([Flags.SKIP.DISALLOWED]);
    });

    it('does not stop the Token’s own Provides', () => {
        put(14, 'fixture_producer');
        put(15, 'fixture_buff_yield');
        TileModifiers.rebuildAround(15);
        const allowed = TileModifiers.resolveAxis(14, EFFECT_TYPES.YIELD, 100, 'logging');
        expect(allowed).toBeGreaterThan(100);

        Flags.setDisallowed(15, true);
        TileModifiers.rebuildAround(15);

        expect(TileModifiers.resolveAxis(14, EFFECT_TYPES.YIELD, 100, 'logging')).toBe(allowed);
    });

    it('does not stop a Manager restocking — a disallowed Manager, onto a disallowed Token’s spot', () => {
        put(15, 'fixture_manager');
        const forest = put(14, 'fixture_producer', 1);
        TokenBank.deposit(BoardState.createTokenInstance('fixture_producer', 5000));
        Flags.setDisallowed(15, true);
        Flags.setDisallowed(14, true);

        Charges.destroyToken(14, forest);
        expect(Managers.sweep()).toBe(1);

        expect(BoardState.getToken(14)?.typeId).toBe('fixture_producer');
    });

    it('survives a save and reload, and a trip through the Vault drops it', async () => {
        put(14, 'fixture_producer');
        Flags.setDisallowed(14, true);

        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));

        const reloaded = BoardState.getToken(14);
        expect(reloaded.disallowed).toBe(true);
        Flags.plant('h1', C(14));
        expect(BoardState.workTileOf('h1')).toBeNull();
        expect(reasons(reloaded)).toEqual([Flags.SKIP.DISALLOWED]);

        BoardState.setToken(14, null);
        TokenBank.deposit(reloaded);
        const back = BoardState.takeFromTokenBank('fixture_producer');
        expect(back).not.toBeNull();
        expect(back.disallowed).toBeUndefined();
    });
});
