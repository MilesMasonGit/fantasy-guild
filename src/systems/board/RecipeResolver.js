// Fantasy Guild — Context crafting (7×7 Playmat rework, Phase 5)

import { neighboursOf } from './adjacency.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
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

/** Every context tag supplied by a tile's 8 neighbours. */
export function contextAround(index) {
    const tags = new Set();
    for (const neighbour of neighboursOf(index)) {
        const instance = BoardState.getToken(neighbour);
        if (!instance) continue;
        for (const tag of getTokenType(instance.typeId)?.provides || []) {
            tags.add(tag);
        }
    }
    return tags;
}

/**
 * Which recipe a station is currently running.
 *
 * A Token with no `recipes` is not a context-driven station at all — a Forest
 * makes Wood regardless of its neighbours — so it resolves `OK` with a null
 * recipe and its own authored outputs stand.
 *
 * @returns {{status: string, recipe: object|null, candidates?: string[]}}
 */
export function resolveRecipe(index, instance) {
    const def = getTokenType(instance?.typeId);
    const recipes = def?.recipes;

    // Not context-driven: its config's own inputs/outputs apply.
    if (!recipes?.length) return { status: RECIPE.OK, recipe: null };

    const available = contextAround(index);
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
            candidates: matched.map(r => r.id)
        };
    }

    return { status: RECIPE.OK, recipe: matched[0] };
}

/**
 * The inputs and outputs a Token is actually running with right now.
 *
 * Collapses "authored on the Token" and "decided by adjacent context" into one
 * answer, so callers never have to know which kind of Token they hold.
 */
export function effectiveIO(index, instance) {
    const def = getTokenType(instance?.typeId);
    const { status, recipe } = resolveRecipe(index, instance);

    if (status !== RECIPE.OK) return { status, inputs: [], outputs: [] };

    return {
        status,
        inputs: recipe?.inputs ?? def?.config?.inputs ?? [],
        outputs: recipe?.outputs ?? def?.config?.outputs ?? []
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
    const def = getTokenType(BoardState.getToken(contextTile)?.typeId);
    const provided = def?.provides || [];
    const isBuff = !!def?.buff;
    if (!provided.length && !isBuff) return [];

    const served = [];
    for (const neighbour of neighboursOf(contextTile)) {
        const instance = BoardState.getToken(neighbour);
        if (!instance) continue;
        const neighbourDef = getTokenType(instance.typeId);

        // "Runs" means a work cycle OR a fight. **One kill is one cycle**
        // (D-129), so a Weapon Rack beside an enemy Token must wear exactly as a
        // Tool Rack beside a Forge does. Checking only for `config` silently
        // exempted combat from the economy, because enemy Tokens carry an
        // `enemyId` instead.
        const runs = !!neighbourDef?.config || neighbourDef?.tokenType === 'enemy';
        if (!runs) continue;                      // inert things aren't served

        // A buff Token serves anything that runs beside it. A context Token
        // serves only stations whose active recipe it actually contributes to.
        if (isBuff) { served.push(neighbour); continue; }

        const { recipe } = resolveRecipe(neighbour, instance);
        if (recipe && (recipe.requiresContext || []).some(tag => provided.includes(tag))) {
            served.push(neighbour);
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
    const depleted = [];

    for (const neighbour of neighboursOf(index)) {
        const support = BoardState.getToken(neighbour);
        if (!support) continue;

        const def = getTokenType(support.typeId);
        const isSupport = !!def?.provides?.length || !!def?.buff;
        if (!isSupport) continue;

        // Unlimited-use support never wears (D-176) — `null` is not a number.
        if (support.usesRemaining == null) continue;

        // Only if it actually served THIS tile's work.
        if (!servesFrom(neighbour).includes(index)) continue;

        support.usesRemaining -= 1;
        if (support.usesRemaining <= 0) {
            depleted.push(neighbour);
            onDeplete?.(neighbour, support);
        }
    }

    return depleted;
}
