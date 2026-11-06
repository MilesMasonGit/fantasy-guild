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
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { registerStatusFixtures, VENOM } from './fixtures/statusEffects.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Enemy moves during time away end exactly where the same time played live ends: the owner's chicken
 * (Peck, Scratch, Flutter) on a knight in plate, a biter whose Venom Bite lands Venom with its hits, a
 * smasher whose Smash hits double for the swing, and a plain goblin beside them. The move pick is one
 * draw a swing, in the same place live and away; the plain goblin's swings draw as they always did.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 4 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerStatusFixtures();
const provides = (id, type, value, category, bucket = 'flat') => ({
    ...makeStatement(KEYWORD.PROVIDES), id, to: null, payload: { type, bucket, value, ...(category ? { category } : {}) }
});
registerEffects({
    emc_flutter: { id: 'emc_flutter', name: 'Flutter', statements: [provides('stm_emc_flutter', EFFECT_TYPES.TYPE_RESIST, 50, 'physical')] },
    emc_heavy: { id: 'emc_heavy', name: 'Heavy Strike', statements: [provides('stm_emc_heavy', EFFECT_TYPES.DAMAGE, 1, null, 'percentage')] }
});

registerItems({
    emc_sword: { id: 'emc_sword', name: 'Sword', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 2 },
    emc_plate: { id: 'emc_plate', name: 'Plate', type: 'armor', equipSlot: 'chest', resistances: { physical: 20 } }
});

const enemy = (id, block) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 8, sprite: 's_crime', requiresHero: true,
    enemy: { level: 5, style: 'melee', ...block },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
});
registerTokenTypes({
    emc_chicken: enemy('emc_chicken', {
        hit: 2,
        moves: [
            { name: 'Peck', damageType: 'stab' },
            { name: 'Scratch', damageType: 'slash' },
            { name: 'Flutter', hits: false, effectId: 'emc_flutter', target: 'self', lasts: 'attack' }
        ]
    }),
    emc_biter: enemy('emc_biter', { hit: 2, moves: [{ name: 'Venom Bite', damageType: 'poison', effectId: VENOM }, { name: 'Claw', damageType: 'slash', weight: 2 }] }),
    emc_smasher: enemy('emc_smasher', { moves: [{ name: 'Smash', damageType: 'crush', effectId: 'emc_heavy', target: 'self', lasts: 'swing' }, { name: 'Shove' }] }),
    emc_goblin: enemy('emc_goblin', {})
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

const NAMES = ['knight', 'biten', 'smashed', 'plain'];

function buildBoard() {
    stream.state = 29;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const heroes = fixtures.makeHeroes(4, {});
    for (const h of heroes) {
        h.skills.melee = { level: 20, xp: xpForLevel(20) };
        InventoryManager.addItem('emc_sword', 1);
        const res = EquipmentManager.equipItem(h.id, 'emc_sword');
        if (!res.success) throw new Error(res.error);
    }
    InventoryManager.addItem('emc_plate', 1);
    EquipmentManager.equipItem(heroes[0].id, 'emc_plate');
    for (const h of heroes) {
        HeroManager.updateHeroFromSkills(h);
        h.hp.current = h.hp.max;
    }
    const places = [['emc_chicken', 300, 300], ['emc_biter', 1100, 300], ['emc_smasher', 300, 900], ['emc_goblin', 1100, 900]];
    places.forEach(([typeId, x, y], i) => {
        const at = fixtures.placeAt(typeId, x, y);
        fixtures.orderAt(heroes[i].id, { x: at.x, y: at.y });
    });
    TileModifiers.rebuildAll();
    return Object.fromEntries(heroes.map((h, i) => [NAMES[i], h.id]));
}

function listen(ids) {
    const nameOf = Object.fromEntries(Object.entries(ids).map(([n, id]) => [id, n]));
    const seen = { kills: 0, swings: [], taken: [], statuses: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => {
            seen.swings.push(`${nameOf[p.heroId]}:${p.hit ? p.damage : 'miss'}${p.crit ? '!' : ''}|${p.verdict || ''}`);
        }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => {
            seen.taken.push(`${nameOf[p.heroId]}:${p.move ?? '-'}:${p.effectOnly ? 'fx' : p.hit ? p.damage : 'miss'}|${(p.types || []).join('+')}|${p.verdict || ''}`);
        }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => { seen.statuses.push(`${p.statusId}:${p.targetType}:${p.stacks}`); })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

const end = (ids, seen) => ({
    heroes: Object.fromEntries(Object.entries(ids).map(([name, id]) => {
        const h = GameState.state.heroes.find(x => x.id === id);
        return [name, { hp: { ...h.hp }, status: h.status, xp: h.skills.melee?.xp }];
    })),
    uses: BoardState.tokens().filter(t => t.typeId.startsWith('emc_')).map(t => `${t.typeId}:${t.usesRemaining}`),
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

describe('enemy moves during a catch-up', () => {
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

        // And the moves really were made: each of the chicken's three, its Peck and Scratch resisted by
        // the knight's plate, Flutter turning some of the knight's hits Resisted; Venom from the bites;
        // the plain goblin naming no move.
        const s = plain.seen;
        const chicken = s.taken.filter(x => x.startsWith('knight:'));
        for (const move of ['Peck', 'Scratch', 'Flutter']) expect(chicken.some(x => x.startsWith(`knight:${move}:`)), move).toBe(true);
        expect(chicken.filter(x => /^knight:(Peck|Scratch):\d/.test(x)).every(x => x.endsWith('|resisted'))).toBe(true);
        expect(s.swings.some(x => x.startsWith('knight:') && x.endsWith('|resisted'))).toBe(true);
        expect(s.statuses.some(x => x.startsWith(`${VENOM}:hero`))).toBe(true);
        expect(s.taken.filter(x => x.startsWith('smashed:Smash:') && !x.includes('miss')).length).toBeGreaterThan(0);
        expect(s.taken.filter(x => x.startsWith('plain:')).every(x => x.startsWith('plain:-:'))).toBe(true);
        expect(s.kills).toBeGreaterThanOrEqual(3);
    }, 60_000);
});
