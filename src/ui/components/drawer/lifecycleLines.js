// Fantasy Guild — the Token inspection's lifecycle lines (Token Lifecycle slice 8.1, TL-4)

/**
 * ⭐ **What a board Token's lifecycle blocks are doing right now**, as plain
 * rows for the inspection panel: a spawner's family and cap, its next spawn and
 * upkeep; time left to grow, to turn, or to turn back; a Foundation's build; a
 * trickle's pay; and, in dev mode, the Token's origin.
 *
 * Pure: every engine read comes in through `sources`, so the panel stays thin
 * and the tests need no engine. The shapes it reads are §3.1's.
 *
 * @typedef {{ label: string, value: string, tone?: 'good'|'warning'|'danger'|'muted' }} LifecycleLine
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

function trickleLines(instance, def, src) {
    const lines = Array.isArray(def.trickle) ? def.trickle : [];
    const out = [];
    lines.forEach((line, i) => {
        const everyMs = Number(line?.everyMs);
        const pays = itemList([line], src.itemName);
        if (!pays || !(everyMs > 0)) return;
        const elapsed = Number(instance.clocks?.trickle?.[i]) || 0;
        out.push({
            label: 'Pays',
            value: `${pays} every ${formatDuration(everyMs)} (next in ${formatDuration(Math.max(0, everyMs - elapsed))})`,
            tone: TONE.GOOD
        });
    });
    return out;
}

/**
 * ⭐ **The trickle income as hover text** (FB-30): a heading, then one line per
 * paying trickle line, e.g. "1 Oak Seed every 5 min (next in 3 min 20 s)".
 * The same wording and maths as the inspection panel's *Pays* rows — this only
 * relabels them. Empty for a Token with no trickle.
 *
 * @param {object|null} instance
 * @param {{ typeOf: (typeId: string) => object|null, itemName: (itemId: string) => string }} src
 * @returns {string[]}
 */
export function trickleHoverLines(instance, src) {
    const def = instance ? src.typeOf(instance.typeId) : null;
    if (!def?.trickle) return [];
    const pays = trickleLines(instance, def, src).map(line => line.value);
    return pays.length ? ['Trickle income:', ...pays] : [];
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
 *   dev?: boolean
 * }} src
 * @returns {LifecycleLine[]}
 */
export function lifecycleLines(instance, src) {
    const def = instance ? src.typeOf(instance.typeId) : null;
    if (!instance || !def) return [];
    const out = [];

    if (instance.turnedFrom) {
        // A turned Token runs only its turn back (TimedChanges): the timing is
        // the ORIGINAL type's, authored once on it.
        const original = src.typeOf(instance.turnedFrom);
        const lastsMs = Number(original?.turns?.lastsMs) || 0;
        out.push({
            label: `Turns back into ${src.tokenName(instance.turnedFrom)}`,
            value: `in ${formatDuration(Math.max(0, lastsMs - clock(instance, 'turnMs')))}`
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
            out.push({
                label: `Turns into ${turnsInto}`,
                value: `in ${formatDuration(Math.max(0, (Number(def.turns.everyMs) || 0) - clock(instance, 'turnMs')))}`
            });
            if (Number(def.turns.lastsMs) > 0) {
                out.push({ label: 'Stays turned for', value: formatDuration(def.turns.lastsMs), tone: TONE.MUTED });
            }
        }
    }

    if (def.foundation) out.push(...foundationLines(instance, def, src));
    // A station waits for the player to pick a recipe (TL-15), as a Foundation
    // waits for "what to build". Only said while nothing is picked.
    else if (src.poolFor && src.poolFor(def).length && !src.selectedRecipe(instance, def)) {
        out.push({ label: 'Recipe', value: 'Choose a recipe', tone: TONE.WARNING });
    }
    if (def.trickle) out.push(...trickleLines(instance, def, src));
    if (src.dev) out.push({ label: 'Origin (dev)', value: src.originOf(instance), tone: TONE.MUTED });
    return out;
}
