// Fantasy Guild — Live tuning for the free playmat's rules (developer tool).

/**
 * The numbers that decide how the mat *plays*, adjustable while the game runs in a dev or perf
 * build: the tests, the benches and the stress boards set them through {@link setMatTuning}.
 *
 * ## Not `playmatTuning.js`
 * That one tunes how the terrain *looks*. This one tunes how the mat *plays*: a value here changes
 * what a Token reaches.
 *
 * ## ⚠️ Persisted per device
 * Values live in `localStorage`, never in the save, and **change gameplay** on this device;
 * {@link resetMatTuning} puts them back to the shipped defaults.
 *
 * ## ⚠️ Dev and perf builds only
 * A test or ship build has no tuning: every number reads its default there, never what a device
 * once stored, and nothing can set one. The mat's size and the bounty numbers are game values
 * owned by the game (`MAT_STEPS` in `matGeometry.js`, `QUEST_CAP_BASE`, `QUEST_CAP_MAX` and
 * `QUEST_EVERY_SEC` in `QuestTokens.js`); their rows here start at those values
 * (`ShippedBuild.test.js` holds them in step) and are read through {@link tunedOr}.
 *
 * Read with `matTuning('key')` at the point of use, every time — capturing a
 * value into a module constant would freeze it at import.
 */

/** Tile step in mat units, repeated here so this config file imports nothing. */
const STEP_U = 160;

/**
 * The mat's shipped height over its width (the Mat shape row's default), repeated here for the same reason.
 * Kept in step with `MAT_ASPECT` in `matGeometry.js` — which imports THIS file,
 * so the dependency may not run the other way.
 */
const ASPECT = 13 / 24;

/**
 * A small Token's art radius, repeated here for the same reason — this file
 * imports nothing, so the hints below can quote real numbers without dragging
 * `matGeometry` (and the Token registry behind it) into the config layer.
 * Kept in step with `ART_RADIUS_BY_SIZE[1]` in `matGeometry.js`.
 */
const SMALL_ART_R = 64;

/** The one standard reach, repeated here for the same reason. Kept in step with `STANDARD_REACH_U` in `reachRegistry.js` (`ShippedBuild.test.js`). */
const REACH = 240;

export const MAT_TUNABLES = Object.freeze([
    {
        // ⚠️ A new key on purpose: the old Near radius row (`nearRadius`, 164) is still stored on
        // devices that ever opened this panel, and must not stand in for the standard reach.
        key: 'reach',
        group: 'Reach',
        label: 'Reach',
        hint: `Dev override of the one standard reach (STANDARD_REACH_U, the game value: ${REACH} u): how far a "nearby" rule carries, a camp hands out work and a Forest plants, centre to centre. 240 takes in a small Token's eight neighbours one step away (diagonals 226 u); 164 was the old Near radius. A shipped build always uses the game value.`,
        min: 100, max: 600, step: 1, def: REACH,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    },
    {
        key: 'walkSpeed',
        group: 'Heroes',
        label: 'Walk speed',
        hint: 'How fast heroes walk, in mat units a second. The mat is 1920 u wide at 12 steps, so 120 crosses it in 16 s. Walking costs work time: a job starts when the hero arrives.',
        min: 20, max: 600, step: 1, def: 120,
        format: (v) => `${Math.round(v)} u/s · ${(Math.round(matTuning('matSteps')) * STEP_U / v).toFixed(1)} s across`
    },
    {
        key: 'potterRadius',
        group: 'Heroes',
        label: 'Idle wander',
        hint: 'How far an idle hero strolls from their spot beside the flag, in mat units (Hero Movement HM-1). They pause 2-6 s between strolls and stroll at half walking speed. 0 makes idle heroes stand still.',
        min: 0, max: 240, step: 1, def: 80,
        format: (v) => (Math.round(v) === 0 ? 'off' : `${Math.round(v)} u`)
    },
    {
        key: 'enemyWalkSpeed',
        group: 'Enemies',
        label: 'Enemy walk speed',
        hint: 'How fast an enemy steps to open space before a crowded fight starts, in mat units a second. Enemies otherwise stand still. A bit slower than heroes (120) by default.',
        min: 10, max: 600, step: 1, def: 90,
        format: (v) => `${Math.round(v)} u/s · ${(Math.round(matTuning('matSteps')) * STEP_U / v).toFixed(1)} s across`
    },
    {
        key: 'hitboxPct',
        group: 'Crowding',
        label: 'Token hitbox',
        hint: 'How much of a Token’s art actually collides, as a percentage of its radius. Never drawn — a Token at rest is just its art. 90% makes a small Token’s hitbox 58 u of its 64 u art (80%, 51 u, was the old default).',
        min: 40, max: 100, step: 1, def: 90,
        format: (v) => `${Math.round(v)}% · small ${Math.round(SMALL_ART_R * v / 100)} u`
    },
    {
        key: 'overlapPct',
        group: 'Crowding',
        label: 'Overlap allowed',
        hint: 'How far two hitboxes may overlap before a drop is refused: lower spaces Tokens further apart. At 90% hitbox, 30% overlap lets two small Tokens sit 81 u apart centre to centre (40%, 70 u, was the old default). ⚠️ It applies to the next drop or spawn: Tokens already down stay put, and a new place is laid out at the shipped default, never this slider.',
        min: 0, max: 80, step: 1, def: 30,
        format: (v) => `${Math.round(v)}% · two small ${Math.round(2 * Math.round(SMALL_ART_R * matTuning('hitboxPct') / 100) * (1 - v / 100))} u apart`
    },
    {
        key: 'hoverLift',
        group: 'Crowding',
        label: 'Hover lifts a Token',
        hint: 'Whether the Token under the pointer jumps in front of its neighbours. Off, it stays where it stands and only its name and gear come up over the others. Either way a click goes to the Token whose centre is nearest the pointer. The default here is the switch for the shipped game.',
        min: 0, max: 1, step: 1, def: 0,
        format: (v) => (Math.round(v) === 1 ? 'on' : 'off')
    },
    {
        key: 'nudgeReach',
        group: 'Crowding',
        label: 'Nudge reach',
        hint: 'How far a drop with no room may be shifted to find a legal spot before it flies back instead. 0 makes every crowded drop fly back; 160 is one old tile step.',
        min: 0, max: 400, step: 1, def: 160,
        format: (v) => `${Math.round(v)} u · ${(v / STEP_U).toFixed(2)} steps`
    },
    {
        key: 'matSteps',
        group: 'The mat',
        label: 'Mat size',
        hint: 'How wide the playmat itself is, in 160 u steps; its height is the width at the Mat shape below (the game value, MAT_STEPS, is 12; dev builds only). ⚠️ Shrinking it pulls Tokens that no longer fit back inside and spaces them apart; flags are only pulled in. Growing it moves nothing.',
        min: 6, max: 20, step: 1, def: 12,
        format: (v) => `${Math.round(v)} steps · ${Math.round(v) * STEP_U} × ${Math.round(Math.round(v) * STEP_U * matTuning('matAspect'))} u`
    },
    {
        key: 'matAspect',
        group: 'The mat',
        label: 'Mat shape',
        hint: 'How tall the playmat is for its width (the game value, MAT_ASPECT, is 13/24, 0.542: 1040 u, 6.5 steps, at 12 steps wide; dev builds only). Lower is wider and shorter. ⚠️ Shortening it pulls Tokens below the new edge back inside, as Mat size does.',
        min: 0.4, max: 0.8, step: 0.001, def: ASPECT,
        format: (v) => `${v.toFixed(3)} · ${Math.round(Math.round(matTuning('matSteps')) * STEP_U * v)} u tall · ${(Math.round(matTuning('matSteps')) * v).toFixed(2)} steps`
    },
    {
        // ⚠️ A new key on purpose: the old `matCap` row's value (40) is still stored on devices
        // that ever touched this panel, and would otherwise outrank the game's cap.
        key: 'tokenCap',
        group: 'The mat',
        label: 'Token cap override',
        hint: 'Dev override for the most Tokens the mat may hold (MatCap.BASE_TOKEN_CAP is the game value, 128). Every Token on the mat counts, placed or spawned; the Guild Hall and quests never do. 0 uses the game value.',
        min: 0, max: 2000, step: 1, def: 0,
        format: (v) => (Math.round(v) === 0 ? 'off: game value' : `${Math.round(v)} Tokens`)
    },
    {
        key: 'questCap',
        group: 'Quests',
        label: 'Quest cap',
        hint: 'How many bounty quests the Guild Hall keeps on the mat (the game value is 2; dev builds only). The max below caps it. Tutorial quests do not count.',
        min: 0, max: 10, step: 1, def: 2,
        format: (v) => `${Math.round(v)} quests`
    },
    {
        key: 'questCapMax',
        group: 'Quests',
        label: 'Quest cap max',
        hint: 'The most this device may set the quest cap to, whatever the row above says (the game value is 5; dev builds only).',
        min: 1, max: 20, step: 1, def: 5,
        format: (v) => `${Math.round(v)} quests`
    },
    {
        key: 'questEverySec',
        group: 'Quests',
        label: 'Quest every',
        hint: 'Game time between bounty quests while the mat has fewer than the cap (TL-18: 3 min, the game value; dev builds only). The clock only runs below the cap.',
        min: 10, max: 1800, step: 10, def: 180,
        format: (v) => `${Math.floor(v / 60)} min ${Math.round(v % 60)} s`
    }
]);

const DEFAULTS = Object.freeze(
    Object.fromEntries(MAT_TUNABLES.map(t => [t.key, t.def]))
);

const STORAGE_KEY = 'fantasy_guild_mat_tuning';

/**
 * ⚠️ The panel stores every value, touched or not, so a device that ever opened it holds the old
 * default of each row and would keep it after the default moves. A stored value equal to a
 * default listed here is read as that untouched old default, not a choice, and the new one wins.
 * Add a row's old default here whenever its `def` changes.
 */
const RETIRED_DEFAULTS = Object.freeze({
    hitboxPct: [80],
    overlapPct: [40],
    matSteps: [11]
});

/**
 * Whether this build takes tuned numbers: a dev or perf build. A test build (a plain `vite build`)
 * and a ship build always use the game's values.
 * ⚠️ Keep the `?.`: the benches import this file in plain Node, where there is no env.
 */
const TUNABLE = !!(import.meta.env?.DEV || import.meta.env?.MODE === 'perf');

/** @type {Record<string, number>} */
let values = { ...DEFAULTS };

function loadStored() {
    try {
        const stored = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) || 'null');
        if (stored && typeof stored === 'object') {
            for (const t of MAT_TUNABLES) {
                const v = stored[t.key];
                if (RETIRED_DEFAULTS[t.key]?.includes(v)) continue;
                // Clamped rather than trusted, as in playmatTuning.
                if (typeof v === 'number' && Number.isFinite(v)) {
                    values[t.key] = Math.max(t.min, Math.min(t.max, v));
                }
            }
        }
    } catch {
        // No storage, or corrupt. Defaults are correct.
    }
}
if (TUNABLE) loadStored();

const listeners = new Set();

function persist() {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
        // Not being able to remember a tweak does not stop making it.
    }
}

/** The live value of one tunable. */
export function matTuning(key) {
    return values[key] ?? DEFAULTS[key];
}

/** Whether this build takes tuned numbers at all (dev and perf builds). */
export function isTunable() {
    return TUNABLE;
}

/** A game value, or in a tunable build the tuning's row `key` (which starts at it). */
export function tunedOr(key, gameValue) {
    return TUNABLE ? matTuning(key) : gameValue;
}

/** Set one, clamped to its declared range. Returns true if it changed; a shipped build never does. */
export function setMatTuning(key, value) {
    const def = MAT_TUNABLES.find(t => t.key === key);
    if (!TUNABLE || !def || !Number.isFinite(value)) return false;
    const next = Math.max(def.min, Math.min(def.max, value));
    if (next === values[key]) return false;
    values[key] = next;
    persist();
    listeners.forEach(fn => fn(key, next));
    return true;
}

/** Put everything back to how it ships. */
export function resetMatTuning() {
    const changed = isMatTuned();
    values = { ...DEFAULTS };
    persist();
    if (changed) listeners.forEach(fn => fn(null, null));
}

/** Whether anything currently differs from the shipped defaults. */
export function isMatTuned() {
    return MAT_TUNABLES.some(t => values[t.key] !== t.def);
}

/** The shipped default of one tunable. */
export function matTuningDefault(key) {
    return DEFAULTS[key];
}

/** Called whenever any value changes. Returns an unsubscribe. */
export function onMatTuningChanged(fn) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}
