// Fantasy Guild bench — load-time probes for the PROFILE pass only.
//
// ES-module exports cannot be monkey-patched from outside (Vite freezes the
// module namespace), and a call a module makes to its own function never goes
// through an export anyway. So the profile pass asks Vite to rewrite a short,
// named list of function declarations AS THEY ARE LOADED into this bench
// process: the original is renamed and a thin wrapper takes its name, counting
// the call (and, for `timed` probes, timing it).
//
// ⚠️ The files on disk are never touched, the game never loads this, and the
// TIMING passes run without it — probes cost time, so profile numbers are for
// "where does the time go", never for "how long is a tick".
//
// Every probe must match exactly one declaration. If the game code moves on and
// a probe no longer matches, the bench fails loudly rather than reporting a
// silent zero.

/**
 * `file` (from the repo root) → probes. `timed: true` also accumulates time.
 * `name` is how the probe is reported.
 */
export const PROBES = {
    'src/systems/board/BoardState.js': [
        { fn: 'tokens', name: 'BoardState.tokens' }
    ],
    'src/systems/board/nearby.js': [
        { fn: 'tokensWithin', name: 'nearby.tokensWithin' },
        { fn: 'tokensAround', name: 'nearby.tokensAround' },
        { fn: 'nearby', name: 'nearby.nearby' }
    ],
    'src/systems/board/TimedChanges.js': [
        { fn: 'tick', name: 'stage:TimedChanges.tick', timed: true }
    ],
    'src/systems/board/Flags.js': [
        { fn: 'assign', name: 'stage:Flags.assign', timed: true },
        { fn: 'evaluate', name: 'Flags.evaluate', timed: true }
    ],
    'src/systems/board/HeroMotion.js': [
        { fn: 'tick', name: 'stage:HeroMotion.tick', timed: true }
    ],
    'src/systems/board/EnemyMotion.js': [
        { fn: 'tick', name: 'stage:EnemyMotion.tick', timed: true }
    ],
    'src/systems/board/Hostiles.js': [
        { fn: 'tick', name: 'stage:Hostiles.tick', timed: true }
    ],
    'src/systems/board/BoardRunner.js': [
        { fn: 'tick', name: 'BoardRunner.tick', timed: true }
    ],
    'src/systems/board/TileModifiers.js': [
        { fn: 'rebuildToken', name: 'TileModifiers.rebuildToken', timed: true },
        { fn: 'rebuildTokens', name: 'TileModifiers.rebuildTokens', timed: true },
        { fn: 'rebuildAll', name: 'TileModifiers.rebuildAll', timed: true }
    ],
    'src/systems/board/WorkCheck.js': [
        { fn: 'whyCannotRun', name: 'WorkCheck.whyCannotRun' },
        { fn: 'fixableReason', name: 'WorkCheck.fixableReason' }
    ],
    'src/systems/board/TriggerSystem.js': [
        { fn: 'handleGlobalItemThreshold', name: 'TriggerSystem.handleGlobalItemThreshold', timed: true }
    ],
    'src/systems/board/MatPlacement.js': [
        { fn: 'relax', name: 'MatPlacement.relax', timed: true },
        { fn: 'findSpot', name: 'MatPlacement.findSpot', timed: true },
        { fn: 'forceSpot', name: 'MatPlacement.forceSpot', timed: true }
    ],
    'src/systems/board/SpawnerSystem.js': [
        { fn: 'attemptSpawn', name: 'SpawnerSystem.attemptSpawn', timed: true }
    ]
};

/** Every probe name, in declaration order — for a stable report. */
export const PROBE_NAMES = Object.values(PROBES).flat().map(p => p.name);

function rewrite(code, file, probes) {
    let out = code;
    const wrappers = [];
    for (const { fn, name } of probes) {
        // `export function fn(` or `function fn(` at the start of a line.
        const re = new RegExp(`^(export\\s+)?function\\s+${fn}\\s*\\(`, 'gm');
        const matches = [...out.matchAll(re)];
        if (matches.length !== 1) {
            throw new Error(`[bench probe] ${file}: expected exactly one declaration of ${fn}(), found ${matches.length}`);
        }
        const exported = !!matches[0][1];
        const orig = `__bench_orig_${fn}`;
        out = out.replace(re, `function ${orig}(`);
        wrappers.push(
            `${exported ? 'export ' : ''}function ${fn}(...__a) { return globalThis.__benchProbe.call(${JSON.stringify(name)}, ${orig}, this, __a); }`
        );
    }
    return `${out}\n\n// --- bench probes (profile pass only) ---\n${wrappers.join('\n')}\n`;
}

/** The Vite plugin. `root` is the repo root, forward-slashed. */
export function instrumentPlugin(root) {
    const base = root.replace(/\\/g, '/').replace(/\/$/, '');
    return {
        name: 'fantasy-guild-bench-probes',
        enforce: 'pre',
        transform(code, id) {
            const clean = id.split('?')[0].replace(/\\/g, '/');
            if (!clean.startsWith(base + '/')) return null;
            const rel = clean.slice(base.length + 1);
            const probes = PROBES[rel];
            if (!probes) return null;
            return { code: rewrite(code, rel, probes), map: null };
        }
    };
}
