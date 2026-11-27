// the balance rules' curves, in one place: the simulator (Recalculate) reads them, and the ledger reads them where it shares a curve

/**
 * The owner's rules (docs/reference/BALANCE_RULES.md; the numbers come from
 * `.claude/skills/balancer/balance_rules.py`, the page's source):
 *
 * - **XP an hour** (section 1): work unlocked at level L pays 1,660 × 2^((L − 1) / 20) XP an hour,
 *   doubling every 20 levels (one tier), so an old task is 2x slower a tier later.
 * - **Worth an hour** (section 7, owner 2026-11-26): an hour of work at level L is worth
 *   1,200 × 2^((L − 1) / 20) gold, the same doubling as XP: 1,200 at level 1, about 35,800 at 99.
 * - **The purpose tilt** (section 1, owner 2026-11-25, the moderate one): one total reward an hour,
 *   leaning toward XP or toward goods. Training work pays 1.5x the XP and half the goods, balanced
 *   work both in full, earning work half the XP and 1.5x the goods.
 *
 * - **The optimized boost factor** (section 1): how much faster a well-optimized hero earns than one
 *   with no boosts, 1 / (1 − Maxed speed) × (1 + Maxed XP), read from the ledger's boost budget
 *   (section 5) and climbing level by level between tier openings. XP per action is divided by it,
 *   because the XP curve is the boosted player's.
 *
 * ⚠️ Pure numbers, no store and no file: the CMS page, its server, its Node tools and the ledger's
 * Worker all import this module.
 */

import { boostBudgetAt, DEFAULT_LEDGER_SETTINGS } from './ledger/settings.js';

/** Levels for XP an hour and worth an hour to double (one tier, BALANCE_RULES section 1). */
export const LEVELS_TO_DOUBLE = 20;

/** XP an hour at level 1: level 1's 83 XP in 3 minutes. */
export const XP_AN_HOUR_AT_LEVEL_1 = 1660;

/** Gold an hour at level 1. */
export const WORTH_AN_HOUR_AT_LEVEL_1 = 1200;

/**
 * The rest rule (section 2, owner 2026-11-26): a node gives about 15 s of work, then is back in about
 * a minute, so a lone hero at one node works about a fifth of the time and a camp keeps one fully
 * busy on 4 or 5. The number pack writes it onto gathering Tokens (`numberPack.js`); the ledger
 * reads the content's own numbers and says the rule in its layout check.
 */
export const REST_RULE = Object.freeze({ workMs: 15000, restMs: 60000 });

/** The end chance a cycle, in percent, that makes about the rule's work at a cycle of `cycleMs`: one decimal, 100 at most. */
export function restRuleEndChance(cycleMs) {
    return Math.min(100, Math.round(1000 * cycleMs / REST_RULE.workMs) / 10);
}

/** The share of the time a lone hero at one node by the rule works: its work over its work and rest. */
export function restRuleBusyShare() {
    return REST_RULE.workMs / (REST_RULE.workMs + REST_RULE.restMs);
}

/** The levels the curves run over; outside them a curve holds its end value. */
export const FIRST_LEVEL = 1;
export const TOP_LEVEL = 99;

/**
 * The purpose tilt, by the simulator's Purpose tag: `xph` is training work, `iph` balanced, `gph`
 * earning. `xp` scales the XP an hour, `goods` the worth an hour.
 */
export const PURPOSE_TILT = Object.freeze({
    xph: Object.freeze({ xp: 1.5, goods: 0.5 }),
    iph: Object.freeze({ xp: 1, goods: 1 }),
    gph: Object.freeze({ xp: 0.5, goods: 1.5 }),
});

/** The level a curve reads: a nonsense level reads as level 1, and the curves hold flat past 1 and 99. */
function curveLevel(level) {
    const L = Number.isFinite(level) ? level : FIRST_LEVEL;
    return Math.min(TOP_LEVEL, Math.max(FIRST_LEVEL, L));
}

/** How many times level L's rate is level 1's: 2 every {@link LEVELS_TO_DOUBLE} levels. */
export function doublingFactor(level) {
    return 2 ** ((curveLevel(level) - FIRST_LEVEL) / LEVELS_TO_DOUBLE);
}

/** XP an hour of work unlocked at `level`, before any tilt. */
export function xpAnHourAt(level) {
    return XP_AN_HOUR_AT_LEVEL_1 * doublingFactor(level);
}

/** Gold an hour of work unlocked at `level`, before any tilt. */
export function worthAnHourAt(level) {
    return WORTH_AN_HOUR_AT_LEVEL_1 * doublingFactor(level);
}

/** The tilt's XP factor for a Purpose tag; 0 for an unknown or missing tag (it teaches nothing). */
export function xpTilt(purpose) {
    return PURPOSE_TILT[purpose]?.xp ?? 0;
}

/** The tilt's goods factor for a Purpose tag; 0 for an unknown or missing tag. */
export function goodsTilt(purpose) {
    return PURPOSE_TILT[purpose]?.goods ?? 0;
}

/**
 * The optimized boost factor at `level`: 1 / (1 − Maxed speed) × (1 + Maxed XP), from the boost
 * budget of `ledgerSettings` (the ledger's settings, the plan's `planSettings`; the ledger's defaults
 * when none), climbing in a straight line between tier openings as the ledger's own budget does.
 */
export function optimizedBoostFactor(level, ledgerSettings = DEFAULT_LEDGER_SETTINGS) {
    const cell = boostBudgetAt(ledgerSettings || DEFAULT_LEDGER_SETTINGS, curveLevel(level));
    const speed = Math.min(0.95, Math.max(0, (cell.speed?.maxed ?? 0) / 100));
    const xp = Math.max(0, (cell.xp?.maxed ?? 0) / 100);
    return (1 / (1 - speed)) * (1 + xp);
}
