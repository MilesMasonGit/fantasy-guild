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
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The gear pass's random numbers in a catch-up (brief 220, C2): a Cleaver's chance to double Raw
 * Beef draws one number per beef that lands, and a Venomous enemy's poison one per hit it lands.
 * Both come from `Math.random` in a fixed order, so time away ends exactly where the same time
 * played live ends. The same harness as `CombatCatchUp.test.js`, kept in its own file.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 6 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerEffects({
    gearcatchup_cleaver_family: {
        id: 'gearcatchup_cleaver_family', name: 'Cleaver',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'DOUBLE_DROP', bucket: 'flat', value: 50, category: 'item_raw_beef' } }]
    }
});

registerItems({
    gearcatchup_cleaver: {
        id: 'gearcatchup_cleaver', name: 'Catch-up Cleaver', type: 'weapon', equipSlot: 'hand', styles: ['melee'], damage: 6,
        effects: [{ effectId: 'gearcatchup_cleaver_family', scale: 1 }]
    }
});

registerTokenTypes({
    // Venomous (a random number per landed hit) and Brute, dropping beef for the Cleaver.
    gearcatchup_enemy: {
        id: 'gearcatchup_enemy', name: 'Catch-up Venomous Brute', tokenType: 'enemy', rarity: 'common',
        theme: 'fixture', uses: 20, sprite: 's_crime', requiresHero: true,
        enemy: { level: 5, style: 'melee', kinds: ['venomous', 'brute'] },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [
                { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'item_raw_beef', chance: 100, minQty: 1, maxQty: 1 }
            ]
        }
    }
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

/** A Melee 60 hero with a Cleaver, pinned to a Venomous Brute that drops Bones and Raw Beef. */
function buildBoard() {
    stream.state = 11;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [fighter] = fixtures.makeHeroes(1, {});
    fighter.skills.melee = { level: 60, xp: xpForLevel(60) };
    // Through the equip path, so the hero holds the copy and its family's ability is carried.
    InventoryManager.addItem('gearcatchup_cleaver', 1);
    expect(EquipmentManager.equipItem(fighter.id, 'gearcatchup_cleaver').success).toBe(true);
    HeroManager.updateHeroFromSkills(fighter);
    fighter.hp.current = fighter.hp.max;
    const a = fixtures.placeAt('gearcatchup_enemy', 400, 400);
    fixtures.plant(fighter.id, { x: a.x, y: a.y }, { pin: true });
    TileModifiers.rebuildAll();
    return fighter.id;
}

function listen() {
    const seen = { kills: 0, defeats: 0, beef: [], poisoned: 0 };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; }),
        EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, (p) => {
            for (const d of p.drops || []) if (d.itemId === 'item_raw_beef') seen.beef.push(d.quantity);
        }),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => { if (p.statusId === 'poison') seen.poisoned++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

function end(fighterId, seen) {
    const h = GameState.state.heroes.find(x => x.id === fighterId);
    return {
        hero: { hp: { ...h.hp }, status: h.status, xp: h.skills.melee?.xp ?? null, poison: h.statuses?.find(s => s.id === 'poison')?.stacks ?? 0 },
        uses: BoardState.tokens().filter(t => t.typeId === 'gearcatchup_enemy').map(t => t.usesRemaining),
        draws: stream.draws,
        seen
    };
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

describe('gear abilities and enemy kinds during a catch-up', () => {
    it('a Cleaver against a Venomous Brute ends exactly where the same 1000 ms steps through the plain loop end', async () => {
        let fighterId = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(fighterId, seen.stop());

        fighterId = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(fighterId, seen.stop());

        expect(caughtUp).toEqual(plain);

        // The abilities really ran: beef doubled on some kills and not others, and the Brute's hits poisoned.
        expect(plain.seen.kills).toBeGreaterThanOrEqual(3);
        expect(plain.seen.beef).toContain(2);
        expect(plain.seen.beef).toContain(1);
        expect(plain.seen.poisoned).toBeGreaterThan(0);
    }, 60_000);
});
