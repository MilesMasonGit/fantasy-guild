// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as Growth from '../systems/board/Growth.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { DeckDndProvider, DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { OrderLighting } from '../ui/components/board/OrderLighting.jsx';
import { OrderDragLine } from '../ui/components/board/OrderDragLine.jsx';
import { orderLitOf } from '../ui/components/board/orderLit.js';
import { hintsOf } from '../ui/components/board/dragHints.js';
import { dropOnMat, matAccepts } from '../ui/components/board/dropOnMat.js';
import { rightClickAt, rightClickEvent } from '../ui/components/board/rightClickOrders.js';
import { setMatBankLocked } from '../ui/hooks/useMatBankLock.js';
import { setMapMode, MAP_MODE } from '../ui/hooks/useMapMode.js';
import { selectHero, pickToken, clearSelection, getSelection, selectedHeroId, selectedTokenId } from '../ui/hooks/useMatSelection.js';
import { TOKEN_FLIGHT_FX, TOKEN_FLIGHT_MS } from '../ui/components/board/tokenFlight.js';
import { HOP_POSES, HOP_POSE_MS } from '../ui/utils/lootArc.js';
import * as fixtures from '../../bench/fixtures.mjs';

// A hero's figure takes a press only on a drawn pixel; jsdom draws none.
vi.mock('../ui/utils/alphaHitTest.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isElementOpaqueAtPoint: () => true };
});

/**
 * ⭐ **Right-click orders** (brief 610 S2, `concept_rts_controls.md`). With a hero selected, a
 * right-click on the mat gives **exactly the order a drop there gives** (work, fight, hunt from an
 * enemy camp, a camp's work, home on the Guild Hall, wait on bare ground) with the drop's refusals,
 * because it is the drop (`dropOnMat`). On the hero's own job it stops them: they wait where they
 * stand with the "needs a job" mark, the Token they left reset and a fight ended, as a recall
 * leaves them. With nothing selected a right-click on a working hero, or the Token they work, stops
 * them; it no longer sends anyone home. Orders land on the mat only. While a hero is selected the
 * drag's hints show at the pointer.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const work = (skill, extra = {}) => ({
    skill, skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
    outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }], ...extra
});
registerTokenTypes({
    rc_tree: plain('rc_tree', 'RC Oak', { uses: 50, requiresHero: true, config: work('forestry') }),
    rc_vein: plain('rc_vein', 'RC Vein', { uses: 50, requiresHero: true, needsTool: { kind: 'pickaxe', minTier: 1 }, config: work('mining') }),
    rc_deep: plain('rc_deep', 'RC Deep Tree', { uses: 50, requiresHero: true, config: work('forestry', { skillRequired: 60 }) }),
    rc_logging: {
        id: 'rc_logging', name: 'RC Logging Camp', tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false, config: null, camp: { skill: 'forestry' }
    }
});

const HALL = { x: 880, y: 560 };
const PRIOR = { x: 200, y: 200 };
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step); };
const h = React.createElement;

/** A fresh board: the Hall, one bench hero working a tree at `PRIOR` for a second. */
function newBoard({ heroes = 1, prior = true } = {}) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    BoardCombat.clearAll();
    fixtures.placeAt('bench_hall', HALL.x, HALL.y);
    const made = fixtures.makeHeroes(heroes);
    TileModifiers.rebuildAll();
    if (prior) {
        fixtures.placeAt('rc_tree', PRIOR.x, PRIOR.y);
        Orders.orderAt(made[0].id, PRIOR);
        run(1000);
    }
    return made;
}

/** The payload a hero dragged from their figure on the mat carries (`MatHero`). */
const heroPayload = (hero) => ({ kind: DRAG_KIND.FLAG, heroId: hero.id, name: hero.name, from: { hero: true } });

/** The drop, as the dnd provider makes it: the mat's `accepts`, then `dropOnMat`. */
function drop(hero, point) {
    const payload = heroPayload(hero);
    return matAccepts(payload) ? dropOnMat(payload, point) : null;
}

/** The right-click with `hero` selected. */
function rightClick(hero, point) {
    selectHero(hero.id);
    return rightClickAt(point);
}

/**
 * What an order did, comparable between two boards built alike: every instance id written as the
 * Token it names (type and place), the callouts said, the hero's order, claim and status, the left
 * Token's progress, and the same a second later.
 */
function outcome(build, act) {
    const { hero, point } = build();
    const label = new Map(BoardState.tokens().map(t => [t.id, `${t.typeId}@${t.x},${t.y}`]));
    const norm = (v) => {
        let s = JSON.stringify(v ?? null);
        for (const [id, name] of label) s = s.split(id).join(name);
        return JSON.parse(s);
    };
    const said = [];
    const offs = [
        EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => said.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.HERO_DEPLOYED, (p) => said.push({ deployed: p })),
        EventBus.subscribe(ENGINE_EVENTS.HEROES_UPDATED, (p) => said.push({ updated: p }))
    ];
    const priorTree = BoardState.tokens().find(t => t.x === PRIOR.x && t.y === PRIOR.y);
    const look = () => norm({
        flag: BoardState.flagOf(hero.id),
        claim: BoardState.claimOfHero(hero.id),
        status: (({ state, instanceId, order, needsJob, campId }) => ({ state, instanceId, order, needsJob, campId }))(Flags.statusOf(hero.id)),
        fighting: !!BoardCombat.fightOfHero(hero.id),
        priorProgress: priorTree ? priorTree.cycleElapsedMs ?? 0 : null
    });
    const result = act(hero, point);
    const now = look();
    run(1000);
    const later = look();
    for (const off of offs) off();
    return norm({ result, said, now, later });
}

/** The same order given by a drop and by a right-click, on two boards built alike. */
function bothWays(build) {
    clearSelection();
    const byDrop = outcome(build, drop);
    const byRightClick = outcome(build, rightClick);
    clearSelection();
    return { byDrop, byRightClick };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

beforeEach(() => {
    clearSelection();
    setMapMode(null);
    setMatBankLocked(false);
});

afterEach(() => {
    cleanup();
    clearSelection();
    setMapMode(null);
    setMatBankLocked(false);
    BoardState.setInstantArrival(true);
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a right-click with a hero selected gives the order a drop there gives', () => {
    const at = (t) => ({ x: t.x, y: t.y });
    const cases = [
        ['a Token they can work', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('rc_tree', 600, 300)) };
        }],
        ['an enemy', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('bench_goblin', 600, 300)) };
        }],
        ['a camp (its work in reach)', () => {
            const [hero] = newBoard();
            const camp = fixtures.placeAt('rc_logging', 1300, 300);
            fixtures.placeAt('rc_tree', 1420, 300);
            return { hero, point: at(camp) };
        }],
        ['an enemy camp (hunt what it spawns)', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('bench_camp', 1300, 700)) };
        }],
        ['the Guild Hall (home)', () => {
            const [hero] = newBoard();
            return { hero, point: { ...HALL } };
        }],
        ['bare ground (wait there, the flag marking it)', () => {
            const [hero] = newBoard();
            return { hero, point: { x: 600, y: 860 } };
        }],
        ['a refusal: a vein with no pickaxe ("Needs Pickaxe")', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('rc_vein', 600, 300)) };
        }],
        ['a refusal: a tree above their level', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('rc_deep', 600, 300)) };
        }],
        ['a refusal: nothing to work (a spawner)', () => {
            const [hero] = newBoard();
            return { hero, point: at(fixtures.placeAt('bench_forest', 600, 300)) };
        }],
        ['a refusal: a healing hero', () => {
            const [hero] = newBoard({ prior: false });
            HeroManager.setHeroStatus(hero.id, 'wounded');
            return { hero, point: at(fixtures.placeAt('rc_tree', 600, 300)) };
        }]
    ];

    it.each(cases)('%s', (_label, build) => {
        const { byDrop, byRightClick } = bothWays(build);
        expect(byRightClick).toEqual(byDrop);
        // Each case really gave its order (or its refusal), so the two agreeing means something.
        expect(byDrop.result).toBeTruthy();
    });

    it('the cases above give what each kind should, so the comparison is not of two no-ops', () => {
        const results = cases.map(([, build]) => bothWays(build).byRightClick);
        const [tree, enemy, camp, enemyCamp, home, ground, noTool, level, nothing, healing] = results;
        expect(tree.result).toMatchObject({ success: true, order: 'token' });
        expect(tree.later.status.state).toBe('working');
        expect(tree.now.priorProgress).toBe(0);
        expect(enemy.result).toMatchObject({ success: true, order: 'token' });
        expect(enemy.later.fighting).toBe(true);
        expect(camp.result).toMatchObject({ success: true, order: 'token' });
        expect(camp.later.status.campId).toMatch(/^rc_logging@/);
        expect(enemyCamp.result).toMatchObject({ success: true, order: 'token' });
        expect(enemyCamp.now.flag.pinnedTo).toMatch(/^bench_camp@/);
        expect(home.result).toMatchObject({ success: true, order: 'home' });
        expect(home.now.flag).toBeNull();
        expect(ground.result).toMatchObject({ success: true, order: 'spot' });
        expect(ground.now.flag).toMatchObject({ spot: true, x: 600, y: 860 });
        expect(noTool.result).toMatchObject({ success: false, reason: 'Needs Pickaxe' });
        // The refusal is said in the drop's red bubble over the Token, and the old job is kept.
        expect(noTool.said.find(p => p.type === 'drop_rejected')).toMatchObject({ severity: 'disallow', title: 'Needs Pickaxe' });
        expect(noTool.now.flag.pinnedTo).toBe(`rc_tree@${PRIOR.x},${PRIOR.y}`);
        expect(level.result).toMatchObject({ success: false, reason: 'Forestry level too low (needs 60)' });
        expect(nothing.result).toMatchObject({ success: false, reason: 'Nothing to work here' });
        expect(healing.result.success).toBe(false);
        expect(healing.result.reason).toMatch(/is healing/);
    });

    it('the selection stays after the order, so a second right-click corrects the first', () => {
        const [hero] = newBoard();
        const a = fixtures.placeAt('rc_tree', 600, 300);
        const b = fixtures.placeAt('rc_tree', 900, 300);
        selectHero(hero.id);
        rightClickAt({ x: a.x, y: a.y });
        expect(selectedHeroId()).toBe(hero.id);
        rightClickAt({ x: b.x, y: b.y });
        expect(Flags.pinnedIdOf(hero.id)).toBe(b.id);
        expect(selectedHeroId()).toBe(hero.id);
    });
});

describe('⭐ a right-click on the job they already have stops them', () => {
    function expectStoppedWhereTheyStood(hero, left) {
        const body = BoardState.heroBodyOf(hero.id);
        const flag = BoardState.flagOf(hero.id);
        expect(flag).toMatchObject({ spot: true, needsJob: true });
        expect(flag.pinnedTo).toBeUndefined();
        // The spot they idle at is where they stand: they do not walk off.
        expect(HeroMotion.idleSpot(flag)).toEqual({ x: body.x, y: body.y });
        expect(BoardState.claimOfHero(hero.id)).toBeNull();
        expect(Flags.statusOf(hero.id)).toMatchObject({ order: 'spot', needsJob: true });
        if (left) expect(left.cycleElapsedMs ?? 0).toBe(0);
    }

    it('the Token they work: they wait where they stand with the mark, its progress reset; a drop there changes nothing', () => {
        const [hero] = newBoard();
        const tree = BoardState.tokens().find(t => t.typeId === 'rc_tree');
        expect(BoardState.workTokenOf(hero.id)).toBe(tree.id);
        expect(tree.cycleElapsedMs).toBeGreaterThan(0);
        // The drop on their own job is no order at all.
        expect(drop(hero, PRIOR)).toMatchObject({ success: true, unchanged: true });
        expect(BoardState.workTokenOf(hero.id)).toBe(tree.id);

        const result = rightClick(hero, PRIOR);
        expect(result).toMatchObject({ success: true, order: 'stop', unchanged: false });
        expectStoppedWhereTheyStood(hero, tree);
        const stoodAt = { ...BoardState.heroBodyOf(hero.id) };
        run(5000);
        // Still stopped, still there (an idle stroll at most), working nothing, never sent home.
        expect(BoardState.workTokenOf(hero.id)).toBeNull();
        expect(HeroMotion.isReturning(hero.id)).toBe(false);
        const now = HeroMotion.heroPointOf(hero.id);
        expect(Math.hypot(now.x - stoodAt.x, now.y - stoodAt.y)).toBeLessThanOrEqual(HeroMotion.potterRadius());
        expect(Flags.statusOf(hero.id)).toMatchObject({ state: 'idle', needsJob: true });
        expect(selectedHeroId()).toBe(hero.id);
    });

    it('the enemy they fight: the fight ends at once, as a recall ends it, and the enemy is whole for the next to engage it', () => {
        const [hero] = newBoard({ prior: false });
        const goblin = fixtures.placeAt('bench_goblin', 600, 300);
        Orders.orderAt(hero.id, { x: goblin.x, y: goblin.y });
        let fight = null;
        for (let i = 0; i < 80 && !(fight && fight.combat.enemyHp.current < fight.combat.enemyHp.max); i++) {
            run(100);
            fight = BoardCombat.fightOfHero(hero.id);
        }
        expect(fight).toBeTruthy();
        expect(fight.combat.enemyHp.current).toBeLessThan(fight.combat.enemyHp.max);

        expect(rightClick(hero, { x: goblin.x, y: goblin.y })).toMatchObject({ order: 'stop', unchanged: false });
        expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
        expect(HeroManager.getHero(hero.id).status).not.toBe('combat');
        expectStoppedWhereTheyStood(hero, null);

        // Sent back at it: a new fight, the enemy whole.
        rightClickAt({ x: goblin.x, y: goblin.y });
        run(100);
        const again = BoardCombat.fightOfHero(hero.id);
        expect(again).toBeTruthy();
        expect(again.combat.enemyHp.current).toBe(again.combat.enemyHp.max);
    });

    it('a camp they work from, and the Token they work in its reach, both stop them', () => {
        for (const onCamp of [true, false]) {
            const [hero] = newBoard({ prior: false });
            const camp = fixtures.placeAt('rc_logging', 600, 300);
            const tree = fixtures.placeAt('rc_tree', 720, 300);
            Orders.orderAt(hero.id, { x: camp.x, y: camp.y });
            run(1000);
            expect(BoardState.workTokenOf(hero.id)).toBe(tree.id);
            const target = onCamp ? camp : tree;
            expect(rightClick(hero, { x: target.x, y: target.y })).toMatchObject({ order: 'stop', unchanged: false });
            expectStoppedWhereTheyStood(hero, tree);
            clearSelection();
        }
    });

    it('a Token that is not their job is an order, never a stop', () => {
        const [hero] = newBoard();
        const other = fixtures.placeAt('rc_tree', 600, 300);
        expect(rightClick(hero, { x: other.x, y: other.y })).toMatchObject({ success: true, order: 'token' });
        expect(Flags.pinnedIdOf(hero.id)).toBe(other.id);
        expect(Flags.needsJob(hero.id)).toBe(false);
    });

    it('a stopped hero takes a new order by right-click, and the mark goes', () => {
        const [hero] = newBoard();
        rightClick(hero, PRIOR);
        expect(Flags.needsJob(hero.id)).toBe(true);
        rightClickAt(PRIOR);
        expect(Flags.pinnedIdOf(hero.id)).toBeTruthy();
        expect(Flags.needsJob(hero.id)).toBe(false);
    });
});

describe('⭐ a selected hero stopped by right-click (owner, 2026-11-11)', () => {
    function mountMat() {
        const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))));
        const mat = view.container.querySelector('[data-mat-board]');
        mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        const move = (target, x, y) => act(async () => {
            target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
            await new Promise(r => setTimeout(r, 50));
        });
        return { ...view, mat, move };
    }
    const hitOf = (c, id) => c.querySelector(`[data-token-hit="${id}"]`);

    it('a right-click on their own figure stops them where they stand, as on their own job, and they stay selected', async () => {
        const [hero] = newBoard();
        const tree = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
        const { container } = mountMat();
        const figure = container.querySelector(`[data-board-hero="${hero.id}"]`);
        act(() => { fireEvent.click(figure); });
        expect(selectedHeroId()).toBe(hero.id);
        // Bare ground under the pointer: without the rule this would be a wait-there order.
        await act(async () => { fireEvent.contextMenu(figure, { clientX: 600, clientY: 860 }); await Promise.resolve(); });
        expect(BoardState.flagOf(hero.id)).toMatchObject({ spot: true, needsJob: true });
        const body = BoardState.heroBodyOf(hero.id);
        expect(HeroMotion.idleSpot(BoardState.flagOf(hero.id))).toEqual({ x: body.x, y: body.y });
        expect(BoardState.claimOfHero(hero.id)).toBeNull();
        expect(tree.cycleElapsedMs ?? 0).toBe(0);
        expect(selectedHeroId()).toBe(hero.id);
        // The same call with the figure named: the stop, not the drop on the ground below.
        clearSelection();
        const [other] = newBoard();
        selectHero(other.id);
        expect(rightClickAt({ x: 600, y: 860 }, { heroUnder: other.id })).toMatchObject({ order: 'stop' });
        expect(BoardState.flagOf(other.id)).toMatchObject({ spot: true, needsJob: true });
    });

    it('another hero’s figure under the right-click is no stop of the selected one', () => {
        const [hero, idle] = newBoard({ heroes: 2 });
        selectHero(hero.id);
        const result = rightClickAt({ x: 600, y: 860 }, { heroUnder: idle.id });
        expect(result).toMatchObject({ success: true, order: 'spot' });
        expect(Flags.needsJob(hero.id)).toBe(false);
    });

    it('after the stop the aim marks go out, so the yellow mark shows at once, until the pointer is on another Token', async () => {
        const [hero] = newBoard();
        const tree = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
        const other = fixtures.placeAt('rc_tree', 600, 300);
        const { container, mat, move } = mountMat();
        act(() => selectHero(hero.id));
        const ground = mat;
        await move(ground, tree.x, tree.y);
        expect(container.querySelector(`[data-order-aim="${tree.id}"]`)).toBeTruthy();
        expect(hintsOf(hero.id)).toBeTruthy();
        await act(async () => { fireEvent.contextMenu(hitOf(container, tree.id), { clientX: tree.x, clientY: tree.y }); await Promise.resolve(); });
        expect(Flags.needsJob(hero.id)).toBe(true);
        expect(container.querySelector('[data-order-aim]')).toBeNull();
        expect(hintsOf(hero.id)).toBeNull();
        expect(container.querySelector('[data-needs-job-mark]')).toBeTruthy();
        // Still on the same Token: still out.
        await move(ground, tree.x + 2, tree.y + 1);
        expect(container.querySelector('[data-order-aim]')).toBeNull();
        expect(container.querySelector('[data-needs-job-mark]')).toBeTruthy();
        // Onto another Token: the marks are back.
        await move(ground, other.x, other.y);
        expect(container.querySelector(`[data-order-aim="${other.id}"]`)).toBeTruthy();
        expect(hintsOf(hero.id)).toBeTruthy();
    });
});

describe('⭐ with nothing selected, a right-click on a working hero or their Token stops them', () => {
    function mount() {
        const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))));
        const mat = view.container.querySelector('[data-mat-board]');
        mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        return { ...view, mat };
    }
    const hitOf = (c, id) => c.querySelector(`[data-token-hit="${id}"]`);

    it('on the hero: they stop where they stand with the "needs a job" mark, and are not sent home', async () => {
        const [hero] = newBoard();
        const { container } = mount();
        const figure = container.querySelector(`[data-board-hero="${hero.id}"]`);
        expect(container.querySelector('[data-needs-job-mark]')).toBeNull();
        await act(async () => { fireEvent.contextMenu(figure, { clientX: 5, clientY: 5 }); await Promise.resolve(); });
        expect(BoardState.flagOf(hero.id)).toMatchObject({ spot: true, needsJob: true });
        expect(HeroMotion.isReturning(hero.id)).toBe(false);
        expect(Flags.statusOf(hero.id).state).not.toBe('docked');
        expect(container.querySelector('[data-needs-job-mark]')).toBeTruthy();
        expect(getSelection()).toBeNull();
    });

    it('on the Token they work: the same stop', () => {
        const [hero] = newBoard();
        const tree = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
        const { container } = mount();
        act(() => { fireEvent.contextMenu(hitOf(container, tree.id), { clientX: tree.x, clientY: tree.y }); });
        expect(BoardState.flagOf(hero.id)).toMatchObject({ spot: true, needsJob: true });
        expect(tree.cycleElapsedMs ?? 0).toBe(0);
    });

    it('on a Token nobody works, or a hero with no job: nothing happens, nobody goes home', () => {
        const [hero, idle] = newBoard({ heroes: 2 });
        const free = fixtures.placeAt('rc_tree', 600, 300);
        Orders.orderAt(idle.id, { x: 900, y: 860 });
        const before = JSON.stringify(BoardState.getFlags());
        const { container } = mount();
        act(() => { fireEvent.contextMenu(hitOf(container, free.id), { clientX: free.x, clientY: free.y }); });
        act(() => { fireEvent.contextMenu(container.querySelector(`[data-board-hero="${idle.id}"]`), { clientX: 5, clientY: 5 }); });
        expect(JSON.stringify(BoardState.getFlags())).toBe(before);
        expect(BoardState.workTokenOf(hero.id)).toBeTruthy();
    });

    it('a right-click on a hero never sends them home any more, selected or not', () => {
        const [hero] = newBoard();
        const { container } = mount();
        const figure = container.querySelector(`[data-board-hero="${hero.id}"]`);
        act(() => { fireEvent.click(figure); });
        expect(selectedHeroId()).toBe(hero.id);
        act(() => { fireEvent.contextMenu(figure, { clientX: 600, clientY: 860 }); });
        expect(BoardState.flagOf(hero.id)).not.toBeNull();
        expect(HeroMotion.isReturning(hero.id)).toBe(false);
    });
});

describe('⭐ orders land on the mat only', () => {
    it('a right-click on a panel over the mat (outside it in the page) is no order', () => {
        const [hero] = newBoard();
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        const view = render(h('div', null,
            h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))),
            h('div', { 'data-shop-drawer': true, 'data-testid': 'panel' }, 'Shop')
        ));
        const mat = view.container.querySelector('[data-mat-board]');
        mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        act(() => selectHero(hero.id));
        const before = JSON.stringify(BoardState.flagOf(hero.id));
        act(() => { fireEvent.contextMenu(view.getByTestId('panel'), { clientX: tree.x, clientY: tree.y }); });
        expect(JSON.stringify(BoardState.flagOf(hero.id))).toBe(before);
        // An event React hands the mat from a node outside it (a portal) is no order either.
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        expect(rightClickEvent({ target: outside, clientX: tree.x, clientY: tree.y, preventDefault() {} }, mat)).toBeNull();
        outside.remove();
        expect(JSON.stringify(BoardState.flagOf(hero.id))).toBe(before);
        // The same right-click on the mat itself is the order.
        act(() => { fireEvent.contextMenu(view.container.querySelector(`[data-token-hit="${tree.id}"]`), { clientX: tree.x, clientY: tree.y }); });
        expect(Flags.pinnedIdOf(hero.id)).toBe(tree.id);
    });

    it('while the Bank covers the mat no right-click gives an order, as no drop lands', () => {
        const [hero] = newBoard();
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        setMatBankLocked(true);
        expect(drop(hero, { x: tree.x, y: tree.y })).toBeNull();
        expect(rightClick(hero, { x: tree.x, y: tree.y })).toBeNull();
        clearSelection();
        expect(rightClickAt(PRIOR)).toBeNull();
        expect(Flags.pinnedIdOf(hero.id)).not.toBe(tree.id);
        expect(Flags.needsJob(hero.id)).toBe(false);
    });

    it('in a map mode (Demolish) a right-click gives no order and stops nobody', () => {
        const [hero] = newBoard();
        setMapMode(MAP_MODE.DEMOLISH);
        expect(rightClickAt(PRIOR, { heroUnder: hero.id })).toBeNull();
        expect(Flags.needsJob(hero.id)).toBe(false);
    });

    it('a selected Token (an enemy too) orders no hero: a right-click moves the Token', () => {
        const [hero] = newBoard();
        const goblin = fixtures.placeAt('bench_goblin', 600, 300);
        expect(pickToken(goblin.id)).toBe(true);
        const before = JSON.stringify(BoardState.getFlags());
        expect(rightClickAt({ x: 1200, y: 700 })).toMatchObject({ success: true });
        expect(rightClickAt({ x: 1300, y: 760 }, { heroUnder: hero.id })).toMatchObject({ success: true });
        expect(JSON.stringify(BoardState.getFlags())).toBe(before);
        expect(Flags.needsJob(hero.id)).toBe(false);
    });
});

describe('⭐ while a hero is selected, the drag’s hints show at the pointer, with no line (owner, 2026-11-12)', () => {
    const drag = (value) => ({ isDragging: false, activePayload: null, ...value });

    it('every Token they could be sent to glows, kept up to date while selected; out once cleared or while anything is carried', async () => {
        const [hero] = newBoard({ prior: false });
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        const vein = fixtures.placeAt('rc_vein', 900, 300);
        const view = render(h(DeckDndContext.Provider, { value: drag() }, h(OrderLighting)));
        expect(orderLitOf(tree.id)).toBeNull();
        act(() => selectHero(hero.id));
        expect(orderLitOf(tree.id)).toBe('workable');
        expect(orderLitOf(vein.id)).toBeNull();
        // A Token placed while they stay selected lights too.
        const later = fixtures.placeAt('rc_tree', 600, 700);
        await act(async () => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: later.id }); await Promise.resolve(); });
        expect(orderLitOf(later.id)).toBe('workable');
        // A Token carried (say a selected hero, another Token in the hand): the selection's lights go out.
        view.rerender(h(DeckDndContext.Provider, { value: drag({ isDragging: true, activePayload: { kind: DRAG_KIND.TOKEN, typeId: 'rc_tree' } }) }, h(OrderLighting)));
        expect(orderLitOf(tree.id)).toBeNull();
        view.rerender(h(DeckDndContext.Provider, { value: drag() }, h(OrderLighting)));
        expect(orderLitOf(tree.id)).toBe('workable');
        act(() => clearSelection());
        expect(orderLitOf(tree.id)).toBeNull();
    });

    function mountLine(value = drag()) {
        const matEl = document.createElement('div');
        matEl.setAttribute('data-mat-board', '');
        matEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        const ground = document.createElement('div');
        matEl.appendChild(ground);
        const panel = document.createElement('div');
        document.body.append(matEl, panel);
        const view = render(h(DeckDndContext.Provider, { value }, h(OrderDragLine, { matRef: { current: matEl } })));
        const move = (target, x, y) => act(async () => {
            target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
            await new Promise(r => setTimeout(r, 50));
        });
        const dashes = () => view.container.querySelector('svg[data-order-line] path:last-child')?.getAttribute('d') ?? null;
        const done = () => { matEl.remove(); panel.remove(); };
        return { view, ground, panel, move, dashes, done };
    }

    it('no dashed line follows the pointer; the drag hint marks stand over the Token under it', async () => {
        const [hero] = newBoard({ prior: false });
        Orders.orderAt(hero.id, { x: 300, y: 860 });
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        selectHero(hero.id);
        const line = mountLine();
        await line.move(line.ground, 1200, 800);
        expect(line.view.container.querySelector('svg[data-order-line]')).toBeNull();
        expect(line.dashes()).toBeNull();
        expect(hintsOf(hero.id)).toBeNull();
        await line.move(line.ground, tree.x, tree.y);
        expect(line.view.container.querySelector(`[data-order-aim="${tree.id}"]`)).toBeTruthy();
        expect(hintsOf(hero.id)).toMatchObject({ kind: 'work', skill: { skillId: 'forestry', pass: true } });
        expect(line.view.container.querySelector('svg[data-order-line]')).toBeNull();
        line.done();
    });

    it('a real drag of the selected hero still draws the dashed line to the pointer', async () => {
        const [hero] = newBoard({ prior: false });
        Orders.orderAt(hero.id, { x: 300, y: 860 });
        selectHero(hero.id);
        const line = mountLine(drag({ isDragging: true, activePayload: heroPayload(hero) }));
        expect(line.view.container.querySelector(`svg[data-order-line="${hero.id}"]`)).toBeTruthy();
        await line.move(line.ground, 1200, 800);
        expect(line.dashes().length).toBeGreaterThan(0);
        line.done();
    });

    it('over a Token they cannot work, the drop’s reason in the red bubble before the right-click', async () => {
        const [hero] = newBoard({ prior: false });
        const vein = fixtures.placeAt('rc_vein', 600, 300);
        selectHero(hero.id);
        const line = mountLine();
        await line.move(line.ground, vein.x, vein.y);
        expect(line.view.container.querySelector(`[data-order-reason="${vein.id}"]`)?.textContent).toBe('Needs Pickaxe');
        line.done();
    });

    it('off the mat (a panel, the hero bar) or under the Bank: nothing shown, and no frame asked for while the pointer is off or still', async () => {
        const [hero] = newBoard({ prior: false });
        Orders.orderAt(hero.id, { x: 300, y: 860 });
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        selectHero(hero.id);
        const line = mountLine();
        const aimed = () => line.view.container.querySelector(`[data-order-aim="${tree.id}"]`);
        await line.move(line.ground, tree.x, tree.y);
        expect(aimed()).toBeTruthy();
        // A still pointer on the mat asks for no frame: with no line there is nothing to march.
        let frames = vi.spyOn(window, 'requestAnimationFrame');
        await act(async () => { await new Promise(r => setTimeout(r, 80)); });
        expect(frames).not.toHaveBeenCalled();
        frames.mockRestore();
        await line.move(line.panel, tree.x, tree.y);
        expect(hintsOf(hero.id)).toBeNull();
        expect(line.view.container.querySelector('[data-order-aim]')).toBeNull();
        frames = vi.spyOn(window, 'requestAnimationFrame');
        await line.move(line.panel, tree.x + 10, tree.y);
        await act(async () => { await new Promise(r => setTimeout(r, 80)); });
        expect(frames).not.toHaveBeenCalled();
        await line.move(line.ground, tree.x, tree.y);
        expect(frames).toHaveBeenCalled();
        expect(aimed()).toBeTruthy();
        frames.mockRestore();
        setMatBankLocked(true);
        await line.move(line.ground, tree.x, tree.y);
        expect(line.view.container.querySelector('[data-order-aim]')).toBeNull();
        line.done();
    });

    it('nothing at all while nothing, or a Token, is selected', () => {
        newBoard({ prior: false });
        const tree = fixtures.placeAt('rc_tree', 600, 300);
        const view = render(h(DeckDndContext.Provider, { value: drag() }, h(OrderDragLine, { matRef: { current: null } })));
        expect(view.container.querySelector('svg')).toBeNull();
        act(() => { pickToken(tree.id); });
        expect(view.container.querySelector('svg')).toBeNull();
    });
});

describe('⭐ a right-click with a Token selected moves it, as a drop there does', () => {
    /** The Token dropped there, as the mat's drag gives it (`MatTokenGrab`'s payload). */
    function dropToken(token, point) {
        const payload = { kind: DRAG_KIND.TOKEN, typeId: token.typeId, from: { instanceId: token.id } };
        return matAccepts(payload) ? dropOnMat(payload, point) : null;
    }
    function rightClickToken(token, point) {
        pickToken(token.id);
        return rightClickAt(point);
    }

    /**
     * What a move did, comparable between two boards built alike: every Token by type and place,
     * the callouts said, the working hero's job and where they are, now and a second later.
     */
    function moveOutcome(build, act) {
        const { token, point, hero = null } = build();
        const label = new Map(BoardState.tokens().map(t => [t.id, `${t.typeId}#${t.x},${t.y}`]));
        const norm = (v) => {
            let str = JSON.stringify(v ?? null);
            for (const [id, name] of label) str = str.split(id).join(name);
            return JSON.parse(str);
        };
        const said = [];
        const offs = [
            EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, (p) => said.push(p)),
            EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => said.push(p)),
            // Health regen ticks on a clock of its own, whichever way the move was made.
            EventBus.subscribe(ENGINE_EVENTS.HEROES_UPDATED, (p) => { if (p?.source !== 'regen') said.push({ updated: p }); })
        ];
        const look = () => norm({
            tokens: BoardState.tokens().map(t => ({ id: t.id, x: t.x, y: t.y, cycle: t.cycleElapsedMs ?? 0 })),
            hero: hero && {
                works: BoardState.workTokenOf(hero.id),
                body: { ...BoardState.heroBodyOf(hero.id) },
                status: (({ state, instanceId }) => ({ state, instanceId }))(Flags.statusOf(hero.id))
            }
        });
        const result = act(token, point);
        const now = look();
        run(1000);
        const later = look();
        for (const off of offs) off();
        return norm({ result, said, now, later });
    }

    function bothWays(build) {
        clearSelection();
        const byDrop = moveOutcome(build, dropToken);
        const byRightClick = moveOutcome(build, rightClickToken);
        clearSelection();
        return { byDrop, byRightClick };
    }

    const cases = [
        ['a free spot: the Token worked moves, its hero walks after it', () => {
            const [hero] = newBoard();
            const token = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
            return { token, hero, point: { x: 700, y: 820 } };
        }],
        ['a crowded spot: nudged to the nearest legal one', () => {
            const [hero] = newBoard();
            const token = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
            const vein = fixtures.placeAt('rc_vein', 900, 600);
            return { token, hero, point: { x: vein.x + 10, y: vein.y } };
        }],
        ['an enemy', () => {
            newBoard();
            return { token: fixtures.placeAt('bench_goblin', 600, 300), point: { x: 1200, y: 760 } };
        }],
        ['a refusal: no room within reach', () => {
            const [hero] = newBoard();
            const token = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
            const vein = fixtures.placeAt('rc_vein', 900, 600);
            setMatTuning('nudgeReach', 0);
            return { token, hero, point: { x: vein.x + 10, y: vein.y } };
        }]
    ];

    it.each(cases)('%s', (_label, build) => {
        const { byDrop, byRightClick } = bothWays(build);
        expect(byRightClick).toEqual(byDrop);
        expect(byDrop.result).toBeTruthy();
    });

    it('the cases above did what each should, so the comparison is not of two no-ops', () => {
        const [free, crowded, enemy, refused] = cases.map(([, build]) => bothWays(build).byRightClick);
        const at = (o, prefix) => o.now.tokens.find(t => t.id.startsWith(prefix));
        expect(free.result).toMatchObject({ success: true, x: 700, y: 820, nudged: false });
        expect(at(free, 'rc_tree')).toMatchObject({ x: 700, y: 820 });
        // The hero keeps the job and walks towards its new spot.
        expect(free.later.hero.works).toMatch(/^rc_tree#/);
        const d = (o) => Math.hypot(o.hero.body.x - 700, o.hero.body.y - 820);
        expect(d(free.later)).toBeLessThan(d(free.now));
        expect(crowded.result).toMatchObject({ success: true, nudged: true });
        expect(enemy.result).toMatchObject({ success: true, x: 1200, y: 760 });
        expect(at(enemy, 'bench_goblin')).toMatchObject({ x: 1200, y: 760 });
        expect(refused.result).toMatchObject({ success: false, full: true });
        expect(refused.said.find(p => p.type === 'drop_rejected')).toBeTruthy();
        // Refused, it stays where it stood.
        expect(at(refused, 'rc_tree')).toMatchObject({ x: PRIOR.x, y: PRIOR.y });
    });

    it('a refused move leaves the Token, flies nothing, and keeps the selection', () => {
        const [hero] = newBoard();
        const tree = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
        const vein = fixtures.placeAt('rc_vein', 900, 600);
        setMatTuning('nudgeReach', 0);
        const flights = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_TOKEN_FX, (p) => flights.push(p));
        expect(rightClickToken(tree, { x: vein.x + 10, y: vein.y })).toMatchObject({ success: false });
        off();
        expect(BoardState.getTokenById(tree.id)).toMatchObject({ x: PRIOR.x, y: PRIOR.y });
        expect(BoardState.workTokenOf(hero.id)).toBe(tree.id);
        expect(flights).toEqual([]);
        expect(selectedTokenId()).toBe(tree.id);
    });

    it('a move flies from where it stood, and the selection stays for the next', () => {
        newBoard();
        const goblin = fixtures.placeAt('bench_goblin', 600, 300);
        const flights = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_TOKEN_FX, (p) => flights.push(p));
        rightClickToken(goblin, { x: 1200, y: 760 });
        expect(flights).toEqual([{ instanceId: goblin.id, fx: TOKEN_FLIGHT_FX, fromX: 600, fromY: 300 }]);
        expect(selectedTokenId()).toBe(goblin.id);
        rightClickAt({ x: 900, y: 700 });
        off();
        expect(BoardState.getTokenById(goblin.id)).toMatchObject({ x: 900, y: 700 });
        expect(flights[1]).toMatchObject({ fromX: 1200, fromY: 760 });
        expect(selectedTokenId()).toBe(goblin.id);
    });

    it('no move while the Bank covers the mat or in Demolish', () => {
        newBoard();
        const goblin = fixtures.placeAt('bench_goblin', 600, 300);
        pickToken(goblin.id);
        setMatBankLocked(true);
        expect(rightClickAt({ x: 1200, y: 760 })).toBeNull();
        setMatBankLocked(false);
        setMapMode(MAP_MODE.DEMOLISH);
        expect(rightClickAt({ x: 1200, y: 760 })).toBeNull();
        expect(BoardState.getTokenById(goblin.id)).toMatchObject({ x: 600, y: 300 });
    });

    describe('on the mat', () => {
        let animations;
        beforeEach(() => {
            animations = [];
            HTMLElement.prototype.animate = function (keyframes, options) {
                const anim = { el: this, keyframes, options, cancel() {}, onfinish: null, oncancel: null };
                animations.push(anim);
                return anim;
            };
        });
        afterEach(() => { delete HTMLElement.prototype.animate; });

        function mount() {
            const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard))));
            const mat = view.container.querySelector('[data-mat-board]');
            mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
            const move = (target, x, y) => act(async () => {
                target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
                await new Promise(r => setTimeout(r, 50));
            });
            return { ...view, mat, move };
        }

        it('a right-click on the mat flies the Token in loot’s arc, on both its boxes, with no slide', async () => {
            newBoard();
            const goblin = fixtures.placeAt('bench_goblin', 600, 300);
            const { container, mat } = mount();
            act(() => { pickToken(goblin.id); });
            await act(async () => { fireEvent.contextMenu(mat, { clientX: 1200, clientY: 760 }); await Promise.resolve(); });
            expect(BoardState.getTokenById(goblin.id)).toMatchObject({ x: 1200, y: 760 });
            const art = container.querySelector(`[data-token-art][data-token-id="${goblin.id}"]`);
            const flown = animations.filter(a => a.options?.composite === 'add' && a.options.duration === TOKEN_FLIGHT_MS);
            expect(TOKEN_FLIGHT_MS).toBe((HOP_POSES + 2) * HOP_POSE_MS);
            expect(flown).toHaveLength(2);
            expect(flown.map(a => a.el)).toContain(art);
            // It starts at its old spot (600 - 1200 across), rises above the line between, and lands.
            const first = flown[0].keyframes[0].transform;
            expect(first).toMatch(/^translate\(-600px, -460px\)/);
            const ys = flown[0].keyframes.map(k => Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(k.transform)?.[1]));
            const xs = flown[0].keyframes.map(k => Number(/translate\((-?[\d.]+)px/.exec(k.transform)?.[1]));
            const mid = Math.floor(HOP_POSES / 2);
            expect(ys[mid]).toBeLessThan(-460 * (1 - mid / HOP_POSES));
            expect(xs.at(-1)).toBe(0);
            // The box does not also slide over from the old spot.
            expect(art.style.transition).toBe('none');
            expect(selectedTokenId()).toBe(goblin.id);
        });

        it('while a Token is selected nothing follows the pointer: no ghost, no reach ring, no dots (owner, 2026-11-12)', async () => {
            newBoard({ prior: false });
            const camp = fixtures.placeAt('rc_logging', 400, 300);
            const tree = fixtures.placeAt('rc_tree', 1300, 700);
            const goblin = fixtures.placeAt('bench_goblin', 600, 800);
            const { container, mat, move } = mount();
            for (const picked of [camp, goblin]) {
                act(() => { pickToken(picked.id); });
                const frames = vi.spyOn(window, 'requestAnimationFrame');
                await move(mat, 1200, 700);
                frames.mockRestore();
                expect(document.querySelector('[data-selected-ghost]')).toBeNull();
                expect(container.querySelector('[data-near-ring]')).toBeNull();
                expect(container.querySelector(`[data-reach-dot="${tree.id}"]`)).toBeNull();
                expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
                // The gold outline on the selected Token stays.
                expect(container.querySelector(`[data-token-art][data-token-id="${picked.id}"]`).getAttribute('data-outline')).toBe('select');
            }
        });

        it('a real drag of the selected camp still shows the reach ring and its dots where it would land', async () => {
            newBoard({ prior: false });
            const camp = fixtures.placeAt('rc_logging', 400, 300);
            const tree = fixtures.placeAt('rc_tree', 1300, 700);
            const { container } = mount();
            act(() => { pickToken(camp.id); });
            const hit = container.querySelector(`[data-token-hit="${camp.id}"]`);
            const ptr = (x, y) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
            act(() => {
                fireEvent.pointerDown(hit, ptr(400, 300));
                fireEvent.pointerMove(document, ptr(430, 300));
            });
            await act(async () => { fireEvent.pointerMove(document, ptr(1200, 700)); await new Promise(r => setTimeout(r, 50)); });
            expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
            expect(container.querySelector('[data-near-ring]')).toBeTruthy();
            expect(container.querySelector(`[data-reach-dot="${tree.id}"]`)).toBeTruthy();
            // The drop, and the click the browser sends right after it on the Token let go: no
            // click again on the selected Token, so it stays selected.
            await act(async () => {
                fireEvent.pointerUp(document, ptr(1200, 700));
                fireEvent.click(hit, ptr(1200, 700));
                await new Promise(r => setTimeout(r, 30));
            });
            expect(selectedTokenId()).toBe(camp.id);
            document.body.classList.remove('gi-dnd-active');
        });
    });
});
