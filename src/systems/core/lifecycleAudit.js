// Content audit for the Token Lifecycle blocks.

import {
    FOUNDATION_KINDS, TURN_DEFAULTS, RESPAWN_MODES, respawnOf, foundationTierOf, foundationMinTierOf, foundationTierMeets,
    STATION_KINDS, stationKindOffers
} from '../../config/registries/tokenConstants.js';
import { stationSkillOf, stationKindOf, getProvidedTagsWithTiers } from '../effects/statements.js';
import { neverWearsReason, NEVER_WEARS_WHY } from './wearRule.js';

/**
 * The one checker for the nine Token Lifecycle blocks (`spawner`, `grows`,
 * `turns`, `foundation`, `shop`, `trickle` (Passive Production), `respawn`, `field`, `camp`) and the recipe
 * fields `foundationKinds`, `foundationMinTier` and `crop`, shared by the game's boot audit (`ContentAudit`) and the
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
 * grow into, following `grows.into` until it stops, and the Token a regrowing
 * one becomes when it runs out (`respawn.into`), as `SpawnerSystem.familyOf`
 * counts it. Loop-guarded.
 */
export function spawnerFamily(spawner, tokens) {
    const family = new Set();
    const walk = (id) => {
        if (!hasValue(id) || family.has(id)) return;
        family.add(id);
        walk(tokens[id]?.grows?.into);
        const respawn = respawnOf(tokens[id]);
        if (respawn?.mode === 'regrow') walk(respawn.into);
    };
    const spawns = Array.isArray(spawner?.spawns) ? spawner.spawns : [];
    for (const entry of spawns) walk(entry?.typeId);
    return family;
}

/** Whether following `grows.into` from `fromId` reaches `toId`. Loop-guarded. */
function growsBackInto(fromId, toId, tokens) {
    const seen = new Set();
    let id = tokens[fromId]?.grows?.into;
    while (hasValue(id) && !seen.has(id)) {
        if (id === toId) return true;
        seen.add(id);
        id = tokens[id]?.grows?.into;
    }
    return false;
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

        // ── charges on a station or a support: never spent (`wearRule.js`) ──
        const neverWears = neverWearsReason(def);
        if (neverWears && def.uses !== undefined && def.uses !== null) {
            warn('uses', `has ${show(def.uses)} Charges, which the game ignores. ${NEVER_WEARS_WHY[neverWears]} Clear them in the CMS, under Lifecycle → Charges (allowed).`);
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

            if (s.withinReach !== undefined && typeof s.withinReach !== 'boolean') {
                err('spawner.withinReach', `spawner "plants within its reach" is ${show(s.withinReach)}; it must be ticked or not.`);
            }

            if (spawnerFamily(s, tokens).has(id)) {
                err('spawner.spawns', 'spawner family contains the spawner itself (through its spawn list or what those grow into).');
            }
        }

        // ── grows ──
        if (def.grows) {
            const g = def.grows;
            checkTokenRef(err, 'grows.into', 'grows into', g.into);
            checkTime(err, 'grows.afterMs', 'grow time', g.afterMs);
            // What it needs in reach before its clock runs (a Stump, its Forest), and what it pays.
            if (g.needsNearby !== undefined) {
                if (!Array.isArray(g.needsNearby)) {
                    err('grows.needsNearby', `needs nearby is ${show(g.needsNearby)}; it must be a list of Tokens.`);
                } else {
                    g.needsNearby.forEach((typeId, i) => {
                        if (typeId === id) err(`grows.needsNearby[${i}]`, 'needs itself nearby to grow, which it always is; name the Token it needs (its Forest).');
                        else checkTokenRef(err, `grows.needsNearby[${i}]`, 'needs nearby', typeId);
                    });
                }
            }
            if (g.cost !== undefined) {
                if (!Array.isArray(g.cost)) {
                    err('grows.cost', `grow cost is ${show(g.cost)}; it must be a list of items.`);
                } else {
                    g.cost.forEach((entry, i) => {
                        checkItemRef(err, `grows.cost[${i}].itemId`, 'grow cost names', entry?.itemId);
                        checkPositive(err, `grows.cost[${i}].quantity`, `grow cost quantity of ${show(entry?.itemId ?? '?')}`, entry?.quantity);
                    });
                }
            }
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

        // ── respawn: what comes back after it runs out ──
        if (def.respawn !== undefined && def.respawn !== null) {
            const r = def.respawn;
            // The engine ignores the block on these (`Respawn.respawnOf`), so it would do nothing.
            if (def.enemy) {
                err('respawn', 'is an enemy and respawns; an enemy never respawns (its spawner replaces it), so the block does nothing.');
            } else if (def.spawner) {
                err('respawn', 'is a spawner and respawns; a spawner never respawns, so the block does nothing.');
            } else if (def.foundation) {
                err('respawn', 'is a Foundation and respawns; a Foundation never respawns, so the block does nothing.');
            } else if (!RESPAWN_MODES.includes(r?.mode)) {
                err('respawn.mode', `respawn mode is ${show(r?.mode ?? 'blank')}; it must be one of ${RESPAWN_MODES.join(', ')}.`);
            } else if (r.mode === 'refill') {
                checkTime(err, 'respawn.afterMs', 'refill time', r.afterMs);
            } else if (r.into === id) {
                err('respawn.into', 'regrows from itself; it must regrow from another Token that grows back into it.');
            } else {
                checkTokenRef(err, 'respawn.into', 'regrows from', r.into);
                if (hasValue(r.into) && tokens[r.into] && !growsBackInto(r.into, id, tokens)) {
                    err('respawn.into',
                        `regrows from ${tokenLabel(r.into)}, which never grows back into it; give that Token a Grows block that ends here.`);
                }
            }
            if (r?.needsNearby !== undefined && RESPAWN_MODES.includes(r?.mode)) {
                if (r.mode === 'regrow') {
                    warn('respawn.needsNearby', 'names Tokens it needs in reach but regrows; only a refill waits for one, so the list does nothing.');
                } else if (!Array.isArray(r.needsNearby)) {
                    err('respawn.needsNearby', `needs nearby is ${show(r.needsNearby)}; it must be a list of Tokens.`);
                } else {
                    r.needsNearby.forEach((typeId, i) => {
                        if (typeId === id) err(`respawn.needsNearby[${i}]`, 'needs itself nearby to refill, which it always is; name the Token it needs (its Orchard).');
                        else checkTokenRef(err, `respawn.needsNearby[${i}]`, 'needs nearby', typeId);
                    });
                }
            }
            if (r?.mode === 'regrow' && hasValue(r.restingSprite)) {
                warn('respawn.restingSprite', 'has a resting sprite but regrows; it becomes another Token with its own art, so the sprite is never drawn.');
            }
            if (def.uses === null || def.uses === undefined) {
                warn('respawn', 'respawns but has unlimited charges, so it never runs out and never rests (allowed).');
            }
        }

        // ── field: a station that grows its own crop (`Fields.js`) ──
        if (def.field !== undefined && def.field !== null) {
            const f = def.field;
            const skill = stationSkillOf(def);
            if (typeof f !== 'object' || Array.isArray(f)) {
                err('field', `field is ${show(f)}; it must be a block.`);
            } else if (!skill) {
                err('field', 'is a Field but works as no station; give it a Works as rule (Farming, kind Field or Herb Garden): its crops are that station’s recipes.');
            } else {
                const kind = stationKindOf(def);
                const crops = recipes.filter((r) => r?.skill === skill
                    && !(Array.isArray(r.foundationKinds) && r.foundationKinds.length > 0) && stationKindOffers(kind, r));
                if (crops.length === 0) {
                    warn('field', `is a Field but no ${show(skill)} recipe${kind ? ` made at a ${kind}` : ''} gives it a crop yet (allowed while it is being authored).`);
                }
                if (hasValue(f.startsWith) && !crops.some((r) => r.id === f.startsWith)) {
                    err('field.startsWith', `starts ripe with ${show(f.startsWith)}, which is not one of its crops; a new copy would start empty.`);
                }
                if (def.spawner) {
                    warn('field', 'is a Field and a spawner; it grows its own crop and also spawns Tokens beside it (allowed, but likely a left-over spawner block).');
                }
            }
        }

        // ── camp: hands the heroes sent to it the Tokens of its skill in its reach (`Camps.js`) ──
        if (def.camp !== undefined && def.camp !== null) {
            const c = def.camp;
            if (typeof c !== 'object' || Array.isArray(c)) {
                err('camp', `camp is ${show(c)}; it must be a block.`);
            } else {
                if (!hasValue(c.skill) || !skillIds.has(c.skill)) {
                    err('camp.skill', `camp skill is ${show(c.skill ?? 'blank')}, which is not a real skill; heroes sent to it would have nothing to work.`);
                }
                if (c.reach !== undefined && !(typeof c.reach === 'number' && Number.isFinite(c.reach) && c.reach > 0)) {
                    err('camp.reach', `camp reach is ${show(c.reach)}; it must be a number of mat units above 0.`);
                }
                if (def.spawner) {
                    warn('camp', 'is a camp and a spawner; a hero sent to it works the Tokens of its skill, never what it spawns (allowed, but likely a left-over spawner block).');
                }
                if (def.config?.skill) {
                    warn('camp', 'is a camp with a work cycle of its own; no hero works a camp itself, only the Tokens in its reach (allowed, but the cycle does nothing).');
                }
            }
        }

        // ── a boss: never hostile ──
        if (def.enemy?.boss === true && def.enemy?.hostile === true) {
            warn('enemy.hostile', 'is a boss marked hostile; a boss never attacks first, so the mark does nothing.');
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

    // ── Crops: a recipe a Field grows ──
    for (const recipe of recipes) {
        if (!recipe || recipe.crop === undefined || recipe.crop === null) continue;
        const c = recipe.crop;
        if (typeof c !== 'object' || Array.isArray(c)) {
            recipeError(recipe, 'crop', `crop is ${show(c)}; it must be a block.`);
            continue;
        }
        if (c.growMs !== undefined) checkTime((field, text) => recipeError(recipe, field, text), 'crop.growMs', 'crop grow time', c.growMs);
        if (c.load !== undefined) checkPositive((field, text) => recipeError(recipe, field, text), 'crop.load', 'crop load', c.load);
        if (!Array.isArray(recipe.inputs) || recipe.inputs.length === 0) {
            recipeWarning(recipe, 'inputs', 'is a crop with no inputs, so sowing it costs no seed (allowed).');
        }
    }

    // ── Station kinds: on a station's Works as rule and on a recipe ──
    for (const [id, def] of Object.entries(tokens)) {
        const kind = stationKindOf(def);
        if (kind && !STATION_KINDS.includes(kind)) {
            tokenError(id, 'stationKind', `works as the station kind ${show(kind)}; it must be one of ${STATION_KINDS.join(', ')}.`);
        }
    }
    for (const recipe of recipes) {
        if (!recipe || recipe.stationKinds === undefined) continue;
        if (!Array.isArray(recipe.stationKinds)) {
            recipeError(recipe, 'stationKinds', `station kinds are ${show(recipe.stationKinds)}; they must be a list.`);
            continue;
        }
        for (const kind of recipe.stationKinds) {
            if (!STATION_KINDS.includes(kind)) {
                recipeError(recipe, 'stationKinds', `names the station kind ${show(kind)}; it must be one of ${STATION_KINDS.join(', ')}.`);
            }
        }
    }

    return out;
}
