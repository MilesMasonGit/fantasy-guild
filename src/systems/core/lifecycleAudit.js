// Content audit for the Token Lifecycle blocks.

import {
    FOUNDATION_KINDS, TURN_DEFAULTS, foundationTierOf, foundationMinTierOf, foundationTierMeets
} from '../../config/registries/tokenConstants.js';
import { stationSkillOf, getProvidedTagsWithTiers } from '../effects/statements.js';

/**
 * The one checker for the six Token Lifecycle blocks (`spawner`, `grows`,
 * `turns`, `foundation`, `shop`, `trickle` (Passive Production)) and the recipe fields
 * `foundationKinds` and `foundationMinTier`, shared by the game's boot audit (`ContentAudit`) and the
 * CMS's Economy Audit (`connectivityAuditor`), so the two can never disagree.
 *
 * The rules are the "Validation" list of `docs/archive/token_lifecycle_roadmap_v1.md`
 * §3.1, one message per problem.
 *
 * ⚠️ **It only reports.** Nothing here changes how the game runs.
 *
 * ## Input
 * A pure function over `{ tokens, items, recipes, skills }`:
 * * `tokens`  — Token definitions keyed by id (or a list), **expanded**: the
 *   "can it be worked" warning recognises a station by its Station rule, which
 *   lives in the effect library. The game's registry stores Tokens expanded;
 *   the CMS expands first.
 * * `items`   — item definitions keyed by id (or a list).
 * * `recipes` — recipes keyed by id (or a list).
 * * `skills`  — skill ids, skill objects with an `id`, or a map keyed by id.
 *
 * ## Output
 * A list of `{ severity, entityType, entityId, entityName, field, message }`,
 * `severity` being `'error'` or `'warning'` (warnings are allowed content), and
 * `message` a complete sentence naming the Token or recipe by name and id.
 */

const GUILD_HALL_ID = 'token_guild_hall';
const MIN_MS = 1000;

const BLOCKS_THAT_DEFINE = ['spawner', 'turns', 'foundation'];

function asMap(collection) {
    if (!collection) return {};
    if (Array.isArray(collection)) {
        const out = {};
        for (const entry of collection) if (entry?.id) out[entry.id] = entry;
        return out;
    }
    return collection;
}

function skillIdSet(skills) {
    const ids = new Set();
    if (!skills) return ids;
    const list = Array.isArray(skills) ? skills : Object.entries(skills).map(([id, s]) => (s?.id ? s : id));
    for (const s of list) {
        if (typeof s === 'string') ids.add(s);
        else if (s?.id) ids.add(s.id);
    }
    return ids;
}

const isPositiveInteger = (v) => Number.isInteger(v) && v > 0;
const isTime = (v) => typeof v === 'number' && Number.isFinite(v) && v >= MIN_MS;
const hasValue = (v) => v !== undefined && v !== null && v !== '';
const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * A spawner's family: every type in its `spawns` list plus everything they
 * grow into, following `grows.into` until it stops. Loop-guarded.
 */
export function spawnerFamily(spawner, tokens) {
    const family = new Set();
    const spawns = Array.isArray(spawner?.spawns) ? spawner.spawns : [];
    for (const entry of spawns) {
        let id = entry?.typeId;
        while (hasValue(id) && !family.has(id)) {
            family.add(id);
            id = tokens[id]?.grows?.into;
        }
    }
    return family;
}

/**
 * Every distinct `grows` loop, each once, as the list of ids in chain order
 * starting from its alphabetically first member.
 */
function growsLoops(tokens) {
    const loops = [];
    const seen = new Set();
    for (const start of Object.keys(tokens).sort()) {
        if (seen.has(start)) continue;
        const path = [];
        const onPath = new Map();
        let id = start;
        while (hasValue(id) && tokens[id]?.grows && !seen.has(id) && !onPath.has(id)) {
            onPath.set(id, path.length);
            path.push(id);
            id = tokens[id].grows.into;
        }
        if (hasValue(id) && onPath.has(id)) {
            const cycle = path.slice(onPath.get(id));
            const first = [...cycle].sort()[0];
            const at = cycle.indexOf(first);
            loops.push([...cycle.slice(at), ...cycle.slice(0, at)]);
        }
        for (const p of path) seen.add(p);
    }
    return loops;
}

export function auditLifecycleBlocks({ tokens: tokenInput, items: itemInput, recipes: recipeInput, skills } = {}) {
    const tokens = asMap(tokenInput);
    const items = asMap(itemInput);
    const recipes = Object.values(asMap(recipeInput));
    const skillIds = skillIdSet(skills);
    const out = [];

    const tokenLabel = (id) => {
        const name = tokens[id]?.name;
        return name && name !== id ? `${name} (${id})` : id;
    };
    const recipeLabel = (recipe) => {
        const name = recipe?.name;
        return name && name !== recipe.id ? `${name} (${recipe.id})` : recipe.id;
    };

    const push = (severity, entityType, entityId, entityName, field, message) =>
        out.push({ severity, entityType, entityId, entityName, field, message });
    const tokenError = (id, field, text) =>
        push('error', 'Token', id, tokens[id]?.name || id, field, `${tokenLabel(id)}: ${text}`);
    const tokenWarning = (id, field, text) =>
        push('warning', 'Token', id, tokens[id]?.name || id, field, `${tokenLabel(id)}: ${text}`);
    const recipeError = (recipe, field, text) =>
        push('error', 'Recipe', recipe.id, recipe.name || recipe.id, field, `${recipeLabel(recipe)}: ${text}`);
    const recipeWarning = (recipe, field, text) =>
        push('warning', 'Recipe', recipe.id, recipe.name || recipe.id, field, `${recipeLabel(recipe)}: ${text}`);

    /** A Token reference. Blank counts as broken: the block has nothing to point at. */
    const checkTokenRef = (report, field, what, value) => {
        if (!hasValue(value)) {
            report(field, `${what} names no Token.`);
        } else if (!tokens[value]) {
            report(field, `${what} ${show(value)}, which does not exist.`);
        }
    };
    /** An item reference: must exist AND be a live `item_*` id. */
    const checkItemRef = (report, field, what, value) => {
        if (!hasValue(value)) {
            report(field, `${what} names no item.`);
        } else if (!items[value]) {
            report(field, `${what} ${show(value)}, which does not exist.`);
        } else if (typeof value !== 'string' || !value.startsWith('item_')) {
            report(field, `${what} ${show(value)}, a legacy item id; use its live item_* id.`);
        }
    };
    const checkPositive = (report, field, what, value) => {
        if (!isPositiveInteger(value)) report(field, `${what} is ${show(value)}; it must be a whole number of 1 or more.`);
    };
    const checkTime = (report, field, what, value) => {
        if (!isTime(value)) report(field, `${what} is ${show(value)}; it must be at least ${MIN_MS} ms.`);
    };
    const checkList = (report, field, what, list) => {
        if (!Array.isArray(list) || list.length === 0) {
            report(field, `${what} is empty; it needs at least one entry.`);
            return [];
        }
        return list;
    };

    for (const [id, def] of Object.entries(tokens)) {
        if (!def || typeof def !== 'object') continue;
        const err = (field, text) => tokenError(id, field, text);
        const warn = (field, text) => tokenWarning(id, field, text);

        // ── At most one of spawner / turns / foundation ──
        const defining = BLOCKS_THAT_DEFINE.filter((b) => def[b]);
        if (defining.length > 1) {
            err(defining.join(', '),
                `has ${defining.join(' and ')} blocks; a Token may have at most one of spawner, turns and foundation (they would fight over what the Token is).`);
        }

        // ── spawner ──
        if (def.spawner) {
            const s = def.spawner;
            const spawns = checkList(err, 'spawner.spawns', 'spawner list', s.spawns);
            spawns.forEach((entry, i) => {
                checkTokenRef(err, `spawner.spawns[${i}].typeId`, 'spawner lists', entry?.typeId);
                checkPositive(err, `spawner.spawns[${i}].weight`, `spawner weight for ${show(entry?.typeId ?? '?')}`, entry?.weight);
            });
            checkPositive(err, 'spawner.allowance', 'spawner allowance', s.allowance);
            checkTime(err, 'spawner.intervalMs', 'spawner interval', s.intervalMs);

            const upkeep = Array.isArray(s.upkeep) ? s.upkeep : [];
            upkeep.forEach((entry, i) => {
                checkItemRef(err, `spawner.upkeep[${i}].itemId`, 'spawner upkeep names', entry?.itemId);
                checkPositive(err, `spawner.upkeep[${i}].quantity`, `spawner upkeep quantity of ${show(entry?.itemId ?? '?')}`, entry?.quantity);
            });
            if (upkeep.length === 0) {
                warn('spawner.upkeep', 'spawner has no upkeep, so it spawns for free (allowed; SP-70 is decided per Token).');
            }

            if (spawnerFamily(s, tokens).has(id)) {
                err('spawner.spawns', 'spawner family contains the spawner itself (through its spawn list or what those grow into).');
            }
        }

        // ── grows ──
        if (def.grows) {
            checkTokenRef(err, 'grows.into', 'grows into', def.grows.into);
            checkTime(err, 'grows.afterMs', 'grow time', def.grows.afterMs);
        }

        // ── turns ──
        if (def.turns) {
            const t = def.turns;
            const into = checkList(err, 'turns.into', 'turns list', t.into);
            into.forEach((entry, i) => {
                const target = entry?.typeId;
                if (target === id) {
                    err(`turns.into[${i}].typeId`, 'turns into itself.');
                } else {
                    checkTokenRef(err, `turns.into[${i}].typeId`, 'turns into', target);
                    if (hasValue(target) && tokens[target]?.turns) {
                        err(`turns.into[${i}].typeId`,
                            `turns into ${tokenLabel(target)}, which has a turns block of its own; a turned Token cannot turn again.`);
                    }
                }
                checkPositive(err, `turns.into[${i}].weight`, `turns weight for ${show(target ?? '?')}`, entry?.weight);
            });
            // A roll every `everyMs` with `chance` percent, both ways.
            checkTime(err, 'turns.everyMs', 'turns every', t.everyMs);
            if (hasValue(t.chance)) {
                if (!(typeof t.chance === 'number' && Number.isFinite(t.chance) && t.chance > 0 && t.chance <= 100)) {
                    err('turns.chance', `turns chance is ${show(t.chance)}; it must be a percent above 0 and at most 100.`);
                }
            } else {
                warn('turns.chance', `turns has no chance, so it rolls the default ${TURN_DEFAULTS.chance}% (allowed; set it in the CMS).`);
            }
            if (t.lastsMs !== undefined) {
                warn('turns.lastsMs', 'turns still carries lastsMs, which nothing reads since TL-12 (the turned Token rolls back on the same cycle and chance); re-save it in the CMS to drop it.');
            }
        }

        // ── foundation ──
        const f = def.foundation;
        const kindOk = !!f && FOUNDATION_KINDS.includes(f.kind);
        const skillOk = !!f && hasValue(f.skill) && skillIds.has(f.skill);
        if (f) {
            if (!kindOk) {
                err('foundation.kind', `foundation kind is ${show(f.kind ?? 'blank')}; it must be one of ${FOUNDATION_KINDS.join(', ')}.`);
            }
            if (!skillOk) {
                err('foundation.skill', `foundation skill is ${show(f.skill ?? 'blank')}, which is not a real skill.`);
            }
            if (hasValue(f.tier) && !isPositiveInteger(f.tier)) {
                err('foundation.tier', `foundation tier is ${show(f.tier)}; it must be a whole number of 1 or more.`);
            }
        }

        // ── shop ──
        if (def.shop) {
            const price = checkList(err, 'shop.price', 'shop price', def.shop.price);
            price.forEach((entry, i) => {
                checkItemRef(err, `shop.price[${i}].itemId`, 'shop price names', entry?.itemId);
                checkPositive(err, `shop.price[${i}].quantity`, `shop price quantity of ${show(entry?.itemId ?? '?')}`, entry?.quantity);
            });

            // A sold Foundation kind needs something to build on it. Skipped
            // when the kind or skill is itself broken: that is already reported.
            if (kindOk && skillOk) {
                const ofKind = recipes.filter((r) =>
                    Array.isArray(r?.foundationKinds) && r.foundationKinds.includes(f.kind) && r.skill === f.skill);
                if (ofKind.length === 0) {
                    err('foundation.kind',
                        `is a ${f.kind} Foundation sold at the Shop, but no ${show(f.skill ?? '?')} recipe builds on ${f.kind} Foundations.`);
                } else if (!ofKind.some((r) => foundationTierMeets(def, r))) {
                    err('foundation.tier',
                        `is a tier ${foundationTierOf(def)} ${f.kind} Foundation sold at the Shop, but every ${show(f.skill)} recipe that builds on ${f.kind} Foundations needs a higher tier.`);
                }
            }

            // A Token that `turns` into a workable Token (the Coast → Shrimp
            // Coast) is worked while it is turned, so it counts.
            const worksDirectly = (d) => !!d?.config || !!stationSkillOf(d);
            const turnsWorkable = Array.isArray(def.turns?.into)
                && def.turns.into.some((entry) => worksDirectly(tokens[entry?.typeId]));
            // A context provider (the Copper Anvil: an `Acts as`
            // rule or a legacy `provides` list) is used by sitting beside a
            // station, so it counts too. Read through the same
            // helper the engine gates recipes with.
            const providesContext = Object.keys(getProvidedTagsWithTiers(def)).length > 0;
            const workable = worksDirectly(def) || !!def.foundation || !!def.spawner || turnsWorkable || providesContext;
            if (!workable) {
                warn('shop', 'is sold at the Shop but has no way to be worked or to spawn anything.');
            }
        }

        // ── trickle: Passive Production, paid on one shared timer, so a line has no interval ──
        if (def.trickle !== undefined) {
            const lines = Array.isArray(def.trickle) ? def.trickle : [];
            lines.forEach((entry, i) => {
                checkItemRef(err, `trickle[${i}].itemId`, 'Passive Production names', entry?.itemId);
                checkPositive(err, `trickle[${i}].quantity`, `Passive Production quantity of ${show(entry?.itemId ?? '?')}`, entry?.quantity);
            });
            if (lines.length > 0 && id !== GUILD_HALL_ID) {
                warn('trickle', 'has Passive Production; only the Guild Hall is meant to have it for now (allowed).');
            }
        }
    }

    // ── grows loops, once per loop ──
    for (const loop of growsLoops(tokens)) {
        const chain = [...loop, loop[0]].join(' → ');
        tokenError(loop[0], 'grows.into', `grows chain loops (${chain}).`);
    }

    // ── Recipes that build on a Foundation ──
    for (const recipe of recipes) {
        if (!recipe || !Array.isArray(recipe.foundationKinds) || recipe.foundationKinds.length === 0) continue;
        const outputs = Array.isArray(recipe.outputs) ? recipe.outputs : [];
        if (outputs.length !== 1 || !hasValue(outputs[0]?.tokenId)) {
            recipeError(recipe, 'outputs', 'builds on a Foundation, so it must output exactly one Token (a tokenId) and nothing else.');
        } else if (!tokens[outputs[0].tokenId]) {
            recipeError(recipe, 'outputs[0].tokenId', `builds ${show(outputs[0].tokenId)}, which does not exist.`);
        }
        if (hasValue(recipe.foundationMinTier) && !isPositiveInteger(recipe.foundationMinTier)) {
            recipeError(recipe, 'foundationMinTier', `minimum Foundation tier is ${show(recipe.foundationMinTier)}; it must be a whole number of 1 or more.`);
        }
        for (const kind of recipe.foundationKinds) {
            if (!FOUNDATION_KINDS.includes(kind)) {
                recipeError(recipe, 'foundationKinds', `names the Foundation kind ${show(kind)}; it must be one of ${FOUNDATION_KINDS.join(', ')}.`);
                continue;
            }
            // Only once a Foundation of the kind exists: a kind with none says nothing here, as before.
            const ofKind = Object.values(tokens).filter((t) => t?.foundation?.kind === kind);
            if (ofKind.length > 0 && !ofKind.some((t) => foundationTierMeets(t, recipe))) {
                recipeWarning(recipe, 'foundationMinTier',
                    `needs a tier ${foundationMinTierOf(recipe)} Foundation, but no ${kind} Foundation is tier ${foundationMinTierOf(recipe)} or higher yet, so nothing can build it there (allowed while it is being authored).`);
            }
            const skills = new Set(Object.values(tokens)
                // A Foundation whose own skill is not real is reported on that
                // Token; it says nothing about which skill this recipe needs.
                .filter((t) => t?.foundation?.kind === kind && skillIds.has(t.foundation.skill))
                .map((t) => t.foundation.skill));
            const mismatched = [...skills].filter((s) => s !== recipe.skill);
            if (mismatched.length > 0) {
                recipeError(recipe, 'skill',
                    `is a ${show(recipe.skill ?? 'blank')} recipe, but ${kind} Foundations are built with ${mismatched.join(', ')}.`);
            }
        }
    }

    return out;
}
