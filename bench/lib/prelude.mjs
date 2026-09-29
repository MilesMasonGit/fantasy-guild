// Fantasy Guild bench — the process boundary (plain Node, loaded BEFORE Vite).
//
// Everything here stands in for a browser just far enough for the engine to
// boot and tick. None of it is game code, and none of it is loaded by the game.
//
// ⚠️ Import this before anything that loads engine modules. Several engine
// modules capture `Math.random` when they load (`let random = Math.random` in
// EnemyMotion and HeroMotion), so the seeded generator must already be in place.

// ---------------------------------------------------------------------------
// Seeded randomness (CR3-044)
// ---------------------------------------------------------------------------
//
// The game calls `Math.random()` directly in ~60 places. Two runs of one
// scenario must do the same work, so `Math.random` becomes a seeded generator
// (mulberry32). The function object never changes — modules that captured it
// keep it — and `reseed` rewinds its state, which the harness does right
// before it builds a scenario.

let rngState = 1;
// How many numbers have been drawn since the last reseed — part of a run's
// work fingerprint (CR3-550). A change that consumes randomness in a different
// order changes this even when the end state happens to match.
let draws = 0;

function seeded() {
    draws++;
    rngState = (rngState + 0x6D2B79F5) | 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const realRandom = Math.random;
Math.random = seeded;

globalThis.__bench = {
    realRandom,
    reseed(seed) { rngState = (Number(seed) | 0) || 1; draws = 0; },
    draws: () => draws,
    clock: null
};

// ---------------------------------------------------------------------------
// A virtual wall clock
// ---------------------------------------------------------------------------
//
// In the running game a tick happens every 100 ms of real time, so `Date.now()`
// advances 100 ms per tick. The bench runs thousands of ticks a second, so a real
// `Date.now()` would barely move and anything timed by the wall clock (loot
// absorption, live-effect expiry, the XP and item rate windows) would behave
// nothing like the game. The harness switches this clock on once the engine has
// loaded and advances it by each tick's delta.
//
// `performance.now()` is NOT touched: it is what the bench times with.

const realDateNow = Date.now.bind(Date);
const clock = {
    enabled: false,
    nowMs: 0,
    enable(startMs = 1_800_000_000_000) {
        this.nowMs = startMs;
        this.enabled = true;
    },
    advance(ms) { this.nowMs += ms; }
};
Date.now = () => (clock.enabled ? clock.nowMs : realDateNow());
globalThis.__bench.clock = clock;

// ---------------------------------------------------------------------------
// Browser stand-ins, only as far as boot needs
// ---------------------------------------------------------------------------

/** An in-memory Storage. Starts empty, so every setting is its default. */
function memoryStorage() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
        setItem: (k, v) => { map.set(String(k), String(v)); },
        removeItem: (k) => { map.delete(String(k)); },
        clear: () => map.clear(),
        key: (i) => [...map.keys()][i] ?? null,
        get length() { return map.size; }
    };
}

const noop = () => {};

if (!globalThis.localStorage) globalThis.localStorage = memoryStorage();
if (!globalThis.sessionStorage) globalThis.sessionStorage = memoryStorage();

// AudioSystem makes `new Audio(src)` and plays it; a silent stand-in.
if (!globalThis.Audio) {
    globalThis.Audio = class BenchAudio {
        constructor(src = '') { this.src = src; this.volume = 1; this.loop = false; this.currentTime = 0; this.paused = true; }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        load() {}
        cloneNode() { return new BenchAudio(this.src); }
        addEventListener() {}
        removeEventListener() {}
    };
}

// AssetPreloader makes `new Image()`. Never loads anything.
if (!globalThis.Image) {
    globalThis.Image = class BenchImage {
        constructor() { this.src = ''; this.onload = null; this.onerror = null; }
        decode() { return Promise.resolve(); }
    };
}

const style = { setProperty: noop, removeProperty: noop };
const element = () => ({
    style: { ...style }, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    setAttribute: noop, getAttribute: () => null, remove: noop
});

if (!globalThis.document) {
    globalThis.document = {
        documentElement: element(),
        body: element(),
        createElement: element,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: noop,
        removeEventListener: noop,
        hidden: false,
        visibilityState: 'visible'
    };
}

// ⚠️ `window` is deliberately NOT defined. Two engine files test
// `typeof window === 'undefined'` and step aside: AudioSystem skips its
// autoplay-unlock listeners, and SpriteLayer skips its 1.1 s absorb
// `setTimeout`. That timer cannot fire inside a synchronous tick loop, so
// defining `window` would pile up thousands of pending timers — a leak the
// game does not have. The absorb still happens: `SpriteLayer.tick` absorbs any
// sprite whose `absorbAt` has passed, on the virtual clock above.

// Nothing in the engine should need a frame clock; if something does, it gets
// one that never fires rather than one that silently runs work off the tick.
globalThis.requestAnimationFrame ??= () => 0;
globalThis.cancelAnimationFrame ??= noop;

// Source probes (profile pass only, bench/lib/instrument-plugin.mjs) call this.
// A pass-through until the harness's profiler replaces it.
globalThis.__benchProbe = { call: (name, fn, self, args) => fn.apply(self, args) };
