// what boosts one Token, effect by effect: each named effect's sources and total, summed as the engine sums them

import { EFFECT_TYPES, TARGET_CATEGORIES } from '../effects/constants.js';
import { applyThreeBucket } from '../effects/ModifierAggregator.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { enemyProfileOf } from '../../config/registries/enemyProfile.js';
import { respawnOf, cropTermsOf } from '../../config/registries/tokenConstants.js';
import { authoredStars } from '../../config/guildUpgrades.js';
import { rareTableChance } from '../../config/registries/rareTables.js';
import { GameState } from '../../state/GameState.js';
import { t } from '../../i18n/index.js';
import { toRoman } from '../../utils/Formatters.js';
import { hallSourceOf } from '../progression/hallModifiers.js';
import { regionSourceOf } from '../atlas/regionModifiers.js';
import { getRegion } from '../atlas/Atlas.js';
import * as HeroManager from '../hero/HeroManager.js';
import { applyXpBonus } from '../hero/xpBonus.js';
import { getCombatXpAward, getHeroCombatStyle } from '../combat/CombatFormulas.js';
import { carriedKindOf } from '../hero/carriedKind.js';
import * as BoardState from './BoardState.js';
import * as TileModifiers from './TileModifiers.js';
import * as Fields from './Fields.js';
import * as Fishing from './Fishing.js';
import * as Respawn from './Respawn.js';
import * as Demolition from './Demolition.js';
import * as Foundations from './Foundations.js';
import { exactInputQuantity, costedInputs } from './InputCost.js';
import { effectiveIO } from './RecipeResolver.js';
import { workConfigOf } from './StationRecipe.js';
import { flooredWorkTime, floorSpeedUp, authoredWorkMs } from './workTime.js';
import { nearby } from './nearby.js';

/**
 * The effect breakdown behind the Token card's badges (brief 600): for one Token on the mat, each
 * named effect (UI_STYLE "Effect names", in that list's order) with its total and every source.
 *
 * ⚠️ Read only, and never a second copy of the maths. Every number comes from the engine's own
 * walk (`TileModifiers.explainAxis` / `explainGrowTime`, the very function `resolveAxis` and
 * `growTimeOf` sum through) and the engine's own rules after the sum (`flooredWorkTime`,
 * `Respawn.restMsOf`, `Fields.loadAtRipening`, `applyXpBonus`), so a badge is what happens. No
 * random draw, no game state written; the runtime caches the card already fills (a Token's
 * aggregator, its kept Grow Time, a hero's kept loadout) may be filled.
 *
 * A source's `amount` is what the total would lose without it: exact for sources in one bucket (all
 * content today), and still the honest marginal share when buckets mix. A badge's `total` is the
 * engine's own resolved value; only a bucket summed below nothing (`combinePercentages` stops at
 * -100 %) can leave the lines adding up to more than it.
 */

/**
 * @typedef {object} EffectSource
 * @property {string} key       one line per source: `token:<id>`, `star:<id>`, `region:<id>`, `gear:<hero>:<items>`...
 * @property {string} kind      a {@link SOURCE_KIND}
 * @property {string} name      for the hover: "Hall star Deep Soil III", "Forge nearby", "Mira's Gloves"
 * @property {number} amount    in the badge's unit, signed (+15 is 15 % faster on Speed)
 * @property {Array<{bucket: string, value: number}>} rules the authored numbers it adds, per bucket
 * @property {string} [tokenId]  the Token the rule stands on (`building`, `self`)
 * @property {string} [typeId]
 * @property {string} [starId]   and `rank`, the rank held (`star`)
 * @property {number} [rank]
 * @property {string} [regionId] (`region`)
 * @property {string} [heroId]   (`gear`, `perk`, `carried`)
 * @property {string[]} [itemIds] the items lending it (`gear`)
 * @property {string} [effectId] the library effect (`gear`, `perk`, `carried`)
 *
 * @typedef {object} EffectBadge
 * @property {string} key       a {@link EFFECT_KEY}: the badge's place in the row and its icon
 * @property {string} name      the UI_STYLE name ("Speed")
 * @property {string} unit      a {@link UNIT}: what `total`, `counted` and each `amount` are in
 * @property {number} total     `resolved` in the badge's unit, signed: +23 is "+23 %" (Speed: faster). The
 *                              sources' amounts add up to it while they share one bucket, as all content does
 * @property {number} counted   `final` in the badge's unit, what the engine applies; equals `total` unless `limit`
 * @property {string|null} limit a {@link LIMIT} when one holds the total, else null
 * @property {boolean} held     `limit !== null`: draw the number gold, say how much counts
 * @property {number} base      the engine's own numbers: the authored value (ms, XP, quantity, chance)...
 * @property {number} resolved  ...after every source (`resolveAxis`)...
 * @property {number} final     ...and after the limits, what the engine runs with
 * @property {string} [itemId]  on an item badge
 * @property {EffectSource[]} sources in scope order: the Token's own (buildings, aimed stars), the guild's, the hero's
 *
 * @typedef {object} TokenEffects
 * @property {string} instanceId
 * @property {string} typeId
 * @property {boolean} enemy
 * @property {string|null} heroId  who works it now (an enemy: who fights it)
 * @property {EffectBadge[]} effects  the Token's badge row, in UI_STYLE order, none at zero
 * @property {Array<{itemId: string, effects: EffectBadge[]}>} outputs Double Item, per made or dropped item
 * @property {Array<{itemId: string, quantity: number, effects: EffectBadge[]}>} inputs Efficiency, per need
 * @property {{heroId: string, name: string, sources: Array<EffectSource & {effect: string, itemId?: string}>}|null} hero
 *           the working hero's own sources across every badge above (the Hero Effects badge), or null
 */

/** The named effects, in UI_STYLE's order. */
export const EFFECT_KEY = Object.freeze({
    SPEED: 'speed',
    YIELD: 'yield',
    GROWTH: 'growth',
    XP: 'xp',
    DOUBLE_LOOT: 'doubleLoot',
    DOUBLE_ITEM: 'doubleItem',
    PRESERVATION: 'preservation',
    REFRESH: 'refresh',
    LUCKY: 'lucky',
    EFFICIENCY: 'efficiency',
    ABUNDANCE: 'abundance'
});

/** What a badge's numbers are in: percent of the base, chance points, or whole things (harvests). */
export const UNIT = Object.freeze({ PERCENT: 'percent', CHANCE: 'chance', COUNT: 'count' });

/** Why the amount that counts is not the sum. */
export const LIMIT = Object.freeze({
    /** Speed-ups together cut at most `MAX_SPEED_UP_CUT` of a time (`floorSpeedUp`). */
    SPEED_FLOOR: 'speedFloor',
    /** No work cycle is shorter than `MIN_WORK_CYCLE_MS`. */
    MIN_CYCLE: 'minCycle',
    /** No rest is shorter than `RESPAWN_MIN_MS`. */
    MIN_REST: 'minRest',
    /** A chance over 100 % happens every time. */
    CERTAIN: 'certain',
    /** A chance at or under 0 % never happens. */
    NEVER: 'never',
    /** Yield never takes a cycle below nothing, nor Efficiency a need. */
    NOTHING_LEFT: 'nothingLeft',
    /** A load is never under one. */
    AT_LEAST_ONE: 'atLeastOne',
    /** Rounded to whole items. */
    WHOLE: 'whole'
});

/** Where a source stands. */
export const SOURCE_KIND = Object.freeze({
    STAR: 'star',
    BUILDING: 'building',
    SELF: 'self',
    REGION: 'region',
    GEAR: 'gear',
    PERK: 'perk',
    CARRIED: 'carried',
    GUILD: 'guild'
});

/** Its work runs at its own time and pays no output rules (`BoardRunner`). */
const GUILD_HALL = 'token_guild_hall';

const EPS = 1e-9;

// --- The rows ------------------------------------------------------------------------------------

/**
 * How each named effect reads off one Token: `measure(ctx)` gives the engine's numbers, or null
 * when the effect cannot apply to it (Speed on an enemy, Growth on a Token that never grows).
 * A new chance-type effect the Token rolls on its cycle needs only a row like Refresh's (`chanceRow`).
 */
const ROWS = [
    { key: EFFECT_KEY.SPEED, typeKey: 'WORK_TIME', unit: UNIT.PERCENT, sign: -1, measure: measureSpeed },
    { key: EFFECT_KEY.YIELD, typeKey: 'YIELD', unit: UNIT.PERCENT, sign: 1, measure: measureYield },
    { key: EFFECT_KEY.GROWTH, typeKey: 'GROW_TIME', unit: UNIT.PERCENT, sign: -1, measure: measureGrowth },
    { key: EFFECT_KEY.XP, typeKey: 'XP_BONUS', unit: UNIT.PERCENT, sign: 1, measure: measureXp },
    { key: EFFECT_KEY.DOUBLE_LOOT, typeKey: 'LOOT_MULT', unit: UNIT.CHANCE, sign: 1, measure: measureDoubleLoot },
    // As `completeCycle` asks it: only for a cycle with something to pay once Efficiency has counted.
    chanceRow(EFFECT_KEY.PRESERVATION, 'PRESERVATION', (ctx) => ctx.works
        && costedInputs(ctx.id, ctx.io?.inputs, ctx.skill).length > 0),
    chanceRow(EFFECT_KEY.REFRESH, 'REFRESH', (ctx) => ctx.works
        && (ctx.instance.usesRemaining != null || Fields.isField(ctx.def))),
    { key: EFFECT_KEY.LUCKY, typeKey: 'LUCKY', unit: UNIT.PERCENT, sign: 1, measure: measureLucky },
    { key: EFFECT_KEY.ABUNDANCE, typeKey: 'CROP_LOAD', unit: UNIT.COUNT, sign: 1, measure: measureAbundance }
];

/** The item rows: Double Item on each made or dropped item, Efficiency on each need. */
const DOUBLE_ITEM = { key: EFFECT_KEY.DOUBLE_ITEM, typeKey: 'DOUBLE_DROP', unit: UNIT.CHANCE, sign: 1 };
const EFFICIENCY = { key: EFFECT_KEY.EFFICIENCY, typeKey: 'INPUT_COST', unit: UNIT.PERCENT, sign: -1 };

/** The axis a row reads, or null while the engine has none (an effect not built yet). */
const typeOf = (row) => EFFECT_TYPES[row.typeKey] || null;

/** A chance rolled once per cycle on the work skill, from a base of 0 (Double Loot's shape). */
function chanceRow(key, typeKey, applies) {
    return {
        key, typeKey, unit: UNIT.CHANCE, sign: 1,
        measure: (ctx, type) => (applies(ctx) ? chance(ctx.id, type, ctx.skill) : null)
    };
}

/** A chance as the engine rolls it: `chance > 0 && random × 100 < chance`, so it counts from 0 to 100. */
function chance(instanceId, type, category) {
    const { resolved, contributions } = TileModifiers.explainAxis(instanceId, type, 0, category);
    const final = Math.min(100, Math.max(0, resolved));
    const limit = resolved > 100 + EPS ? LIMIT.CERTAIN : resolved < -EPS ? LIMIT.NEVER : null;
    return { base: 0, resolved, final, limit, contributions };
}

function measureSpeed(ctx, type) {
    if (!ctx.works || ctx.isHall) return null;
    const base = authoredWorkMs(ctx.io, ctx.config);
    const { resolved, contributions } = TileModifiers.explainAxis(ctx.id, type, base, ctx.skill);
    const final = flooredWorkTime(base, resolved);
    let limit = null;
    if (final > resolved + EPS) limit = floorSpeedUp(base, resolved) > resolved + EPS ? LIMIT.SPEED_FLOOR : LIMIT.MIN_CYCLE;
    return { base, resolved, final, limit, contributions };
}

/** Yield on one unit of output: a percentage rule reads the same on any roll. */
function measureYield(ctx, type) {
    if (ctx.isHall || !outputItemIds(ctx).length) return null;
    const { resolved, contributions } = TileModifiers.explainAxis(ctx.id, type, 1, ctx.lootSkill);
    const final = Math.max(0, resolved);
    return { base: 1, resolved, final, limit: final > resolved + EPS ? LIMIT.NOTHING_LEFT : null, contributions };
}

/**
 * Growth on the time this Token grows by: a Field's crop, a `grows` change, or a refill's rest (the
 * engine's three readers of Grow Time). Nobody's loadout reaches it.
 */
function measureGrowth(ctx) {
    const { instance, def } = ctx;
    if (Fields.isField(def)) {
        const crop = Fields.cropOf(instance, def);
        if (!crop) return null;
        return growth(instance, cropTermsOf(crop).growMs);
    }
    const growsMs = Number(def.grows?.afterMs) || 0;
    if (def.grows?.into && growsMs > 0) return growth(instance, growsMs);
    const respawn = respawnOf(def);
    if (respawn?.mode === 'refill' && Number(respawn.afterMs) > 0) {
        const out = growth(instance, Number(respawn.afterMs));
        // The rest the engine waits (`Respawn.restMsOf`): the floored Grow Time, never under its minimum.
        const rest = Respawn.restMsOf(instance, def);
        if (rest > out.final + EPS) return { ...out, final: rest, limit: LIMIT.MIN_REST };
        return out;
    }
    return null;
}

function growth(instance, baseMs) {
    if (!(baseMs > 0)) return null;
    const { resolved, final, contributions } = TileModifiers.explainGrowTime(instance, baseMs);
    return { base: baseMs, resolved, final, limit: final > resolved + EPS ? LIMIT.SPEED_FLOOR : null, contributions };
}

/**
 * XP on a cycle's award, or an enemy's kill award in the fighting hero's style (`killXp`). The
 * whole-XP rounding is no limit: a positive bonus always adds at least one.
 */
function measureXp(ctx, type) {
    let base;
    let category;
    if (ctx.enemy) {
        base = getCombatXpAward(ctx.profile);
        category = ctx.hero ? getHeroCombatStyle(ctx.hero) : TARGET_CATEGORIES.ALL;
    } else {
        if (!ctx.works || !ctx.skill) return null;
        base = Number(ctx.io?.xp ?? ctx.config.xp) || 0;
        category = ctx.skill;
    }
    if (!(base > 0)) return null;
    const { resolved, contributions } = TileModifiers.explainAxis(ctx.id, type, base, category);
    return { base, resolved, final: applyXpBonus(base, resolved), limit: null, contributions };
}

function measureDoubleLoot(ctx, type) {
    if (ctx.isHall || !outputItemIds(ctx).length) return null;
    return chance(ctx.id, type, ctx.lootSkill);
}

/**
 * Lucky on the Token's rare table, from the table's own chance (`RareTables.luckyChance`): rolled
 * after a cycle that is not a build (`completeCycle`) or after a kill (`LootSystem`), on the skill
 * its loot reads. Null for a Token with no table.
 */
function measureLucky(ctx, type) {
    const base = rareTableChance(ctx.def);
    if (!(base > 0)) return null;
    if (!ctx.enemy && (!ctx.works || (Foundations.isFoundation(ctx.def) && Foundations.buildTargetOf(ctx.io)))) return null;
    const { resolved, contributions } = TileModifiers.explainAxis(ctx.id, type, base, ctx.lootSkill);
    const final = Math.min(100, Math.max(0, resolved));
    const limit = resolved > 100 + EPS ? LIMIT.CERTAIN : resolved < -EPS ? LIMIT.NEVER : null;
    return { base, resolved, final, limit, contributions };
}

/** A Field's harvests as its crop ripens (`Fields.loadAtRipening`). */
function measureAbundance(ctx, type) {
    const { instance, def } = ctx;
    if (!Fields.isField(def)) return null;
    const crop = Fields.cropOf(instance, def);
    if (!crop) return null;
    const base = cropTermsOf(crop).load;
    const skill = typeof def.config?.skill === 'string' && def.config.skill ? def.config.skill : TARGET_CATEGORIES.ALL;
    const { resolved, contributions } = TileModifiers.explainAxis(instance.id, type, base, skill);
    const final = Fields.loadAtRipening(instance, def, crop);
    return { base, resolved, final, limit: wholeLimit(resolved, final), contributions };
}

/** A whole-number rule's limit: under one held at one, else a rounding that moved it. */
function wholeLimit(resolved, final) {
    if (Math.round(resolved) < 1) return LIMIT.AT_LEAST_ONE;
    return Math.abs(final - resolved) > EPS ? LIMIT.WHOLE : null;
}

// --- One Token -----------------------------------------------------------------------------------

/** What the rows read off the Token, worked out once. */
function contextOf(instance) {
    const def = getTokenType(instance.typeId);
    const profile = enemyProfileOf(def);
    const heroId = BoardState.workerOf(instance.id) || null;
    const marked = Demolition.isMarked(instance);
    // `workConfigOf` and `effectiveIO` are what `BoardRunner.tick` runs the cycle with; a Token
    // marked for demolition runs none of its own work, and an enemy runs a fight instead.
    const config = profile || marked ? null : workConfigOf(def, instance);
    const works = !!config;
    return {
        instance, def, id: instance.id, profile, enemy: !!profile,
        heroId, hero: heroId ? HeroManager.getHero(heroId) : null,
        config, works, io: works ? effectiveIO(instance.id, instance) : null,
        skill: config?.skill,
        // A kill's loot reads its Token's skill or none (`LootSystem`); a cycle's, its work skill.
        lootSkill: profile ? (def.config?.skill || '') : config?.skill,
        isHall: instance.typeId === GUILD_HALL,
        near: null
    };
}

/** The items a cycle or a kill drops, in their lines' order, each once: Makes, Drops, a water's catch. */
function outputItemIds(ctx) {
    if (ctx.outputs) return ctx.outputs;
    let lines = [];
    if (ctx.isHall) lines = [];
    else if (ctx.enemy) lines = ctx.def.config?.outputs || [];
    else if (ctx.works && Fishing.isWater(ctx.def)) lines = ctx.heroId ? (Fishing.fishingOf(ctx.def, ctx.heroId)?.pool?.catches || []) : [];
    else if (ctx.works) lines = ctx.io?.outputs || [];
    ctx.outputs = [...new Set(lines.filter(l => l?.itemId && !l.currency).map(l => l.itemId))];
    return ctx.outputs;
}

/**
 * Every named effect on Token `instanceId` now, as the card's badges: see {@link TokenEffects}.
 * Null for a Token not on the mat.
 *
 * @param {string} instanceId
 * @returns {TokenEffects|null}
 */
export function effectBreakdown(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance || !getTokenType(instance.typeId)) return null;
    const ctx = contextOf(instance);

    const effects = [];
    for (const row of ROWS) {
        const type = typeOf(row);
        if (!type) continue;
        const measured = row.measure(ctx, type);
        const badge = measured && badgeOf(row, measured, ctx);
        if (badge) effects.push(badge);
    }

    const outputs = [];
    const doubleItem = typeOf(DOUBLE_ITEM);
    if (doubleItem && !ctx.isHall) {
        for (const itemId of outputItemIds(ctx)) {
            const badge = badgeOf(DOUBLE_ITEM, chance(ctx.id, doubleItem, itemId), ctx, itemId);
            if (badge) outputs.push({ itemId, effects: [badge] });
        }
    }

    const inputs = [];
    const efficiency = typeOf(EFFICIENCY);
    if (efficiency && ctx.works) {
        for (const input of ctx.io?.inputs || []) {
            if (!input?.itemId) continue;
            // The exact cost (`InputCost`), what a cycle pays on average: it is made whole by chance
            // only as the cycle pays, so no rounding here, and no minimum of one.
            const base = input.quantity || 1;
            const { resolved, contributions } = TileModifiers.explainAxis(ctx.id, efficiency, base, ctx.skill);
            const final = exactInputQuantity(ctx.id, input.quantity, ctx.skill);
            const limit = final > resolved + EPS ? LIMIT.NOTHING_LEFT : null;
            const badge = badgeOf(EFFICIENCY, { base, resolved, final, limit, contributions }, ctx, input.itemId);
            if (badge) inputs.push({ itemId: input.itemId, quantity: base, effects: [badge] });
        }
    }

    return {
        instanceId, typeId: instance.typeId, enemy: ctx.enemy, heroId: ctx.heroId,
        effects, outputs, inputs,
        hero: heroBlock(ctx, effects, outputs, inputs)
    };
}

/**
 * The Preservation badge for something a hero carries: the chance item `itemId` is not used up,
 * asked as `CycleSavings.keepsCarried` asks (the item, then its kind) at the Token the hero works
 * now, else the guild's stars alone, so it is the chance the engine rolls. A fight reads the enemy
 * Token instead, which cannot be known ahead. Null at zero, with no such hero, or for an item that
 * is never used up.
 * ⚠️ Read only: no draw, no state written.
 *
 * @returns {EffectBadge|null}
 */
export function carriedPreservation(heroId, itemId) {
    const type = EFFECT_TYPES.PRESERVATION;
    const kind = type && HeroManager.getHero(heroId) ? carriedKindOf(itemId) : null;
    if (!kind) return null;
    const at = BoardState.workTokenOf(heroId);
    const row = { key: EFFECT_KEY.PRESERVATION, unit: UNIT.CHANCE, sign: 1 };
    return badgeOf(row, chance(at, type, [itemId, kind]), { id: at, near: null }, itemId);
}

/** One badge from a row's numbers, or null at zero. */
function badgeOf(row, { base, resolved, final, limit, contributions }, ctx, itemId = null) {
    // `|| 0`: a zero is a plain 0, never -0.
    const toUnit = (delta) => (row.sign * (row.unit === UNIT.PERCENT ? (delta / base) * 100 : delta)) || 0;
    const total = toUnit(resolved - base);
    if (!(Math.abs(total) > EPS)) return null;
    return {
        key: row.key,
        name: t(`effectBadges.effect.${row.key}`),
        unit: row.unit,
        total,
        counted: limit ? toUnit(final - base) : total,
        limit: limit || null,
        held: !!limit,
        base, resolved, final,
        ...(itemId ? { itemId } : {}),
        sources: sourcesOf(contributions, base, toUnit, ctx)
    };
}

// --- Sources -------------------------------------------------------------------------------------

/** The buckets `applyThreeBucket` takes, from contributions, leaving out one source's. */
function bucketsOf(contributions, skipKey = null) {
    const buckets = { flat: [], multipliers: [], percentages: [] };
    for (const c of contributions) {
        if (c.key === skipKey) continue;
        if (c.bucket === 'flat') buckets.flat.push(c.value);
        else if (c.bucket === 'multiplier') buckets.multipliers.push(c.value);
        else buckets.percentages.push(c.value);
    }
    return buckets;
}

/** One line per source, in scope order, each with what the total would lose without it. */
function sourcesOf(contributions, base, toUnit, ctx) {
    const keyed = contributions.map(c => ({ ...c, ...describe(c, ctx) }));
    const all = applyThreeBucket(base, bucketsOf(keyed));
    const lines = new Map();
    for (const c of keyed) {
        let line = lines.get(c.key);
        if (!line) {
            const { scope, bucket, value, modifier, statement, carried, ...source } = c;
            line = { ...source, amount: 0, rules: [] };
            lines.set(c.key, line);
        }
        line.rules.push({ bucket: c.bucket, value: c.value });
    }
    for (const line of lines.values()) {
        line.amount = toUnit(all - applyThreeBucket(base, bucketsOf(keyed, line.key)));
    }
    return [...lines.values()];
}

/** Where one contribution came from, and its line's name. */
function describe(c, ctx) {
    if (c.scope === TileModifiers.AXIS_SCOPE.HERO) return heroSource(c);
    const modifier = c.modifier || {};
    if (modifier.fromTokenId) return tokenSource(modifier.fromTokenId, ctx);
    const star = hallSourceOf(modifier.source);
    if (star) {
        const rank = Math.floor(Number(GameState.state?.progress?.guildUpgrades?.[star.starId]) || 0);
        const name = authoredStars().find(s => s.id === star.starId)?.name || star.starId;
        return {
            key: `star:${star.starId}`, kind: SOURCE_KIND.STAR, starId: star.starId, rank,
            name: t('effectBadges.source.star', { star: name, rank: toRoman(rank) })
        };
    }
    const region = regionSourceOf(modifier.source);
    if (region) {
        const record = getRegion(region.regionId);
        const regionName = record?.flavourName || record?.practicalName || region.regionId;
        return {
            key: `region:${region.regionId}`, kind: SOURCE_KIND.REGION, regionId: region.regionId,
            name: t('effectBadges.source.region', { region: regionName })
        };
    }
    return { key: `guild:${modifier.source}`, kind: SOURCE_KIND.GUILD, name: t('effectBadges.source.guild') };
}

function tokenSource(tokenId, ctx) {
    const typeId = BoardState.getTokenById(tokenId)?.typeId ?? null;
    const token = typeId ? tokenName(typeId) : tokenId;
    if (tokenId === ctx.id) {
        return { key: `token:${tokenId}`, kind: SOURCE_KIND.SELF, tokenId, typeId, name: t('effectBadges.source.self', { token }) };
    }
    if (!ctx.near) ctx.near = new Set(nearby(ctx.id));
    return {
        key: `token:${tokenId}`, kind: SOURCE_KIND.BUILDING, tokenId, typeId,
        name: t(ctx.near.has(tokenId) ? 'effectBadges.source.nearby' : 'effectBadges.source.onMat', { token })
    };
}

function heroSource(c) {
    const { statement, heroId, carried } = c;
    const hero = HeroManager.getHero(heroId)?.name || heroId;
    const effectId = statement.sourceEffectId || null;
    const effect = statement.effectTitle || effectId || '';
    if (carried) {
        return { key: `carried:${heroId}:${effectId}`, kind: SOURCE_KIND.CARRIED, heroId, effectId, name: t('effectBadges.source.carried', { hero, effect }) };
    }
    if (statement.perk) {
        return { key: `perk:${heroId}:${effectId}`, kind: SOURCE_KIND.PERK, heroId, effectId, name: t('effectBadges.source.perk', { hero, perk: effect }) };
    }
    const itemIds = [...(statement.sourceItemIds || [])];
    const item = itemIds.map(id => getItem(id)?.name || id).join(', ');
    return {
        key: `gear:${heroId}:${itemIds.join(',')}`, kind: SOURCE_KIND.GEAR, heroId, itemIds, effectId,
        name: t('effectBadges.source.gear', { hero, item })
    };
}

/** The working hero's own sources across every badge: what the Hero Effects badge lists. */
function heroBlock(ctx, effects, outputs, inputs) {
    if (!ctx.heroId) return null;
    const heroKinds = new Set([SOURCE_KIND.GEAR, SOURCE_KIND.PERK, SOURCE_KIND.CARRIED]);
    const sources = [];
    const take = (badge) => {
        for (const source of badge.sources) {
            if (heroKinds.has(source.kind)) sources.push({ ...source, effect: badge.key, ...(badge.itemId ? { itemId: badge.itemId } : {}) });
        }
    };
    effects.forEach(take);
    for (const line of [...outputs, ...inputs]) line.effects.forEach(take);
    if (!sources.length) return null;
    return { heroId: ctx.heroId, name: ctx.hero?.name || ctx.heroId, sources };
}
