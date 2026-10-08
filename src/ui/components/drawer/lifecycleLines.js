
import { turnTiming, PASSIVE_PRODUCTION_MS } from '../../../config/registries/tokenConstants.js';

/**
 * What a board Token's lifecycle blocks are doing right now, as plain rows for the inspection
 * panel: a spawner's family and cap, its next spawn and upkeep; time left to grow; the next
 * chance to turn or to turn back; a Foundation's build; Passive Production; and, in dev mode, the
 * Token's origin.
 * Pure: every engine read comes in through `sources`, so the panel stays thin and the tests
 * need no engine.
 * @typedef {{ label: string, value: string, tone?: 'good'|'warning'|'danger'|'muted' }}
 * LifecycleLine
 */

/** Tones the panel colours by. Absent means the plain text colour. */
export const TONE = Object.freeze({ GOOD: 'good', WARNING: 'warning', DANGER: 'danger', MUTED: 'muted' });

/**
 * A duration for the panel, rounded UP to the second so a clock never shows
 * "0 s" while it still has time to run: `12 s`, `1 min 30 s`, `5 min`,
 * `2 h 5 min`.
 */
export function formatDuration(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    if (total < 60) return `${total} s`;
    const h = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return min ? `${h} h ${min} min` : `${h} h`;
    return s ? `${min} min ${s} s` : `${min} min`;
}

/** `[{ itemId, quantity }]` as "1 Oak Seed, 2 Resin"; empty → null. */
function itemList(lines, itemName) {
    const parts = (Array.isArray(lines) ? lines : [])
        .filter(l => l?.itemId && Number(l.quantity) > 0)
        .map(l => `${Math.floor(Number(l.quantity))} ${itemName(l.itemId)}`);
    return parts.length ? parts.join(', ') : null;
}

/** `[{ typeId }]` as "Shrimp Coast or Crab Coast". */
function typeList(entries, tokenName) {
    return (Array.isArray(entries) ? entries : [])
        .filter(e => e?.typeId)
        .map(e => tokenName(e.typeId))
        .join(' or ');
}

/** A percent as the panel shows it: `30%`, `12.5%`. */
function formatPercent(chance) {
    return `${Math.round(Number(chance) * 10) / 10}%`;
}

/** "in 34 s (30%)": time to a turn's next roll, and its chance. */
function nextChance(ms, chance) {
    return `in ${formatDuration(Math.max(0, ms))} (${formatPercent(chance)})`;
}

function clock(instance, key) {
    return Number(instance?.clocks?.[key]) || 0;
}

function spawnerLines(instance, def, src) {
    const status = src.spawnerStatus(instance.id);
    if (!status) return [];
    const out = [];
    const spawns = typeList(def.spawner.spawns, src.tokenName);
    if (spawns) out.push({ label: 'Spawns', value: spawns });
    out.push({
        label: 'Family',
        value: `${status.familyLabel} family ${status.count} / ${status.cap}`,
        tone: status.count >= status.cap ? TONE.WARNING : undefined
    });

    switch (status.state) {
        case 'at_cap':
            out.push({ label: 'Next spawn', value: 'At cap: waits for room in the family', tone: TONE.WARNING });
            break;
        case 'needs_item':
            out.push({
                label: 'Next spawn',
                value: `Waiting for ${(status.needs || []).map(src.itemName).join(', ')}`,
                tone: TONE.DANGER
            });
            break;
        case 'no_room':
            out.push({ label: 'Next spawn', value: 'No room to spawn nearby', tone: TONE.WARNING });
            break;
        case 'mat_full':
            out.push({ label: 'Next spawn', value: 'Token cap full: waits until the mat has room', tone: TONE.WARNING });
            break;
        default:
            out.push({ label: 'Next spawn', value: `in ${formatDuration(status.nextInMs)}` });
    }

    const upkeep = itemList(def.spawner.upkeep, src.itemName);
    if (!upkeep) {
        out.push({ label: 'Upkeep per spawn', value: 'Free', tone: TONE.MUTED });
    } else {
        const unpaid = status.state === 'needs_item';
        out.push({
            label: 'Upkeep per spawn',
            value: `${upkeep} (${unpaid ? 'not paid: Bank and mat short' : 'paid from the Bank, then loot on the mat'})`,
            tone: unpaid ? TONE.DANGER : TONE.GOOD
        });
    }
    return out;
}

function foundationLines(instance, def, src) {
    const recipe = src.selectedRecipe(instance, def);
    if (!recipe) return [{ label: 'Building', value: 'Choose what to build', tone: TONE.WARNING }];
    const target = (recipe.outputs || []).find(o => o?.tokenId)?.tokenId;
    const duration = Number(recipe.durationMs) > 0 ? Number(recipe.durationMs) : null;
    const elapsed = Math.max(0, Number(instance.cycleElapsedMs) || 0);
    const out = [{ label: 'Building', value: target ? src.tokenName(target) : (recipe.name || recipe.id) }];
    if (duration) {
        const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
        out.push({
            label: 'Build progress',
            value: elapsed > 0
                ? `${pct}% (${formatDuration(Math.min(elapsed, duration))} of ${formatDuration(duration)})`
                : `Not started (${formatDuration(duration)} of work)`,
            tone: elapsed > 0 ? undefined : TONE.MUTED
        });
    }
    return out;
}

/** A countdown as the UI writes it: `4:57`, rounded up to the second. */
export function formatClock(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** One lap's pay as words: "1 Oak Seed", "10 Water (Wishing Well)". */
function passivePays(passive, itemName) {
    return (passive?.lines || [])
        .filter(l => l?.itemId && Number(l.quantity) > 0)
        .map(l => `${Math.floor(Number(l.quantity))} ${itemName(l.itemId)}${l.source === 'wishing_well' ? ' (Wishing Well)' : ''}`);
}

function passiveRows(instance, src) {
    const passive = src.passive?.(instance);
    const pays = passivePays(passive, src.itemName);
    if (!pays.length) return [];
    return [{
        label: 'Passive Production',
        value: `${pays.join(', ')} every ${formatDuration(PASSIVE_PRODUCTION_MS)} (next in ${formatDuration(passive.nextInMs)})`,
        tone: TONE.GOOD
    }];
}

/**
 * **Passive Production as hover text**: a heading with the shared timer's countdown (`Passive Production · next in 4:57`), then one line
 * per item a lap pays, e.g. "1 Oak Seed", "10 Water (Wishing Well)". Empty for a Token that pays
 * nothing.
 *
 * @param {object|null} instance
 * @param {{ passive: (instance: object) => { lines: object[], nextInMs: number }|null,
 *           itemName: (itemId: string) => string }} src
 * @returns {string[]}
 */
export function passiveHoverLines(instance, src) {
    if (!instance) return [];
    const passive = src.passive?.(instance);
    const pays = passivePays(passive, src.itemName);
    if (!pays.length) return [];
    return [
        `Passive Production · next in ${formatClock(passive.nextInMs)}`,
        ...pays
    ];
}

/**
 * The lifecycle rows for one board Token.
 *
 * @param {object|null} instance the Token on the mat
 * @param {{
 *   typeOf: (typeId: string) => object|null,
 *   tokenName: (typeId: string) => string,
 *   itemName: (itemId: string) => string,
 *   spawnerStatus: (instanceId: string) => object|null,
 *   selectedRecipe: (instance: object, def: object) => object|null,
 *   poolFor?: (def: object) => object[],
 *   originOf: (instance: object) => string,
 *   passive?: (instance: object) => { lines: object[], nextInMs: number }|null,
 *   dev?: boolean
 * }} src
 * @returns {LifecycleLine[]}
 */
export function lifecycleLines(instance, src) {
    const def = instance ? src.typeOf(instance.typeId) : null;
    if (!instance || !def) return [];
    const out = [];

    if (instance.turnedFrom) {
        // A turned Token runs only its turn back (TimedChanges): it rolls on the
        // ORIGINAL type's cycle and chance, authored once on it.
        const { everyMs, chance } = turnTiming(src.typeOf(instance.turnedFrom)?.turns);
        out.push({
            label: `Next chance to turn back into ${src.tokenName(instance.turnedFrom)}`,
            value: nextChance(everyMs - clock(instance, 'turnMs'), chance)
        });
    } else {
        if (def.spawner) out.push(...spawnerLines(instance, def, src));
        if (def.grows?.into) {
            out.push({
                label: `Grows into ${src.tokenName(def.grows.into)}`,
                value: `in ${formatDuration(Math.max(0, (Number(def.grows.afterMs) || 0) - clock(instance, 'growMs')))}`
            });
        }
        const turnsInto = typeList(def.turns?.into, src.tokenName);
        if (turnsInto) {
            // A chance once per cycle, not a fixed timer; the same numbers roll it back.
            const { everyMs, chance } = turnTiming(def.turns);
            out.push({
                label: `Next chance to turn into ${turnsInto}`,
                value: nextChance(everyMs - clock(instance, 'turnMs'), chance)
            });
            out.push({
                label: 'Turns',
                value: `${formatPercent(chance)} chance every ${formatDuration(everyMs)}, and the same to turn back`,
                tone: TONE.MUTED
            });
        }
    }

    if (def.foundation) out.push(...foundationLines(instance, def, src));
    // A station waits for the player to pick a recipe, as a Foundation waits for 'what to
    // build'. Only said while nothing is picked.
    else if (src.poolFor && src.poolFor(def).length && !src.selectedRecipe(instance, def)) {
        out.push({ label: 'Recipe', value: 'Choose a recipe', tone: TONE.WARNING });
    }
    out.push(...passiveRows(instance, src));
    if (src.dev) out.push({ label: 'Origin (dev)', value: src.originOf(instance), tone: TONE.MUTED });
    return out;
}
