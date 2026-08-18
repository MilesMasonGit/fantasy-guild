// Fantasy Guild — Context crafting (7×7 Playmat rework, Phase 5)

import { neighboursOf, neighboursOfFootprint } from './adjacency.js';
import { getTokenType, hasAdjacencyEffect, getProvidedTagsWithTiers, tokenName } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as InputAllocator from './InputAllocator.js';
import * as BoardState from './BoardState.js';

/**
 * What a station makes is decided by **what is next to it** (D-18).
 *
 * ## This is adjacency's real job
 * Not amplification — **definition**. A Forge with a Helmet Schematic beside it
 * makes helmets; the same Forge with nothing beside it makes **nothing at all**.
 * That is binary and decisive, and it is what makes placement matter.
 *
 * Numerical buffs (D-119/D-120) are a light optimisation layer on top and are
 * deliberately small. If placement ever stops feeling meaningful, the lever is
 * **more recipe-defining Context Tokens, not bigger buff numbers** (risk 2).
 *
 * > This deliberately trades away the "build one monster tile" fantasy. In
 * > exchange no stacking pattern dominates, so boards do not converge on a
 * > single optimal geometry (risk 1).
 *
 * ## The three rules
 *  - **A context Token with nothing relevant adjacent is inert** (D-19). It
 *    costs a tile and does nothing until something it can drive arrives.
 *  - **A context Token serves EVERY adjacent station** (D-113). A schematic
 *    between two Forges drives both — and wears twice as fast for it (D-157).
 *  - **Conflicting context puts the station in an error state** (D-20): it
 *    produces nothing and shows a warning until the player resolves it.
 *
 * ## No menus
 * There is deliberately no recipe dropdown. To change what a station makes, the
 * player moves a Token. The board is the interface.
 */

/** Resolution outcomes for a station. */
export const RECIPE = {
    /** Exactly one context set matched — this is what it makes. */
    OK: 'ok',
    /** Nothing relevant adjacent. The station makes nothing (§3.3). */
    NONE: 'none',
    /** Two or more recipes matched. Error state until resolved (D-20). */
    CONFLICT: 'conflict'
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
 * Which recipe a station is currently running.
 *
 * A Token with no recipes is not a context-driven station at all — a Forest
 * makes Wood regardless of its neighbours — so it resolves `OK` with a null
 * recipe and its own authored outputs stand.
 *
 * ## Pooled or private (CMS-39/76/77)
 * The candidate list comes from `recipesForToken`, which returns the whole
 * skill pool for a station that opted in (`recipePool`) and the station's own
 * `recipes[]` otherwise. Everything below is identical either way — matching,
 * conflict detection and wear never need to know which kind of station this is.
 *
 * @returns {{status: string, recipe: object|null, candidates?: string[]}}
 */
export function resolveRecipe(index, instance) {
    const def = getTokenType(instance?.typeId);

    // First verify Accepted Tokens on the Token definition itself (e.g. Copper Ore needing Pickaxe)
    if (!checkAcceptedTokens(index, def)) {
        return { status: RECIPE.NONE, recipe: null, reason: 'missing_tool' };
    }

    const recipes = recipesForToken(def);

    // Not context-driven: its config's own inputs/outputs apply.
    if (!recipes.length) return { status: RECIPE.OK, recipe: null };

    const available = contextAround(index);
    // ⚠️ EVERY tag must be present, not any — this is what lets a recipe be
    // gated on a COMBINATION of context (CMS-6), e.g. a Pie Tin *and* a
    // Strawberry Cookbook together keying a Kitchen to Strawberry Pie.
    const matched = recipes.filter(r =>
        (r.requiresContext || []).every(tag => available.has(tag))
    );

    if (matched.length === 0) {
        // "A Forge with nothing beside it makes nothing at all." Not a fault —
        // an unstaffed or uncontexted station is simply not doing anything.
        return { status: RECIPE.NONE, recipe: null };
    }

    if (matched.length > 1) {
        // D-20. Deliberately an ERROR rather than a silent priority order: the
        // player put two schematics next to one Forge, and the game should say
        // so rather than quietly picking one and leaving them to wonder why the
        // other did nothing.
        return {
            status: RECIPE.CONFLICT,
            recipe: null,
            candidates: matched.map(r => r.name || r.id)
        };
    }

    return { status: RECIPE.OK, recipe: matched[0] };
}

/**
 * What a Token is actually running with right now — inputs, outputs, and how
 * long the cycle takes.
 *
 * Collapses "authored on the Token" and "decided by adjacent context" into one
 * answer, so callers never have to know which kind of Token they hold.
 *
 * ## Cycle time and XP come from the recipe when it defines them (CMS-70)
 * A pooled recipe carries its own timing, so a Feast can plausibly take longer
 * than Bread and recipe complexity can correlate with time. A private station
 * has no per-recipe timing and falls back to its flat `config.cycleTimeMs`
 * (CMS-79) — which is exactly today's shape, so no existing Token changed
 * behaviour.
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
        cycleTimeMs: recipe?.cycleTimeMs ?? def?.config?.cycleTimeMs,
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
        if (recipe && (recipe.requiresContext || []).some(tag => providedTags.includes(tag))) {
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
 * @returns {number[]} tiles whose Token depleted and was removed
 */
export function wearAdjacentSupport(index, onDeplete) {
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

        if (!servesFrom(nOcc.anchorIndex).includes(anchor)) continue;

        const support = nOcc.instance;
        // Unlimited-use support never wears (D-176) — `null` is not a number.
        if (support.usesRemaining == null) continue;

        support.usesRemaining -= 1;
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
                    const formatted = req.tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

    // 2. Check Context-Driven Recipes
    const recipes = recipesForToken(def);
    if (recipes.length > 0) {
        const available = contextAround(tileIndex);
        const matched = recipes.filter(r =>
            (r.requiresContext || []).every(tag => available.has(tag))
        );

        if (matched.length === 0) {
            // Collect required context tokens from candidate recipes
            const neededTags = new Set();
            for (const r of recipes) {
                for (const tag of r.requiresContext || []) {
                    if (!available.has(tag)) {
                        const formatted = tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        neededTags.add(formatted);
                    }
                }
            }
            return {
                type: 'tokens',
                items: Array.from(neededTags)
            };
        }

        if (matched.length > 1) {
            return {
                type: 'tokens',
                items: ['Conflicting Context']
            };
        }
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

