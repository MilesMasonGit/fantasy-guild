// the progression ledger's calibration stamp: which code the rate calculator was last checked against the engine with

/**
 * `npm run bench:calibrate` plays small fixed boards in the real engine and compares what they make
 * with the rate calculator (`bench/calibrate.mjs`). When every setup ran it writes
 * `bench/calibration/stamp.json`: the commit, the date, the result of each setup, and a hash of
 * every file below. The ledger compares those hashes with the files as they are now: a changed
 * file means the calculator and the engine may have drifted apart since they were last seen to
 * agree, and the ledger says the calibration is stale until it is run again.
 *
 * The files: the calculator, the game code it imports (the buckets, the floors, the reach and
 * filter rules, the dose rules), and the engine code it follows without importing (how a board
 * reads its rules, runs a cycle, rests, regrows, fishes, grows a Field, spawns and pays Passive
 * Production), with the calibration's own setups. Fights are coarse until brief 280 and are not
 * calibrated, so combat code is left out.
 *
 * Pure: hashing takes the texts it is handed (Node reads the files, the CMS bundles them).
 */

export const CALIBRATED_FILES = Object.freeze([
    'src/systems/progression/ledger/rates.js',
    'src/systems/effects/ModifierAggregator.js',
    'src/systems/effects/statements.js',
    'src/systems/effects/effectLibrary.js',
    'src/systems/board/workTime.js',
    'src/systems/board/cycleCharges.js',
    'src/systems/hero/xpBonus.js',
    'src/systems/hero/perkTable.js',
    'src/systems/atlas/regionModifiers.js',
    'src/systems/core/consumableRule.js',
    'src/systems/core/wearRule.js',
    'src/config/registries/tokenConstants.js',
    'src/config/registries/filterRegistry.js',
    'src/config/registries/reachRegistry.js',
    'src/config/registries/toolKinds.js',
    'src/config/registries/catchPools.js',
    'src/config/guildUpgrades.js',
    'src/systems/board/BoardRunner.js',
    'src/systems/board/TileModifiers.js',
    'src/systems/board/TimedChanges.js',
    'src/systems/board/Respawn.js',
    'src/systems/board/Growth.js',
    'src/systems/board/Fields.js',
    'src/systems/board/Fishing.js',
    'src/systems/board/OutputRules.js',
    'src/systems/board/PassiveProduction.js',
    'src/systems/board/SpawnerSystem.js',
    'src/systems/board/Camps.js',
    'src/systems/board/Flags.js',
    'src/systems/hero/HeroEffects.js',
    'src/systems/effects/LiveEffects.js',
    'src/systems/core/CatchUp.js',
    'bench/calibration/setups.mjs',
    'bench/calibration/engine.mjs'
]);

/** Where the stamp lives, from the project root. */
export const STAMP_FILE = 'bench/calibration/stamp.json';

/** A file's text as hashed: line endings made one (a Windows checkout writes CRLF). */
const normalise = (text) => String(text ?? '').replace(/\r\n/g, '\n');

/** FNV-1a over a text, as eight hex digits: enough to tell a changed file. */
export function hashText(text) {
    const s = normalise(text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/** Each calibrated file's hash, from texts by path (a missing file hashes as `missing`). */
export function fileHashes(textsByPath) {
    const out = {};
    for (const file of CALIBRATED_FILES) out[file] = textsByPath[file] === undefined ? 'missing' : hashText(textsByPath[file]);
    return out;
}

/**
 * Whether the calculator's calibration still stands: `{ state, changed, stamp }`, `state` one of
 * `none` (never run), `failed` (its last run was outside tolerance), `stale` (a file changed since),
 * `ok`; `changed` the files whose hash moved.
 */
export function calibrationState(stamp, hashes) {
    if (!stamp || typeof stamp !== 'object' || !stamp.files) return { state: 'none', changed: [], stamp: null };
    const changed = CALIBRATED_FILES.filter(f => stamp.files[f] !== hashes[f]);
    if (changed.length) return { state: 'stale', changed, stamp };
    if (stamp.passed === false) return { state: 'failed', changed, stamp };
    return { state: 'ok', changed, stamp };
}

/** The ledger finding for a calibration that does not stand, or null. */
export function calibrationFinding(status) {
    if (!status || status.state === 'ok') return null;
    const base = { check: 'calibration-stale', key: 'calibration:engine', name: 'Rate calculator' };
    if (status.state === 'none') {
        return { ...base, message: 'The rate calculator has never been checked against the engine here: run npm run bench:calibrate.' };
    }
    const when = `${status.stamp.date ? status.stamp.date.slice(0, 10) : 'an unknown date'} (commit ${status.stamp.commit || 'unknown'})`;
    if (status.state === 'failed') {
        return { ...base, message: `The last calibration, ${when}, found the calculator outside its tolerance: read bench/calibration/stamp.json before trusting the pace.` };
    }
    const names = status.changed.map(f => f.split('/').pop());
    return {
        ...base,
        message: `The rate calculator was last checked against the engine ${when}; since then ${names.length === 1 ? 'one file has' : `${names.length} files have`} changed (${names.slice(0, 5).join(', ')}${names.length > 5 ? ` and ${names.length - 5} more` : ''}). Run npm run bench:calibrate.`
    };
}
