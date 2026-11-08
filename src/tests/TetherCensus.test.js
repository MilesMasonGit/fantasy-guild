import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { sourceCode, setScanTimeout } from './fixtures/sourceScan.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

setScanTimeout();

/**
 * ⭐ What an enemy camp spawned is kept as a count (`SpawnerSystem`'s census), so a mat full of camps
 * no longer walks the mat once per camp per tick. The count is only safe if every way a Token gains
 * or loses a tether keeps it right, so each way has its own case here, reading the count BEFORE the
 * change as well as after: a count that was never read cannot be stale. The test suite's own check
 * (`setup/tetherCensusCheck.js`) compares every answer with a walk of the mat, here and in every other
 * test that touches a camp.
 */

const LOAD_NOW = 1_800_000_000_000;

const ruleSpawn = {
    ...makeStatement(KEYWORD.SPAWNS),
    id: 'stm_tc_rule',
    payload: { typeId: 'fixture_tc_ambusher', placement: PLACEMENT.NEAREST_FREE },
    when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 },
    chargeDelta: 0
};

registerTokenTypes({
    fixture_tc_hall: { ...fixtures.BENCH_TOKENS.bench_hall, id: 'fixture_tc_hall', name: 'Census Hall' },
    /** One kill and gone: the Goblin's shape. */
    fixture_tc_enemy: {
        id: 'fixture_tc_enemy', name: 'Census Enemy', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fixture_tc_den: {
        id: 'fixture_tc_den', name: 'Census Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'fixture_tc_enemy', weight: 1 }], allowance: 3, intervalMs: 1000, upkeep: [] }
    },
    /** A sprout that grows into an enemy: the same family, a new instance. */
    fixture_tc_sprout: {
        id: 'fixture_tc_sprout', name: 'Census Sprout', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', grows: { into: 'fixture_tc_brute', afterMs: 3000 }
    },
    fixture_tc_brute: {
        id: 'fixture_tc_brute', name: 'Census Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fixture_tc_nursery: {
        id: 'fixture_tc_nursery', name: 'Census Nursery', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'fixture_tc_sprout', weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
    },
    /** Not in any camp's family. */
    fixture_tc_stray: {
        id: 'fixture_tc_stray', name: 'Census Stray', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature'
    },
    fixture_tc_ambusher: {
        id: 'fixture_tc_ambusher', name: 'Census Ambusher', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** A camp whose rule also names its enemy: the game refuses a rule that spawns an enemy. */
    fixture_tc_rule_den: {
        id: 'fixture_tc_rule_den', name: 'Census Rule Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'fixture_tc_ambusher', weight: 1 }], allowance: 4, intervalMs: 24 * 3600 * 1000, upkeep: [] },
        statements: [ruleSpawn]
    },
    /** Re-registered by one case, which changes its family. */
    fixture_tc_reg_den: {
        id: 'fixture_tc_reg_den', name: 'Census Reg Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'fixture_tc_enemy', weight: 1 }], allowance: 4, intervalMs: 1000, upkeep: [] }
    }
});

const DEF = (typeId) => getTokenType(typeId);
const count = (camp) => SpawnerSystem.spawnerCounts(camp.id).count;
const tick = (ms = 100) => GameLoop.runHandlers(ms);
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) tick(step); };
const place = (typeId, x, y) => fixtures.placeAt(typeId, x, y);

/** The slow answer, written out here: what the census must equal. */
function walked(camp) {
    const family = new Set(SpawnerSystem.familyOf(camp.typeId));
    return BoardState.tokens().filter(t => t.tether === camp.id && family.has(t.typeId)).length;
}

function liveCamps() {
    return BoardState.tokens().filter(t => !t.turnedFrom && SpawnerSystem.isSpawner(DEF(t.typeId)) && SpawnerSystem.isEnemyCampType(t.typeId));
}

/** Every camp's count against the slow answer; the differences. */
function differences() {
    const out = [];
    for (const camp of liveCamps()) {
        const answer = count(camp);
        const slow = walked(camp);
        if (answer !== slow) out.push(`${camp.typeId} ${camp.id}: census ${answer}, walk ${slow}`);
        const def = DEF(camp.typeId);
        if (SpawnerSystem.isFullEnemyCamp(camp, def) !== (slow >= def.spawner.allowance)) out.push(`${camp.id}: full answer wrong at ${slow}`);
    }
    return out;
}

/** Take an enemy off as a kill does. */
function beat(enemy) {
    BoardState.removeToken(enemy.id);
    EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: enemy.id, x: enemy.x, y: enemy.y, typeId: enemy.typeId, exhaustedBy: 'test' });
}

/** A camp's `n` spawns, through the real attempt. */
function fill(camp, n) {
    for (let i = 0; i < n; i++) expect(SpawnerSystem.attemptSpawn(camp, DEF(camp.typeId))).toBe(camp);
}

/** Save and load, as `SaveManager` does: `edit` may change the save first. */
async function saveAndLoad(edit = null) {
    const data = JSON.parse(GameState.serializeJson());
    if (edit) edit(data.state);
    const state = migrateState(data.state, data.version);
    loadSavedState(state);
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
}

/** An older save: its Tokens never had a tether, and the board's one-off attach has not run. */
function fromBeforeTethers(state) {
    for (const t of Object.values(state.board.tokens)) delete t.tether;
    state.board.enemyTethers = 0;
}

const live = (id) => BoardState.getTokenById(id);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    setMatTuning('tokenCap', 400);
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
    GameState.state.heroes = [];
    GameState.state.board.enemyTethers = 1;
});

afterEach(() => GameLoop.stop());

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ every way a tether changes keeps the camp\'s count right', () => {
    it('a spawn: counted the moment it lands', () => {
        const den = place('fixture_tc_den', 500, 500);
        expect(count(den)).toBe(0);
        expect(SpawnerSystem.isFullEnemyCamp(den, DEF(den.typeId))).toBe(false);
        fill(den, 1);
        expect(count(den)).toBe(1);
        fill(den, 2);
        expect(count(den)).toBe(3);
        expect(SpawnerSystem.isFullEnemyCamp(den, DEF(den.typeId))).toBe(true);
        expect(SpawnerSystem.attemptSpawn(den, DEF(den.typeId))).toBe(null);
    });

    it('⚠️ a read between the Token landing and its tether being written does not stick', () => {
        const den = place('fixture_tc_den', 500, 500);
        const during = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, () => during.push(count(den)));
        fill(den, 1);
        off();
        expect(during).toEqual([0]);                   // on the mat, not tied to the camp yet
        expect(count(den)).toBe(1);
    });

    it('a death: the camp is short at once, and refills an interval later', () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 3);
        expect(count(den)).toBe(3);
        beat(BoardState.tokens().find(t => t.tether === den.id));
        expect(count(den)).toBe(2);
        run(900);
        expect(count(den)).toBe(2);
        run(200);
        expect(count(den)).toBe(3);
    });

    it('⚠️ an older save: enemies attached on the first tick, with no Token joining or leaving', async () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 3);
        await saveAndLoad(fromBeforeTethers);
        const loaded = live(den.id);
        expect(count(loaded)).toBe(0);                 // read before the attach: this is the stale case
        const membership = BoardState.membershipVersion().version;
        expect(EnemyMotion.attachUntethered()).toBe(3);
        expect(BoardState.membershipVersion().version).toBe(membership);
        expect(count(loaded)).toBe(3);
        expect(SpawnerSystem.isFullEnemyCamp(loaded, DEF(loaded.typeId))).toBe(true);
    });

    it('a load: the new board\'s count, whatever the old board said', async () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 2);
        expect(count(den)).toBe(2);
        await saveAndLoad();
        expect(count(live(den.id))).toBe(2);
        beat(BoardState.tokens().find(t => t.tether === den.id));
        expect(count(live(den.id))).toBe(1);
        await saveAndLoad();
        expect(count(live(den.id))).toBe(1);
    });

    it('a catch-up: kills and refills through it come out right', async () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 3);
        for (const t of BoardState.tokens().filter(x => x.tether === den.id)) beat(t);
        expect(count(den)).toBe(0);
        await CatchUp.run({ savedAt: LOAD_NOW - 60_000, now: LOAD_NOW, save: false, reset: false, yieldFn: () => Promise.resolve() });
        expect(count(den)).toBe(3);
        expect(differences()).toEqual([]);
    });

    it('a change of mat: there and back, and each mat counts its own', () => {
        const hall = place('fixture_tc_hall', 900, 500);
        expect(hall).toBeTruthy();
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 3);
        Atlas.createStarterRegion();
        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        expect(count(den)).toBe(3);

        expect(Atlas.travel(b).success).toBe(true);
        expect(live(den.id)).toBeNull();
        const other = place('fixture_tc_den', 500, 800);
        expect(count(other)).toBe(0);
        fill(other, 1);
        expect(count(other)).toBe(1);

        expect(Atlas.travel(a).success).toBe(true);
        expect(count(live(den.id))).toBe(3);
        expect(SpawnerSystem.isFullEnemyCamp(live(den.id), DEF('fixture_tc_den'))).toBe(true);
        expect(Atlas.travel(b).success).toBe(true);
        expect(count(live(other.id))).toBe(1);
    });

    it('a growth inside the family: a new instance, the tether carried, the same count', () => {
        const nursery = place('fixture_tc_nursery', 500, 500);
        fill(nursery, 2);
        expect(count(nursery)).toBe(2);
        run(3200);
        expect(BoardState.tokens().filter(t => t.typeId === 'fixture_tc_brute' && t.tether === nursery.id)).toHaveLength(2);
        expect(count(nursery)).toBe(2);
    });

    it('a change into something outside the family: tied to the camp still, no longer counted', () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 2);
        expect(count(den)).toBe(2);
        const [one] = BoardState.tokens().filter(t => t.tether === den.id);
        const next = EffectActions.transformInstance(one, 'fixture_tc_stray');
        expect(next.tether).toBe(den.id);
        expect(count(den)).toBe(1);
    });

    it('a camp whose rule names its enemy spawns none by rule (no ambushes): nothing to count', () => {
        const den = place('fixture_tc_rule_den', 500, 500);
        EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: den.id, typeId: den.typeId, heroId: null, failed: false, produced: [] });
        expect(BoardState.tokens().filter(t => t.typeId === 'fixture_tc_ambusher')).toHaveLength(0);
        expect(count(den)).toBe(0);
    });

    it('lifted and put down: the same Token, the same count', () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 2);
        const [one] = BoardState.tokens().filter(t => t.tether === den.id);
        expect(count(den)).toBe(2);
        BoardState.removeToken(one.id);
        expect(count(den)).toBe(1);
        BoardState.addToken(one, 900, 900);
        expect(count(den)).toBe(2);
    });

    it('a camp gone: its enemies count toward no other camp', () => {
        const den = place('fixture_tc_den', 500, 500);
        const other = place('fixture_tc_den', 1300, 500);
        fill(den, 2);
        expect(count(other)).toBe(0);
        BoardState.removeToken(den.id);
        expect(count(other)).toBe(0);
        expect(BoardState.tokens().filter(t => t.tether === den.id)).toHaveLength(2);
    });

    it('none of its own: an arrival\'s enemy, tied to nothing, is never counted or attached', () => {
        const den = place('fixture_tc_den', 500, 500);
        expect(count(den)).toBe(0);
        const stray = BoardState.createTokenInstance('fixture_tc_enemy', 1, null, BoardState.ORIGIN.SPAWNED);
        BoardState.setTether(stray, null);
        BoardState.addToken(stray, 700, 700);
        GameState.state.board.enemyTethers = 0;
        expect(EnemyMotion.attachUntethered()).toBe(0);
        expect(count(den)).toBe(0);
    });

    it('a content change: the family is read live, so the count follows it with no Token touched', () => {
        const den = place('fixture_tc_reg_den', 500, 500);
        fill(den, 1);
        const stray = place('fixture_tc_stray', 900, 500);
        BoardState.setTether(stray, den.id);
        expect(count(den)).toBe(1);
        const was = DEF('fixture_tc_reg_den');
        registerTokenTypes({
            fixture_tc_reg_den: { ...was, spawner: { ...was.spawner, spawns: [...was.spawner.spawns, { typeId: 'fixture_tc_stray', weight: 1 }] } }
        });
        expect(count(den)).toBe(2);
        registerTokenTypes({ fixture_tc_reg_den: was });
        expect(count(den)).toBe(1);
    });

    it('a mat wiped by the dev tools: nothing left to count', () => {
        const den = place('fixture_tc_den', 500, 500);
        fill(den, 3);
        expect(count(den)).toBe(3);
        GameState.state.board.tokens = {};
        const fresh = place('fixture_tc_den', 500, 500);
        expect(fresh.id).not.toBe(den.id);
        expect(count(fresh)).toBe(0);
    });
});

describe('⭐ a tether is written in one place', () => {
    it('no code but `BoardState.setTether` writes one', () => {
        const writes = [];
        const scanned = sourceCode();
        expect(scanned.length).toBeGreaterThan(100);
        for (const { file, code } of scanned) {
            for (const line of code.split('\n')) {
                const assigns = /(\.tether|\[\s*['"]tether['"]\s*\])\s*=(?!=)/.test(line);
                const inLiteral = /(^|[{,\s])tether\s*:/.test(line) && !/\.tether/.test(line);
                if (!assigns && !inLiteral) continue;
                writes.push(`${file}: ${line.trim()}`);
            }
        }
        expect(writes).toEqual(['systems/board/BoardState.js: instance.tether = tether;']);
    });

    it('the suite\'s check catches a tether written behind the census\'s back', () => {
        // In place of the check's own listener (`setup/tetherCensusCheck.js`): this difference is on purpose.
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const den = place('fixture_tc_den', 500, 500);
        const enemy = place('fixture_tc_enemy', 700, 500);
        expect(count(den)).toBe(0);
        expect(logged).not.toHaveBeenCalled();
        enemy.tether = den.id;
        expect(count(den)).toBe(0);                    // what the census says: this is the bug it guards
        expect(logged).toHaveBeenCalledWith(expect.stringMatching(/^Tether census out of step.*counts 0, the mat holds 1/));
        logged.mockRestore();
    });
});

/** A seeded generator (mulberry32), the bench's own; its own stream, so the game's rolls are untouched. */
function seeded(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('⭐ a long seeded run: the count equals the walk after every tick and every change', () => {
    // A longer run by hand, stopping at the limit whatever the count:
    // FG_TETHER_TICKS=100000 npx vitest run src/tests/TetherCensus.test.js
    const TICKS = Number(process.env.FG_TETHER_TICKS) || 4000;
    const BY_HAND_LIMIT_MS = 150_000;

    it('through fights, spawns, deaths, growth, refused rule spawns, loads, older saves, catch-ups and travel', async () => {
        const pick = seeded(20261103);
        const within = (n) => Math.floor(pick() * n);
        const choice = (list) => list[within(list.length)];
        const seen = {
            ticks: 0, comparisons: 0, spawned: 0, killed: 0, beaten: 0, campsSwapped: 0, grown: 0, leftFamily: 0,
            ruleRefusals: 0, lifted: 0, loads: 0, olderSaves: 0, attached: 0, bigSteps: 0, catchUps: 0, travels: 0
        };
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, () => { seen.spawned++; }),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, (p) => { if (p.exhaustedBy !== 'test') seen.killed++; }),
            EventBus.subscribe(BOARD_EVENTS.TOKEN_TRANSFORMED, (p) => { if (p.cause === 'grow') seen.grown++; })
        ];

        place('fixture_tc_hall', 960, 520);
        const CAMPS = ['bench_camp', 'bench_warcamp', 'fixture_tc_den', 'fixture_tc_nursery', 'fixture_tc_rule_den', 'fixture_tc_reg_den'];
        for (let i = 0; i < CAMPS.length * 2; i++) {
            place(CAMPS[i % CAMPS.length], 160 + (i % 4) * 500, 200 + Math.floor(i / 4) * 300);
        }
        fixtures.prefillSpawners(3);
        const heroes = fixtures.makeHeroes(4);
        Atlas.createStarterRegion();
        const home = Atlas.activeRegionId();
        const away = Atlas.devCreateEmptyRegion().id;

        const check = (when) => {
            const diff = differences();
            seen.comparisons += liveCamps().length;
            if (diff.length) throw new Error(`after ${when}, tick ${seen.ticks}: ${diff.join('; ')}`);
        };
        const tied = () => BoardState.tokens().filter(t => typeof t.tether === 'string');
        const sendHeroes = () => {
            const enemies = tied().filter(t => DEF(t.typeId)?.enemy);
            for (const hero of heroes) {
                const target = enemies.length ? choice(enemies) : null;
                if (target) fixtures.orderAt(hero.id, { x: target.x, y: target.y });
            }
        };
        sendHeroes();
        check('the build');

        const changes = {
            beat() {
                const enemies = tied();
                if (!enemies.length) return;
                beat(choice(enemies));
                seen.beaten++;
            },
            swapCamp() {
                const camp = choice(liveCamps());
                if (!camp) return;
                const { typeId, x, y } = camp;
                BoardState.removeToken(camp.id);
                check('a camp leaving');
                place(typeId, x, y);
                seen.campsSwapped++;
            },
            leaveFamily() {
                const list = tied();
                if (!list.length) return;
                if (EffectActions.transformInstance(choice(list), 'fixture_tc_stray')) seen.leftFamily++;
                // Kept few: a mat packed solid is the push storm's business, and very slow.
                const strays = BoardState.tokens().filter(t => t.typeId === 'fixture_tc_stray');
                if (strays.length > 6) BoardState.removeToken(strays[0].id);
            },
            ruleSpawn() {
                const den = BoardState.tokens().find(t => t.typeId === 'fixture_tc_rule_den');
                if (!den) return;
                const before = BoardState.tokens().length;
                EventBus.publish(BOARD_EVENTS.CYCLE_COMPLETE, { instanceId: den.id, typeId: den.typeId, heroId: null, failed: false, produced: [] });
                // A rule never spawns an enemy: the camp's rule is refused, and nothing joins the mat.
                expect(BoardState.tokens().length).toBe(before);
                seen.ruleRefusals++;
            },
            lift() {
                const list = tied();
                if (!list.length) return;
                const t = choice(list);
                const at = { x: t.x, y: t.y };
                BoardState.removeToken(t.id);
                check('a lift');
                BoardState.addToken(t, at.x, at.y);
                seen.lifted++;
            },
            async load() {
                await saveAndLoad();
                seen.loads++;
            },
            async olderSave() {
                await saveAndLoad(fromBeforeTethers);
                check('an older save, before its attach');
                seen.attached += EnemyMotion.attachUntethered();
                seen.olderSaves++;
            },
            bigStep() {
                tick(5000);
                seen.bigSteps++;
            },
            async catchUp() {
                await CatchUp.run({ savedAt: LOAD_NOW - 30_000, now: LOAD_NOW, save: false, reset: false, yieldFn: () => Promise.resolve() });
                seen.catchUps++;
            },
            travel() {
                expect(Atlas.travel(away).success).toBe(true);
                check('leaving');
                for (let i = 0; i < 3; i++) tick();
                check('the other mat');
                expect(Atlas.travel(home).success).toBe(true);
                seen.travels++;
            }
        };
        const names = Object.keys(changes);

        const startedAt = performance.now();
        for (let i = 0; i < TICKS; i++) {
            if (process.env.FG_TETHER_TICKS && performance.now() - startedAt > BY_HAND_LIMIT_MS) break;
            tick();
            seen.ticks++;
            check('a tick');
            if (i % 25 === 0) {
                const name = choice(names);
                await changes[name]();
                check(name);
            }
            if (i % 200 === 0) sendHeroes();
        }
        for (const off of offs) off();

        // The run did what it says: a run that never met a change proves nothing.
        expect(seen.comparisons).toBeGreaterThan(seen.ticks);
        for (const key of Object.keys(seen)) expect(seen[key], `the run saw no ${key}`).toBeGreaterThan(0);
        if (process.env.FG_TETHER_TICKS) process.stderr.write(`tether census run ${JSON.stringify(seen)}
`);
    }, 240_000);
});
