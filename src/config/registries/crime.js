// Crime: what a camp's enemy gives a thief, and how often a thief is caught (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (through `cms/src/utils/constants.js`),
// for the enemy editor's steal table and the Hideout's caught curve. Pure: it imports only the coin
// reader, as pure.

import { coinsOf } from './coinCosts.js';

/** The station kind a Hideout works as: Crime's one building, which robs a camp instead of running recipes. */
export const HIDEOUT_KIND = 'hideout';

/**
 * A Hideout's caught curve when its Token writes none (`hideout` block, every number optional):
 * - `evenChance`: percent a thief is caught robbing a camp of their own Crime level;
 * - `perLevel`: percentage points more for each level the camp's Crime level is above the thief's,
 *   and less for each level below;
 * - `minChance`, `maxChance`: the curve never goes past these, Quiet included.
 */
export const CAUGHT_DEFAULTS = Object.freeze({ evenChance: 25, perLevel: 3, minChance: 2, maxChance: 80 });

const CURVE_FIELDS = Object.freeze(['evenChance', 'perLevel', 'minChance', 'maxChance']);

const clampPercent = (n) => Math.max(0, Math.min(100, n));
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const curveMemo = new WeakMap();

/**
 * A Hideout Token's caught curve, `{ evenChance, perLevel, minChance, maxChance }`: its `hideout`
 * block's numbers where written, the defaults ({@link CAUGHT_DEFAULTS}) elsewhere. A chance is
 * kept within 0 to 100, and a floor above the ceiling reads as the ceiling.
 */
export function caughtCurveOf(def) {
    const block = def?.hideout && typeof def.hideout === 'object' && !Array.isArray(def.hideout) ? def.hideout : null;
    if (!block) return CAUGHT_DEFAULTS;
    let curve = curveMemo.get(block);
    if (!curve || CURVE_FIELDS.some(k => curve.src[k] !== block[k])) {
        const pick = (k) => (isNumber(block[k]) ? block[k] : CAUGHT_DEFAULTS[k]);
        const maxChance = clampPercent(pick('maxChance'));
        const terms = Object.freeze({
            evenChance: clampPercent(pick('evenChance')),
            perLevel: Math.max(0, pick('perLevel')),
            minChance: Math.min(clampPercent(pick('minChance')), maxChance),
            maxChance
        });
        curve = { src: Object.fromEntries(CURVE_FIELDS.map(k => [k, block[k]])), terms };
        curveMemo.set(block, curve);
    }
    return curve.terms;
}

/**
 * The percent a thief of `thiefLevel` is caught robbing a camp of Crime level `campLevel`, on
 * `curve` ({@link caughtCurveOf}), less `quiet` points (the Quiet effect): the even chance, plus
 * `perLevel` for each level the camp stands above the thief (less below), held within the curve's
 * floor and ceiling. Below the camp's level often, above it rarely.
 */
export function caughtChance(thiefLevel, campLevel, curve = CAUGHT_DEFAULTS, quiet = 0) {
    const gap = (Number(campLevel) || 0) - (Number(thiefLevel) || 0);
    const raw = curve.evenChance + curve.perLevel * gap - (Number(quiet) || 0);
    return Math.max(curve.minChance, Math.min(curve.maxChance, raw));
}

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

const stealMemo = new WeakMap();
const NONE = Symbol('none');

/** One steal line: an item line as an enemy's drops are written; anything else is no line. */
function stealLine(raw) {
    if (!raw || typeof raw !== 'object' || raw.tokenId) return null;
    const itemId = text(raw.itemId);
    if (!itemId) return null;
    const chance = raw.chance == null ? 100 : Number(raw.chance);
    if (!Number.isFinite(chance) || chance <= 0) return null;
    return Object.freeze({ ...raw, itemId, chance: Math.min(100, chance) });
}

/**
 * An enemy Token's **steal table**: what a thief takes from its camp, beside its fight drops. The
 * `steal` block on the enemy:
 *
 * ```jsonc
 * "steal": {
 *   "crimeLevel": 5,      // the camp's Crime level; missing: the enemy's level
 *   "xp": 6,              // a theft's Crime XP; missing: the Hideout's own
 *   "outputs": [ { "itemId": "item_wheat", "chance": 80, "minQty": 1, "maxQty": 2 } ],
 *   "rareTable": { "chance": 2, "entries": [ { "itemId": "item_nature_mote", "weight": 1 } ] },
 *   "coins": 12           // coins a theft takes, beside the lines; Coin Find at the Hideout raises them
 * }
 * ```
 *
 * `outputs` are item lines, rolled each theft as a cycle's drops are (a Token line is no line);
 * `rareTable` is a rare drop table (`rareTables.js`), rolled after them, which Lucky widens; `coins`
 * (`coinCosts.stealCoinsOf`) a pile of the guild's coins every theft that is not caught. A table
 * with no usable line, no rare table and no coins is no table: the camp cannot be robbed.
 *
 * @returns {{ crimeLevel: number|null, xp: number|null, outputs: object[], rareTable: object|null, coins: number, block: object }|null}
 * `block` is the authored object itself, the stable key a rare table is read by.
 */
export function stealOf(def) {
    const block = def?.steal;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
    let steal = stealMemo.get(block);
    if (steal === undefined) {
        const outputs = (Array.isArray(block.outputs) ? block.outputs : []).map(stealLine).filter(Boolean);
        const rare = block.rareTable && typeof block.rareTable === 'object' ? block.rareTable : null;
        const level = Number(block.crimeLevel);
        const xp = Number(block.xp);
        const coins = coinsOf(block.coins);
        steal = outputs.length || rare || coins > 0
            ? Object.freeze({
                crimeLevel: block.crimeLevel != null && Number.isFinite(level) ? level : null,
                xp: block.xp != null && Number.isFinite(xp) && xp >= 0 ? xp : null,
                outputs: Object.freeze(outputs),
                rareTable: rare,
                coins,
                block
            })
            : NONE;
        stealMemo.set(block, steal);
    }
    return steal === NONE ? null : steal;
}

/** Whether an enemy Token carries a usable steal table ({@link stealOf}). */
export function hasStealTable(def) {
    return stealOf(def) != null;
}

/**
 * The Crime level of the camp an enemy guards: its steal table's `crimeLevel` where written, else
 * the enemy's own level (owner 2026-11-25), else 1.
 */
export function crimeLevelOf(def) {
    const written = stealOf(def)?.crimeLevel;
    if (written != null) return written;
    const level = Number(def?.enemy?.level);
    return Number.isFinite(level) ? level : 1;
}
