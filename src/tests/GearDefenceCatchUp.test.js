// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { registerStatusFixtures, SUNDER, VENOM } from './fixtures/statusEffects.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Gear and defence during time away end exactly where the same time played live ends: a knight in
 * a chestplate and a shield against a Venomous rat (its Physical swings resisted, Venom landing), a
 * mage in the chestplate (its cut on every spell), a spear and a sundering arrow stripping an
 * Armoured crab's resistance stack by stack. Nothing here adds a random draw: the cut and the
 * resistances move the fraction a hit rolls, never whether it rolls.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 4 * 60_000;
const ARROWS = 200;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerStatusFixtures();
registerEffects({
    gdc_sundering: {
        id: 'gdc_sundering', name: 'Sundering',
        statements: [{
            ...makeStatement(KEYWORD.APPLIES), id: 'stm_gdc_sunder',
            when: { event: 'FIGHT_HIT', scope: 'self', every: 1 },
            target: { role: ROLE.OPPONENT },
            payload: { effectId: SUNDER, chance: 100 }
        }]
    }
});

registerItems({
    gdc_sword: { id: 'gdc_sword', name: 'Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2 },
    gdc_shield: { id: 'gdc_shield', name: 'Kite Shield', type: 'armor', equipSlot: 'hand', offHand: true, resistances: { physical: 15 } },
    gdc_plate: { id: 'gdc_plate', name: 'Iron Chestplate', type: 'armor', equipSlot: 'chest', resistances: { physical: 20 }, damageCut: { magic: 30, stealth: 15 } },
    gdc_plate_b: { id: 'gdc_plate_b', name: 'Iron Chestplate B', type: 'armor', equipSlot: 'chest', resistances: { physical: 20 }, damageCut: { magic: 30, stealth: 15 } },
    gdc_wand: { id: 'gdc_wand', name: 'Frost Wand', type: 'weapon', equipSlot: 'hand', styles: ['magic'], damage: 2, damageType: 'ice' },
    gdc_spear: { id: 'gdc_spear', name: 'Spear', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2, damageType: 'stab', effects: [{ effectId: 'gdc_sundering', scale: 1 }] },
    gdc_bow: { id: 'gdc_bow', name: 'Bow', type: 'weapon', equipSlot: 'hand', styles: ['ranged'], damage: 1, damageType: 'electric' },
    gdc_bodkin: { id: 'gdc_bodkin', name: 'Sundering Bodkin', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' }, effects: [{ effectId: 'gdc_sundering', scale: 1 }] }
});

const enemy = (id, block) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 8, sprite: 's_crime', requiresHero: true,
    enemy: { level: 5, ...block },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
});
registerTokenTypes({
    gdc_rat: enemy('gdc_rat', { style: 'melee', hit: 3, kinds: ['venomous'] }),
    gdc_dummy: enemy('gdc_dummy', { style: 'melee' }),
    gdc_crab: enemy('gdc_crab', { style: 'stealth', kinds: ['armoured'], resistances: { crush: -50 } })
});

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

const NAMES = ['knight', 'mage', 'lancer', 'archer'];

function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const heroes = fixtures.makeHeroes(4, {});
    const [knight, mage, lancer, archer] = heroes;
    knight.skills.melee = { level: 20, xp: xpForLevel(20) };
    mage.skills.magic = { level: 20, xp: xpForLevel(20) };
    lancer.skills.melee = { level: 20, xp: xpForLevel(20) };
    archer.skills.ranged = { level: 20, xp: xpForLevel(20) };
    const kit = {
        [knight.id]: ['gdc_sword', 'gdc_shield', 'gdc_plate'],
        [mage.id]: ['gdc_wand', 'gdc_plate_b'],
        [lancer.id]: ['gdc_spear'],
        [archer.id]: ['gdc_bow', 'gdc_bodkin']
    };
    InventoryManager.addItem('gdc_bodkin', ARROWS);
    for (const h of heroes) {
        for (const itemId of kit[h.id]) {
            if (itemId !== 'gdc_bodkin') InventoryManager.addItem(itemId, 1);
            const res = EquipmentManager.equipItem(h.id, itemId);
            if (!res.success) throw new Error(res.error);
        }
        HeroManager.updateHeroFromSkills(h);
        h.hp.current = h.hp.max;
    }
    const places = [['gdc_rat', 300, 300], ['gdc_dummy', 1100, 300], ['gdc_crab', 300, 900], ['gdc_crab', 1100, 900]];
    places.forEach(([typeId, x, y], i) => {
        const at = fixtures.placeAt(typeId, x, y);
        fixtures.orderAt(heroes[i].id, { x: at.x, y: at.y });
    });
    TileModifiers.rebuildAll();
    return Object.fromEntries(heroes.map((h, i) => [NAMES[i], h.id]));
}

function listen(ids) {
    const nameOf = Object.fromEntries(Object.entries(ids).map(([n, id]) => [id, n]));
    const seen = { kills: 0, swings: Object.fromEntries(NAMES.map(n => [n, []])), taken: [], statuses: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
            seen.swings[nameOf[p.heroId]]?.push(`${p.hit ? p.damage : 'miss'}${p.crit ? '!' : ''}|${(p.types || []).join('+')}|${p.verdict || ''}|${p.arrowId || ''}`);
        }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => {
            seen.taken.push(`${nameOf[p.heroId]}:${p.hit ? p.damage : 'miss'}|${p.verdict || ''}`);
        }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => { seen.statuses.push(`${p.statusId}:${p.targetType}:${p.stacks}`); })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

const end = (ids, seen) => ({
    heroes: Object.fromEntries(Object.entries(ids).map(([name, id]) => {
        const h = GameState.state.heroes.find(x => x.id === id);
        return [name, { hp: { ...h.hp }, status: h.status, skills: Object.fromEntries(['melee', 'magic', 'ranged'].map(s => [s, h.skills[s]?.xp])) }];
    })),
    uses: BoardState.tokens().filter(t => t.typeId.startsWith('gdc_')).map(t => `${t.typeId}:${t.usesRemaining}`),
    arrows: InventoryManager.getItemCount('gdc_bodkin'),
    draws: stream.draws,
    seen
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('gear and defence during a catch-up', () => {
    it('end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let ids = buildBoard();
        let watch = listen(ids);
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(ids, watch.stop());

        ids = buildBoard();
        watch = listen(ids);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(ids, watch.stop());

        expect(caughtUp).toEqual(plain);

        // And the gear really worked: the knight's 35 % Physical took every landed rat swing as
        // Resisted while Venom landed; the mage's spells carried the cut (Ice 2 + the level step 1,
        // × 0.7 = 2.1, so 2s and the odd 3); Sunder built on the crabs from the spear and the arrows.
        const s = plain.seen;
        const knightTaken = s.taken.filter(t => t.startsWith('knight:') && !t.includes('miss'));
        expect(knightTaken.length).toBeGreaterThan(3);
        expect(knightTaken.every(t => t.endsWith('|resisted'))).toBe(true);
        expect(s.statuses.some(x => x.startsWith(`${VENOM}:hero`))).toBe(true);
        const spells = s.swings.mage.filter(x => !x.startsWith('miss') && !x.includes('!'));
        expect(spells.length).toBeGreaterThan(10);
        expect(new Set(spells.map(x => x.split('|')[0]))).toEqual(new Set(['2', '3']));
        expect(s.statuses.filter(x => x.startsWith(`${SUNDER}:enemy:3`)).length).toBeGreaterThanOrEqual(2);
        expect(s.swings.archer.every(x => x.endsWith('|gdc_bodkin'))).toBe(true);
        expect(plain.arrows).toBe(ARROWS - s.swings.archer.length);
        expect(s.kills).toBeGreaterThanOrEqual(3);
    }, 60_000);
});
