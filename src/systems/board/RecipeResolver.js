// Fantasy Guild — Context crafting (7×7 Playmat rework, Phase 5)

import { neighbourIds } from './nearby.js';
import { getTokenType, hasAdjacencyEffect, getProvidedTagsWithTiers, tokenName } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, contextTagsOf } from '../../config/registries/recipePoolRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as InputAllocator from './InputAllocator.js';
import * as StationRecipe from './StationRecipe.js';
import * as BoardState from './BoardState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * The player chooses what a station makes; **adjacency decides whether it can**.
 *
 * ⚠️ This file used to assert the opposite, and said so in a signed comment
 * block: adjacency *defined* the product (D-18), a station with nothing beside
 * it had no recipe at all, two matching context sets were an error state (D-20),
 * and "there is deliberately no recipe dropdown". The Recipe & Charges rework
 * reverses that deliberately (roadmap §2). **Do not restore it.** What replaced
 * it:
 *
 *  - A station carries `selectedRecipeId` and defaults to its pool's
 *    lowest-level recipe on placement (R-5). `StationRecipe.js` owns that field.
 *  - This module **validates** that selection rather than discovering one: are
 *    its context requirements met? (Items are `InputAllocator`'s answer and
 *    charges are `Charges`'; `BoardRunner` asks all three in turn.)
 *  - `RECIPE.CONFLICT` is gone. An explicit selection cannot be ambiguous, so
 *    the state was unreachable rather than merely rare.
 *  - A context Token is no longer a selector. Under R-10 it is a plain recipe
 *    input, and an unmet one is a missing input like any other.
 *
 * ## What survived unchanged
 *  - **A context Token with nothing relevant nearby is inert** (D-19). It
 *    costs a tile and does nothing until something it can use arrives.
 *  - **A context Token serves EVERY nearby station** (D-113). One rack
 *    between two Forges serves both — and wears twice as fast for it (D-157).
 *  - Numerical buffs (D-119/D-120) remain a light layer on top, deliberately
 *    small.
 *
 * ## "Beside" means Near (Free Playmat 1.3, FP-41; by instance id since 1.6b)
 * Every "nearby" question here — the context around a station, the tools it
 * accepts, which stations a context Token serves, and whom it wears for — is
 * `nearby.neighbourIds()`: Tokens whose centres are within the Near radius,
 * measured centre to centre, named by **instance id**. "Acts as" and recipe
 * context carry no reach field of their own; they are Near.
 *
 * Every function here takes the station's (or context Token's) instance id and
 * answers in instance ids. The neighbour list is cached per instance and
 * dropped on any Token add, move or removal or a Near change, because this
 * module asks it several times per station per tick.
 */

/** Resolution outcomes for a station. */
export const RECIPE = {
    /** The selected recipe's context requirements are met — this is what it makes. */
    OK: 'ok',
    /** It cannot run its selection right now, or it has no pool to select from. */
    NONE: 'none'
};

/**
 * Context tags and highest provided tiers supplied by the Tokens near a Token.
 *
 * Presence only, highest tier per tag wins — unchanged. Each Token is named
 * once, by instance id.
 */
export function contextTiersAround(instanceId) {
    const tiers = {};

    for (const id of neighbourIds(instanceId)) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;

        const def = getTokenType(instance.typeId);
        if (!def) continue;
        const provided = getProvidedTagsWithTiers(def);
        for (const [tag, tier] of Object.entries(provided)) {
            tiers[tag] = Math.max(tiers[tag] || 0, tier);
        }
    }
    return tiers;
}

/** Every context tag supplied by the Tokens near a Token. */
export function contextAround(instanceId) {
    const tiers = contextTiersAround(instanceId);
    return new Set(Object.keys(tiers));
}

/** The type ids of every Token near a Token. */
function typesNear(instanceId) {
    const types = new Set();
    for (const id of neighbourIds(instanceId)) {
        const typeId = BoardState.getTokenById(id)?.typeId;
        if (typeId) types.add(typeId);
    }
    return types;
}

/**
 * Checks whether a token's acceptedTokens requirements are met by Tokens near it.
 */
export function checkAcceptedTokens(instanceId, def) {
    if (!def?.acceptedTokens || def.acceptedTokens.length === 0) return true;
    const tiers = contextTiersAround(instanceId);
    const nearbyTokens = typesNear(instanceId);

    for (const req of def.acceptedTokens) {
        if (req.tag) {
            const minTier = req.minTier || 1;
            if ((tiers[req.tag] || 0) < minTier) return false;
        } else if (req.tokenIds?.length) {
            const hasAny = req.tokenIds.some(id => nearbyTokens.has(id));
            if (!hasAny) return false;
        }
    }
    return true;
}

/**
 * Which context tags a recipe still wants, at the tier it wants them.
 *
 * ⚠️ EVERY requirement must be met, not any — this is what lets a recipe be
 * gated on a COMBINATION of context (CMS-6), e.g. a Pie Tin *and* a Berry
 * Cookbook together being what a Kitchen needs to bake a pie.
 *
 * Tier is compared rather than mere presence, so a Tier 2 Anvil satisfies a
 * requirement for Tier 1 and a Tier 1 does not satisfy Tier 2 (concept §2.4).
 */
export function unmetContext(instanceId, recipe) {
    const required = recipe?.requiresContext || [];
    if (!required.length) return [];
    const tiers = contextTiersAround(instanceId);
    return required.filter(req => (tiers[req.tag] || 0) < (req.minTier || 1));
}

/**
 * Whether a station can run the recipe it is set to.
 *
 * **Validation, not discovery.** The recipe is whatever `selectedRecipeId` says
 * (defaulted on placement per R-5); this only answers whether the board around
 * it currently satisfies it.
 *
 * A Token with no recipes at all is not a station — a Forest makes Wood
 * regardless of its neighbours — so it resolves `OK` with a null recipe and its
 * own authored outputs stand.
 *
 * ## The pool is the station's declared skill (P2.5, R-14)
 * The candidate list comes from `recipesForToken`, which returns every recipe of
 * the skill named in the Token's `Works as` statement. A Token without that
 * statement gets an empty list, which is the "not a station" case above.
 *
 * The selected recipe is returned even when it cannot run, so callers can say
 * *what* is missing rather than only that something is.
 *
 * @returns {{status: string, recipe: object|null, reason?: string, missingContext?: object[]}}
 */
export function resolveRecipe(instanceId, instance) {
    const def = getTokenType(instance?.typeId);

    // First verify Accepted Tokens on the Token definition itself (e.g. Copper Ore needing Pickaxe)
    if (!checkAcceptedTokens(instanceId, def)) {
        return { status: RECIPE.NONE, recipe: null, reason: 'missing_tool' };
    }

    const recipes = recipesForToken(def);

    // Not a station: its config's own inputs/outputs apply.
    if (!recipes.length) return { status: RECIPE.OK, recipe: null };

    // A station always has a selection (R-5). It can only be missing here on a
    // Token whose pool is empty, which the branch above has already returned on.
    const recipe = StationRecipe.ensureSelection(instance, def);
    if (!recipe) return { status: RECIPE.NONE, recipe: null, reason: 'no_pool' };

    const missing = unmetContext(instanceId, recipe);
    if (missing.length) {
        return { status: RECIPE.NONE, recipe, reason: 'missing_context', missingContext: missing };
    }

    return { status: RECIPE.OK, recipe };
}

/**
 * What a Token is actually running with right now — inputs, outputs, and how
 * long the cycle takes.
 *
 * Collapses "authored on the Token" and "decided by nearby context" into one
 * answer, so callers never have to know which kind of Token they hold.
 *
 * ## Cycle time and XP come from the recipe when it defines them (CMS-70)
 * A recipe carries its own `durationMs`, so a Feast can plausibly take longer
 * than Bread and recipe complexity can correlate with time. A Token running no
 * recipe falls back to the flat `config.cycleTimeMs` on its own definition
 * (CMS-79). The returned key stays `cycleTimeMs` because it is the station's
 * cycle either way, and `BoardRunner` and `TileProgressBar` read it by that
 * name for both kinds of Token.
 */
export function effectiveIO(instanceId, instance) {
    const def = getTokenType(instance?.typeId);
    const { status, recipe } = resolveRecipe(instanceId, instance);

    if (status !== RECIPE.OK) return { status, inputs: [], outputs: [] };

    return {
        status,
        recipe,
        inputs: recipe?.inputs ?? def?.config?.inputs ?? [],
        outputs: recipe?.outputs ?? def?.config?.outputs ?? [],
        cycleTimeMs: recipe?.durationMs ?? def?.config?.cycleTimeMs,
        xp: recipe?.xp ?? def?.config?.xp
    };
}

/**
 * Every nearby Token (by instance id, arrival order) that is a station this
 * context Token serves.
 *
 * This is what D-126 charges wear against: a Context Token loses one use per
 * cycle **each nearby station completes**, so one Tool Rack serving three
 * Forges wears three times as fast (D-157).
 *
 * > Sharing is a **rate trade, not free value**. One Token serving three
 * > stations delivers the same *total* benefit as one serving a single station
 * > — three times faster, and wearing out three times sooner. Clustering buys
 * > throughput now at the cost of restocking sooner.
 */
export function servesFrom(contextId) {
    const instance = BoardState.getTokenById(contextId);
    const def = getTokenType(instance?.typeId);
    const providedMap = getProvidedTagsWithTiers(def);
    const providedTags = Object.keys(providedMap);
    const isBuff = hasAdjacencyEffect(def);
    if (!providedTags.length && !isBuff) return [];

    const served = [];

    for (const id of neighbourIds(contextId)) {
        const nInstance = BoardState.getTokenById(id);
        if (!nInstance) continue;

        const neighbourDef = getTokenType(nInstance.typeId);

        // "Runs" means a work cycle OR a fight. **One kill is one cycle**
        // (D-129), so a Weapon Rack beside an enemy Token must wear exactly as a
        // Tool Rack beside a Forge does. Checking only for `config` silently
        // exempted combat from the economy, because enemy Tokens carry an
        // `enemyId` instead.
        const runs = !!neighbourDef?.config || neighbourDef?.tokenType === 'enemy';
        if (!runs) continue;                      // inert things aren't served

        // If neighbour requires acceptedTokens that we provide
        const accepted = neighbourDef?.acceptedTokens || [];
        const matchesAccepted = accepted.some(req => {
            if (req.tag && providedMap[req.tag] != null) {
                return (providedMap[req.tag] >= (req.minTier || 1));
            }
            if (req.tokenIds?.includes(instance.typeId)) return true;
            return false;
        });
        if (matchesAccepted) {
            served.push(id);
            continue;
        }

        // A buff Token serves anything that runs beside it. A context Token
        // serves only stations whose active recipe it actually contributes to.
        if (isBuff) { served.push(id); continue; }

        const { recipe } = resolveRecipe(id, nInstance);
        if (recipe && contextTagsOf(recipe).some(tag => providedTags.includes(tag))) {
            served.push(id);
        }
    }
    return served;
}

/**
 * Charge every Context and Buff Token near a Token that just completed a cycle
 * (D-126).
 *
 * **Wear is per cycle served**, which is what makes shared context a rate trade
 * rather than free value (D-157). Called from the cycle engine on completion —
 * and because one kill counts as one cycle (D-129), a Weapon Rack beside an
 * enemy Token burns down as it is used, exactly like a Tool Rack beside a Forge.
 *
 * ## `exclude` — the Tokens this cycle has already billed (P1)
 * A recipe can name a nearby context Token's charges as an explicit input
 * and pay them through `Charges.planCycle`. Their ids are passed in here so
 * D-126's flat per-cycle wear does not bill them a second time for the same
 * cycle. A Token nobody's recipe named still wears exactly as it always did.
 *
 * @param {string} instanceId the Token that completed the cycle
 * @param {(supportId: string, support: object) => void} [onDeplete] removes a worn-out support Token
 * @param {Set<string>} [exclude] instance ids already charged for this cycle
 * @returns {string[]} instance ids of the support Tokens that wore out
 */
export function wearNearbySupport(instanceId, onDeplete, exclude = null) {
    const depleted = [];

    // Still −1 per station per cycle (D-113/D-157); only "beside" became Near.
    // Iterates a copy: `onDeplete` takes Tokens off the mat, which drops the cache.
    for (const supportId of [...neighbourIds(instanceId)]) {
        const support = BoardState.getTokenById(supportId);
        if (!support) continue;
        if (exclude?.has(supportId)) continue;

        if (!servesFrom(supportId).includes(instanceId)) continue;

        // Unlimited-use support never wears (D-176) — `null` is not a number.
        if (support.usesRemaining == null) continue;

        support.usesRemaining -= 1;
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            instanceId: supportId,
            delta: -1,
            remaining: support.usesRemaining,
            typeId: support.typeId
        });
        if (support.usesRemaining <= 0) {
            depleted.push(supportId);
            onDeplete?.(supportId, support);
        }
    }

    return depleted;
}

/**
 * Returns missing requirements for a Token with strict priority:
 * 1. Tokens/Tools priority: If accepted tokens/tools are missing, or context recipes missing/conflicting.
 * 2. Items priority: Only once all token requirements are satisfied and recipe is resolved.
 *
 * @returns {{ type: 'tokens'|'items'|null, items: string[] }}
 */
export function getMissingRequirements(instanceId, instance) {
    if (!instance?.typeId) return { type: null, items: [] };
    const def = getTokenType(instance.typeId);
    if (!def) return { type: null, items: [] };

    // 1. Check Accepted Tokens / Tools on the Token definition itself (e.g. tag 'anvil' or 'pickaxe')
    if (def.acceptedTokens?.length) {
        const tiers = contextTiersAround(instanceId);
        const nearbyTokens = typesNear(instanceId);

        const missingTools = [];
        for (const req of def.acceptedTokens) {
            if (req.tag) {
                const minTier = req.minTier || 1;
                if ((tiers[req.tag] || 0) < minTier) {
                    const formatted = req.tag.toLowerCase() === 'axe'
                        ? 'Woodaxe'
                        : req.tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    missingTools.push(formatted);
                }
            } else if (req.tokenIds?.length) {
                const hasAny = req.tokenIds.some(id => nearbyTokens.has(id));
                if (!hasAny) {
                    missingTools.push(tokenName(req.tokenIds[0]) || req.tokenIds[0]);
                }
            }
        }

        if (missingTools.length > 0) {
            return { type: 'tokens', items: missingTools };
        }
    }

    // 2. Check the context the SELECTED recipe asks for.
    //
    // Only that one recipe's requirements are listed. Naming every tag every
    // candidate recipe could want was the right answer while adjacency chose
    // the recipe; now the station has already chosen, and listing the rest
    // would tell the player to fetch Tokens for work they did not ask for.
    const { recipe } = resolveRecipe(instanceId, instance);
    const missingContext = unmetContext(instanceId, recipe);
    if (missingContext.length) {
        return {
            type: 'tokens',
            items: missingContext.map(req =>
                req.tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            )
        };
    }

    // 3. Tokens are satisfied! Now check missing input Items
    const io = effectiveIO(instanceId, instance);
    if (io.inputs?.length) {
        const check = InputAllocator.checkInputs(io.inputs);
        if (!check.ok) {
            const missingItems = check.missing.map(m => {
                const item = getItem(m.itemId);
                return item?.name || m.itemId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            });
            return {
                type: 'items',
                items: missingItems
            };
        }
    }

    return { type: null, items: [] };
}

