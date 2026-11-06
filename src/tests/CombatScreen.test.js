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
import { registerStatusFixtures, providesFlat, VENOM } from './fixtures/statusEffects.js';
import {
    startFightWatch, resetFightWatch, fightsOf, subscribeMoments, adopt, MOMENT, OUTCOME
} from '../ui/components/combat/fightWatch.js';
import { LiveFightPanel } from '../ui/components/combat/FightPanel.jsx';
import { fightPanelView, activeElixirsOf } from '../ui/components/combat/fightView.js';
import * as MatFx from '../ui/components/board/fx/matFx.js';
import { watchFightFloats } from '../ui/components/board/fx/fightFloats.js';
import { STRIKE_DELAY_MS } from '../ui/components/board/hitAnimations.js';
import { fightReach, fightBarShift, CHIP, CHIP_PX, MAT_BAR } from '../ui/components/board/healthBar.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';

/**
 * The combat screen read from a real fight (brief 220, C6b): the fight watch keeps each fight's
 * whole log and the last one, the floats rise over each fighter, the panel reads the engine's
 * numbers, the "While you were away" summary counts the fights' supplies
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
    cs_fx_buff: { id: 'cs_fx_buff', name: 'Tested', statements: [{ ...providesFlat('stm_cs_buff', EFFECT_TYPES.TYPE_RESIST, 25), payload: { type: EFFECT_TYPES.TYPE_RESIST, bucket: 'flat', value: 25, category: 'physical' } }] },
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
    fixtures.orderAt(hero.id, { x: foe.x, y: foe.y });
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
        EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: enemyId, title: 'Venom' });
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
        // Venom: 1 a stack a tick.
        expect(tick.statusId).toBe(VENOM);
        expect(tick.hpChange).toBe(-tick.stacks);
        const log = [...(fightsOf(heroId).current?.log || []), ...(fightsOf(heroId).last?.log || [])];
        expect(log.some(l => l.key === 'statusLands' && l.vars.status === 'Venom')).toBe(true);
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
        expect(tick).toMatchObject({ on: 'hero', statusId: VENOM, heroId, instanceId: enemyId });
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
        // Screen Sword 3 + level 20's step of 1, Slash; Physical 25 % from the elixir's buff (it was
        // armour 1 before damage types); a normal swing.
        expect(view.hero).toMatchObject({ style: 'melee', level: 20, hit: 4, resists: [{ id: 'physical', value: 25 }], swingMs: 3000 });
        expect(view.hero.hitParts).toEqual([{ type: 'slash', hit: 4, arrow: false }]);
        // Ten fights to a dose, this one counted (owner, 2026-10-25); nine more after it.
        expect(view.hero.elixirs).toEqual([{ itemId: 'cs_elixir', name: 'Elixir of Testing', left: 9, count: 10 }]);
        // Level 10 from the table: 30 health, a Physical hit of 1, no resistances; Venomous shows once fought.
        expect(view.enemy).toMatchObject({ level: 10, hit: 1, hitType: 'physical', resists: [], swingMs: 3000 });
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

        it('⭐ rise over each fighter, under its bar: white on the enemy (on the strike frame), red on the hero', () => {
            const { heroId, enemyId } = buildFight();
            const stop = watchFightFloats();
            runUntil(() => calls.some(c => c.el.getAttribute('data-fight-float-on') === 'hero')
                && calls.some(c => c.el.getAttribute('data-fight-float-on') === 'enemy'), 60);
            stop();
            const enemy = BoardState.getTokenById(enemyId);
            const body = HeroMotion.bodyView(heroId);
            const onEnemy = calls.find(c => c.el.getAttribute('data-fight-float-on') === 'enemy');
            const onHero = calls.find(c => c.el.getAttribute('data-fight-float-on') === 'hero');
            // Over the fighter's middle, hung by its top just under the top of its art (64 over its point here).
            expect(parseFloat(onEnemy.el.style.left)).toBe(enemy.x);
            expect(parseFloat(onHero.el.style.left)).toBe(body.x);
            for (const [c, at] of [[onEnemy, enemy], [onHero, body]]) {
                const top = parseFloat(c.el.style.top);
                expect(top).toBeGreaterThan(at.y - 64);
                expect(top).toBeLessThan(at.y);
                expect(c.el.style.translate).toBe('-50% 0');
            }
            expect(onEnemy.el.className).toContain('gi-ff-white');
            expect(onEnemy.options.delay).toBe(STRIKE_DELAY_MS);
            if (onHero.el.getAttribute('data-fight-float') !== MOMENT.HEAL) expect(onHero.el.className).toContain('gi-ff-red');
            expect(onHero.el.style.willChange).toBe('contents');
            // No damage types, verdicts or move names on the mat: the fight window and the bubbles say those.
            expect(calls.some(c => c.el.querySelector?.('[data-fight-float-type], .gi-ff-weak-word, .gi-ff-resisted-word, .gi-ff-move-word'))).toBe(false);
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

describe('a fight\'s button on the mat', () => {
    it('the button opens the panel on its hero\'s fight, and there is no plate', async () => {
        const { heroId } = buildFight();
        runUntil(() => false, 3);
        const { FightLayer } = await import('../ui/components/board/FightLayer.jsx');
        const { fightPanelState, closeFightPanel } = await import('../ui/components/combat/fightPanelStore.js');
        const enemy = BoardState.tokens().find(t => t.typeId === 'cs_venom');
        const body = HeroMotion.bodyView(heroId);
        const { container } = render(React.createElement(FightLayer, { fights: [{ tokenId: enemy.id, heroId, typeId: 'cs_venom', x: enemy.x, y: enemy.y, hx: body.x, hy: body.y }] }));
        const chip = container.querySelector(`[data-fight-chip="${heroId}"]`);
        expect(chip).not.toBeNull();
        expect(container.querySelector('[data-fight-plate], [data-fight-plate-slot], [data-plate-cell]')).toBeNull();
        act(() => { fireEvent.click(chip); });
        expect(fightPanelState().heroId).toBe(heroId);
        act(() => { fireEvent.click(chip); });
        expect(fightPanelState()).toBeNull();
        closeFightPanel();
    });
});

describe('the fight window belongs to its hero (owner, 2026-11-05)', () => {
    registerTokenTypes({ cs_wolfish: enemy('cs_wolfish', 'Screen Wolf', { level: 5 }) });

    it('⭐ shows the last result between fights, then turns to the next enemy: Kira vs Goblin becomes Kira vs Wolf', () => {
        const { heroId } = buildFight();
        const stop = startFightWatch();
        const name = HeroManager.getHero(heroId).name;
        runUntil(() => !!fightsOf(heroId).current, 20);
        const { container } = render(React.createElement(LiveFightPanel, { heroId, onClose: () => {} }));
        const title = () => container.querySelector('[data-fight-title]').textContent.replace(/\s+/g, ' ').trim();
        expect(title()).toBe(`${name} vs Screen Venomous`);
        expect(container.querySelector('[data-fight-result]')).toBeNull();

        act(() => runUntil(() => fightsOf(heroId).last?.outcome === OUTCOME.WON));
        expect(fightsOf(heroId).current).toBeNull();
        expect(title()).toBe(`${name} vs Screen Venomous`);
        expect(container.querySelector('[data-fight-result]').getAttribute('data-fight-result')).toBe(OUTCOME.WON);
        expect(container.querySelector('[data-fight-hp="enemy"]').textContent).toBe('0/30');

        const wolf = fixtures.placeAt('cs_wolfish', 900, 400);
        act(() => { fixtures.orderAt(heroId, { x: wolf.x, y: wolf.y }); });
        act(() => runUntil(() => fightsOf(heroId).current?.typeId === 'cs_wolfish', 60));
        expect(title()).toBe(`${name} vs Screen Wolf`);
        expect(container.querySelector('[data-fight-result]')).toBeNull();
        expect(fightsOf(heroId).last.enemyName).toBe('Screen Venomous');
        stop();
    });

    it('a minimized window tab shows both healths and draws again only when one of them changes', async () => {
        const { FightTab, tabKey } = await import('../ui/components/combat/FightTab.jsx');
        const { heroId } = buildFight();
        const stop = startFightWatch();
        runUntil(() => (fightsOf(heroId).current?.log.length || 0) > 2, 20);
        const { container } = render(React.createElement(FightTab, { heroId }));
        const record = fightsOf(heroId).current;
        const hp = (who) => container.querySelector(`[data-fight-tab-hp="${who}"]`).textContent;
        expect(hp('hero')).toBe(`${record.hp.hero.cur}/${record.hp.hero.max}`);
        expect(hp('enemy')).toBe(`${record.hp.enemy.cur}/${record.hp.enemy.max}`);
        expect(container.querySelector('[data-fight-tab-enemy]').textContent).toBe('Screen Venomous');
        // A new log line with no change of health is the same tab.
        const before = tabKey(fightsOf(heroId));
        expect(tabKey({ current: { ...record, log: [...record.log, { n: 999 }] }, last: null })).toBe(before);
        act(() => runUntil(() => fightsOf(heroId).current?.hp.enemy.cur !== record.hp.enemy.cur || !fightsOf(heroId).current, 20));
        const now = fightsOf(heroId).current || fightsOf(heroId).last;
        expect(hp('enemy')).toBe(`${now.hp.enemy.cur}/${now.hp.enemy.max}`);
        stop();
    });
});

describe('an elixir counts the fight it is working in (owner, 2026-10-25: 10 down to 1)', () => {
    it('a fresh one shows 10, one less as each fight ends, 1 in its last fight, then it is gone', () => {
        const { heroId, enemyId } = buildFight();
        const hero = () => HeroManager.getHero(heroId);
        const shown = () => activeElixirsOf(hero()).map(e => e.count);
        const engaged = () => {
            const fight = BoardCombat.fightOfHero(heroId);
            return !!fight && !((fight.combat?.state?.intermissionTimer ?? 0) > 0);
        };
        runUntil(() => engaged() && activeElixirsOf(hero()).length > 0, 10);
        expect(shown()).toEqual([10]);
        expect(fightPanelView(heroId, { current: null, last: null }) ?? null).toBeNull();
        // The first enemy falls: resting before the next, nine fights are left.
        runUntil(() => !engaged(), 180);
        expect(shown()).toEqual([9]);
        // The next one steps up: it is one of those nine.
        runUntil(() => engaged(), 10);
        expect(shown()).toEqual([9]);
        // Its last fight: one dose left to count, this one.
        hero().elixirFights.cs_elixir = 1;
        InventoryManager.removeItem('cs_elixir', InventoryManager.getItemCount('cs_elixir'));
        runUntil(() => !engaged(), 180);
        runUntil(() => engaged(), 10);
        expect(shown()).toEqual([1]);
        // That fight ends with none left in the Bank: the elixir is spent.
        runUntil(() => !engaged(), 180);
        expect(shown()).toEqual([]);
    });
});

describe('nothing covers a fighter\'s health number (owner, 2026-10-25: everything above it)', () => {
    /** The y of the first `translate(x, y)` of an element's transform. */
    const yOf = (el) => Number(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform)[2]);
    /** How far over its art's top a fighter's bar, number and chip reach at a 1:1 mat (one screen pixel a plate pixel). */
    const reach = () => fightReach(1);
    /** A fresh callout layer. */
    async function calloutLayer() {
        const { CalloutLayer } = await import('../ui/components/board/CalloutLayer.jsx');
        return render(React.createElement(CalloutLayer)).container;
    }

    it('the reach is the bar, or the fight button whose middle is on it, whichever is higher', () => {
        expect(fightReach(1)).toBe(MAT_BAR.GAP + Math.max(MAT_BAR.H, MAT_BAR.H / 2 + CHIP_PX / 2));
        expect(fightReach(2)).toBe(2 * fightReach(1));
    });

    it('⭐ a boss rule over an enemy in a fight sits above its bar and the button', async () => {
        const { enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const container = await calloutLayer();
        act(() => { EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: enemyId, title: 'Enrage' }); });
        const group = container.querySelector('[data-callout]').parentElement;
        const enemy = BoardState.getTokenById(enemyId);
        // The art's top at a 1:1 mat: the Token's 128 box over its centre.
        expect(yOf(group)).toBeLessThanOrEqual(enemy.y - 64 - reach());
    });

    it('⭐ an enemy\'s named move is said in a bubble over its bar; a second bubble stacks over the first, never on it', async () => {
        const { heroId, enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const container = await calloutLayer();
        act(() => {
            EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { heroId, instanceId: enemyId, move: 'Shiv', hit: true, damage: 1, heroHpRemaining: 10 });
            EventBus.publish(ENGINE_EVENTS.STATUS_APPLIED, { targetType: 'enemy', targetId: enemyId, statusId: VENOM, stacks: 1 });
        });
        const said = [...container.querySelectorAll('[data-callout]')];
        expect(said.map(el => el.getAttribute('data-callout'))).toEqual(['Shiv', 'Venom!']);
        // One column over the enemy: each bubble in the flow of one stack, so none can sit on another.
        expect(said[0].parentElement).toBe(said[1].parentElement);
        expect(said[0].parentElement.className).toContain('flex-col-reverse');
        const enemy = BoardState.getTokenById(enemyId);
        expect(yOf(said[0].parentElement)).toBeLessThanOrEqual(enemy.y - 64 - reach());
    });

    it('a status\'s own name fired over a fighting enemy is not said there: its landing is, over whoever it lands on', async () => {
        const { enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const container = await calloutLayer();
        act(() => { EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: enemyId, title: 'Venom' }); });
        expect(container.querySelector('[data-callout]')).toBeNull();
    });

    it('⭐ a status landing on a fighting hero is said over the hero\'s bar: "Venom!"', async () => {
        const { heroId, enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const { HeroBubbleLayer } = await import('../ui/components/board/HeroBubbleLayer.jsx');
        const body = HeroMotion.bodyView(heroId);
        const heroes = [{ heroId, state: 'working', x: body.x, y: body.y, moving: false, tokenId: enemyId, combat: true, hurt: false }];
        const { container } = render(React.createElement(HeroBubbleLayer, { heroes }));
        await new Promise(r => setTimeout(r, 2));
        act(() => { EventBus.publish(ENGINE_EVENTS.STATUS_APPLIED, { targetType: 'hero', targetId: heroId, statusId: VENOM, stacks: 1 }); });
        const stack = container.querySelector(`[data-hero-bubble-stack="${heroId}"]`);
        expect(stack.textContent).toBe('Venom!');
        expect(yOf(stack)).toBeLessThanOrEqual(body.y - 64 - reach());
    });

    it('⭐ a hero\'s speech over a fighter sits above the bar\'s number', async () => {
        const { heroId, enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const { HeroBubbleLayer } = await import('../ui/components/board/HeroBubbleLayer.jsx');
        const body = HeroMotion.bodyView(heroId);
        const heroes = [{ heroId, state: 'working', x: body.x, y: body.y, moving: false, tokenId: enemyId, combat: true, hurt: false }];
        const { container } = render(React.createElement(HeroBubbleLayer, { heroes }));
        await new Promise(r => setTimeout(r, 2));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'tok_gone', typeId: 'fixture_producer', exhaustedBy: heroId }); });
        const stack = container.querySelector(`[data-hero-bubble-stack="${heroId}"]`);
        // The stack's foot (its tail hangs below it) clears the hero's art top by the reach.
        expect(yOf(stack)).toBeLessThanOrEqual(body.y - 64 - reach());
        cleanup();
        // Not fighting and whole: just over the head, as before.
        const calm = [{ ...heroes[0], combat: false }];
        const { container: c2 } = render(React.createElement(HeroBubbleLayer, { heroes: calm }));
        // A millisecond passes first, as in play: the layer redraws on the clock it is told.
        await new Promise(r => setTimeout(r, 2));
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'tok_gone2', typeId: 'fixture_producer', exhaustedBy: heroId }); });
        expect(yOf(c2.querySelector(`[data-hero-bubble-stack="${heroId}"]`))).toBeGreaterThan(body.y - 64 - reach());
    });

    it('⭐ a "used" bubble over a hero in a fight sits above the bar\'s number', () => {
        const calls = [];
        const proto = window.Element.prototype;
        const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
        const original = proto.animate;
        proto.animate = function animate(keyframes, options) {
            const a = { el: this, keyframes, options, onfinish: null, oncancel: null, cancel() {}, finish() { this.onfinish?.(); } };
            calls.push(a);
            return a;
        };
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
            const { heroId, enemyId } = buildFight();
            runUntil(() => !!BoardCombat.getFight(enemyId), 10);
            // A 1:1 mat: art drawn at 2, one screen pixel a plate pixel.
            MatFx.attachFxHost(host, 2, 1);
            MatFx.usedBubble(heroId, 'cs_elixir', 'Elixir of Testing');
            const column = host.querySelector(`[data-fx-used-column="${heroId}"]`);
            const body = HeroMotion.bodyView(heroId);
            expect(parseFloat(column.style.top)).toBeLessThanOrEqual(body.y - 64 - reach());
        } finally {
            MatFx.attachFxHost(null);
            host.remove();
            if (had) proto.animate = original; else delete proto.animate;
        }
    });
});

describe('⭐ a fight\'s health bars draw over the loot (owner, 2026-10-25: drops never cover a number)', () => {
    /** The mat with a fight on it, its loot layer and the fight layer's bar host. */
    async function matInFight() {
        const { heroId, enemyId } = buildFight();
        runUntil(() => !!BoardCombat.getFight(enemyId), 10);
        const { DndContext } = await import('@dnd-kit/core');
        const { MatBoard } = await import('../ui/components/board/MatBoard.jsx');
        const view = render(React.createElement(DndContext, null, React.createElement(MatBoard)));
        await act(async () => {});
        return { heroId, enemyId, container: view.container };
    }
    const bars = (root, who, of) => [...root.querySelectorAll(`[data-health-bar="${who}"][data-health-of="${of}"]`)];

    it('both fighters\' bars sit in the fight layer, above the loot\'s z, once each', async () => {
        const { MAT_Z } = await import('../ui/components/board/matLayers.js');
        const SpriteLayer = await import('../systems/board/SpriteLayer.js');
        const { container, heroId, enemyId } = await matInFight();
        // A drop over the fight, as a kill scatters them.
        await act(async () => { SpriteLayer.addSprite('item', 'item_bones', 1, enemyId); });
        const host = container.querySelector('[data-fight-bars]');
        expect(host).not.toBeNull();
        expect(Number(host.style.zIndex)).toBe(MAT_Z.FIGHT);
        expect(MAT_Z.FIGHT).toBeGreaterThan(MAT_Z.LOOT);
        // The loot layer's own z, as drawn: under the bars.
        const loot = [...container.querySelectorAll('div')].find(el => Number(el.style.zIndex) === MAT_Z.LOOT);
        expect(loot).toBeTruthy();
        expect(Number(host.style.zIndex)).toBeGreaterThan(Number(loot.style.zIndex));
        // No double bars: each fighter's bar once on the whole mat, and that one in the host.
        expect(bars(container, 'hero', heroId)).toHaveLength(1);
        expect(bars(container, 'enemy', enemyId)).toHaveLength(1);
        expect(host.contains(bars(container, 'hero', heroId)[0])).toBe(true);
        expect(host.contains(bars(container, 'enemy', enemyId)[0])).toBe(true);
        expect(container.querySelector(`[data-board-hero="${heroId}"] [data-health-bar]`)).toBeNull();
        expect(container.querySelector(`[data-token-id="${enemyId}"] [data-health-bar]`)).toBeNull();
    });

    it('each bar stands where it stood on its fighter: the hero\'s over the hero\'s box, the enemy\'s over its box', async () => {
        const { heroBarPlace, enemyBarPlace } = await import('../ui/components/board/healthBar.js');
        const { heroBoxAt } = await import('../ui/components/board/MatHero.jsx');
        const { tokenBoxPx } = await import('../ui/components/board/MatToken.jsx');
        const { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } = await import('../ui/components/base/TokenSprite.jsx');
        const { plateUnit } = await import('../ui/components/board/workPlate.js');
        const { container, heroId, enemyId } = await matInFight();
        const u = plateUnit(1);
        const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(1));
        const box = heroBoxAt(HeroMotion.bodyView(heroId));
        const h = heroBarPlace(artPx, u);
        const hero = bars(container, 'hero', heroId)[0];
        const enemyAt = BoardState.getTokenById(enemyId);
        const apart = HeroMotion.bodyView(heroId).x - enemyAt.x;
        // Out of the fight button's way: moved away from the enemy, if at all.
        const out = Math.sign(apart) * fightBarShift(apart, u);
        expect(parseFloat(hero.style.left)).toBeCloseTo(box.left + h.left + out, 6);
        expect(parseFloat(hero.style.top)).toBeCloseTo(box.top + h.top, 6);
        expect(parseFloat(hero.style.width)).toBeCloseTo(h.width, 6);

        const enemy = BoardState.getTokenById(enemyId);
        const boxPx = tokenBoxPx('cs_venom', tokenSizeFor(TOKEN_SURFACE.BOARD, 'cs_venom', boardScaleAt(1)));
        const e = enemyBarPlace(boxPx, u);
        const bar = bars(container, 'enemy', enemyId)[0];
        expect(parseFloat(bar.style.left)).toBeCloseTo(enemy.x - boxPx / 2 + e.left - out, 6);
        expect(parseFloat(bar.style.top)).toBeCloseTo(enemy.y - boxPx / 2 + e.top, 6);
    });

    it('⭐ the fight button stands between the two bars, clear of each, its middle on theirs; no plate under the fight', async () => {
        const { container, heroId, enemyId } = await matInFight();
        const box = (el) => {
            const left = parseFloat(el.style.left);
            const top = parseFloat(el.style.top);
            const width = parseFloat(el.style.width);
            const height = el.style.height ? parseFloat(el.style.height) : MAT_BAR.H;
            return { left, top, right: left + width, bottom: top + height, mid: top + height / 2 };
        };
        const slot = container.querySelector(`[data-fight="${enemyId}"] [data-fight-button-slot]`);
        expect(slot).not.toBeNull();
        expect(slot.querySelector(`[data-fight-chip="${heroId}"]`)).not.toBeNull();
        const b = box(slot);
        expect(b.right - b.left).toBe(CHIP_PX);
        const hero = box(bars(container, 'hero', heroId)[0]);
        const enemy = box(bars(container, 'enemy', enemyId)[0]);
        const [l, r] = hero.left < enemy.left ? [hero, enemy] : [enemy, hero];
        expect(b.left - l.right).toBeGreaterThanOrEqual(CHIP.GAP - 0.5);
        expect(r.left - b.right).toBeGreaterThanOrEqual(CHIP.GAP - 0.5);
        expect(Math.abs(b.mid - Math.max(hero.mid, enemy.mid))).toBeLessThanOrEqual(0.5);
        // The plate is gone: nothing of a work plate or the old fight plate under the fighters.
        expect(container.querySelector('[data-fight-plate], [data-fight-plate-slot]')).toBeNull();
        expect(container.querySelector(`[data-work-plate="${enemyId}"]`)).toBeNull();
    });

    it('a click on the hero\'s bar still opens the hero', async () => {
        const { container, heroId } = await matInFight();
        const inspected = [];
        const off = EventBus.subscribe('inspect_hero', (p) => inspected.push(p.heroId));
        fireEvent.click(bars(container, 'hero', heroId)[0].querySelector('[data-health-label]'));
        off();
        expect(inspected).toEqual([heroId]);
    });
});
