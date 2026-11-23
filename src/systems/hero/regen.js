import { REGEN_CONFIG } from '../../config/FormulaRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { KEYWORD } from '../effects/statements.js';
import { applyThreeBucket } from '../effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { modifierStatements } from '../effects/LiveEffects.js';
import { loadoutStatements } from './HeroEffects.js';

/**
 * Regen: how much a hero heals out of a fight, the base (`REGEN_CONFIG.hp`) moved by the Regen
 * the hero carries (gear, perks, a lingering effect) and the guild gives (a Guild Hall star, a
 * Region's rule), all in one set of buckets. A Token's Regen is never read: no building heals yet.
 */

/** Where one Regen contribution came from. */
export const REGEN_FROM = Object.freeze({ GEAR: 'gear', PERK: 'perk', CARRIED: 'carried', GUILD: 'guild' });

function bucketOf(bucket) {
    if (bucket === 'flat' || bucket === 'additive') return 'flat';
    if (bucket === 'multiplier') return 'multiplier';
    return 'percentage';
}

/**
 * Every Regen contribution reaching `hero`, in order: their loadout (gear, then perks), their
 * lingering effects, then the guild's. Each `{ from, bucket, value, statement?, modifier? }`.
 */
export function regenContributions(hero) {
    const out = [];
    if (!hero || typeof hero !== 'object') return out;
    const carried = (statements, lingering) => {
        for (const statement of statements) {
            if (statement?.keyword !== KEYWORD.PROVIDES) continue;
            const payload = statement.payload || {};
            if (payload.type !== EFFECT_TYPES.HP_REGEN) continue;
            const value = Number(payload.value);
            if (!Number.isFinite(value)) continue;
            const from = lingering ? REGEN_FROM.CARRIED : statement.perk ? REGEN_FROM.PERK : REGEN_FROM.GEAR;
            out.push({ from, bucket: bucketOf(payload.bucket), value, statement });
        }
    };
    carried(loadoutStatements(hero), false);
    carried(modifierStatements(hero), true);

    const guild = getGlobalAggregator();
    const trace = [];
    guild.getFlat(EFFECT_TYPES.HP_REGEN, undefined, trace);
    guild.collectMultipliers(EFFECT_TYPES.HP_REGEN, undefined, trace);
    guild.collectPercentages(EFFECT_TYPES.HP_REGEN, undefined, trace);
    for (const { bucket, value, modifier } of trace) out.push({ from: REGEN_FROM.GUILD, bucket, value, modifier });
    return out;
}

/** The fraction one set of contributions adds, as one percentage bucket: +50% is 0.5. */
export function regenShare(contributions) {
    return regenOf(contributions) / REGEN_CONFIG.hp.amount - 1;
}

function regenOf(contributions) {
    const flat = [];
    const multipliers = [];
    const percentages = [];
    for (const { bucket, value } of contributions) {
        if (bucket === 'flat') flat.push(value);
        else if (bucket === 'multiplier') multipliers.push(value);
        else percentages.push(value);
    }
    return Math.max(0, applyThreeBucket(REGEN_CONFIG.hp.amount, { flat, multipliers, percentages }));
}

/**
 * HP one regen interval heals `hero`, a fraction where Regen makes one (1.5 at +50%). Exactly
 * `REGEN_CONFIG.hp.amount` with no Regen.
 */
export function regenPerInterval(hero) {
    const contributions = regenContributions(hero);
    return contributions.length ? regenOf(contributions) : REGEN_CONFIG.hp.amount;
}
