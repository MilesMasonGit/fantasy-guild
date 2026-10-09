// Fantasy Guild bench — the in-engine half (loaded THROUGH Vite by worker.mjs).
//
// Boots the real engine the way `EngineBootstrap` + `onSlotSelected` do (minus
// React, the art preloader, autosave and the wall-clock loop), lets a scenario
// build a board from runtime fixtures, and drives ticks synchronously through
// `GameLoop.runHandlers(100)` — the entry point `DevTools.advanceTime` uses.

import { EngineBootstrap } from '../../src/systems/core/EngineBootstrap.js';
import { GameLoop } from '../../src/systems/core/GameLoop.js';
import { EventBus } from '../../src/systems/core/EventBus.js';
import { GameState } from '../../src/state/GameState.js';
import { SettingsManager } from '../../src/systems/core/SettingsManager.js';
import { DiscoveryManager } from '../../src/systems/core/DiscoveryManager.js';
import { AudioSystem } from '../../src/systems/core/AudioSystem.js';
import { InventoryManager } from '../../src/systems/inventory/InventoryManager.js';
import * as TileModifiers from '../../src/systems/board/TileModifiers.js';
import * as BoardState from '../../src/systems/board/BoardState.js';
import * as NotificationSystem from '../../src/systems/core/NotificationSystem.js';
import { setMatTuning } from '../../src/config/matTuning.js';
import { logger } from '../../src/utils/Logger.js';
import * as fixtures from '../fixtures.mjs';
import { summarise } from './stats.mjs';
import { fingerprint } from './fingerprint.mjs';

const now = () => performance.now();
const TICK_MS = 100;

// ---------------------------------------------------------------------------
// Console and logger
// ---------------------------------------------------------------------------

/**
 * The shipped game is a production build, where `Logger` prints nothing
 * (`isDevelopment` is false). Under Vite's dev transform it would print every
 * debug line, which is not what a player's machine does — so the bench runs
 * the logger as production does, and counts the calls instead (CR3-030).
 *
 * `console.*` from engine code is swallowed (the content audit prints pages at
 * boot) and counted; the first few errors are kept for the report, because a
 * tick handler that throws is a bench result in itself.
 */
const consoleCounts = { log: 0, info: 0, warn: 0, error: 0, debug: 0 };
const errors = [];
function quietConsole() {
    for (const level of Object.keys(consoleCounts)) {
        console[level] = (...args) => {
            consoleCounts[level]++;
            if (level === 'error' && errors.length < 5) {
                errors.push(args.map(a => (a instanceof Error ? `${a.message}\n${a.stack?.split('\n').slice(1, 4).join('\n')}` : String(a))).join(' '));
            }
        };
    }
}

const loggerCounts = { debug: 0, info: 0, warn: 0, error: 0 };
function productionLogger() {
    logger.isDevelopment = false;
    for (const level of Object.keys(loggerCounts)) {
        const original = logger[level].bind(logger);
        logger[level] = (...args) => { loggerCounts[level]++; return original(...args); };
    }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

let engineReady = false;

/**
 * Boot the engine once per process, then start a new game. Exported for the
 * micro-benchmarks, which boot the same way and start a new game per board.
 */
export function boot(seed) {
    if (!engineReady) {
        quietConsole();
        productionLogger();

        // `main.jsx` order: settings, then the engine's subscriptions and tick
        // handlers. The in-memory localStorage is empty, so every setting and
        // every Mat Tuner value is its shipped default.
        SettingsManager.init();
        EngineBootstrap.init();
        if (GameLoop.tickHandlers.length !== 8) {
            throw new Error(`expected the 8 engine tick handlers, found ${GameLoop.tickHandlers.length}: ${GameLoop.tickHandlers.map(h => h.name).join(', ')}`);
        }
        engineReady = true;
    }

    // A new game, as `onSlotSelected(…, true)` makes one — but the board comes
    // from the scenario, not `createDefaultGameData` (whose Tokens are content).
    globalThis.__bench.reseed(seed);
    globalThis.__bench.clock.enable();
    GameState.initNew();
    DiscoveryManager.init();
    AudioSystem.init();
    InventoryManager.init();
}

/** What `onSlotSelected` publishes once the game is ready. */
export function announceReady() {
    TileModifiers.rebuildAll();
    EventBus.publish('state_changed');
    EventBus.publish('heroes_updated');
    EventBus.publish('inventory_updated');
}

// ---------------------------------------------------------------------------
// Ticking
// ---------------------------------------------------------------------------

/** One engine tick of `TICK_MS` game time; the virtual wall clock moves with it. */
function tickOnce() {
    globalThis.__bench.clock.advance(TICK_MS);
    GameLoop.runHandlers(TICK_MS);
}

function runTicks(n) {
    for (let i = 0; i < n; i++) tickOnce();
}

/** `n` ticks, each timed. Returns a Float64Array of milliseconds. */
function timeTicks(n) {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        globalThis.__bench.clock.advance(TICK_MS);
        const t0 = now();
        GameLoop.runHandlers(TICK_MS);
        out[i] = now() - t0;
    }
    return out;
}

/** A deliberately slow tick handler, for proving `--compare` catches a slowdown. */
function injectSlow(ms) {
    GameLoop.onTick('bench_inject_slow', () => {
        const until = now() + ms;
        while (now() < until) { /* busy */ }
    }, 1000);
}

// ---------------------------------------------------------------------------
// Heap
// ---------------------------------------------------------------------------

function heapMb() {
    if (typeof globalThis.gc === 'function') {
        globalThis.gc();
        globalThis.gc();
    }
    return process.memoryUsage().heapUsed / 1048576;
}

// ---------------------------------------------------------------------------
// Profile pass: handlers, stages, events, probes
// ---------------------------------------------------------------------------

function makeProfiler() {
    const handlerMs = new Map();
    const eventCounts = new Map();
    let listenerCalls = 0;
    let events = 0;
    const probes = new Map();
    let enabled = false;

    // Tick handlers are plain objects in an array: wrap each one's function.
    for (const entry of GameLoop.tickHandlers) {
        const original = entry.handler;
        const name = entry.name;
        handlerMs.set(name, 0);
        entry.handler = (delta, count) => {
            if (!enabled) return original(delta, count);
            const t0 = now();
            try { return original(delta, count); } finally { handlerMs.set(name, handlerMs.get(name) + now() - t0); }
        };
    }

    // EventBus is a class instance: wrap `publish` to count by name and to sum
    // the subscribers each publish reaches.
    const publish = EventBus.publish.bind(EventBus);
    EventBus.publish = (name, payload) => {
        if (enabled) {
            events++;
            eventCounts.set(name, (eventCounts.get(name) || 0) + 1);
            listenerCalls += EventBus.subscribers.get(name)?.size || 0;
        }
        return publish(name, payload);
    };

    // Source probes (bench/lib/instrument-plugin.mjs) report here.
    globalThis.__benchProbe = {
        call(name, fn, self, args) {
            if (!enabled) return fn.apply(self, args);
            let p = probes.get(name);
            if (!p) { p = { calls: 0, ms: 0 }; probes.set(name, p); }
            p.calls++;
            const t0 = now();
            try { return fn.apply(self, args); } finally { p.ms += now() - t0; }
        }
    };

    return {
        start() { enabled = true; },
        stop() { enabled = false; },
        report(ticks) {
            const per = (n) => n / ticks;
            const handlers = [...handlerMs.entries()]
                .map(([name, ms]) => ({ name, msPerTick: per(ms) }))
                .sort((a, b) => b.msPerTick - a.msPerTick);
            const eventsByName = [...eventCounts.entries()]
                .map(([name, n]) => ({ name, perTick: per(n) }))
                .sort((a, b) => b.perTick - a.perTick);
            const probeRows = [...probes.entries()]
                .map(([name, p]) => ({ name, callsPerTick: per(p.calls), msPerTick: per(p.ms) }))
                .sort((a, b) => a.name.localeCompare(b.name));
            return {
                handlers,
                eventsPerTick: per(events),
                listenerCallsPerTick: per(listenerCalls),
                eventsByName,
                probes: probeRows
            };
        }
    };
}

// ---------------------------------------------------------------------------
// The work fingerprint lives in ./fingerprint.mjs (CR3-550)
// ---------------------------------------------------------------------------

/** Sizes of the runtime structures S6 watches for unbounded growth. */
function structureSizes() {
    let listeners = 0;
    for (const set of EventBus.subscribers.values()) listeners += set.size;
    const s = GameState.state;
    return {
        tokens: BoardState.tokens().length,
        sprites: (s.board?.sprites || []).length,
        listeners,
        eventNames: EventBus.subscribers.size,
        notifications: NotificationSystem.getQueue?.().length ?? null,
        bin: (s.board?.bin || []).length,
        stateJsonKb: Math.round(JSON.stringify(s).length / 1024)
    };
}

// ---------------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {object} opts.scenario   the scenario module's default export
 * @param {'timing'|'profile'} opts.mode
 * @param {number} opts.seed
 * @param {boolean} opts.long      S6's full 8 game-hours
 * @param {number} opts.injectSlowMs
 */
export async function run(opts) {
    const { scenario, mode = 'timing', seed = 1, injectSlowMs = 0, long = false } = opts;
    const t0 = now();
    boot(seed);

    const ctx = { fixtures, setMatTuning, tickOnce, runTicks, now, heapMb };
    await scenario.build(ctx);
    announceReady();
    const buildMs = now() - t0;

    if (injectSlowMs > 0) injectSlow(injectSlowMs);

    const profiler = mode === 'profile' ? makeProfiler() : null;
    const result = {
        scenario: scenario.id, mode, seed, injectSlowMs,
        buildMs,
        startCensus: fixtures.census()
    };

    if (scenario.custom) {
        // Non-tick scenarios (S4): the scenario times its own operations.
        profiler?.start();
        result.custom = await scenario.custom(ctx);
        profiler?.stop();
        if (profiler) result.profile = profiler.report(1);
    } else {
        const plan = scenario.ticks(long);
        runTicks(plan.warmup);
        result.warmCensus = fixtures.census();

        const heapBefore = heapMb();
        const loggerAt = { ...loggerCounts };
        profiler?.start();
        let samples;
        if (plan.checkpointEvery) {
            // S6: time every tick, and stop at checkpoints to record the heap
            // after a forced GC and the size of every runtime structure.
            samples = new Float64Array(plan.measure);
            result.checkpoints = [];
            let i = 0;
            const record = () => result.checkpoints.push({
                gameMinutes: Math.round(GameState.state.time.gameTimeMs / 60000),
                heapMb: heapMb(),
                ...structureSizes()
            });
            record();
            while (i < plan.measure) {
                const n = Math.min(plan.checkpointEvery, plan.measure - i);
                samples.set(timeTicks(n), i);
                i += n;
                record();
            }
        } else {
            samples = timeTicks(plan.measure);
        }
        profiler?.stop();
        const heapAfter = heapMb();

        result.ticks = { warmup: plan.warmup, measured: plan.measure };
        result.tick = summarise(samples);
        result.heap = { beforeMb: heapBefore, afterMb: heapAfter, deltaMb: heapAfter - heapBefore, gcExposed: typeof globalThis.gc === 'function' };
        result.endCensus = fixtures.census();
        // Logger calls during the measured ticks (CR3-030). The shipped build
        // prints none of them, but each call still builds its arguments.
        result.loggerPerTick = Object.fromEntries(Object.keys(loggerCounts)
            .map(k => [k, (loggerCounts[k] - loggerAt[k]) / plan.measure]));
        if (profiler) result.profile = profiler.report(plan.measure);
    }

    // A non-tick scenario (S4, S8) adds its own checkpoints and counts — the
    // position hashes after each stage — to the end-of-run fingerprint, and may
    // ask for its own fingerprint options (S8: ids without their time).
    result.fingerprint = { ...fingerprint(scenario.fingerprint), ...(result.custom?.identity || {}) };
    result.structures = structureSizes();
    result.logger = { ...loggerCounts };
    result.console = { ...consoleCounts };
    result.errors = errors;
    result.totalMs = now() - t0;
    return result;
}
