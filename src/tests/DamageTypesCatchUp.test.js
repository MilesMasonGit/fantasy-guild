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
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Typed fights during time away end exactly where the same time played live ends: the fraction
 * sub-roll draws in a fixed place (after the miss and crit), and an arrow is spent the same way
 * whether the loop runs live or in a catch-up. An archer shoots a crab that resists the arrow's
 * Stab (a 2.5 that rolls 2 or 3); a mage's Ice wand finds a Fire Elemental's weakness.
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

registerItems({
    dtc_bow: { id: 'dtc_bow', name: 'Spark Bow', type: 'weapon', equipSlot: 'hand', styles: ['ranged'], damage: 1, damageType: 'electric' },
    dtc_arrow: { id: 'dtc_arrow', name: 'Bodkin Arrow', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    dtc_wand: { id: 'dtc_wand', name: 'Frost Wand', type: 'weapon', equipSlot: 'hand', styles: ['magic'], damage: 1, damageType: 'ice' }
});

const enemy = (id, block) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 8, sprite: 's_crime', requiresHero: true,
    enemy: { level: 5, ...block },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
});
registerTokenTypes({
    dtc_crab: enemy('dtc_crab', { style: 'stealth', kinds: ['armoured'] }),
    dtc_elemental: enemy('dtc_elemental', { style: 'melee', resistances: { fire: 100, ice: -50 } })
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

function buildBoard() {
    stream.state = 11;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [archer, mage] = fixtures.makeHeroes(2, {});
    archer.skills.ranged = { level: 20, xp: xpForLevel(20) };
    mage.skills.magic = { level: 20, xp: xpForLevel(20) };
    archer.equipment[0] = 'dtc_bow';
    archer.equipment[1] = 'dtc_arrow';
    mage.equipment[0] = 'dtc_wand';
    InventoryManager.addItem('dtc_arrow', ARROWS);
    for (const h of [archer, mage]) {
        HeroManager.updateHeroFromSkills(h);
        h.hp.current = h.hp.max;
    }
    const a = fixtures.placeAt('dtc_crab', 400, 400);
    const b = fixtures.placeAt('dtc_elemental', 1300, 400);
    fixtures.orderAt(archer.id, { x: a.x, y: a.y });
    fixtures.orderAt(mage.id, { x: b.x, y: b.y });
    TileModifiers.rebuildAll();
    return { archerId: archer.id, mageId: mage.id };
}

function listen() {
    const seen = { kills: 0, shots: [], spells: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
            const line = `${p.hit ? p.damage : 'miss'}${p.crit ? '!' : ''}|${(p.types || []).join('+')}|${p.verdict || ''}|${p.arrowId || ''}`;
            (p.heroId === seen.archerId ? seen.shots : seen.spells).push(line);
        })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

const end = (ids, seen) => ({
    heroes: Object.fromEntries([ids.archerId, ids.mageId].map(id => {
        const h = GameState.state.heroes.find(x => x.id === id);
        return [id, { hp: { ...h.hp }, status: h.status, ranged: h.skills.ranged?.xp, magic: h.skills.magic?.xp }];
    })),
    uses: BoardState.tokens().filter(t => t.typeId.startsWith('dtc_')).map(t => `${t.typeId}:${t.usesRemaining}`),
    arrows: InventoryManager.getItemCount('dtc_arrow'),
    draws: stream.draws,
    seen
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
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
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('typed fights during a catch-up', () => {
    it('end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let ids = buildBoard();
        let watch = listen();
        watch.seen.archerId = ids.archerId;
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(ids, watch.stop());

        ids = buildBoard();
        watch = listen();
        watch.seen.archerId = ids.archerId;
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(ids, watch.stop());

        expect(caughtUp).toEqual(plain);

        // And the typed fights really happened: arrows were spent one a shot, the crab's
        // resisted Stab made a 2.5 (the bow's 1 + the level step, plus half the arrow's 1) that
        // rolled both ways, and the Ice wand found the weakness.
        const shots = plain.seen.shots;
        expect(shots.length).toBeGreaterThan(10);
        expect(plain.arrows).toBe(ARROWS - shots.length);
        const plainHits = shots.filter(s => !s.startsWith('miss') && !s.includes('!'));
        expect(plainHits.every(s => s.endsWith('|electric+stab|resisted|dtc_arrow'))).toBe(true);
        expect(new Set(plainHits.map(s => s.split('|')[0]))).toEqual(new Set(['2', '3']));
        expect(plain.seen.spells.filter(s => !s.startsWith('miss')).every(s => s.includes('|ice|weak|'))).toBe(true);
        expect(plain.seen.kills).toBeGreaterThanOrEqual(2);
    }, 60_000);
});
