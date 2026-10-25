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
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Placement from '../systems/board/Placement.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { DiscoveryManager } from '../systems/core/DiscoveryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { registerStatusFixtures, providesFlat, POISON } from './fixtures/statusEffects.js';
import {
    startFightWatch, resetFightWatch, fightsOf, subscribeMoments, adopt, MOMENT, OUTCOME
} from '../ui/components/combat/fightWatch.js';
import { LiveFightPanel } from '../ui/components/combat/FightPanel.jsx';
import { fightPanelView, activeElixirsOf } from '../ui/components/combat/fightView.js';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import { watchFightFloats } from '../ui/components/board/fx/fightFloats.js';
import { STRIKE_DELAY_MS } from '../ui/components/board/hitAnimations.js';
import { fightPlateOf, fightPlateCells } from '../ui/components/board/fightPlate.js';
import { CELL } from '../ui/components/board/workPlate.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';

/**
 * The combat screen read from a real fight (brief 220, C6b): the fight watch keeps each fight's
 * whole log and the last one, the floats rise at each fighter's outer side, the panel and the
 * plate read the engine's numbers, the "While you were away" summary counts the fights' supplies
 * and drops, and a catch-up records and draws nothing. The harness is `CombatCatchUpStatuses`'s.
 */

const NOW = 1_800_000_000_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerStatusFixtures();

registerItems({
    cs_sword: { id: 'cs_sword', name: 'Screen Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 3 },
    cs_elixir: { id: 'cs_elixir', name: 'Elixir of Testing', type: 'potion', sprite: 'i_potion_sun_red', stackable: true, equipSlot: 'consumable', effects: [{ effectId: 'cs_fx_elixir' }] }
});
registerEffects({
    cs_fx_buff: { id: 'cs_fx_buff', name: 'Tested', statements: [providesFlat('stm_cs_buff', EFFECT_TYPES.ARMOR, 1)] },
    cs_fx_elixir: {
        id: 'cs_fx_elixir', name: 'Elixir of Testing', statements: [{
            ...makeStatement(KEYWORD.APPLIES), id: 'stm_cs_elixir',
            when: { event: 'COMBAT_ENGAGED', scope: 'self' }, target: { role: ROLE.ACTOR },
            payload: { effectId: 'cs_fx_buff', scale: 1, durationMs: 0, forFight: true, chance: 100 }
        }]
    }
});

const enemy = (id, name, enemyBlock) => ({
    id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 40, sprite: 's_crime', requiresHero: true,
    enemy: { style: 'melee', ...enemyBlock },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
});
registerTokenTypes({ cs_venom: enemy('cs_venom', 'Screen Venomous', { level: 10, kinds: ['venomous'] }) });

/** A seeded `Math.random` (mulberry32), as the catch-up tests use. */
const stream = { state: 1 };
function seeded() {
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

/** One fed Melee 20 hero with a sword and an elixir, pinned on a Venomous enemy at (600, 400). */
function buildFight() {
    stream.state = 41;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    LiveEffects.resetClock();
    const [hero] = fixtures.makeHeroes(1, {});
    hero.skills.melee = { level: 20, xp: xpForLevel(20) };
    InventoryManager.addItem('item_shrimp', 40);
    InventoryManager.addItem('cs_sword', 1);
    InventoryManager.addItem('cs_elixir', 10);
    expect(EquipmentManager.equipItem(hero.id, 'cs_sword').success).toBe(true);
    expect(EquipmentManager.equipItem(hero.id, 'item_shrimp').success).toBe(true);
    expect(EquipmentManager.equipItem(hero.id, 'cs_elixir').success).toBe(true);
    HeroManager.updateHeroFromSkills(hero);
    hero.hp.current = hero.hp.max;
    const foe = fixtures.placeAt('cs_venom', 600, 400);
    fixtures.plant(hero.id, { x: foe.x, y: foe.y }, { pin: true });
    TileModifiers.rebuildAll();
    return { heroId: hero.id, enemyId: foe.id };
}

/** Run the loop a second at a time until `done()` or `maxS` seconds. */
function runUntil(done, maxS = 180) {
    for (let i = 0; i < maxS && !done(); i++) GameLoop.runHandlers(1000);
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    // What a slot opening starts: the first swing records the enemy as fought (its kinds show).
    DiscoveryManager.init();
    GameLoop.stop();
});

beforeEach(() => resetFightWatch());

afterEach(() => {
    cleanup();
    resetFightWatch();
    resetDrawSwitches();
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the fight watch: this fight and the last one', () => {
    it('⭐ keeps the whole of a fight, and the last fight once it ends, in memory', () => {
        const { heroId, enemyId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => fightsOf(heroId).last?.outcome === OUTCOME.WON);
        const { last } = fightsOf(heroId);
        expect(last).not.toBeNull();
        expect(last.instanceId).toBe(enemyId);
        expect(last.enemyName).toBe('Screen Venomous');
        const keys = last.log.map(l => l.key);
        // The elixir drunk as it engaged opens the log; the kill closes it, after its drops.
        expect(keys[0]).toBe('drinks');
        expect(keys).toContain('heroHits');
        expect(keys.some(k => k === 'enemyHits' || k === 'enemyMisses')).toBe(true);
        expect(keys.at(-1)).toBe('won');
        expect(keys.at(-2)).toBe('drops');
        expect(last.hp.enemy.cur).toBe(0);
        expect(last.endedAt - last.startedAt).toBeGreaterThanOrEqual(0);

        // The next enemy steps up: a new fight is "this fight", the one just won stays "last".
        runUntil(() => !!fightsOf(heroId).current, 10);
        const next = fightsOf(heroId);
        expect(next.current.id).toBeGreaterThan(next.last.id);
        expect(next.last).toBe(last);
        stop();
    });

    it('a fight already running when the watch starts is adopted as "seen from partway", but never a rest between kills', () => {
        const { heroId, enemyId } = buildFight();
        runUntil(() => false, 5);
        const stop = startFightWatch();
        expect(fightsOf(heroId).current).toBeNull();
        expect(adopt(heroId)).toBe(true);
        expect(fightsOf(heroId).current).toMatchObject({ instanceId: enemyId, joinedLate: true });
        // Resting after a kill: nothing to adopt until the next enemy steps up.
        runUntil(() => !!fightsOf(heroId).last, 180);
        expect(fightsOf(heroId).current).toBeNull();
        expect(adopt(heroId)).toBe(false);
        expect(fightsOf(heroId).last.outcome).toBe(OUTCOME.WON);
        stop();
    });

    it('a boss move’s name joins the log; a status’s callout does not (its landing has its own line)', () => {
        const { heroId, enemyId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => !!fightsOf(heroId).current, 10);
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: enemyId, title: 'Crushing Blow' });
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: enemyId, title: 'Poison' });
        const moves = fightsOf(heroId).current.log.filter(l => l.key === 'move');
        expect(moves.map(l => l.vars.move)).toEqual(['Crushing Blow']);
        stop();
    });

    it('lands Venomous poison and its ticks in the log, each tick saying what it took', () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        const ticks = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.STATUS_DOT_TICK, (p) => ticks.push(p));
        runUntil(() => ticks.some(t => t.targetType === 'hero' && t.hpChange < 0), 120);
        off();
        const tick = ticks.find(t => t.targetType === 'hero' && t.hpChange < 0);
        // Poison: 1 a stack a tick, ignoring armour.
        expect(tick.statusId).toBe(POISON);
        expect(tick.hpChange).toBe(-tick.stacks);
        const log = [...(fightsOf(heroId).current?.log || []), ...(fightsOf(heroId).last?.log || [])];
        expect(log.some(l => l.key === 'statusLands' && l.vars.status === 'Poison')).toBe(true);
        expect(log.some(l => l.key === 'statusHurts' && l.amount === `−${tick.stacks}`)).toBe(true);
        stop();
    });

    it('an enemy\'s swing names its Token', () => {
        const { enemyId } = buildFight();
        const swings = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => swings.push(p));
        runUntil(() => swings.length > 0, 30);
        off();
        expect(swings[0].instanceId).toBe(enemyId);
    });

    it('moments: the hero\'s swings land on the enemy, the enemy\'s on the hero, ticks with their status', () => {
        const { heroId, enemyId } = buildFight();
        const stop = startFightWatch();
        const seen = [];
        const off = subscribeMoments((m) => seen.push(m));
        runUntil(() => seen.some(m => m.kind === MOMENT.TICK) && seen.some(m => m.by === 'enemy'), 120);
        off();
        const heroSwings = seen.filter(m => m.by === 'hero' && m.on === 'enemy');
        expect(heroSwings.length).toBeGreaterThan(0);
        expect(heroSwings.every(m => [MOMENT.HIT, MOMENT.CRIT, MOMENT.MISS].includes(m.kind))).toBe(true);
        expect(seen.filter(m => m.by === 'enemy').every(m => m.on === 'hero')).toBe(true);
        const tick = seen.find(m => m.kind === MOMENT.TICK);
        expect(tick).toMatchObject({ on: 'hero', statusId: POISON, heroId, instanceId: enemyId });
        expect(tick.amount).toBeGreaterThan(0);
        stop();
    });

    it('a recalled hero\'s fight ends as "left" and becomes the last one', async () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => (fightsOf(heroId).current?.log.length || 0) > 3, 30);
        Placement.recallHeroById(heroId);
        await Promise.resolve();
        expect(fightsOf(heroId).current).toBeNull();
        expect(fightsOf(heroId).last.outcome).toBe(OUTCOME.LEFT);
        stop();
    });

    it('⭐ a catch-up records nothing and draws nothing (every listener is a UI listener)', async () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        let moments = 0;
        const off = subscribeMoments(() => { moments++; });
        const result = await CatchUp.run({ savedAt: NOW - 3 * 60_000, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        off();
        // Fights ran while away (kills counted by the engine's own listener)...
        expect(result.summary.fightsWon.total).toBeGreaterThan(0);
        // ...and the screen heard none of it.
        expect(moments).toBe(0);
        expect(fightsOf(heroId).current).toBeNull();
        expect(fightsOf(heroId).last).toBeNull();
        stop();
    });

    it('the catch-up summary counts the fights\' meals, elixirs and drops', async () => {
        buildFight();
        const result = await CatchUp.run({ savedAt: NOW - 10 * 60_000, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const { combat, fightsWon } = result.summary;
        expect(combat.elixirs.cs_elixir).toBeGreaterThanOrEqual(1);
        expect(combat.drops.item_bones).toBe(fightsWon.total);
        expect(Object.keys(combat.food).every(id => id === 'item_shrimp')).toBe(true);
    });
});

describe('the panel, the plate and the floats read the real fight', () => {
    it('the panel\'s view: both sides\' numbers from the engine, the elixir with its fights left', () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => (fightsOf(heroId).current?.log.length || 0) > 2, 20);
        const view = fightPanelView(heroId, fightsOf(heroId));
        expect(view.live).toBe(true);
        expect(view.title).toBe(`${HeroManager.getHero(heroId).name} vs Screen Venomous`);
        // Screen Sword 3 + level 20's step of 1; armour 1 from the elixir's buff; a normal swing.
        expect(view.hero).toMatchObject({ style: 'melee', level: 20, hit: 4, armour: 1, swingMs: 3000 });
        expect(view.hero.elixirs).toEqual([{ itemId: 'cs_elixir', name: 'Elixir of Testing', left: 9 }]);
        // Level 10 from the table: 30 health, a hit of 1, no armour; Venomous shows once fought.
        expect(view.enemy).toMatchObject({ level: 10, hit: 1, armour: 0, swingMs: 3000 });
        expect(view.enemy.hp.max).toBe(30);
        expect(view.enemy.kinds.map(k => k.id)).toEqual(['venomous']);
        stop();
    });

    it('⭐ the live panel opens with its log closed, on this fight', () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => (fightsOf(heroId).current?.log.length || 0) > 2, 20);
        const { container } = render(React.createElement(LiveFightPanel, { heroId, onClose: () => {} }));
        expect(container.querySelector('[data-fight-log="closed"]')).not.toBeNull();
        expect(container.querySelector('[data-fight-log-line]')).toBeNull();
        act(() => { fireEvent.click(container.querySelector('[data-fight-log-toggle]')); });
        expect(container.querySelector('[data-fight-log-tab="this"]').getAttribute('aria-selected')).toBe('true');
        expect(container.querySelectorAll('[data-fight-log-line]').length).toBe(fightsOf(heroId).current.log.length);
        stop();
    });

    it('the fight plate: the enemy\'s style, a divider, the hero\'s style and elixir, mirrored on the left', () => {
        const { heroId, enemyId } = buildFight();
        runUntil(() => !!activeElixirsOf(HeroManager.getHero(heroId)).length, 10);
        const plate = fightPlateOf(heroId, enemyId);
        const kinds = (cells) => cells.map(c => (c.kind === CELL.SKILL ? `${c.who}:${c.id}` : c.kind));
        expect(kinds(fightPlateCells({ ...plate, side: 1 }))).toEqual(['enemy:melee', CELL.DIVIDER, 'hero:melee', CELL.ELIXIR]);
        expect(kinds(fightPlateCells({ ...plate, side: -1 }))).toEqual([CELL.ELIXIR, 'hero:melee', CELL.DIVIDER, 'enemy:melee']);
        expect(fightPlateCells({ ...plate, side: 1 }).at(-1).count).toBe(9);
        // A Recruit has no style: the enemy's alone, then the elixirs.
        expect(kinds(fightPlateCells({ ...plate, heroStyle: null, side: 1 }))).toEqual(['enemy:melee', CELL.DIVIDER, CELL.ELIXIR]);
        expect(kinds(fightPlateCells({ ...plate, heroStyle: null, elixirs: [], side: 1 }))).toEqual(['enemy:melee']);
    });

    describe('floats', () => {
        let calls;
        let restore;
        let host;
        beforeEach(() => {
            calls = [];
            const proto = window.Element.prototype;
            const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
            const original = proto.animate;
            proto.animate = function animate(keyframes, options) {
                const a = { el: this, keyframes, options, onfinish: null, oncancel: null, cancel() {}, finish() { this.onfinish?.(); } };
                calls.push(a);
                return a;
            };
            restore = () => { if (had) proto.animate = original; else delete proto.animate; };
            host = document.createElement('div');
            document.body.appendChild(host);
            MatFx.attachFxHost(host, 2);
        });
        afterEach(() => { MatFx.attachFxHost(null); host.remove(); restore(); });

        it('⭐ rise at each fighter\'s outer side: white on the enemy (on the strike frame), red on the hero', () => {
            const { heroId, enemyId } = buildFight();
            const stop = watchFightFloats();
            runUntil(() => calls.some(c => c.el.getAttribute('data-fight-float-on') === 'hero')
                && calls.some(c => c.el.getAttribute('data-fight-float-on') === 'enemy'), 60);
            stop();
            const enemy = BoardState.getTokenById(enemyId);
            const body = HeroMotion.bodyView(heroId);
            const side = body.x >= enemy.x ? 1 : -1;
            const onEnemy = calls.find(c => c.el.getAttribute('data-fight-float-on') === 'enemy');
            const onHero = calls.find(c => c.el.getAttribute('data-fight-float-on') === 'hero');
            // Outside the pair: the enemy's float further from the hero than the enemy, the hero's further from the enemy.
            expect(Math.sign(parseFloat(onEnemy.el.style.left) - enemy.x)).toBe(-side);
            expect(Math.sign(parseFloat(onHero.el.style.left) - body.x)).toBe(side);
            const enemyKind = onEnemy.el.getAttribute('data-fight-float');
            if (enemyKind !== MOMENT.MISS) expect(onEnemy.el.className).toContain('gi-ff-white');
            expect(onEnemy.options.delay).toBe(STRIKE_DELAY_MS);
            const heroKind = onHero.el.getAttribute('data-fight-float');
            if (heroKind === MOMENT.HIT || heroKind === MOMENT.CRIT || heroKind === MOMENT.TICK) expect(onHero.el.className).toContain('gi-ff-red');
            expect(onHero.el.style.willChange).toBe('contents');
        });

        it('the matFx draw switch stops them', () => {
            buildFight();
            setDrawn('matFx', false);
            const stop = watchFightFloats();
            runUntil(() => false, 20);
            stop();
            expect(calls.filter(c => c.el.hasAttribute('data-fight-float'))).toHaveLength(0);
        });
    });
});

describe('a fight\'s link on the mat', () => {
    it('the chip opens the panel on its hero\'s fight', async () => {
        const { heroId } = buildFight();
        runUntil(() => false, 3);
        const { FightLayer } = await import('../ui/components/board/FightLayer.jsx');
        const { fightPanelState, closeFightPanel } = await import('../ui/components/combat/fightPanelStore.js');
        const enemy = BoardState.tokens().find(t => t.typeId === 'cs_venom');
        const { container } = render(React.createElement(FightLayer, { fights: [{ tokenId: enemy.id, heroId, typeId: 'cs_venom', x: enemy.x, y: enemy.y }] }));
        const chip = container.querySelector(`[data-fight-chip="${heroId}"]`);
        expect(chip).not.toBeNull();
        expect(container.querySelector(`[data-fight-plate="${enemy.id}"]`)).not.toBeNull();
        act(() => { fireEvent.click(chip); });
        expect(fightPanelState().heroId).toBe(heroId);
        act(() => { fireEvent.click(chip); });
        expect(fightPanelState()).toBeNull();
        closeFightPanel();
    });
});
