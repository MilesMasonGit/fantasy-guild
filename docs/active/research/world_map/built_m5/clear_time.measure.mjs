// M5 measurement (not part of the suite): how long a settled place's arrival takes to clear, with
// heroes walking, when the enemies stand in the old lair against the new spread. Copied into
// src/tests to run, then deleted.
import { it, expect, vi } from 'vitest';
import fs from 'fs';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Placement from '../systems/board/Placement.js';
import * as Occupation from '../systems/board/Occupation.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { mulberry32 } from '../systems/atlas/seededRandom.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

const OUT = process.env.FG_M5_OUT;

// The lair as it was (crunch/ring-stars 9e4043b9, Arrival.js), copied exactly.
const LAIR_BAND = 0.72;
const LAIR_SPREAD = 84;
const LAIR_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
function lairOf(seed, w = matW(), h = matH()) {
    const random = mulberry32((Number(seed) >>> 0) ^ 0x5eed1a1);
    let ux = 1; let uy = 0;
    for (let k = 0; k < 32; k++) {
        const x = random() * 2 - 1; const y = random() * 2 - 1; const d = x * x + y * y;
        if (d > 0.04 && d <= 1) { const l = Math.sqrt(d); ux = x / l; uy = y / l; break; }
    }
    const art = 64;
    return { x: Math.round(w / 2 + ux * LAIR_BAND * (w / 2 - art)), y: Math.round(h / 2 + uy * LAIR_BAND * (h / 2 - art)) };
}

/** Stand the arrival as the old lair did: taken off, then put back in written order at the lair's aims. */
function toLair(seed) {
    const lair = lairOf(seed);
    const enemies = Occupation.standingEnemies().map(e => ({ ...e }));
    for (const e of enemies) BoardState.removeToken(e.id);
    enemies.forEach((e, k) => {
        const [ox, oy] = LAIR_OFFSETS[k % LAIR_OFFSETS.length];
        const instance = BoardState.createTokenInstance(e.typeId, 1, null, BoardState.ORIGIN.SPAWNED, e.id);
        BoardState.setTether(instance, null);
        instance.arrival = true;
        const res = Placement.placeArrivalNear(instance, { x: lair.x + ox * LAIR_SPREAD, y: lair.y + oy * LAIR_SPREAD });
        expect(res.success).toBe(true);
    });
}

function newGame(seed) {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed });
}

function crewFor(cell, n) {
    GameState.state.progress.rosterLimit = Math.max(4, n);
    const crew = [];
    for (let i = 0; i < n; i++) crew.push(HeroManager.addHero(generateHero()));
    for (const { skill, level } of cell.requires.skills) addXP(crew[0].id, skill, xpForLevel(level) - (crew[0].skills[skill]?.xp || 0));
    for (const hero of crew) {
        GameState.heroes.find(h => h.id === hero.id).skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 40 };
        InventoryManager.addItem('item_steak', 10);
        EquipmentManager.equipItem(hero.id, 'item_steak');
    }
    return crew;
}

/** Settle the first ring-1 cell of world `seed`, stand the arrival `how`, send heroes, and time the clear. */
function clearTime(seed, how, heroes) {
    newGame(seed);
    const cell = World.currentWorld().cells.find(c => c.ring === 1);
    const crew = crewFor(cell, heroes);
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
    const result = World.settleCell(cell.id);
    expect(result.success).toBe(true);
    if (how === 'lair') toLair(result.region.seed);
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
    // Each hero at the standing enemy nearest the Hall not yet taken, as a player would.
    const standing = Occupation.standingEnemies().sort((a, b) => Math.hypot(a.x - hall.x, a.y - hall.y) - Math.hypot(b.x - hall.x, b.y - hall.y));
    crew.forEach((hero, i) => expect(Flags.orderToken(hero.id, standing[i % standing.length]).success).toBe(true));
    let t = 0;
    let walked = 0;
    while (Occupation.isOccupied() && t < 60 * 60_000) {
        BoardRunner.tick(100);
        SpriteLayer.tick(100);
        t += 100;
        for (const hero of crew) if (BoardState.heroBodyOf(hero.id)?.moving) walked += 100;
    }
    return { seed, how, heroes, enemies: result.arrival.ids.length, clearS: t / 1000, cleared: !Occupation.isOccupied(), heroWalkS: walked / 1000 };
}

it('measures', () => {
    Flags.init();
    Arrival.init();
    BoardCombat.init();
    BoardState.setInstantArrival(false);
    const rows = [];
    for (let s = 1; s <= 12; s++) {
        for (const heroes of [1, 3]) {
            for (const how of ['lair', 'spread']) rows.push(clearTime(s * 101, how, heroes));
        }
    }
    BoardState.setInstantArrival(true);
    if (OUT) fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    expect(rows.every(r => r.cleared)).toBe(true);
}, 600_000);
