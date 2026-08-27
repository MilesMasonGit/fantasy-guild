// Fantasy Guild — Context crafting (7×7 Playmat rework, Phase 5)

import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
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
 *  - **A context Token with nothing relevant adjacent is inert** (D-19). It
 *    costs a tile and does nothing until something it can use arrives.
 *  - **A context Token serves EVERY adjacent station** (D-113). One rack
 *    between two Forges serves both — and wears twice as fast for it (D-157).
 *  - Numerical buffs (D-119/D-120) remain a light layer on top, deliberately
 *    small.
 */

/** Resolution outcomes for a station. */
export const RECIPE = {
    /** The selected recipe's context requirements are met — this is what it makes. */
    OK: 'ok',
    /** It cannot run its selection right now, or it has no pool to select from. */
    NONE: 'none'
};

/** Context tags and highest provided tiers supplied by a tile's surrounding perimeter. */
export function contextTiersAround(index) {
    const tiers = {};
    const occ = BoardState.getOccupyingToken(index);
    const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(index);
    const seenAnchors = new Set();

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (!nOcc?.instance) continue;
        if (seenAnchors.has(nOcc.anchorIndex)) continue;
        seenAnchors.add(nOcc.anchorIndex);

        const def = getTokenType(nOcc.instance.typeId);
        if (!def) continue;
        const provided = getProvidedTagsWithTiers(def);
        for (const [tag, tier] of Object.entries(provided)) {
            tiers[tag] = Math.max(tiers[tag] || 0, tier);
        }
    }
    return tiers;
}

/** Every context tag supplied by a tile's surrounding perimeter. */
export function contextAround(index) {
    const tiers = contextTiersAround(index);
    return new Set(Object.keys(tiers));
}

/**
 * Checks whether a token's acceptedTokens requirements are met by adjacent tiles.
 */
export function checkAcceptedTokens(index, def) {
    if (!def?.acceptedTokens || def.acceptedTokens.length === 0) return true;
    const tiers = contextTiersAround(index);
    const adjacentTokens = new Set();
    const occ = BoardState.getOccupyingToken(index);
    const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(index);

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (nOcc?.instance?.typeId) adjacentTokens.add(nOcc.instance.typeId);
    }

    for (const req of def.acceptedTokens) {
        if (req.tag) {
            const minTier = req.minTier || 1;
            if ((tiers[req.tag] || 0) < minTier) return false;
        } else if (req.tokenIds?.length) {
            const hasAny = req.tokenIds.some(id => adjacentTokens.has(id));
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
export function unmetContext(index, recipe) {
    const required = recipe?.requiresContext || [];
    if (!required.length) return [];
    const tiers = contextTiersAround(index);
    return required.filter(req => (tiers[req.tag] || 0) < (req.minTier || 1));
}

/**
 * Whether the station on a tile can run the recipe it is set to.
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
export function resolveRecipe(index, instance) {
    const def = getTokenType(instance?.typeId);

    // First verify Accepted Tokens on the Token definition itself (e.g. Copper Ore needing Pickaxe)
    if (!checkAcceptedTokens(index, def)) {
        return { status: RECIPE.NONE, recipe: null, reason: 'missing_tool' };
    }

    const recipes = recipesForToken(def);

    // Not a station: its config's own inputs/outputs apply.
    if (!recipes.length) return { status: RECIPE.OK, recipe: null };

    // A station always has a selection (R-5). It can only be missing here on a
    // Token whose pool is empty, which the branch above has already returned on.
    const recipe = StationRecipe.ensureSelection(instance, def);
    if (!recipe) return { status: RECIPE.NONE, recipe: null, reason: 'no_pool' };

    const missing = unmetContext(index, recipe);
    if (missing.length) {
        return { status: RECIPE.NONE, recipe, reason: 'missing_context', missingContext: missing };
    }

    return { status: RECIPE.OK, recipe };
}

/**
 * What a Token is actually running with right now — inputs, outputs, and how
 * long the cycle takes.
 *
 * Collapses "authored on the Token" and "decided by adjacent context" into one
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
export function effectiveIO(index, instance) {
    const def = getTokenType(instance?.typeId);
    const { status, recipe } = resolveRecipe(index, instance);

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
 * Every adjacent tile whose Token is a station this context Token serves.
 *
 * This is what D-126 charges wear against: a Context Token loses one use per
 * cycle **each adjacent station completes**, so one Tool Rack serving three
 * Forges wears three times as fast (D-157).
 *
 * > Sharing is a **rate trade, not free value**. One Token serving three
 * > stations delivers the same *total* benefit as one serving a single station
 * > — three times faster, and wearing out three times sooner. Clustering buys
 * > throughput now at the cost of restocking sooner.
 */
export function servesFrom(contextTile) {
    const occ = BoardState.getOccupyingToken(contextTile);
    const instance = occ?.instance;
    const def = getTokenType(instance?.typeId);
    const providedMap = getProvidedTagsWithTiers(def);
    const providedTags = Object.keys(providedMap);
    const isBuff = hasAdjacencyEffect(def);
    if (!providedTags.length && !isBuff) return [];

    const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(contextTile);
    const served = [];
    const seenAnchors = new Set();

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (!nOcc?.instance) continue;
        if (seenAnchors.has(nOcc.anchorIndex)) continue;
        seenAnchors.add(nOcc.anchorIndex);

        const neighbourDef = getTokenType(nOcc.instance.typeId);

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
            served.push(nOcc.anchorIndex);
            continue;
        }

        // A buff Token serves anything that runs beside it. A context Token
        // serves only stations whose active recipe it actually contributes to.
        if (isBuff) { served.push(nOcc.anchorIndex); continue; }

        const { recipe } = resolveRecipe(nOcc.anchorIndex, nOcc.instance);
        if (recipe && contextTagsOf(recipe).some(tag => providedTags.includes(tag))) {
            served.push(nOcc.anchorIndex);
        }
    }
    return served;
}

/**
 * Charge every Context and Buff Token adjacent to a tile that just completed a
 * cycle (D-126).
 *
 * **Wear is per cycle served**, which is what makes shared context a rate trade
 * rather than free value (D-157). Called from the cycle engine on completion —
 * and because one kill counts as one cycle (D-129), a Weapon Rack beside an
 * enemy Token burns down as it is used, exactly like a Tool Rack beside a Forge.
 *
 * ## `exclude` — the tiles this cycle has already billed (P1)
 * A recipe can name an adjacent context Token's charges as an explicit input
 * and pay them through `Charges.planCycle`. Those tiles are passed in here so
 * D-126's flat per-cycle wear does not bill them a second time for the same
 * cycle. A Token nobody's recipe named still wears exactly as it always did.
 *
 * @param {Set<number>} [exclude] anchor tiles already charged for this cycle
 * @returns {number[]} tiles whose Token depleted and was removed
 */
export function wearAdjacentSupport(index, onDeplete, exclude = null) {
    const occ = BoardState.getOccupyingToken(index);
    const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(index);
    const anchor = occ ? occ.anchorIndex : index;
    const depleted = [];
    const seenAnchors = new Set();

    for (const neighbour of neighbours) {
        const nOcc = BoardState.getOccupyingToken(neighbour);
        if (!nOcc?.instance) continue;
        if (seenAnchors.has(nOcc.anchorIndex)) continue;
        seenAnchors.add(nOcc.anchorIndex);
        if (exclude?.has(nOcc.anchorIndex)) continue;

        if (!servesFrom(nOcc.anchorIndex).includes(anchor)) continue;

        const support = nOcc.instance;
        // Unlimited-use support never wears (D-176) — `null` is not a number.
        if (support.usesRemaining == null) continue;

        support.usesRemaining -= 1;
        EventBus.publish(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, {
            tile: nOcc.anchorIndex,
            delta: -1,
            remaining: support.usesRemaining,
            typeId: support.typeId
        });
        if (support.usesRemaining <= 0) {
            depleted.push(nOcc.anchorIndex);
            onDeplete?.(nOcc.anchorIndex, support);
        }
    }

    return depleted;
}

/**
 * Returns missing requirements for a tile with strict priority:
 * 1. Tokens/Tools priority: If accepted tokens/tools are missing, or context recipes missing/conflicting.
 * 2. Items priority: Only once all token requirements are satisfied and recipe is resolved.
 *
 * @returns {{ type: 'tokens'|'items'|null, items: string[] }}
 */
export function getMissingRequirements(tileIndex, instance) {
    if (!instance?.typeId) return { type: null, items: [] };
    const def = getTokenType(instance.typeId);
    if (!def) return { type: null, items: [] };

    // 1. Check Accepted Tokens / Tools on the Token definition itself (e.g. tag 'anvil' or 'pickaxe')
    if (def.acceptedTokens?.length) {
        const tiers = contextTiersAround(tileIndex);
        const adjacentTokens = new Set();
        const occ = BoardState.getOccupyingToken(tileIndex);
        const neighbours = occ && occ.footprint.length > 1 ? neighboursOfFootprint(occ.footprint) : neighboursOf(tileIndex);

        for (const neighbour of neighbours) {
            const nOcc = BoardState.getOccupyingToken(neighbour);
            if (nOcc?.instance?.typeId) adjacentTokens.add(nOcc.instance.typeId);
        }

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
                const hasAny = req.tokenIds.some(id => adjacentTokens.has(id));
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
    const { recipe } = resolveRecipe(tileIndex, instance);
    const missingContext = unmetContext(tileIndex, recipe);
    if (missingContext.length) {
        return {
            type: 'tokens',
            items: missingContext.map(req =>
                req.tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            )
        };
    }

    // 3. Tokens are satisfied! Now check missing input Items
    const io = effectiveIO(tileIndex, instance);
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

