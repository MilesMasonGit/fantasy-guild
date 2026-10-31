// the progression ledger's rate calculator: cycle time, items and XP per hour for a Token or a recipe, factor by factor

import { ModifierAggregator, applyThreeBucket } from '../../effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../../effects/constants.js';
import { KEYWORD, statementsOf, stationSkillOf, stationKindOf } from '../../effects/statements.js';
import { expandBearer, effectRefsOf, statementsFromEntry, normaliseScale, MAX_SCALE } from '../../effects/effectLibrary.js';
import { reachOf, reachCovers, RELATION } from '../../../config/registries/reachRegistry.js';
import { FILTER_NEEDS, matchesFilters, filtersOf, getFilterKind, targetModeMatches } from '../../../config/registries/filterRegistry.js';
import {
    outputRange, respawnOf, growsTermsOf, RESPAWN_MIN_MS, stationKindOffers, fieldOf, cropTermsOf,
    PASSIVE_PRODUCTION_MS, foundationTierMeets, campOf
} from '../../../config/registries/tokenConstants.js';
import { neededToolOf, toolOf, toolMeets, toolItemFor } from '../../../config/registries/toolKinds.js';
import { hasCatchPools, catchPoolsOf } from '../../../config/registries/catchPools.js';
import { wishingWellWater, WISHING_WELL_ITEM } from '../../../config/guildUpgrades.js';
import { flooredWorkTime, floorSpeedUp } from '../../board/workTime.js';
import { ownCycleCost } from '../../board/cycleCharges.js';
import { applyXpBonus } from '../../hero/xpBonus.js';
import { perkRowsOf, perksEarnedAt } from '../../hero/perkTable.js';
import { neverWearsOut } from '../../core/wearRule.js';
import { isSpentCategory, isAlwaysOn, isWorkMoment, workSkillMatches, doseKindsOf, DOSE, DOSE_LENGTH } from '../../core/consumableRule.js';
import { modifiersOf as regionModifiersOf } from '../../atlas/regionModifiers.js';

/**
 * What one hero earns working one Token (or one recipe at a station) at the content's own numbers,
 * worked out the way the board works it, with every factor named and switchable: the supports in
 * reach, the tool and gear in hand, drinks and work potions, milestone perks, a Region's rules and
 * guild-wide rules.
 *
 * Average luck only: every chance is taken at its expected value (a 25 % double is ×1.25), never
 * rolled. The formulas are the board's own, shared rather than copied: the three buckets
 * (`ModifierAggregator`), the speed-up and work-time floors (`workTime.js`), the XP floor
 * (`xpBonus.js`), the output range (`tokenConstants.outputRange`), a cycle's charge cost
 * (`cycleCharges.js`), the reach and filter rules (`reachRegistry`, `filterRegistry`), the dose rules
 * (`consumableRule.js`) and a Region's rules (`regionModifiers.js`).
 *
 * ⚠️ Which ambient rules reach the worked Token is decided on the board by
 * `TileModifiers.applicableStatements` and `heroContributions`, which read live board state and are
 * not shared: {@link tileRules} and {@link heroRules} follow them step for step, and
 * `LedgerRates.test.js` pins them against the real board, rule set by rule set. Change one, change
 * the other.
 *
 * Anything the calculator cannot read is listed in `unmodelled`, never silently dropped.
 *
 * Pure: it reads only what it is handed (the CMS workspace or `data/`), so it runs in the CMS, in
 * Node and in the game alike.
 */

const HOUR_MS = 3_600_000;

/** The ambient keywords: they apply continuously, with no moment of their own (`TileModifiers.AMBIENT_KEYWORDS`). */
const AMBIENT = new Set([KEYWORD.PROVIDES, KEYWORD.GRANTS, KEYWORD.APPLIES]);

/** The axes this calculator reads on a work Token. */
const READ_AXES = new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.YIELD, EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT,
    EFFECT_TYPES.DOUBLE_DROP, EFFECT_TYPES.INPUT_COST, EFFECT_TYPES.FAIL_CHANCE, EFFECT_TYPES.GROW_TIME,
    EFFECT_TYPES.BONUS_DROP, EFFECT_TYPES.CROP_LOAD, EFFECT_TYPES.CATCH_WEIGHT
]);

/** Axes the board reads on some work this calculator does not model yet: reaching one is reported. */
const UNREAD_WORK_AXES = new Set();

/** The kinds of factor, as the switches name them. */
export const FACTOR = Object.freeze({
    SELF: 'self',
    SUPPORT: 'support',
    TOOL: 'tool',
    GEAR: 'gear',
    CONSUMABLE: 'consumable',
    PERK: 'perk',
    REGION: 'region',
    GUILD: 'guild'
});

/** How a Token's work comes back after it runs out. */
export const LIFECYCLE = Object.freeze({
    UNLIMITED: 'unlimited',
    REFILL: 'refill',
    REGROW: 'regrow',
    ONE_OFF: 'one-off'
});

/** What limits a worked rate: the hero's own pace, what the Token can offer between rests, or a clock no hero works. */
export const LIMIT = Object.freeze({ HERO: 'hero', SUPPLY: 'supply', CLOCK: 'clock' });

/** The kinds of work the calculator rates. */
export const WORK = Object.freeze({
    GATHER: 'gather',
    STATION: 'station',
    BUILD: 'build',
    WATER: 'water',
    FIELD: 'field',
    FIGHT: 'fight',
    PASSIVE: 'passive'
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const text = (v) => (typeof v === 'string' && v ? v : null);
const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

function keyed(collection) {
    const out = {};
    if (Array.isArray(collection)) {
        collection.forEach((def, i) => { if (isObject(def)) out[def.id ?? String(i)] = def; });
    } else if (isObject(collection)) {
        for (const [key, def] of Object.entries(collection)) if (isObject(def)) out[def.id ?? key] = def;
    }
    return out;
}

function recipeMap({ recipes, recipePools }) {
    const out = {};
    const add = (recipe, skill = null) => {
        if (!isObject(recipe) || !text(recipe.id)) return;
        out[recipe.id] = recipe.skill || !skill ? recipe : { ...recipe, skill };
    };
    if (Array.isArray(recipes)) recipes.forEach(r => add(r));
    else if (isObject(recipes)) Object.values(recipes).forEach(r => add(r));
    else for (const [skill, pool] of Object.entries(isObject(recipePools) ? recipePools : {})) list(pool).forEach(r => add(r, skill));
    return out;
}

/** A support named in a setup: an id, or `{ id, count, distant }`. */
function supportEntry(entry) {
    if (typeof entry === 'string') return { id: entry, count: 1, distant: false };
    if (!isObject(entry) || !text(entry.id)) return null;
    const count = Math.max(0, Math.floor(Number(entry.count ?? 1)));
    return { id: entry.id, count, distant: entry.distant === true };
}

/**
 * The calculator over one picture of the content.
 *
 * @param {object} content  `{ items, tokens, recipes | recipePools, effects, skillPerks }`, as the CMS
 *   workspace or the game's `data/` files hold them
 */
export function buildRateBook(content = {}) {
    const library = isObject(content.effects) ? content.effects : {};
    const rawTokens = keyed(content.tokens);
    const items = keyed(content.items);
    const recipes = recipeMap(content);
    const perkTables = {};
    for (const [skill, record] of Object.entries(isObject(content.skillPerks) ? content.skillPerks : {})) {
        const rows = perkRowsOf(record);
        if (rows.length) perkTables[skill] = rows;
    }

    const expanded = new Map();
    const tokenDef = (id) => {
        if (!rawTokens[id]) return null;
        if (!expanded.has(id)) expanded.set(id, expandBearer(rawTokens[id], library));
        return expanded.get(id);
    };

    const book = {
        library, items, recipes, perkTables,
        tokenIds: () => Object.keys(rawTokens),
        token: tokenDef,
        rateOf: (target, setup) => rateOf(book, target, setup),
        stationsFor: (recipeId) => stationsFor(book, recipeId),
        buildsOn: (recipeId) => buildsOn(book, recipeId),
        workTargets: () => workTargets(book),
        workKindOf: (target) => {
            const def = rawTokens[target?.token] ? tokenDef(target.token) : null;
            return def ? workKindOf(def, text(target.recipe) ? recipes[target.recipe] ?? null : null) : { why: 'no such Token' };
        },
        everyRate: (setup) => everyRate(book, setup)
    };
    return book;
}

/** The stations that offer a recipe, by id: a working station of its skill and kind (never a Foundation). */
function stationsFor(book, recipeId) {
    const recipe = book.recipes[recipeId];
    if (!recipe) return [];
    return book.tokenIds().filter(id => {
        const def = book.token(id);
        return !isObject(def.foundation) && isObject(def.config) && stationSkillOf(def) === recipe.skill
            && stationKindOffers(stationKindOf(def), recipe);
    });
}

// ── factors ─────────────────────────────────────────────────────────────────────────────────────

/** Whether a factor is switched off: by its id, or every factor of its kind. */
function isOff(setup, id, kind) {
    const off = list(setup.off);
    return off.includes(id) || off.includes(kind);
}

/**
 * The rules from Tokens that reach the worked Token, as the board's tile aggregator gathers them
 * (`TileModifiers.applicableStatements` and `rebuildToken`): its own rules (reach `self`) and the
 * supports standing within Near of it (or anywhere, for a `board` reach).
 */
function tileRules(book, targetDef, setup, hero, notes) {
    const sources = [{ id: targetDef.id, def: targetDef, relation: RELATION.SELF, count: 1, factorId: `${FACTOR.SELF}:${targetDef.id}`, kind: FACTOR.SELF }];
    for (const raw of list(setup.supports)) {
        const entry = supportEntry(raw);
        const def = entry ? book.token(entry.id) : null;
        if (!def) {
            notes.unmodelled.push({ source: entry?.id ?? String(raw), what: 'support', why: 'no such Token' });
            continue;
        }
        sources.push({ id: entry.id, def, relation: entry.distant ? RELATION.DISTANT : RELATION.NEARBY, count: entry.count, factorId: `${FACTOR.SUPPORT}:${entry.id}`, kind: FACTOR.SUPPORT });
    }

    const modifiers = [];
    const grants = [];
    const seenTypes = new Set();
    for (const source of sources) {
        if (isOff(setup, source.factorId, source.kind)) continue;
        const statements = statementsOf(source.def);
        for (let copy = 0; copy < source.count; copy++) {
            const duplicate = source.def.noStackDuplicates && seenTypes.has(source.id);
            let claimed = false;
            for (const statement of statements) {
                if (statement?.when?.event) {
                    if (copy === 0 && triggerTouches(statement, source.relation, targetDef)) {
                        notes.unmodelled.push({ source: source.id, what: statement.keyword, why: 'fires on a moment (a triggered rule)', statementId: statement.id ?? null });
                    }
                    continue;
                }
                if (!AMBIENT.has(statement?.keyword)) continue;
                if (!reachCovers(reachOf(statement), source.relation)) continue;
                if (duplicate) continue;
                if (source.def.noStackDuplicates && !claimed) {
                    seenTypes.add(source.id);
                    claimed = true;
                }
                if (statement.keyword === KEYWORD.APPLIES) {
                    if (!statement.payload?.statusId && !statement.payload?.effectId) continue;
                    if (statement.target?.role) continue;
                } else if (!statement.payload?.type) {
                    continue;
                }
                const match = targetMatch(statement.to, targetDef, hero);
                if (!match.ok) continue;
                if (copy === 0 && match.live) {
                    notes.unmodelled.push({ source: source.id, what: statement.keyword, why: 'its filter reads how many charges the Token holds; taken at full charges', statementId: statement.id ?? null });
                }
                if (copy === 0 && statement.upkeep) {
                    notes.assumptions.push({ source: source.id, what: 'upkeep', why: 'its upkeep is taken as paid', statementId: statement.id ?? null });
                }
                if (statement.keyword === KEYWORD.APPLIES) {
                    if (copy === 0) notes.unmodelled.push({ source: source.id, what: 'applies', why: 'puts a status on the hero who works here', statementId: statement.id ?? null });
                    continue;
                }
                const payload = statement.payload;
                if (copy === 0) noteAxis(notes, source.id, payload.type, targetDef, statement);
                if (statement.keyword === KEYWORD.PROVIDES) {
                    const { category, ...rest } = payload;
                    modifiers.push({
                        factorId: source.factorId,
                        umi: { ...rest, source: `${source.factorId}#${copy}:${statement.id ?? ''}`, ...(category ? { target: { category } } : {}) }
                    });
                }
                if (payload.type === EFFECT_TYPES.BONUS_DROP && text(payload.itemId)) {
                    grants.push({ factorId: source.factorId, payload });
                }
            }
        }
    }
    return { modifiers, grants };
}

/**
 * Whether a triggered rule could fire on the worked Token's work: the Token's own self-scoped rules
 * (an ambush on its cycle), and a neighbour's rules on its neighbours' moments that name it. Errs on
 * the side of reporting.
 */
function triggerTouches(statement, relation, targetDef) {
    const scope = statement.when?.scope || 'nearby';
    if (relation === RELATION.SELF) return scope !== 'nearby' || targetModeMatches(statement?.to, targetDef);
    return scope !== 'self' && targetModeMatches(statement?.to, targetDef);
}

/**
 * `TileModifiers.matchesTokenTarget` for a Token being worked by the calculator's hero: the primary
 * mode, then the stacked filters with the definition, a full-charged instance and the hero standing
 * there. `live` says a filter read state the calculator only assumes.
 */
function targetMatch(spec, targetDef, hero) {
    if (!targetModeMatches(spec, targetDef)) return { ok: false, live: false };
    const filters = filtersOf(spec);
    const live = filters.some(f => getFilterKind(f.kind)?.needs === FILTER_NEEDS.INSTANCE);
    const available = new Set([FILTER_NEEDS.DEF, FILTER_NEEDS.INSTANCE, FILTER_NEEDS.TILE]);
    const ok = matchesFilters(spec, {
        def: targetDef,
        instance: { typeId: targetDef.id, usesRemaining: neverWearsOut(targetDef) ? null : (targetDef.uses ?? null) },
        heroOnTile: 'calculator',
        heroCarries: (effectId) => hero.carries.has(effectId)
    }, available);
    return { ok, live };
}

/** A rule reaching the worked Token on an axis this calculator does not read for its kind of work. */
function noteAxis(notes, sourceId, type, targetDef, statement) {
    if (READ_AXES.has(type) || !UNREAD_WORK_AXES.has(type)) return;
    notes.unmodelled.push({ source: sourceId, what: type, why: 'an axis the calculator does not read yet', statementId: statement.id ?? null });
}

/**
 * The hero's side, as the board reads it (`HeroEffects.loadoutStatements`, `HeroEffects.perkStatements`,
 * `LiveEffects.modifierStatements` and `grantStatements`): the always-on rules of what they wear (the
 * tool and gear), their milestone perks at their levels, and what their drinks and work potions put
 * on them for each cycle of this skill.
 */
function heroRules(book, skill, setup, gates, notes) {
    const { library, items } = book;
    const statements = [];
    const live = [];
    const carries = new Set();
    const costs = [];
    const factors = [];

    // The loadout is one bearer: two items naming one effect apply it once, their scales added (capped).
    const worn = [];
    if (gates.toolItem && !isOff(setup, `${FACTOR.TOOL}:${gates.toolItem}`, FACTOR.TOOL)) worn.push({ itemId: gates.toolItem, kind: FACTOR.TOOL });
    for (const itemId of list(setup.gear)) {
        if (items[itemId] && !isOff(setup, `${FACTOR.GEAR}:${itemId}`, FACTOR.GEAR)) worn.push({ itemId, kind: FACTOR.GEAR });
    }
    const spent = [];
    for (const itemId of list(setup.consumables)) {
        if (items[itemId] && !isOff(setup, `${FACTOR.CONSUMABLE}:${itemId}`, FACTOR.CONSUMABLE)) spent.push({ itemId, kind: FACTOR.CONSUMABLE });
    }

    const merged = new Map();
    for (const { itemId, kind } of [...worn, ...spent]) {
        const def = items[itemId];
        const isWorn = !isSpentCategory(def?.equipSlot);
        for (const { effectId, scale } of effectRefsOf(def)) {
            let current = merged.get(effectId);
            if (!current) {
                current = { scale: 0, itemIds: [], worn: { scale: 0, itemIds: [] }, kinds: new Set() };
                merged.set(effectId, current);
            }
            current.scale = current.itemIds.length ? Math.min(MAX_SCALE, current.scale + scale) : normaliseScale(scale);
            current.itemIds.push(itemId);
            current.kinds.add(kind);
            if (isWorn) {
                current.worn.scale = current.worn.itemIds.length ? Math.min(MAX_SCALE, current.worn.scale + scale) : normaliseScale(scale);
                current.worn.itemIds.push(itemId);
            }
        }
    }
    for (const [effectId, { scale, itemIds, worn: w }] of merged) {
        const entry = library[effectId];
        if (!entry) continue;
        const allWorn = w.itemIds.length === itemIds.length;
        const wornOnes = !allWorn && w.itemIds.length ? statementsFromEntry(entry, { effectId, scale: w.scale }) : null;
        statementsFromEntry(entry, { effectId, scale }).forEach((statement, i) => {
            const factorId = factorOfItems(itemIds, items);
            if (!isAlwaysOn(statement) || allWorn) statements.push({ statement, factorId, itemIds });
            else if (wornOnes) statements.push({ statement: wornOnes[i], factorId: factorOfItems(w.itemIds, items), itemIds: w.itemIds });
        });
    }

    // Milestone perks, read off the hero's levels (`HeroPerks.earnedPerkRefs`): one reference per effect, scales added.
    if (setup.perks !== false) {
        const levels = { ...(isObject(setup.levels) ? setup.levels : {}), [skill]: gates.level };
        const perkRefs = new Map();
        for (const [perkSkill, rows] of Object.entries(book.perkTables)) {
            const level = Number(levels[perkSkill]) || 0;
            if (!level) continue;
            for (const row of perksEarnedAt(rows, level)) {
                const id = `${FACTOR.PERK}:${perkSkill}:${row.level}:${row.effectId}`;
                if (isOff(setup, id, FACTOR.PERK)) continue;
                const current = perkRefs.get(row.effectId);
                perkRefs.set(row.effectId, { scale: current == null ? normaliseScale(row.scale) : Math.min(MAX_SCALE, current.scale + row.scale), factorId: current?.factorId ?? id });
            }
        }
        for (const [effectId, { scale, factorId }] of perkRefs) {
            const entry = library[effectId];
            if (!entry) continue;
            for (const statement of statementsFromEntry(entry, { effectId, scale })) {
                statements.push({ statement: { ...statement, chargeDelta: 0 }, factorId, itemIds: [] });
            }
        }
    }

    // A drink or work potion's moment: on each cycle of its skill it puts its effect on the hero for that cycle.
    for (const { statement, factorId, itemIds } of statements) {
        if (statement.keyword !== KEYWORD.APPLIES || !isWorkMoment(statement.when?.event)) continue;
        if (!workSkillMatches(statement.when, skill)) continue;
        const payload = statement.payload || {};
        const entry = text(payload.effectId) ? library[payload.effectId] : null;
        if (!entry) continue;
        const chance = clamp01((Number(payload.chance ?? 100)) / 100);
        if (chance < 1) notes.assumptions.push({ source: factorId, what: 'applies', why: `applied on ${Math.round(chance * 100)} % of cycles; its rules are taken at full strength on those, averaged`, statementId: statement.id ?? null });
        if (!(payload.forCycle === true || Number(payload.durationMs) === 0)) {
            notes.unmodelled.push({ source: factorId, what: 'applies', why: 'an effect that lasts a time rather than a cycle', statementId: statement.id ?? null });
        }
        carries.add(payload.effectId);
        for (const s of statementsFromEntry(entry, { effectId: payload.effectId, scale: Number(payload.scale) || 1 })) {
            live.push({ statement: s, factorId, weight: chance });
        }
        for (const itemId of itemIds) {
            if (costs.some(c => c.itemId === itemId)) continue;
            const def = items[itemId];
            const kinds = doseKindsOf(def?.equipSlot, statementsOf(expandBearer(def, library)));
            const dose = kinds.includes(DOSE.DRINK) ? DOSE.DRINK : kinds.includes(DOSE.POTION) ? DOSE.POTION : null;
            if (dose) costs.push({ itemId, perCycle: 1 / DOSE_LENGTH[dose], dose, factorId });
        }
    }

    for (const { factorId } of [...statements, ...live]) if (!factors.includes(factorId)) factors.push(factorId);
    return { statements, live, carries, costs, factors };
}

function factorOfItems(itemIds, items) {
    const first = itemIds[0];
    const def = items[first];
    if (toolOf(def)) return `${FACTOR.TOOL}:${first}`;
    return isSpentCategory(def?.equipSlot) ? `${FACTOR.CONSUMABLE}:${first}` : `${FACTOR.GEAR}:${first}`;
}

/**
 * What the hero's rules put into one axis's buckets (`TileModifiers.heroContributions`): every
 * `Provides` of the axis, narrowed by an exact category match when it names one; a rule applied for
 * the cycle on only some cycles counts at its share.
 */
function heroBuckets(hero, effectType, category) {
    let flat = 0;
    const multipliers = [];
    const percentages = [];
    const contributing = [
        ...hero.statements.map(s => ({ ...s, weight: 1 })),
        ...hero.live
    ];
    const used = new Set();
    for (const { statement, weight, factorId } of contributing) {
        if (statement.keyword !== KEYWORD.PROVIDES) continue;
        const payload = statement.payload || {};
        if (payload.type !== effectType) continue;
        if (payload.category && payload.category !== category) continue;
        const value = Number(payload.value) * weight;
        if (!Number.isFinite(value)) continue;
        used.add(factorId);
        if (payload.bucket === 'flat') flat += value;
        else if (payload.bucket === 'multiplier') multipliers.push(value);
        else percentages.push(value);
    }
    return { flat, multipliers, percentages, used };
}

/** The hero's bonus-drop grants (`TileModifiers.loadoutPayloads` for `Grants`, and the ones lent for the cycle). */
function heroGrants(hero) {
    const out = [];
    for (const { statement, factorId } of hero.statements) {
        if (statement.keyword !== KEYWORD.GRANTS || statement.target?.role || statement.when?.event) continue;
        out.push({ factorId, payload: statement.payload || {}, weight: 1 });
    }
    for (const { statement, factorId, weight } of hero.live) {
        if (statement.keyword !== KEYWORD.GRANTS || statement.target?.role) continue;
        out.push({ factorId, payload: statement.payload || {}, weight });
    }
    return out.filter(g => g.payload.type === EFFECT_TYPES.BONUS_DROP && text(g.payload.itemId));
}

/** The guild-wide scope: a Region's rules (`regionModifiers.modifiersOf`) and guild-wide modifiers. */
function guildScope(setup, notes) {
    const agg = new ModifierAggregator('calculator:guild');
    const factorsBySource = new Map();
    if (!isOff(setup, FACTOR.REGION, FACTOR.REGION)) {
        const { modifiers, ignored } = regionModifiersOf(list(setup.region), 'calculator');
        for (const m of modifiers) { agg.addModifier(m); factorsBySource.set(m.source, FACTOR.REGION); }
        for (const skip of ignored) notes.unmodelled.push({ source: FACTOR.REGION, what: `rule ${skip.index}`, why: skip.reason });
    }
    if (!isOff(setup, FACTOR.GUILD, FACTOR.GUILD)) {
        list(setup.guild).forEach((modifier, i) => {
            if (!isObject(modifier) || !modifier.type) return;
            const source = modifier.source || `guild#${i}`;
            agg.addModifier({ ...modifier, source });
            factorsBySource.set(source, FACTOR.GUILD);
        });
    }
    return { agg, factorsBySource };
}

/** A scope whose sources are factors: an aggregator plus which factor each modifier came from. */
function tileScope(modifiers) {
    const agg = new ModifierAggregator('calculator:tile');
    const factorsBySource = new Map();
    for (const { umi, factorId } of modifiers) {
        agg.addModifier(umi);
        factorsBySource.set(umi.source, factorId);
    }
    return { agg, factorsBySource };
}

/** The factors whose modifiers an aggregator matched on one axis. */
function matchedFactors(scope, effectType, category, into) {
    for (const [source, mods] of scope.agg.modifiers) {
        for (const mod of mods) {
            if (mod.type !== effectType) continue;
            const target = mod.target?.category || TARGET_CATEGORIES.ALL;
            if (target === TARGET_CATEGORIES.ALL || target === category || scope.agg._isParentOf(target, category)) {
                into.add(scope.factorsBySource.get(source) ?? source);
            }
        }
    }
}

/**
 * One axis resolved across every scope at once, into one set of buckets (`TileModifiers.resolveAxis`):
 * the Token's tile, the guild-wide rules and the hero's own. `used` names the factors that moved it.
 */
function makeResolver(tile, guild, hero) {
    return (effectType, base, category = TARGET_CATEGORIES.ALL, { withHero = true } = {}) => {
        const h = withHero ? heroBuckets(hero, effectType, category) : { flat: 0, multipliers: [], percentages: [], used: new Set() };
        const value = applyThreeBucket(base, {
            flat: [tile.agg.getFlat(effectType, category), guild.agg.getFlat(effectType, category), h.flat],
            multipliers: [...tile.agg.collectMultipliers(effectType, category), ...guild.agg.collectMultipliers(effectType, category), ...h.multipliers],
            percentages: [...tile.agg.collectPercentages(effectType, category), ...guild.agg.collectPercentages(effectType, category), ...h.percentages]
        });
        const used = new Set(h.used);
        matchedFactors(tile, effectType, category, used);
        matchedFactors(guild, effectType, category, used);
        return { value, used };
    };
}

// ── gates ───────────────────────────────────────────────────────────────────────────────────────

/** The hero's gates on this work (`WorkCheck.heroReason`): the level, then the tool. */
function gatesOf(book, def, config, recipe, setup, pool = null) {
    const skill = text(config?.skill);
    const needed = Math.max(Number(config?.skillRequired) || 0, Number(recipe?.levelRequirement) || 0, 1);
    const asked = isObject(setup.levels) ? Number(setup.levels[skill]) : Number(setup.level);
    const level = Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : needed;
    // At water the pool fished names the tool kind; a tool's tier never gates there (`Fishing.js`).
    const need = !skill ? null : pool ? { kind: pool.tool, minTier: 1 } : neededToolOf(def);
    let toolItem = null;
    if (need) {
        if (setup.tool === null) toolItem = null;
        else if (text(setup.tool)) toolItem = setup.tool;
        else toolItem = toolItemFor(need, book.items);
    } else if (text(setup.tool)) {
        toolItem = setup.tool;
    }
    let reason = null;
    if (skill && level < needed) reason = 'level';
    else if (need && !toolMeets(toolOf(book.items[toolItem]), need)) reason = 'no_tool';
    return { skill, needed, level, need, toolItem, ok: !reason, reason };
}

// ── lifecycles ──────────────────────────────────────────────────────────────────────────────────

/** The skill a growing or resting Token's Grow Time narrows to (`TileModifiers.growSkillOf`). */
function growSkillOf(book, typeId) {
    let def = book.token(typeId);
    for (let step = 0; step < 8 && def; step++) {
        const skill = def.config?.skill;
        if (typeof skill === 'string' && skill.trim()) return skill;
        def = typeof def.grows?.into === 'string' ? book.token(def.grows.into) : null;
    }
    return TARGET_CATEGORIES.ALL;
}

/**
 * A grow or rest time with the Grow Time the supports and the guild-wide rules give a Token of this
 * type (`TileModifiers.growTimeOf`: no hero scope), floored.
 */
function growTime(book, typeId, baseMs, setup, guild, notes) {
    const def = book.token(typeId);
    if (!def) return { ms: baseMs, used: new Set() };
    const tile = tileScope(tileRules(book, def, setup, { carries: new Set() }, notes).modifiers);
    const resolve = makeResolver(tile, guild, { statements: [], live: [] });
    const { value, used } = resolve(EFFECT_TYPES.GROW_TIME, baseMs, growSkillOf(book, typeId), { withHero: false });
    return { ms: floorSpeedUp(baseMs, value), used };
}

/** Whether a support of one of these types is in the setup (a `needsNearby` gate). */
function hasNearby(setup, typeIds) {
    if (!typeIds?.length) return true;
    return list(setup.supports).map(supportEntry).some(e => e && e.count > 0 && !e.distant && typeIds.includes(e.id) && !isOff(setup, `${FACTOR.SUPPORT}:${e.id}`, FACTOR.SUPPORT));
}

/**
 * The camp the setup names (`camp: id` or `{ id, members }`), when it is a camp of the work's skill
 * and switched on: `{ id, members }`, or null.
 */
function campOfSetup(book, setup, skill) {
    const raw = setup.camp;
    const id = typeof raw === 'string' ? raw : isObject(raw) ? text(raw.id) : null;
    if (!id) return null;
    const block = campOf(book.token(id));
    if (!block || block.skill !== skill || isOff(setup, `${FACTOR.SUPPORT}:${id}`, FACTOR.SUPPORT)) return null;
    const members = Math.floor(Number(isObject(raw) ? raw.members : NaN));
    return { id, members: members >= 1 ? members : null };
}

/**
 * How many copies of the worked Token one hero works in turn. A camp of its skill hands a hero
 * every one in its reach: `camp.members` when the setup says, else the spawner family's `allowance`,
 * else one. Without a camp a named family still takes turns (`family.members`, else its allowance);
 * a setup that names a camp the work cannot use (switched off, another skill) works one.
 */
function familyMembers(book, setup, skill) {
    const family = isObject(setup.family) ? setup.family : null;
    const allowance = Math.floor(Number(book.token(family?.spawner)?.spawner?.allowance));
    if (setup.camp !== undefined && setup.camp !== null) {
        const camp = campOfSetup(book, setup, skill);
        if (!camp) return 1;
        if (camp.members) return camp.members;
        return allowance >= 1 ? allowance : 1;
    }
    if (!family) return 1;
    const asked = Math.floor(Number(family.members));
    if (asked >= 1) return asked;
    return allowance >= 1 ? allowance : 1;
}

/**
 * How the worked Token comes back after it runs out, and so how many cycles an hour it can offer one
 * hero standing by it: unlimited; refilled after a rest (a vein, a ripe Field's next crop); regrown
 * through a chain of growths back to itself (a felled tree, its stump, its sapling); or worn out for
 * good (a chest).
 */
function lifecycleOf(book, def, recipe, cycleMs, setup, guild, notes, kind, skill) {
    if (kind === WORK.FIELD) return fieldLifecycle(book, def, recipe, cycleMs, setup, guild, notes, skill);
    if (kind === WORK.FIGHT) return fightLifecycle(book, def, setup);
    if (kind === WORK.BUILD || kind === WORK.WATER) return { kind: LIFECYCLE.UNLIMITED, supplyPerHour: Infinity, used: new Set() };
    const uses = neverWearsOut(def) ? null : (def.uses ?? null);
    const cost = ownCycleCost(def, recipe);
    if (uses == null || !(cost > 0)) return { kind: LIFECYCLE.UNLIMITED, supplyPerHour: Infinity, used: new Set() };
    const cycles = Math.floor(uses / cost);
    const respawn = respawnOf(def);
    if (respawn?.mode === 'refill') {
        if (!hasNearby(setup, respawn.needsNearby)) {
            return { kind: LIFECYCLE.ONE_OFF, cycles, supplyPerHour: 0, used: new Set(), why: 'its refill needs a neighbour the setup lacks' };
        }
        const { ms, used } = growTime(book, def.id, respawn.afterMs, setup, guild, notes);
        const restMs = Math.max(RESPAWN_MIN_MS, ms);
        // Only a camp moves a hero on to the next copy while this one rests.
        const members = setup.camp !== undefined && setup.camp !== null ? familyMembers(book, setup, skill) : 1;
        return { kind: LIFECYCLE.REFILL, cycles, restMs, members, supplyPerHour: members * HOUR_MS * cycles / (cycles * cycleMs + restMs), used };
    }
    if (respawn?.mode === 'regrow') {
        const steps = [];
        const used = new Set();
        const costs = [];
        let at = respawn.into;
        let ok = false;
        for (let step = 0; step < 8 && at; step++) {
            if (at === def.id) { ok = true; break; }
            const stepDef = book.token(at);
            if (!stepDef?.grows?.into) break;
            const terms = growsTermsOf(stepDef);
            if (!hasNearby(setup, terms.needsNearby)) {
                return { kind: LIFECYCLE.ONE_OFF, cycles, supplyPerHour: 0, used, why: `${at} grows only beside ${terms.needsNearby.join(' or ')}` };
            }
            const grown = growTime(book, at, Number(stepDef.grows.afterMs) || 0, setup, guild, notes);
            grown.used.forEach(f => used.add(f));
            steps.push({ typeId: at, ms: grown.ms });
            for (const c of terms.cost) costs.push({ itemId: c.itemId, perLife: c.quantity });
            at = stepDef.grows.into;
        }
        if (!ok) return { kind: LIFECYCLE.ONE_OFF, cycles, supplyPerHour: 0, used, why: 'its regrowth never comes back to it' };
        const growMs = steps.reduce((sum, s) => sum + s.ms, 0);
        const members = familyMembers(book, setup, skill);
        return {
            kind: LIFECYCLE.REGROW, cycles, steps, growMs, members, costs,
            supplyPerHour: members * HOUR_MS * cycles / (cycles * cycleMs + growMs), used
        };
    }
    return { kind: LIFECYCLE.ONE_OFF, cycles, supplyPerHour: 0, used: new Set() };
}

/**
 * A Field (`Fields.js`): it ripens with its crop's load (Crop Load in reach added, rounded, never
 * under one), is harvested that many cycles, then sows again and grows for its grow time (Grow Time
 * in reach, floored), paying the crop's seed once a sowing.
 */
function fieldLifecycle(book, def, recipe, cycleMs, setup, guild, notes, skill) {
    const terms = cropTermsOf(recipe);
    const tile = tileScope(tileRules(book, def, setup, { carries: new Set() }, notes).modifiers);
    const resolve = makeResolver(tile, guild, { statements: [], live: [] });
    const load = resolve(EFFECT_TYPES.CROP_LOAD, terms.load, skill || TARGET_CATEGORIES.ALL, { withHero: false });
    const cycles = Math.max(1, Math.round(load.value) || 1);
    const grown = resolve(EFFECT_TYPES.GROW_TIME, terms.growMs, growSkillOf(book, def.id), { withHero: false });
    const restMs = floorSpeedUp(terms.growMs, grown.value);
    const used = new Set([...load.used, ...grown.used]);
    const members = setup.camp !== undefined && setup.camp !== null ? familyMembers(book, setup, skill) : 1;
    return {
        kind: LIFECYCLE.REFILL, cycles, restMs, members, used,
        costs: terms.seeds.map(s => ({ itemId: s.itemId, perLife: s.quantity })),
        supplyPerHour: members * HOUR_MS * cycles / (cycles * cycleMs + restMs)
    };
}

/**
 * A coarse fight: one kill a fight cycle; the enemy comes back as fast as its camp spawns it (the
 * setup's `family.spawner`), else it is there once, for its charges.
 */
function fightLifecycle(book, def, setup) {
    const spawnerId = isObject(setup.family) ? setup.family.spawner : null;
    const spawner = book.token(spawnerId)?.spawner;
    if (isObject(spawner)) {
        const spawns = list(spawner.spawns).filter(s => text(s.typeId));
        const total = spawns.reduce((sum, s) => sum + Math.max(0, Number(s.weight ?? 1) || 0), 0);
        const mine = spawns.filter(s => s.typeId === def.id).reduce((sum, s) => sum + Math.max(0, Number(s.weight ?? 1) || 0), 0);
        const every = Number(spawner.intervalMs);
        const share = total > 0 ? mine / total : 0;
        if (share > 0 && every > 0) {
            return { kind: LIFECYCLE.REFILL, cycles: 1, restMs: every / share, members: 1, supplyPerHour: HOUR_MS * share / every, used: new Set() };
        }
    }
    const uses = Number(def.uses);
    return { kind: LIFECYCLE.ONE_OFF, cycles: Number.isFinite(uses) && uses > 0 ? uses : 1, supplyPerHour: 0, used: new Set() };
}

// ── the rate ────────────────────────────────────────────────────────────────────────────────────

/** An output's expected landed quantity per roll after Yield: the board rolls the range, then widens (`OutputRules.widenYield`). */
function expectedYield(output, resolve, skill) {
    const { min, max } = outputRange(output);
    const lo = Math.floor(Number(min));
    const hi = Math.floor(Number(max));
    const used = new Set();
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return { value: 0, used };
    let sum = 0;
    for (let q = lo; q <= hi; q++) {
        const r = resolve(EFFECT_TYPES.YIELD, q, skill);
        r.used.forEach(f => used.add(f));
        // `roundUp` is exact on average: a ×1.5 is 1 plus a 50 % chance of a second.
        sum += Math.max(0, r.value);
    }
    return { value: sum / (hi - lo + 1), used };
}

/**
 * Everything one piece of work's rate is worked out from: the Token and recipe, the cycle's terms, the
 * gates, and the resolver over every scope. `refused` holds the answer instead when the work cannot be
 * rated (no such Token, a kind the calculator does not model, no cycle time).
 */
function prepare(book, target, setup) {
    const notes = { unmodelled: [], assumptions: [] };
    const refuse = (reason, unmodelled = []) => ({ refused: { ok: false, reason, target, unmodelled, assumptions: [] } });
    const def = book.token(target.token);
    if (!def) return refuse('no such Token');
    const recipe = text(target.recipe) ? book.recipes[target.recipe] ?? null : null;
    if (text(target.recipe) && !recipe) return refuse('no such recipe');

    const kind = workKindOf(def, recipe);
    if (kind.why) return refuse(kind.why, kind.unmodelled ? [{ source: def.id, what: 'work', why: kind.why }] : []);

    let config = def.config;
    let pool = null;
    // The cycle's terms as `RecipeResolver.effectiveIO` reads them: the recipe's own, else the Token's.
    // A crop's seed is paid once a sowing, never a harvest (`Fields.js`).
    const io = {
        inputs: kind.kind === WORK.FIELD ? [] : list(recipe?.inputs ?? config?.inputs),
        outputs: list(recipe?.outputs ?? config?.outputs),
        cycleTimeMs: recipe?.durationMs ?? config?.cycleTimeMs,
        xp: recipe?.xp ?? config?.xp
    };
    if (kind.kind === WORK.BUILD) {
        // A build spends its recipe's inputs and the Foundation it stands on, bought at the Shop.
        const skill = text(def.foundation.skill) || recipe.skill;
        config = { skill, skillRequired: Number(def.config?.skillRequired) || 1 };
        io.inputs = [...list(recipe.inputs), ...list(def.shop?.price).filter(p => text(p.itemId))];
        notes.assumptions.push({ source: def.id, what: 'build', why: 'built again and again: each build takes a new Foundation from the Shop; taking the last one down is not counted' });
    } else if (kind.kind === WORK.WATER) {
        pool = poolOf(book, def, target, setup);
        if (!pool) return refuse('no catch pool for that tool and bait');
        io.outputs = [];
        io.inputs = [];
    } else if (kind.kind === WORK.FIGHT) {
        config = { ...config, skill: '' };
        const firsts = io.outputs.filter(o => o?.firstKill === true && text(o.itemId));
        io.outputs = io.outputs.filter(o => o?.firstKill !== true);
        io.xp = 0;
        notes.assumptions.push({ source: def.id, what: 'fight', why: 'coarse: one kill a fight cycle of its authored time, won every time; levels and gear left out until brief 280' });
        if (firsts.length) notes.assumptions.push({ source: def.id, what: 'first kill', why: `${firsts.map(o => o.itemId).join(', ')} drop once, on the first kill: not a rate` });
        notes.unmodelled.push({ source: def.id, what: 'combat XP', why: 'what a fight teaches its hero is not rated' });
    }
    const baseCycleMs = Number(io.cycleTimeMs) || Number(config?.cycleTimeMs);
    if (!(baseCycleMs > 0)) return refuse('no cycle time', [{ source: def.id, what: 'cycleTimeMs', why: 'no cycle time authored' }]);

    const gates = gatesOf(book, def, config, recipe, setup, pool);
    const hero = heroRules(book, gates.skill, setup, gates, notes);
    const reaching = tileRules(book, def, setup, hero, notes);
    const tile = tileScope(reaching.modifiers);
    const guild = guildScope(setup, notes);
    const resolve = makeResolver(tile, guild, hero);
    return { def, recipe, kind: kind.kind, pool, io, baseCycleMs, gates, hero, tileGrants: reaching.grants, guild, resolve, notes };
}

/**
 * The catch pool a hero fishes at a water: `target.pool` (`'tool|bait'`) when named, else the
 * pool for the tool in hand (the setup's, else the water's first kind) with the setup's `bait`,
 * else that tool's basic pool, as `Fishing.fishingOf` picks it.
 */
function poolOf(book, def, target, setup) {
    const pools = catchPoolsOf(def);
    if (text(target.pool)) {
        const [tool, bait] = target.pool.split('|');
        return pools.find(p => p.tool === tool && (p.bait || '') === (bait || '')) || null;
    }
    const held = text(setup.tool) ? toolOf(book.items[setup.tool])?.kind : null;
    const kind = held || pools[0]?.tool;
    const bait = text(setup.bait);
    return pools.find(p => p.tool === kind && p.bait === bait) || pools.find(p => p.tool === kind && !p.bait) || null;
}

/** A pool as `target.pool` names it. */
export function poolKey(pool) {
    return `${pool.tool}|${pool.bait || ''}`;
}

/**
 * What kind of work a Token (with a recipe, at a station or on a Foundation) is, or why the
 * calculator does not rate it: `{ kind }` or `{ why, unmodelled }`, `unmodelled` when it is work the
 * calculator cannot read rather than no work at all.
 */
function workKindOf(def, recipe) {
    if (isObject(def.enemy)) return isObject(def.config) && Number(def.config.cycleTimeMs) > 0
        ? { kind: WORK.FIGHT } : { why: 'a fight with no fight time', unmodelled: true };
    if (isObject(def.foundation)) {
        if (!recipe) return { why: 'a Foundation: name a build recipe' };
        const kinds = list(recipe.foundationKinds);
        const skill = text(def.foundation.skill) || recipe.skill;
        if (!kinds.includes(def.foundation.kind) || recipe.skill !== skill || !foundationTierMeets(def, recipe)) {
            return { why: 'the Foundation does not take the recipe' };
        }
        return { kind: WORK.BUILD };
    }
    if (hasCatchPools(def)) return { kind: WORK.WATER };
    if (isPassive(def) && !isObject(def.config)) return { kind: WORK.PASSIVE };
    if (!isObject(def.config)) {
        return { why: isObject(def.spawner) ? 'no work cycle (a spawner)' : 'no work cycle' };
    }
    if (stationSkillOf(def)) {
        if (!recipe) return { why: 'a station: name a recipe' };
        if (!(stationSkillOf(def) === recipe.skill && stationKindOffers(stationKindOf(def), recipe))) return { why: 'the station does not offer the recipe' };
        if (fieldOf(def)) return isObject(recipe.crop) ? { kind: WORK.FIELD } : { why: 'a Field grows crops only' };
        return { kind: WORK.STATION };
    }
    return { kind: WORK.GATHER };
}

/** Whether a Token pays Passive Production: its own `trickle` lines, or the Guild Hall (the Wishing Well's Water). */
function isPassive(def) {
    return list(def?.trickle).some(l => text(l.itemId)) || def?.id === 'token_guild_hall' || def?.isGuildHall === true;
}

/**
 * Passive Production (`PassiveProduction.linesOf`): every line once a lap, no hero; the Guild Hall
 * adds the Wishing Well's Water at the setup's rank (`hallRanks.wishing_well`).
 */
function passiveRate(book, def, setup) {
    const perLap = {};
    for (const line of list(def.trickle)) {
        const q = Math.floor(Number(line?.quantity));
        if (text(line?.itemId) && q > 0) perLap[line.itemId] = (perLap[line.itemId] || 0) + q;
    }
    const factors = [{ id: `${FACTOR.SELF}:${def.id}`, kind: FACTOR.SELF, name: def.name || def.id, on: true, axes: [] }];
    if (def.id === 'token_guild_hall' || def.isGuildHall === true) {
        const rank = Math.floor(Number(setup.hallRanks?.wishing_well) || 0);
        const id = `${FACTOR.GUILD}:wishing_well`;
        const water = isOff(setup, id, FACTOR.GUILD) ? 0 : wishingWellWater(rank);
        if (water > 0) perLap[WISHING_WELL_ITEM] = (perLap[WISHING_WELL_ITEM] || 0) + water;
        if (rank > 0) factors.push({ id, kind: FACTOR.GUILD, name: `Wishing Well rank ${rank}`, on: water > 0, axes: water > 0 ? ['passive'] : [] });
    }
    const laps = HOUR_MS / PASSIVE_PRODUCTION_MS;
    return {
        ok: true, reason: null, kind: WORK.PASSIVE,
        target: { token: def.id, recipe: null }, skill: null,
        gates: { level: 0, needed: 0, tool: null, need: null },
        baseCycleMs: PASSIVE_PRODUCTION_MS, cycleMs: PASSIVE_PRODUCTION_MS, failChance: 0,
        lifecycle: { kind: LIFECYCLE.UNLIMITED, cycles: null, restMs: null, growMs: null, steps: null, members: null, why: null },
        heroCyclesPerHour: 0, supplyCyclesPerHour: laps, cyclesPerHour: laps, limitedBy: LIMIT.CLOCK,
        perCycle: perLap, items: Object.fromEntries(Object.entries(perLap).map(([k, v]) => [k, v * laps])),
        tokens: {}, inputs: {}, xpPerCycle: 0, xp: {}, factors, unmodelled: [], assumptions: []
    };
}

/**
 * One axis as the board resolves it on the worked Token (`TileModifiers.resolveAxis`), under a setup:
 * `resolve(effectType, base, category)` gives the number, before any floor. Null when the work cannot
 * be rated. For checking the calculator against the board, and for the ledger's breakdown views.
 */
export function axisResolverOf(book, target, setup = {}) {
    const prepared = prepare(book, target, setup);
    if (prepared.refused) return null;
    return (effectType, base, category = TARGET_CATEGORIES.ALL) => prepared.resolve(effectType, base, category).value;
}

/**
 * The rate of one piece of work.
 *
 * @param {object} target  `{ token }` (a vein, a tree, a bush, an enemy, Passive Production),
 *   `{ token, pool }` (water, `pool` as `poolKey` names it), `{ token, recipe }` (a recipe at a
 *   station, a crop at its Field, a build on its Foundation)
 * @param {object} [setup]  the factor switches:
 *   - `level` (or `levels: { skill: level }`): the hero's level; the work's own gate when absent
 *   - `tool`: the tool item in hand; the lowest tier that answers the need when absent, none when null
 *   - `gear`, `consumables`: item ids carried besides the tool (drinks and potions taken as in stock)
 *   - `supports`: Tokens standing within Near of the worked one, each an id or `{ id, count, distant }`
 *   - `region`: a Region's rules (statements); `guild`: guild-wide modifiers
 *   - `perks`: false to leave milestone perks out (default in)
 *   - `family`: `{ spawner, members }`, a spawner's family worked in turn; `members` defaults to the
 *     spawner's allowance (all of them in the hero's reach). For a fight, the camp that spawns it.
 *   - `camp`: a camp of the work's skill the hero works from (an id or `{ id, members }`): it works
 *     `members` copies in turn (else the family's allowance); named but unusable, one copy
 *   - `bait`: the bait carried at water; `hallRanks`: Guild Hall upgrade ranks (the Wishing Well)
 *   - `heroes`: how many heroes work it (default 1; only a family can take more than one)
 *   - `off`: factor ids or kinds switched off (`support:token_copper_mine`, `consumable`, …)
 * @returns {object} the rate, its factors and what it could not read
 */
function rateOf(book, target = {}, setup = {}) {
    const passiveDef = book.token(target.token);
    if (passiveDef && !text(target.recipe) && workKindOf(passiveDef, null).kind === WORK.PASSIVE) return passiveRate(book, passiveDef, setup);
    const prepared = prepare(book, target, setup);
    if (prepared.refused) return prepared.refused;
    const { def, recipe, kind, pool, baseCycleMs, gates, hero, tileGrants, guild, resolve, notes } = prepared;
    const io = { ...prepared.io };
    const skill = gates.skill;
    const category = skill || TARGET_CATEGORIES.ALL;
    const usedBy = new Map();
    const note = (axis, used) => {
        for (const f of used) {
            if (!usedBy.has(f)) usedBy.set(f, new Set());
            usedBy.get(f).add(axis);
        }
    };

    // Work time, floored twice (`TileModifiers.workTimeOf`). A fight takes its own time.
    const wt = kind === WORK.FIGHT ? { value: baseCycleMs, used: new Set() } : resolve(EFFECT_TYPES.WORK_TIME, baseCycleMs, category);
    note(EFFECT_TYPES.WORK_TIME, wt.used);
    const cycleMs = kind === WORK.FIGHT ? baseCycleMs : flooredWorkTime(baseCycleMs, wt.value);

    // Water lands one catch a cycle, picked by weight, each weight widened by Catch Weight with the
    // fish as the narrowing (`Fishing.catchOf`); then it lands like any output.
    if (kind === WORK.WATER) {
        const weights = pool.catches.map(c => {
            const r = resolve(EFFECT_TYPES.CATCH_WEIGHT, c.weight, c.itemId);
            note(EFFECT_TYPES.CATCH_WEIGHT, r.used);
            return Math.max(0, r.value);
        });
        const total = weights.reduce((a, b) => a + b, 0);
        io.outputs = total > 0 ? pool.catches.map((c, i) => ({ itemId: c.itemId, chance: 100 * weights[i] / total, minQty: 1, maxQty: 1 })) : [];
    }

    // A failed cycle pays its inputs and makes nothing (`BoardRunner.completeCycle`).
    const fail = resolve(EFFECT_TYPES.FAIL_CHANCE, 0, category);
    note(EFFECT_TYPES.FAIL_CHANCE, fail.used);
    const pFail = clamp01(fail.value / 100);
    const loot = resolve(EFFECT_TYPES.LOOT_MULT, 0, category);
    note(EFFECT_TYPES.LOOT_MULT, loot.used);
    const pDouble = loot.value > 0 ? clamp01(loot.value / 100) : 0;

    const perCycle = {};
    const tokensPerCycle = {};
    for (const output of io.outputs) {
        const chance = clamp01((output.chance ?? 100) / 100);
        if (text(output.tokenId)) {
            const { min, max } = outputRange(output);
            tokensPerCycle[output.tokenId] = (tokensPerCycle[output.tokenId] || 0) + (1 - pFail) * chance * (min + max) / 2;
            continue;
        }
        if (!text(output.itemId)) continue;
        const y = expectedYield(output, resolve, category);
        note(EFFECT_TYPES.YIELD, y.used);
        const dd = resolve(EFFECT_TYPES.DOUBLE_DROP, 0, output.itemId);
        note(EFFECT_TYPES.DOUBLE_DROP, dd.used);
        const pItem = dd.value > 0 ? clamp01(dd.value / 100) : 0;
        const amount = (1 - pFail) * chance * y.value * (1 + pDouble) * (1 + pItem);
        perCycle[output.itemId] = (perCycle[output.itemId] || 0) + amount;
    }
    for (const grant of [...tileGrants.map(g => ({ ...g, weight: 1 })), ...heroGrants(hero)]) {
        const chance = clamp01((grant.payload.chance ?? 100) / 100) * grant.weight;
        const quantity = Math.max(1, Number(grant.payload.quantity) || 1);
        perCycle[grant.payload.itemId] = (perCycle[grant.payload.itemId] || 0) + (1 - pFail) * chance * quantity;
        note(EFFECT_TYPES.BONUS_DROP, [grant.factorId]);
    }

    // XP: the cycle's own, widened by XP Bonus through the floor (`BoardRunner`), then the hero's own
    // multiplier in `SkillSystem.addXP`, which holds no XP Bonus (only fight axes register on a hero).
    const baseXp = Number(io.xp) || 0;
    const xb = resolve(EFFECT_TYPES.XP_BONUS, baseXp, category);
    note(EFFECT_TYPES.XP_BONUS, xb.used);
    const awarded = applyXpBonus(baseXp, xb.value);
    const granted = awarded > 0 ? Math.max(1, applyXpBonus(awarded, awarded * 1)) : 0;
    const xpPerCycle = skill ? (1 - pFail) * granted : 0;

    const inputsPerCycle = {};
    for (const input of io.inputs) {
        if (!text(input.itemId)) continue;
        const ic = resolve(EFFECT_TYPES.INPUT_COST, input.quantity || 1, category);
        note(EFFECT_TYPES.INPUT_COST, ic.used);
        inputsPerCycle[input.itemId] = (inputsPerCycle[input.itemId] || 0) + Math.max(1, Math.round(ic.value));
    }
    for (const c of hero.costs) inputsPerCycle[c.itemId] = (inputsPerCycle[c.itemId] || 0) + c.perCycle;
    // A catch with bait spends one; a failed cycle keeps it (`BoardRunner.completeCycle`).
    if (pool?.bait) inputsPerCycle[pool.bait] = (inputsPerCycle[pool.bait] || 0) + (1 - pFail);

    const life = lifecycleOf(book, def, recipe, cycleMs, setup, guild, notes, kind, skill);
    note(EFFECT_TYPES.GROW_TIME, life.used);
    note(EFFECT_TYPES.CROP_LOAD, life.kind === LIFECYCLE.REFILL && kind === WORK.FIELD ? life.used : []);
    const camp = campOfSetup(book, setup, skill);
    if (camp && life.members > 1) note('family', [`${FACTOR.SUPPORT}:${camp.id}`]);
    const heroes = Math.max(1, Math.floor(Number(setup.heroes) || 1));
    const heroPerHour = gates.ok ? heroes * HOUR_MS / cycleMs : 0;
    const supplyPerHour = gates.ok ? life.supplyPerHour : 0;
    const cyclesPerHour = Math.min(heroPerHour, supplyPerHour);
    const limitedBy = heroPerHour <= supplyPerHour ? LIMIT.HERO : LIMIT.SUPPLY;

    const perHour = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v * cyclesPerHour]));
    // A regrowth's cost (a stump's seedling) or a crop's seed is paid once a life, and a life is `cycles` cycles.
    const inputs = perHour(inputsPerCycle);
    for (const c of life.costs || []) inputs[c.itemId] = (inputs[c.itemId] || 0) + c.perLife * cyclesPerHour / life.cycles;

    return {
        ok: gates.ok,
        reason: gates.reason,
        kind,
        target: { token: def.id, recipe: recipe?.id ?? null, ...(pool ? { pool: poolKey(pool) } : {}) },
        skill,
        gates: { level: gates.level, needed: gates.needed, tool: gates.toolItem, need: gates.need },
        baseCycleMs,
        cycleMs,
        failChance: pFail,
        lifecycle: { kind: life.kind, cycles: life.cycles ?? null, restMs: life.restMs ?? null, growMs: life.growMs ?? null, steps: life.steps ?? null, members: life.members ?? null, why: life.why ?? null },
        heroCyclesPerHour: heroPerHour,
        supplyCyclesPerHour: supplyPerHour,
        cyclesPerHour,
        limitedBy,
        perCycle,
        items: perHour(perCycle),
        tokens: perHour(tokensPerCycle),
        inputs,
        xpPerCycle,
        xp: skill ? { [skill]: xpPerCycle * cyclesPerHour } : {},
        factors: factorList(book, def, setup, hero, usedBy),
        unmodelled: dedupe(notes.unmodelled),
        assumptions: dedupe(notes.assumptions)
    };
}

/** Every factor that was on the table, whether it moved anything, and which axes it moved. */
function factorList(book, def, setup, hero, usedBy) {
    const out = [];
    const push = (id, kind, name) => out.push({ id, kind, name, on: !isOff(setup, id, kind), axes: [...(usedBy.get(id) || [])] });
    push(`${FACTOR.SELF}:${def.id}`, FACTOR.SELF, def.name || def.id);
    for (const raw of list(setup.supports)) {
        const e = supportEntry(raw);
        if (e) push(`${FACTOR.SUPPORT}:${e.id}`, FACTOR.SUPPORT, `${book.token(e.id)?.name || e.id}${e.count > 1 ? ` ×${e.count}` : ''}`);
    }
    for (const id of hero.factors) {
        if (out.some(f => f.id === id)) continue;
        const [kind, itemOrSkill] = id.split(':');
        push(id, kind, book.items[itemOrSkill]?.name || id);
    }
    const campId = typeof setup.camp === 'string' ? setup.camp : isObject(setup.camp) ? text(setup.camp.id) : null;
    if (campId && !out.some(f => f.id === `${FACTOR.SUPPORT}:${campId}`)) push(`${FACTOR.SUPPORT}:${campId}`, FACTOR.SUPPORT, book.token(campId)?.name || campId);
    if (list(setup.region).length) push(FACTOR.REGION, FACTOR.REGION, 'Region rules');
    if (list(setup.guild).length) push(FACTOR.GUILD, FACTOR.GUILD, 'guild-wide rules');
    return out;
}

function dedupe(rows) {
    const seen = new Set();
    return rows.filter(r => {
        const key = `${r.source}|${r.what}|${r.why}|${r.statementId ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Every piece of work the calculator rates, as targets: each Token's own work (a vein, a tree, a
 * bush, a fight, Passive Production), each pool of each water, each recipe at each station that
 * offers it (crops at their Fields) and each build on each Foundation that takes it.
 */
function workTargets(book) {
    const out = [];
    for (const id of book.tokenIds()) {
        const def = book.token(id);
        if (isObject(def.foundation)) continue;
        if (stationSkillOf(def) && isObject(def.config)) continue;
        if (hasCatchPools(def)) {
            for (const pool of catchPoolsOf(def)) out.push({ token: id, pool: poolKey(pool) });
            continue;
        }
        out.push({ token: id });
    }
    for (const recipeId of Object.keys(book.recipes)) {
        const recipe = book.recipes[recipeId];
        if (list(recipe.foundationKinds).length) {
            for (const foundation of buildsOn(book, recipeId)) out.push({ token: foundation, recipe: recipeId });
            continue;
        }
        for (const station of stationsFor(book, recipeId)) out.push({ token: station, recipe: recipeId });
    }
    return out;
}

/** The Foundations a build recipe can stand on, by id. */
function buildsOn(book, recipeId) {
    const recipe = book.recipes[recipeId];
    if (!recipe || !list(recipe.foundationKinds).length) return [];
    return book.tokenIds().filter(id => {
        const def = book.token(id);
        return isObject(def.foundation) && workKindOf(def, recipe).kind === WORK.BUILD;
    });
}

/**
 * Every Token's rate and every recipe's at each station that offers it, under one setup: what the
 * ledger's pace views read. Work the calculator cannot read comes back with `ok: false` and why.
 */
function everyRate(book, setup = {}) {
    return workTargets(book).map(target => rateOf(book, target, setup));
}

/**
 * The rate of several pieces of work run together off one Bank: each at its own rate, and a station
 * slowed to what its inputs arrive at when the work beside it supplies them (a smelter fed by a
 * vein). Inputs no work in the setup makes are taken as in stock.
 *
 * @param {object} book  from {@link buildRateBook}
 * @param {{ target: object, setup?: object }[]} works
 * @returns {{ works: object[], made: Record<string, number>, spent: Record<string, number>,
 *   net: Record<string, number>, xp: Record<string, number> }} per hour: what every work makes, what
 *   it spends, the difference, and XP by skill
 */
export function chainRates(book, works) {
    const rated = works.map(w => ({ ...w, rate: book.rateOf(w.target, w.setup || {}) }));
    const supply = {};
    for (const w of rated) {
        if (!w.rate.ok) continue;
        if (Object.keys(w.rate.inputs || {}).length) continue;
        for (const [item, n] of Object.entries(w.rate.items)) supply[item] = (supply[item] || 0) + n;
    }
    const out = [];
    const made = {};
    const spent = {};
    const xp = {};
    for (const w of rated) {
        const r = w.rate;
        let scale = 1;
        if (r.ok && r.cyclesPerHour > 0) {
            for (const [item, need] of Object.entries(r.inputs || {})) {
                if (!(item in supply) || !(need > 0)) continue;
                scale = Math.min(scale, supply[item] / need);
            }
        }
        const cyclesPerHour = r.ok ? r.cyclesPerHour * scale : 0;
        const k = r.cyclesPerHour > 0 ? cyclesPerHour / r.cyclesPerHour : 0;
        const fedItems = Object.fromEntries(Object.entries(r.items || {}).map(([i, n]) => [i, n * k]));
        const fedXp = Object.fromEntries(Object.entries(r.xp || {}).map(([s, n]) => [s, n * k]));
        const fedInputs = Object.fromEntries(Object.entries(r.inputs || {}).map(([i, n]) => [i, n * k]));
        out.push({ target: w.target, rate: r, fed: scale < 1, cyclesPerHour, items: fedItems, xp: fedXp, inputs: fedInputs });
        for (const [i, n] of Object.entries(fedItems)) made[i] = (made[i] || 0) + n;
        for (const [i, n] of Object.entries(fedInputs)) spent[i] = (spent[i] || 0) + n;
        for (const [s, n] of Object.entries(fedXp)) xp[s] = (xp[s] || 0) + n;
    }
    const net = {};
    for (const i of new Set([...Object.keys(made), ...Object.keys(spent)])) net[i] = (made[i] || 0) - (spent[i] || 0);
    return { works: out, made, spent, net, xp };
}
