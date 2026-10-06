/**
 * Economic simulator, pass 5: the MAP check. A Map is the one thing the player buys blind: a price up front for a burst drawn from a pool. The pass asks two questions in gold: the scrap side (selling everything the burst hands over must not return more than a Map is worth as salvage, or it is a gold printer) and the productive side (using everything must earn back a sensible multiple of the cost, or it is a trap).
 * ⚠️ It writes nothing back to a Map's authored fields: every input is authored, so its findings are refusals, not adjustments.
 */

import {
    DEFAULT_DIALS, RARITY_WEIGHTS, scrapRatioAt, productiveReturnAt,
} from './dials.js';
import { isDeferredKind, isInert, liveCharges } from './fieldAdapter.js';

/**
 * How many things a Map burst deals.
 * ⚠️ The game no longer bursts Maps, but the CMS still models and prices them, so the number is frozen here at the last value the game dealt.
 */
export const BURST_SIZE = 3;
import { cyclesPerHour, earningsPerHour, CORRECTION_CAP } from './tuningPass.js';
import { makeRefusal } from './refusals.js';

/** Token types whose acquisition slice is their productive value: a Context tool and the kinds v1 defers. They are neutral in the verdict, and each files an Info row naming itself, so a pool that is all scaffolding reads as such. `isDeferredKind` covers buff / manager / market / passive / enemy; `context` is the addition. */
const SUPPORT_TOKEN_TYPES = Object.freeze(['context']);

/** Guild-hall maps are skipped. */
export function isGuildHallMap(mapId) {
    return mapId === 'map_guild_hall'
        || (typeof mapId === 'string' && mapId.startsWith('map_guild_hall'));
}

/** A pool entry's gold face value, for the kinds that have one. */
function goldAmount(entry) {
    return entry?.amount || entry?.quantity || 2000;
}

function isGoldEntry(entry) {
    return entry?.kind === 'gold' || entry?.kind === 'currency';
}

/** The draw weight a pool entry derives from its rarity tag. One global table, no per-pool override: the entry's weight column in the Map editor is derived from here. A referenced record with no rarity reads as Common, the table's neutral row. */
export function derivedWeight(rarity, dials = DEFAULT_DIALS) {
    const weights = dials.rarityWeights || RARITY_WEIGHTS;
    return weights[rarity] ?? weights.common ?? 100;
}

/** Split `total` across `weights` by `weight^(−premium)`, in whole gold by largest remainder so the slices sum exactly. Premium 0 gives every entry an equal slice (rarity stops mattering); 1 is a hard inverse, so one draw's expected scrap is identical for every entry; the default sits between. */
export function allocateByRarity(total, weights, premium = 0.8) {
    const n = weights.length;
    const budget = Math.max(0, Math.round(total));
    if (n === 0 || budget === 0) return new Array(n).fill(0);

    const exponents = weights.map((w) => {
        const weight = Number.isFinite(w) && w > 0 ? w : 1;
        return Math.pow(weight, -premium);
    });
    const sum = exponents.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return new Array(n).fill(0);

    const ideal = exponents.map((e) => (budget * e) / sum);
    const floors = ideal.map((v) => Math.floor(v));
    let left = budget - floors.reduce((a, b) => a + b, 0);

    // Biggest fractional part first; ties by index, so the split is stable across runs.
    const order = ideal
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
    for (const { i } of order) {
        if (left <= 0) break;
        floors[i] += 1;
        left -= 1;
    }
    return floors;
}

/**
 * How many of each pool entry one burst is expected to contain.
 * ⚠️ Slot one is not a free draw: it draws over the pool's `kind === 'token'` entries only, with weights renormalised among themselves, and later slots draw over the whole pool. In a pool that is half raw items this roughly doubles how often Tokens turn up. The burst length is `BURST_SIZE`.
 */
export function burstExpectation(shares, isToken, burstSize = BURST_SIZE) {
    const n = shares.length;
    const tokenTotal = shares.reduce((sum, s, i) => sum + (isToken[i] ? s : 0), 0);
    // A pool with no Token entries (or whose Tokens are all undrawable) falls back to free draws for every slot.
    const slotOne = tokenTotal > 0
        ? shares.map((s, i) => (isToken[i] ? s / tokenTotal : 0))
        : [...shares];
    const free = Math.max(0, burstSize - 1);
    return new Array(n).fill(0).map((_, i) => slotOne[i] + free * shares[i]);
}

export function mapCost(map, values) {
    const price = Number.isFinite(map?.price) ? map.price : 0;
    const materials = (map?.materials || []).reduce((sum, m) => {
        const value = values.get(m?.itemId);
        if (!Number.isFinite(value)) return sum;
        return sum + value * (Number.isFinite(m?.quantity) ? m.quantity : 1);
    }, 0);
    return price + materials;
}

/** What an enemy's lifetime loot is worth: one kill is one charge, so its lifetime loot is the expected drops from one kill. No time dimension and no new field. `drops[]` is `{ itemId, minQty, maxQty, chance }` with `chance` a percentage. */
export function enemyLootValue(enemy, values) {
    return (enemy?.drops || []).reduce((sum, drop) => {
        const value = values.get(drop?.itemId);
        if (!Number.isFinite(value)) return sum;
        const min = Number.isFinite(drop?.minQty) ? drop.minQty : 1;
        const max = Number.isFinite(drop?.maxQty) ? drop.maxQty : min;
        const chance = Number.isFinite(drop?.chance) ? drop.chance / 100 : 1;
        return sum + ((min + max) / 2) * chance * value;
    }, 0);
}

/**
 * What one copy of a Token earns over its whole life, in gold: profit per hour from the solved cycle the TUNE pass left behind, over a lifetime of `charges ÷ cycles per hour` (how long the copy lasts, not how long the player owns it). A Token with no charge count never runs out, so the `unlimitedLifetimeHours` dial stands in.
 * ⚠️ Charges are read through `liveCharges`: `uses`, never `charges`.
 */
export function lifetimeValue(entity, { cycleTimeMs, values, dials }) {
    if (!entity || isInert(entity) || !Number.isFinite(cycleTimeMs) || cycleTimeMs <= 0) {
        return { value: 0, hours: 0, profitPerHour: 0, unlimited: false };
    }
    // ⚠️ The adapted outputs are passed through whole. `earningsPerHour` reads
    // each output's **precomputed `abundance`** rather than deriving it, so a
    // hand-built output object missing that field silently earns `NaN` an hour.
    const state = { cycleTimeMs, outputs: entity.outputs.map((o) => ({ ...o })) };
    const { profitPerHour } = earningsPerHour(entity, state, values);
    // ⚠️ Zero, not NaN, and the difference is the whole point: `NaN < bound` is
    // `false`, so an unguarded NaN made a Map that produces nothing read as
    // PASSING its productive bound. Pinned by a test.
    if (!Number.isFinite(profitPerHour)) {
        return { value: 0, hours: 0, profitPerHour: 0, unlimited: false };
    }
    const cph = cyclesPerHour(cycleTimeMs, entity.level);
    const charges = entity.charges;
    const unlimited = !Number.isFinite(charges) || charges <= 0;
    const hours = unlimited
        ? (dials.unlimitedLifetimeHours ?? DEFAULT_DIALS.unlimitedLifetimeHours)
        : (cph > 0 ? charges / cph : 0);
    return { value: profitPerHour * hours, hours, profitPerHour, unlimited };
}

/**
 * Run the MAP check over every Map in the corpus.
 *
 * @param {object} maps    keyed Map records, as the CMS store holds them
 * @param {object} ctx     `{ entities, values, cycleTimes, items, tokens,
 *                            enemies, dials }`
 * @returns {{ reports: Map, scrapValues: Map, weights: Map, rows: Array }}
 *
 * `scrapValues` is one derived sell price per Token id.
 */
export function runMapPass(maps = {}, {
    entities = [],
    values = new Map(),
    cycleTimes = new Map(),
    items = {},
    tokens = {},
    enemies = {},
    dials = DEFAULT_DIALS,
} = {}) {
    const byId = new Map(entities.map((e) => [e.id, e]));
    const rows = [];
    const reports = new Map();
    const weights = new Map();
    const scrapValues = new Map();
    const premium = Number.isFinite(dials.rarityPremium) ? dials.rarityPremium : 0.8;

    for (const mapId of Object.keys(maps).sort()) {
        const map = maps[mapId];
        const id = map?.id ?? mapId;
        const name = map?.name ?? id;
        const pool = Array.isArray(map?.pool) ? map.pool : [];

        if (isGuildHallMap(id)) {
            reports.set(id, { id, name, skipped: 'guild-hall', entries: [] });
            continue;
        }
        if (pool.length === 0) {
            reports.set(id, { id, name, skipped: 'empty-pool', entries: [] });
            continue;
        }

        const entries = pool.map((entry, index) => {
            const kind = isGoldEntry(entry) ? 'gold' : (entry?.kind ?? 'token');
            const refId = entry?.refId ?? null;
            const token = kind === 'token' ? tokens[refId] : null;
            const item = kind === 'item' ? items[refId] : null;
            const enemy = kind === 'enemy' ? enemies[refId] : null;
            const ref = token || item || enemy || null;
            const entity = kind === 'token' ? byId.get(refId) : null;
            return {
                index,
                kind,
                refId,
                name: ref?.name ?? refId ?? kind,
                rarity: ref?.rarity ?? null,
                quantity: Number.isFinite(entry?.quantity) ? entry.quantity : 1,
                amount: kind === 'gold' ? goldAmount(entry) : 0,
                missing: kind !== 'gold' && !ref,
                token, item, enemy, entity,
                weight: derivedWeight(ref?.rarity, dials),
            };
        });

        const weightTotal = entries.reduce((sum, e) => sum + e.weight, 0);
        entries.forEach((e) => { e.share = weightTotal > 0 ? e.weight / weightTotal : 0; });
        weights.set(id, entries.map((e) => e.weight));

        const expected = burstExpectation(
            entries.map((e) => e.share),
            entries.map((e) => e.kind === 'token'),
        );
        entries.forEach((e, i) => { e.expectedCount = expected[i]; });

        // Derived Map level: the pool-share-weighted mean of what its entries ask of a hero, renormalised over the entries that ask anything at all, so a pile of gold does not drag the mean to zero.
        let levelWeight = 0;
        let levelSum = 0;
        for (const e of entries) {
            const level = e.entity?.level ?? e.enemy?.level ?? null;
            if (!Number.isFinite(level)) continue;
            levelWeight += e.share;
            levelSum += e.share * level;
        }
        const level = levelWeight > 0 ? levelSum / levelWeight : 1;

        const cost = mapCost(map, values);
        const scrapRatio = scrapRatioAt(level, dials);
        const budget = Math.round(cost * scrapRatio);

        // Raw items and gold stand outside the rarity allocation and count at face value on both sides.
        const outsideOf = (e) => {
            if (e.kind === 'gold') return e.amount;
            if (e.kind === 'item') {
                const value = values.get(e.refId);
                return Number.isFinite(value) ? value * e.quantity : 0;
            }
            return null;
        };
        entries.forEach((e) => { e.outside = outsideOf(e); });

        const outsideTotal = Math.round(
            entries.reduce((sum, e) => sum + (e.outside ?? 0), 0)
        );
        const overflow = outsideTotal > budget;
        const remaining = Math.max(0, budget - outsideTotal);

        const inside = entries.filter((e) => e.outside === null);
        const slices = allocateByRarity(remaining, inside.map((e) => e.weight), premium);
        inside.forEach((e, i) => { e.scrapValue = slices[i]; });
        entries.forEach((e) => { if (e.outside !== null) e.scrapValue = e.outside; });

        if (overflow) {
            rows.push(makeRefusal('map-item-heavy', {
                what: `${name}'s raw-item and gold entries are worth ${outsideTotal}g on their own.`,
                why: `The whole burst is only supposed to scrap for about ${budget}g — ${(scrapRatio * 100).toFixed(0)}% of what the Map costs (${cost}g) — so the burst scrap exceeds the scrap bound before any Token is counted, and every Token in the pool scraps for nothing.`,
            }, { entityId: id, detail: { cost, budget, outsideTotal } }));
        }

        for (const e of entries) {
            if (e.outside !== null) {
                // Face value on both sides: a raw item or a pile of gold is
                // worth what it is worth, whether spent or sold.
                e.productiveValue = e.outside;
                e.basis = e.kind === 'gold' ? 'gold' : 'raw item';
                continue;
            }

            if (e.kind === 'enemy') {
                const loot = enemyLootValue(e.enemy, values);
                e.productiveValue = loot;
                e.basis = 'lifetime loot (one kill)';
                // Band-check the loot against what the burst charged for it: wildly generous or a rip-off, not off-by-a-fraction. The factor is the lever policy's own correction cap, reused because the project already means too far by it.
                if (e.scrapValue > 0 && loot > 0) {
                    const ratio = loot / e.scrapValue;
                    if (ratio > CORRECTION_CAP || ratio < 1 / CORRECTION_CAP) {
                        const generous = ratio > CORRECTION_CAP;
                        rows.push(makeRefusal('map-enemy-band', {
                            what: `${e.name} drops ${loot.toFixed(0)}g of loot per kill, and ${name}'s burst charges ${e.scrapValue}g for it.`,
                            why: generous
                                ? 'Killing it pays several times what it cost to find, so the pool is a loot fountain rather than a supply line.'
                                : 'It costs several times what killing it ever gives back, so drawing it reads as a wasted slot.',
                        }, { entityId: id, generous, detail: { ratio, loot, slice: e.scrapValue } }));
                    }
                }
                continue;
            }

            const support = e.kind === 'token'
                && (SUPPORT_TOKEN_TYPES.includes(e.token?.tokenType) || isDeferredKind(e.entity));
            if (support) {
                // Acquisition slice is the productive value, so the entry is neutral in the verdict either way.
                e.productiveValue = e.scrapValue;
                e.basis = 'support — counted at its slice';
                rows.push(makeRefusal('map-support-entry', {
                    what: `${e.name} is a ${e.token?.tokenType ?? 'support'} Token in ${name}'s pool.`,
                    why: 'A Token that helps its neighbours rather than producing anything is counted at exactly what the burst charged for it, so it neither helps nor hurts this Map\'s verdict.',
                }, { entityId: id, detail: { tokenType: e.token?.tokenType ?? null } }));
                continue;
            }

            const life = lifetimeValue(e.entity, {
                cycleTimeMs: cycleTimes.get(e.refId),
                values,
                dials,
            });
            e.productiveValue = life.value;
            e.lifetimeHours = life.hours;
            e.basis = life.value === 0
                ? 'no solved cycle'
                : `${life.profitPerHour.toFixed(0)}g/h over ${life.hours.toFixed(1)}h`;

            if (life.value === 0) {
                rows.push(makeRefusal('map-idle-entry', {
                    what: `${e.name} does no work the simulator can price, and ${name}'s burst still hands it over.`,
                    why: 'It counts as earning nothing on the productive side, which is why this Map may read as underwater.',
                }, { entityId: id, detail: { refId: e.refId } }));
            }

            // An unlimited Token quietly opts out of the supply-line loop this whole check protects.
            if (e.kind === 'token' && e.entity && !isInert(e.entity)
                && !Number.isFinite(liveCharges(e.token))) {
                rows.push(makeRefusal('map-unlimited-token', {
                    what: `${e.name} never runs out, and ${name}'s burst hands it over.`,
                    why: `An unlimited Token is a rare, special design space that opts out of the supply line — the check can only guess at its lifetime, and is assuming ${dials.unlimitedLifetimeHours ?? DEFAULT_DIALS.unlimitedLifetimeHours} hours of work.`,
                }, { entityId: id, detail: { refId: e.refId } }));
            }
        }

        const scrapSide = entries.reduce((s, e) => s + e.expectedCount * e.scrapValue, 0);
        const productiveSide = entries.reduce((s, e) => s + e.expectedCount * e.productiveValue, 0);
        const scrapBound = budget;
        const productiveReturn = productiveReturnAt(level, dials);
        const productiveBound = cost * productiveReturn;

        const scrapRich = scrapSide > scrapBound;
        const underwater = productiveSide < productiveBound;

        if (scrapRich) {
            rows.push(makeRefusal('map-scrap-rich', {
                what: `${name} bursts into about ${scrapSide.toFixed(0)}g of scrap, and it should scrap for at most ${scrapBound}g.`,
                why: `A burst of ${BURST_SIZE} draws from a pool of ${entries.length} takes a large share of a scrap budget that is split across the whole pool, so selling the contents pays back more than the ${cost}g the Map cost.`,
            }, { entityId: id, detail: { scrapSide, scrapBound, cost, poolSize: entries.length } }));
        }
        if (underwater) {
            rows.push(makeRefusal('map-underwater', {
                what: `${name} costs ${cost}g and its burst earns about ${productiveSide.toFixed(0)}g over the contents' lifetime.`,
                why: `A Map whose contents work at level ${level.toFixed(0)} should hand back around ${productiveReturn.toFixed(1)}× its cost — about ${productiveBound.toFixed(0)}g — and this one does not pay for itself.`,
            }, { entityId: id, detail: { productiveSide, productiveBound, cost, level } }));
        }

        // A Token in several pools takes the best price it earns anywhere: the reading a player can verify, where an average would price a Token by Maps the player may never have seen.
        for (const e of entries) {
            if (e.kind !== 'token' || !e.refId) continue;
            const best = Math.max(scrapValues.get(e.refId) ?? 0, e.scrapValue);
            scrapValues.set(e.refId, best);
        }

        reports.set(id, {
            id, name, level, cost,
            scrapRatio, scrapBudget: budget, scrapSide, scrapBound,
            productiveReturn, productiveSide, productiveBound,
            scrapRich, underwater, overflow,
            pass: !scrapRich && !underwater,
            burstSize: BURST_SIZE,
            entries: entries.map((e) => ({
                kind: e.kind,
                refId: e.refId,
                name: e.name,
                rarity: e.rarity,
                missing: e.missing,
                weight: e.weight,
                share: e.share,
                expectedCount: e.expectedCount,
                scrapValue: e.scrapValue,
                productiveValue: e.productiveValue,
                basis: e.basis,
            })),
        });
    }

    return { reports, scrapValues, weights, rows };
}
