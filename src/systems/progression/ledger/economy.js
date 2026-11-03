// the progression ledger's checks E: the economy (one-source hubs, stocks with no sink, spawner upkeep, value per effort)

import { HOW, LUCK_BELOW, parseKey, itemKey, tokenKey } from './engine.js';
import { ruleIndex, ruleTier } from './checks.js';
import { buildRateBook, LIFECYCLE } from './rates.js';
import { planOf, tierLabel } from './plan.js';

/**
 * Checks E, worked out from the ledger and the content and handed to `runChecks` as `extra`
 * findings (`checks.js` holds their words and severities):
 *
 * - **A hub with one source** (`hub-one-source`): at least {@link HUB_MIN_USES} things spend an
 *   item and one work alone makes it, so that one source moves them all.
 * - **A stock with no sink** (`no-sink`): made over and over, but only ever paid once at a time (a
 *   build, a Shop price, a Guild Hall rank): once those are paid it piles up.
 * - **Spawner upkeep above output** (`spawner-upkeep`): what a spawner charges for a spawn is worth
 *   more than everything that spawn makes before it wears out, by the items' values.
 * - **Value per effort far off the norm** (`value-effort`): an item's value (the simulator's) over
 *   the hero-minutes its tree takes is over {@link VALUE_EFFORT_FACTOR} times its stage's middle
 *   either way.
 *
 * Average luck only; a source that gives an item under the luck line is not a source here.
 * Pure: reads only what it is handed.
 */

/** A hub is spent by at least this many things. */
export const HUB_MIN_USES = 3;
/** Value per effort-minute this many times off its stage's middle, either way, is far off. */
export const VALUE_EFFORT_FACTOR = 4;

/** The rules that make an item over and over. */
const PRODUCING = new Set([HOW.WORK, HOW.CATCH, HOW.DROP, HOW.CRAFT, HOW.TRICKLE, HOW.UPGRADE, HOW.BONUS]);
/** The rules that spend an item over and over: a recipe's cycle, a work's input or bait, an upkeep, a regrowth. */
const REPEATING = new Set([HOW.STATION, HOW.CRAFT, HOW.WORK, HOW.CATCH, HOW.SPAWN, HOW.GROW]);
/** Item types a player uses up or wears: spending them is the player's, not a recipe's. */
const FINAL_TYPES = new Set(['consumable', 'treasure', 'food', 'drink', 'potion', 'weapon', 'armor', 'tool', 'fuel', 'drop']);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);

function itemsOf(content) {
    const out = {};
    const items = content.items;
    if (Array.isArray(items)) items.forEach(d => { if (isObject(d) && d.id) out[d.id] = d; });
    else if (isObject(items)) for (const [id, d] of Object.entries(items)) if (isObject(d)) out[d.id ?? id] = d;
    return out;
}

/**
 * Every finding of checks E: `[{ check, key, message, related, severity? }]`.
 * @param {object} ledger   `buildLedger(content)`
 * @param {object} content  what the ledger was built from
 * @param {{ book?: object }} [options]  a rate book already built (`buildRateBook(content)`)
 */
export function economyFindings(ledger, content = {}, { book = null } = {}) {
    const { world, reach } = ledger;
    const index = ruleIndex(world);
    const items = itemsOf(content);
    const name = (key) => world.names.get(key) ?? parseKey(key).id;
    const reached = (rule) => Number.isInteger(ruleTier(reach, rule));
    const counted = (key) => !world.planned?.has(key);
    const out = [];
    const listNames = (keys, max = 3) => {
        const names = [...new Set(keys.map(name))];
        return names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', ');
    };
    const isBuild = (recipeKey) => index.givers(recipeKey).some(r => r.how === HOW.BUILD);
    const sourceWords = (key) => (parseKey(key).kind === 'recipe' ? `the ${name(key)} recipe` : name(key));
    const producersOf = (key) => index.givers(key).filter(r => PRODUCING.has(r.how) && reached(r)
        && r.gives.some(g => g.key === key && g.chance >= LUCK_BELOW && g.firstKill !== true));

    // A hub with one source.
    for (const hub of ledger.hubs()) {
        const key = itemKey(hub.id);
        if (hub.uses < HUB_MIN_USES || !counted(key) || !Number.isInteger(reach.get(key)?.tier)) continue;
        const sources = [...new Set(producersOf(key).map(r => r.via).filter(Boolean))];
        if (sources.length !== 1) continue;
        out.push({
            check: 'hub-one-source', key,
            message: `${hub.uses} things spend it (${listNames(hub.consumers)}), and only ${sourceWords(sources[0])} makes it: that one source sets the pace of them all.`,
            related: [sources[0], ...hub.consumers]
        });
    }

    // A stock with no sink.
    for (const [id, def] of Object.entries(items)) {
        const key = itemKey(id);
        if (!counted(key) || !Number.isInteger(reach.get(key)?.tier)) continue;
        const type = String(def.type || '').toLowerCase();
        if (FINAL_TYPES.has(type) || def.equipSlot || list(def.tags).some(t => FINAL_TYPES.has(String(t).toLowerCase()))) continue;
        const makers = producersOf(key).filter(r => !(r.how === HOW.CRAFT && isBuild(r.via)));
        if (!makers.length) continue;
        const sinks = index.takers(key).filter(r => r.inputs.some(i => i.key === key) && !r.gives.some(g => g.key === key));
        if (!sinks.length) continue;
        const repeating = sinks.filter(r => REPEATING.has(r.how) && !(r.how === HOW.CRAFT && isBuild(r.via)) && !(r.how === HOW.STATION && isBuild(r.gives[0]?.key)));
        if (repeating.length) continue;
        const once = [...new Set(sinks.map(r => (r.how === HOW.SHOP || r.how === HOW.BUILD || r.how === HOW.STATION ? r.gives[0]?.key : r.via) || r.gives[0]?.key).filter(Boolean))];
        out.push({
            check: 'no-sink', key,
            message: `Made over and over (by ${[...new Set(makers.map(r => r.via).filter(Boolean))].slice(0, 3).map(sourceWords).join(', ')}), but only ever paid once at a time: ${listNames(once, 4)}. Once those are paid it piles up with nothing to spend it on.`,
            related: [...makers.map(r => r.via).filter(Boolean), ...once]
        });
    }

    // Spawner upkeep above what a spawn makes before it wears out.
    const rates = book || buildRateBook(content);
    const valueOf = (itemId) => {
        const v = Number(items[itemId]?.value);
        return Number.isFinite(v) && v > 0 ? v : null;
    };
    for (const id of rates.tokenIds()) {
        const def = rates.token(id);
        const upkeep = list(def?.spawner?.upkeep).filter(u => typeof u?.itemId === 'string' && Number(u.quantity) > 0);
        const key = tokenKey(id);
        if (!upkeep.length || !counted(key) || !Number.isInteger(reach.get(key)?.tier)) continue;
        const cost = upkeep.map(u => ({ itemId: u.itemId, value: valueOf(u.itemId), quantity: Number(u.quantity) }));
        if (cost.some(c => c.value === null)) continue;
        const costValue = cost.reduce((a, c) => a + c.value * c.quantity, 0);
        for (const spawn of list(def.spawner.spawns)) {
            const worked = workedFrom(rates, spawn?.typeId);
            if (!worked) continue;
            const r = rates.rateOf({ token: worked });
            if (!r.ok || r.lifecycle?.kind !== LIFECYCLE.ONE_OFF) continue;
            const cycles = Number(r.lifecycle.cycles) || 0;
            let lifeValue = 0;
            let priced = true;
            for (const [itemId, n] of Object.entries(r.perCycle || {})) {
                const v = valueOf(itemId);
                if (v === null) { priced = false; break; }
                lifeValue += v * n * cycles;
            }
            if (!priced || lifeValue >= costValue) continue;
            out.push({
                check: 'spawner-upkeep', key,
                message: `Each ${name(tokenKey(spawn.typeId))} it spawns costs ${cost.map(c => `${c.quantity} ${name(itemKey(c.itemId))}`).join(', ')} (worth ${Math.round(costValue)}), but ${name(tokenKey(worked))} makes only ${Math.round(lifeValue)} worth over its ${cycles} cycle${cycles === 1 ? '' : 's'} before it wears out.`,
                related: [tokenKey(worked)]
            });
        }
    }

    // Value per effort-minute far off its stage's middle.
    const byTier = new Map();
    for (const [id, def] of Object.entries(items)) {
        const key = itemKey(id);
        const value = valueOf(id);
        if (value === null || !counted(key) || !Number.isInteger(reach.get(key)?.tier)) continue;
        const tree = ledger.treeOf(id);
        if (!tree.complete || !(tree.effortMs > 0)) continue;
        const tier = planOf(def).tier ?? reach.get(key).tier;
        if (!byTier.has(tier)) byTier.set(tier, []);
        byTier.get(tier).push({ key, value, minutes: tree.effortMs / 60000, rate: value / (tree.effortMs / 60000) });
    }
    for (const [tier, rows] of byTier) {
        if (rows.length < 5) continue;
        const sorted = rows.map(r => r.rate).sort((a, b) => a - b);
        const middle = sorted[Math.floor(sorted.length / 2)];
        for (const r of rows) {
            const off = r.rate / middle;
            if (off <= VALUE_EFFORT_FACTOR && off >= 1 / VALUE_EFFORT_FACTOR) continue;
            out.push({
                check: 'value-effort', key: r.key,
                message: `Worth ${Math.round(r.value)} for ${r.minutes < 1 ? `${Math.max(1, Math.round(r.minutes * 60))} s` : `${Math.round(r.minutes * 10) / 10} min`} of hero work: ${rateWords(r.rate)} a minute, ${off > 1 ? `${Math.round(off * 10) / 10}× more` : `${Math.round(10 / off) / 10}× less`} than the middle of ${tierLabel(tier)} (${rateWords(middle)}).`
            });
        }
    }
    return out;
}

const rateWords = (n) => (n >= 10 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`);

/** The Token a spawn is worked as: itself when it has work, else what it grows into (a sapling into its tree). */
function workedFrom(book, typeId) {
    let id = typeId;
    for (let step = 0; step < 8 && typeof id === 'string'; step++) {
        const def = book.token(id);
        if (!def) return null;
        if (isObject(def.config)) return id;
        id = def.grows?.into;
    }
    return null;
}
