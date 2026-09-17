// Fantasy Guild — Per-tile modifier scope (7×7 Playmat rework, Phase 5)

import { ModifierAggregator, applyThreeBucket } from '../effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';
import { nearby, reachFrom, tokensAround } from './nearby.js';
import { onMatTuningChanged } from '../../config/matTuning.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsOf } from '../effects/statements.js';
import { isStatementPaid } from './BlockUpkeep.js';
import { REACH, RELATION, reachOf, reachCovers } from '../../config/registries/reachRegistry.js';
import { FILTER_NEEDS, matchesFilters } from '../../config/registries/filterRegistry.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as LiveEffects from '../effects/LiveEffects.js';

/**
 * TileModifiers — one runtime `ModifierAggregator` per tile, and the resolver
 * that reads them.
 *
 * The successor to the deleted `AreaModifiers.js`. Same discipline, new scope:
 * **runtime-only, rebuilt from board state, never serialized.** Persisting a
 * derived aggregator would freeze a stale buff into the save, and a silently
 * empty one after a reload is the classic failure — `ModifierScopes.test.js`
 * pins both.
 *
 * ## ⚠️ Why this file matters more than it looks
 * The gap analysis found that **only `SPEED` crossed scopes** in the old engine.
 * `YIELD`, `WORK_TIME` and `INPUT_COST` were card-local, which meant a Context
 * Token could never actually change a neighbour's output — the exact thing
 * D-119/D-120 describe. That was flagged as significant work.
 *
 * It turned out cheap, for a reason worth recording: **Phase 4 replaced the
 * consumers.** `BoardRunner` and `InputAllocator` compute yield, cycle time and
 * input cost themselves, so widening those axes is adding this resolver at three
 * call sites rather than retrofitting `LootSystem`, `StatProcessor` and
 * `WorkProcessor`. Rewriting the consumer first made the hard problem small.
 *
 * ## The rule that must not be got wrong
 * Every scope pushes into the **same buckets**, resolved once:
 *
 * ```
 * Final = (Base + Σflat) × (Σmultipliers) × (1 + Σpercentages)
 * ```
 *
 * Resolving each scope separately and multiplying compounds them — three +25%
 * sources give ×1.95 instead of ×1.75. That is precisely how D-120's
 * deliberately *small* adjacency effects turn into large ones, and it is what
 * `ModifierScopes.test.js` exists to prevent.
 */

/**
 * The keywords that apply **continuously**, with no firing moment of their own.
 *
 * Everything else either belongs to `TriggerSystem` (it has a `When`), is read
 * straight off the definition (`Acts as`, `Requires`), or is not an effect at
 * all (`Cannot` is a placement rule and never reaches this scope).
 */
const AMBIENT_KEYWORDS = new Set([KEYWORD.PROVIDES, KEYWORD.GRANTS, KEYWORD.APPLIES]);

/**
 * One aggregator per **Token instance id** (Free Playmat slice 1.6b) — the
 * inbound modifiers of the Token with that id. There are no tiles.
 *
 * @type {Map<string, ModifierAggregator>}
 */
const aggregators = new Map();

/** The aggregator for Token `instanceId`, created on first use. */
export function getTokenAggregator(instanceId) {
    let agg = aggregators.get(instanceId);
    if (!agg) {
        agg = new ModifierAggregator(`token:${instanceId}`);
        aggregators.set(instanceId, agg);
    }
    return agg;
}

/** Drop every Token aggregator (before a rehydrate, and in tests). */
export function clearAll() {
    aggregators.clear();
}

/** Live subscriptions, so `init` is idempotent across reloads and tests. */
let unsubscribers = [];

/**
 * ⚠️ **A hero arriving changes what the buffs on this tile are** (V4).
 *
 * A tile's aggregator is a cache, rebuilt when the **board** changes. That was
 * enough while every filter asked about definitions — a tag does not change when
 * somebody walks onto a tile. The `being worked` filter does: the same Token
 * matches or not depending on whether anybody is standing there, and hero
 * movement is the game's most frequent action.
 *
 * Without this, a rule reading *"to every nearby Token being worked"* would be
 * evaluated once, at placement, and then never again — silently wrong for the
 * whole session. Hero movement is cheap and rare enough compared to a frame that
 * rebuilding the neighbourhood on it costs nothing measurable.
 *
 * ⚠️ This is the same reasoning `heroContributions` uses to read a loadout live
 * rather than caching it: **a hero is not the board.** The difference is that a
 * loadout can be read at the moment it matters, and an aggregator cannot.
 */
export function init() {
    teardown();
    /**
     * ⚠️ **A hero LEAVING matters as much as one arriving**, and the event does
     * not always say where they left.
     *
     * `HERO_MOVED` on a recall names only where the hero is now (the Dock) —
     * the place they left is never in the payload. Rebuilding only on arrival
     * meant a `being worked` buff switched ON when a hero stepped up and never
     * switched OFF when they were recalled: it stayed live for the rest of the
     * session.
     *
     * So the departure case rebuilds around the hero's **last known point**,
     * which `lastPointOf` remembers precisely because the event cannot say.
     * Where they are now is asked of the seam (`displayPointOf`, null in the
     * Dock), not read off the payload (slice 1.6b).
     */
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, ({ heroId } = {}) => {
        const left = lastPointOf.get(heroId) || null;
        const now = BoardState.displayPointOf(heroId);
        if (now) lastPointOf.set(heroId, now);
        else lastPointOf.delete(heroId);
        rebuildAround([left, now]);
    }));

    /**
     * ⚠️ **A new Near radius changes what every tile reaches** (Free Playmat 1.2).
     *
     * Nothing on the board moves when the Mat Tuner's radius does, so no board
     * event would ever refresh the aggregators. Rebuilding all of them is one
     * pass over the Tokens, once per slider change — never per frame.
     */
    unsubscribers.push(onMatTuningChanged((key) => {
        if (key == null || key === 'nearRadius') rebuildAll();
    }));
}

/**
 * Where each hero was drawn when we last heard, as a mat point.
 *
 * Runtime-only and rebuilt from events, exactly like the aggregators — it exists
 * solely because `HERO_MOVED` reports a destination and never an origin.
 */
const lastPointOf = new Map();

/** Drop the subscriptions. */
export function teardown() {
    unsubscribers.forEach(u => u?.());
    unsubscribers = [];
    lastPointOf.clear();
}

/** The source id one Token's buff registers under. Per COPY (instance id), never per type. */
const sourceIdFor = (instanceId, typeId) => `token:${instanceId}:${typeId}`;

/**
 * Does a targeted buff apply to the Token on the tile being rebuilt? (CMS-18/23)
 *
 * ## Targeted vs untargeted
 * A buff with **no** `targetToken` is untargeted and applies to everything
 * nearby — the existing D-119/D-120 behaviour, whose effects are deliberately
 * tiny precisely *because* they touch everything nearby.
 *
 * A buff **with** one is narrow: "double all nearby Shrimp output" needs the
 * specific target beside it to matter at all, so it can afford real weight
 * without letting power come from stacking modifiers (CMS-17).
 *
 * ## Three modes, chosen per Token (CMS-18)
 * Different buffs want different precision, so this is a per-buff choice rather
 * than one fixed method:
 *
 * * `tag`       — "boost all nearby seafood"       (a Token's `tags`)
 * * `id`        — "boost specifically Shrimp Beds"   (exact `typeId`)
 * * `tokenType` — "boost all nearby resources"     (the coarse category)
 *
 * ⚠️ An unknown mode matches **nothing**. A typo in a target spec should make a
 * buff visibly inert, not silently universal — the failure that would otherwise
 * turn a narrow, large effect into a board-wide one.
 */
export function matchesTokenTarget(spec, def, ctx = null) {
    if (!modeMatches(spec, def)) return false;

    /**
     * ⚠️ The stacked filters (G-9), which need more than a definition.
     *
     * `ctx` is what the caller could supply — an instance, the id of a Token
     * standing on the mat (`tokenId`), both or neither — and `matchesFilters`
     * refuses any filter it cannot evaluate rather than guessing. A caller
     * passing nothing gets the pre-V4 behaviour exactly, which is what keeps
     * every rule authored before this unchanged.
     *
     * The filter kinds still call "where it stands" `FILTER_NEEDS.TILE`; since
     * slice 1.6b it is satisfied by a Token id on the mat, not a tile.
     */
    const available = new Set([FILTER_NEEDS.DEF]);
    if (ctx?.instance) available.add(FILTER_NEEDS.INSTANCE);
    if (ctx?.tokenId) available.add(FILTER_NEEDS.TILE);

    // The filter context keeps its `heroOnTile` field name; it is filled from
    // the worker seam (Free Playmat 1.4a), by instance id (1.6b).
    const heroOnTile = ctx?.tokenId ? BoardState.workerOf(ctx.tokenId) : null;
    return matchesFilters(spec, {
        def,
        instance: ctx?.instance,
        heroOnTile,
        // Supplied as a closure so the filter never has to reach into the hero
        // registry itself — the same reason `renderStatement` takes a `names`
        // resolver rather than importing one.
        heroCarries: (effectId) => LiveEffects.heroCarries(HeroManager.getHero(heroOnTile), effectId)
    }, available);
}

/** The single primary mode — tag, id, or everything. Unchanged since CMS-18. */
function modeMatches(spec, def) {
    if (!spec || !spec.mode) return true;   // untargeted
    if (spec.mode === 'all') return !!def;  // every nearby Token (owner Q2)
    if (!def) return false;

    switch (spec.mode) {
        case 'id':
            return def.id === spec.value;
        case 'tokenType':
            return def.tokenType === spec.value;
        case 'tag':
            return (def.tags || []).includes(spec.value);
        default:
            return false;
    }
}

/**
 * The tiles a statement's filter names, seen from the Token carrying it.
 *
 * ## Why this exists (Effects Robustness P1)
 * A filter is matched in two directions, and until now only one of them was
 * written down twice and the other not at all.
 *
 * * **Inbound** — `applicableStatements` asks "does this neighbour's rule reach
 *   *me*?" That is `matchesTokenTarget(statement.to, myDef)`, and it is how
 *   every ambient effect resolves.
 * * **Outbound** — a *triggered* rule fires on the Token that owns it and has to
 *   ask the opposite question: "which of my neighbours did I just name?"
 *
 * `StatusApplication.applyToNeighbours` had the outbound loop written inline and
 * was the only thing that honoured a filter when firing. `TriggerSystem` had no
 * such loop, so a triggered `Grants` dropped its item on the tile that fired —
 * whatever its sentence said. Extracting the loop here gives both paths one
 * answer, and gives `Converts` (ER-14) the same one for free.
 *
 * ## By instance id (Free Playmat slice 1.6b)
 * Answers with the **instance ids** of the Tokens named, in arrival order.
 *
 * `fallbackPoint` is for a bearer that has already left the mat (a rule firing
 * on its own depletion): the reach is then measured from that point, with no
 * "self" to include.
 *
 * @param {string} sourceId  the Token carrying the statement
 * @param {object} statement
 * @param {{x:number,y:number}|null} [fallbackPoint]
 * @returns {string[]} instance ids of the Tokens the filter names
 */
export function filterTargets(sourceId, statement, fallbackPoint = null) {
    // The candidate set is the reach, and only the reach — a distance query
    // measured centre to centre (Free Playmat 1.2, FP-41).
    const source = BoardState.getTokenById(sourceId);
    const candidates = source
        ? nearby(source.id, reachOf(statement))
        : reachFrom(fallbackPoint, null, reachOf(statement));

    const targets = [];
    for (const id of candidates) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;

        // ⚠️ `board` includes the Token carrying the rule, and that is right:
        // "every Token on the board" is not "every Token except me". A rule that
        // means to skip itself is `nearby`, which is the default.
        if (!matchesTokenTarget(statement?.to, getTokenType(instance.typeId),
            { instance, tokenId: id })) continue;
        targets.push(id);
    }

    return targets;
}

/**
 * Rebuild one tile's inbound modifiers from the Tokens within reach of it.
 *
 * Called whenever the neighbourhood changes. Cheap: 36 tiles at most, and only
 * the Tokens within Near of the change are rebuilt (`nearby.tokensAround`).
 *
 * ## Two rules land here
 * - **A Buff Token affects every nearby Token** — the same scarce Sawmill
 *   nudges each Forge beside it (D-113's logic applied to buffs).
 * - **Duplicates stack, uncapped** (D-23). Eight Sawmills genuinely give eight
 *   times a very small number, which is still a small number. That is safe
 *   because *effects are small* (D-120), not because tiles are scarce — tiles
 *   are abundant now (D-115), and the old justification no longer holds.
 *   Individual Tokens may still opt out with `noStackDuplicates` (D-82).
 */

/**
 * Generator yielding every **statement** reaching this tile.
 *
 * Handles:
 *  - many statements per Token — each is considered independently
 *  - CMS-18/23: targeted statements matching tag, id, or `all`
 *  - D-82: duplicate protection (`noStackDuplicates: true`)
 *  - CMS-60/97: paid upkeep check, now keyed by the statement's stable id
 *  - **ER-1: the statement's declared reach**, which is what decides whether a
 *    source Token is even a candidate
 *
 * ⚠️ A statement carrying a `When` clause is skipped here, exactly as a
 * triggered block was: it belongs to `TriggerSystem`. The difference is that
 * the grammar no longer *lets* an ambient effect carry one, so the case where
 * both systems skipped the same authored effect can no longer be authored.
 *
 * ## ⚠️ This used to say "from neighbouring Tokens", and that was the bug
 * The source set was `neighboursOf(index)`, which **never contains `index`** —
 * `areNearby` states outright that a tile is not nearby to itself. So a
 * Token could not reach itself with any rule, at any strength, however it was
 * authored. The source set is now every occupied Token, and each statement's
 * `reach` decides whether it carries from there to here (`reachCovers`).
 *
 * ## The cost, and why it is acceptable
 * This walks every occupied tile rather than eight neighbours — at most 36 on a
 * 6×6 board. It runs on board changes (`rebuildToken`) and on cycle completion
 * (`collectItemGrants`, `collectStatusApplications`), neither of which is a hot
 * loop; the per-frame path reads the *cached* aggregator and does not come
 * through here at all. Scanning unconditionally is chosen over a "does any Token
 * have board reach?" cache because a stale cache here is a silently missing
 * effect, which is the failure mode this project keeps paying for.
 */
function* applicableStatements(selfId) {
    const self = BoardState.getTokenById(selfId);
    if (!self) return;
    const selfDef = getTokenType(self.typeId);
    const seenTypes = new Set();

    // `nearby` means Near: every other Token whose centre is within the Near
    // radius of this Token's centre (Free Playmat 1.2, FP-41; by id since 1.6b).
    const nearbyIds = new Set(nearby(self.id, REACH.NEARBY));

    // Every Token on the mat, once each, in arrival order.
    for (const instance of BoardState.tokens()) {
        // Where this source stands relative to the Token being rebuilt. Computed
        // once per source rather than per statement, because it is a fact about
        // the board and every statement on the Token shares it.
        const relation = instance.id === self.id ? RELATION.SELF
            : nearbyIds.has(instance.id) ? RELATION.NEARBY
                : RELATION.DISTANT;

        const def = getTokenType(instance.typeId);

        // A Token may carry SEVERAL statements — two effects aimed at different
        // neighbours, say. Each is considered independently.
        const statements = statementsOf(def);
        if (!statements.length) continue;

        /**
         * ⚠️ **The duplicate guard runs AFTER the reach test, not before.**
         *
         * The source set widened from eight neighbours to every occupied tile
         * (P2), and the scan runs in ascending tile order. Claiming the
         * `seenTypes` slot before checking reach meant a **distant** copy of a
         * `noStackDuplicates` Token could take the slot and suppress an
         * **nearby** one whose rule actually reached here — the tile lost a
         * buff it should have had, depending only on tile numbering.
         */
        const duplicate = def.noStackDuplicates && seenTypes.has(instance.typeId);
        let claimed = false;

        for (const statement of statements) {
            if (statement?.when?.event) continue;
            if (!AMBIENT_KEYWORDS.has(statement?.keyword)) continue;
            // ER-1: does this rule carry from where its Token sits to here? An
            // unauthored reach resolves to `nearby`, which is what every rule
            // written before P2 meant — so nothing shipped changed.
            if (!reachCovers(reachOf(statement), relation)) continue;
            if (duplicate) continue;
            if (def.noStackDuplicates && !claimed) {
                seenTypes.add(instance.typeId);
                claimed = true;
            }
            // Every ambient keyword must name the thing it does, or it reaches
            // nothing: an effect axis for the two that scale a number, a status
            // for the one that puts something on a person.
            if (statement.keyword === KEYWORD.APPLIES) {
                // ⚠️ EITHER shape counts (V6). The guard tested `statusId`
                // alone, so an `Applies` naming a **library effect** — which is
                // what the editor now produces by default — was never yielded,
                // and the whole feature was inert on a Token while rendering a
                // perfectly good sentence.
                if (!statement.payload?.statusId && !statement.payload?.effectId) continue;
                // G-42: an `Applies` aimed at a role is not a filter rule, so it
                // never reaches a tile's occupants this way.
                if (statement.target?.role) continue;
            } else if (!statement.payload?.type) {
                continue;
            }

            // CMS-18/23: a targeted statement only reaches Tokens it names.
            if (!matchesTokenTarget(statement.to, selfDef, { instance: self, tokenId: self.id })) continue;

            // CMS-60/97: an unpaid statement is simply off until stock returns.
            if (!isStatementPaid(instance, statement.id)) continue;

            yield { statement, neighbour: instance.id, instance };
        }
    }
}

/** Rebuild Token `instanceId`'s inbound modifiers. A Token not on the mat loses its aggregator. */
export function rebuildToken(instanceId) {
    if (!BoardState.getTokenById(instanceId)) {
        aggregators.delete(instanceId);
        return;
    }
    const agg = getTokenAggregator(instanceId);
    agg.clearAll();

    for (const { statement, neighbour, instance } of applicableStatements(instanceId)) {
        if (statement.keyword !== KEYWORD.PROVIDES) continue;
        // The source id carries the statement's **stable id** rather than its
        // position, so reordering a Token's rules cannot make one statement's
        // contribution look like another's.
        const source = `${sourceIdFor(neighbour, instance.typeId)}:${statement.id}`;
        /**
         * ⚠️ `category` is authored flat and registered **nested** (P4).
         *
         * The aggregator matches `mod.target.category`, which is an awkward
         * shape to ask an author for and a needless one to store in content. The
         * payload carries a plain `category`; the translation happens here, at
         * the one point a payload becomes a modifier.
         *
         * `BoardRunner` passes the Token's own `config.skill` as the category on
         * every `resolveAxis` call, so this is what makes *"+10% yield to Mining
         * only"* resolve — machinery that has been live and unwritable since the
         * aggregator was built.
         */
        const { category, ...payload } = statement.payload;
        agg.addModifier({
            ...payload, source,
            ...(category ? { target: { category } } : {})
        });
    }
}

/**
 * Statements that put a **status** on whoever is working this tile.
 *
 * The mirror of `collectItemGrants`, and deliberately the same shape: both are
 * "things that happen to this tile when it finishes a cycle, sent by a
 * neighbour that named it". The filter has already been matched against this
 * tile's Token by `applicableStatements`, so the caller only has to find the
 * person standing here.
 */
export function collectStatusApplications(instanceId) {
    const out = [];
    for (const { statement } of applicableStatements(instanceId)) {
        // The title rides along so the caller can announce which named effect
        // landed (P3). Copied rather than pushed by reference, because the
        // payload belongs to the statement and callers should not be able to
        // reach back into the library through it.
        if (statement.keyword === KEYWORD.APPLIES) {
            out.push({ ...statement.payload, effectTitle: statement.effectTitle });
        }
    }
    out.push(...loadoutPayloads(instanceId, KEYWORD.APPLIES));
    return out;
}

/**
 * What the hero standing here contributes of one keyword, as payloads.
 *
 * ## Why the loadout comes in through the same door as the neighbours
 * A hero's items and a Token's neighbours are different sources of the same
 * kind of thing: something reaching this tile at the moment it finishes a cycle.
 * Feeding them into the collectors the board already calls means `BoardRunner`
 * needs no new loop, the failed-cycle rule and the needs-a-person rule apply
 * unchanged, and P3's announcement comes along for free.
 *
 * `sourceItemIds` rides with the payload because paying an item rule's cost
 * means consuming one of the items that granted it (UE-21), and by the time the
 * caller acts, which items those were is no longer derivable.
 */
function loadoutPayloads(instanceId, keyword) {
    const heroId = BoardState.workerOf(instanceId);
    if (!heroId) return [];

    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    return HeroEffects.loadoutStatementsWith(hero, keyword)
        // G-42: a role-aimed rule reaches its role, never this tile's occupant.
        .filter(statement => !statement?.target?.role)
        .map(statement => ({
        ...statement.payload,
        effectTitle: statement.effectTitle,
        chargeDelta: statement.chargeDelta,
        sourceItemIds: statement.sourceItemIds
    }));
}

/**
 * Item-granting statements reaching this tile, as raw payloads (CMS-27/72).
 */
export function collectItemGrants(instanceId, effectType) {
    const grants = [];
    for (const { statement } of applicableStatements(instanceId)) {
        const payload = statement.payload;
        // Carries `effectTitle` for the same reason as the statuses above.
        if (payload?.type === effectType && payload.itemId) {
            grants.push({ ...payload, effectTitle: statement.effectTitle });
        }
    }
    // The hero's own items grant at this tile too (UE-23).
    for (const payload of loadoutPayloads(instanceId, KEYWORD.GRANTS)) {
        if (payload?.type === effectType && payload.itemId) grants.push(payload);
    }
    return grants;
}

/**
 * Whether any Token on the board carries a rule with `board` reach.
 *
 * Scanned, not cached: a few dozen Tokens at most, on board events only.
 */
function boardReachOnBoard() {
    for (const instance of BoardState.tokens()) {
        const statements = statementsOf(getTokenType(instance?.typeId));
        if (statements.some(s => reachOf(s) === REACH.BOARD)) return true;
    }
    return false;
}

/**
 * Whether a board-reach rule was on the board at the last rebuild.
 *
 * ⚠️ Needed because the Token that matters may be the one that just **left**: by
 * the time its departure is rebuilt it is gone and the scan above cannot see it.
 * Remembering that one was there is what makes its leaving refresh every Token.
 * Refreshed by every rebuild below, so it can only be stale for a Token that
 * arrived with no rebuild at all.
 */
let boardReachLive = false;

/**
 * Rebuild exactly these Tokens — or **every** Token when a board-reach rule is,
 * or just was, on the mat.
 *
 * ## The board-reach refresh (Free Playmat 1.3, pre-existing bug)
 * A `board` rule reaches every Token, however far. Rebuilding only the Tokens
 * within Near of a change left distant Tokens holding a buff from a Token that
 * had left, or missing one from a Token that had just arrived or changed, until
 * the next full rebuild. So while such a rule is (or was) present, a change
 * anywhere rebuilds every Token on the mat — cheap, and on events only.
 *
 * @param {string[]} ids instance ids
 */
export function rebuildTokens(ids) {
    const now = boardReachOnBoard();
    const wholeBoard = now || boardReachLive;
    boardReachLive = now;
    if (wholeBoard) {
        for (const instance of BoardState.tokens()) rebuildToken(instance.id);
        return;
    }
    for (const id of ids || []) rebuildToken(id);
}

/**
 * Rebuild every Token whose modifiers a change at these mat points can touch —
 * every Token within Near (+ the largest art radius) of **any** of them
 * (`nearby.tokensAround`).
 *
 * ⚠️ **Pass the departure point AND the arrival point.** A Token moving from A
 * to B takes its buffs away from A's neighbours and gives them to B's; rebuilding
 * around only one of the two leaves the other side holding a stale buff (the
 * slice's top risk). `null` entries are ignored, so a caller can pass
 * `[oldPoint, newPoint]` without checking either.
 *
 * Follows the live radius, not a fixed ring, so raising Near in the Mat Tuner
 * cannot leave stale buffs outside the old reach (Free Playmat 1.2).
 *
 * @param {Array<{x:number,y:number}|null>} points
 */
export function rebuildAround(points) {
    // ⚠️ A tile number here would be silently ignored as "no point" and leave
    // buffs stale — so a caller still holding a tile fails loudly instead.
    if (typeof points === 'number') {
        throw new TypeError('TileModifiers.rebuildAround takes mat points, not a tile');
    }
    rebuildTokens(tokensAround(Array.isArray(points) ? points : [points]));
}

/** Rebuild every Token on the mat — on boot and after a save load. */
export function rebuildAll() {
    clearAll();
    boardReachLive = boardReachOnBoard();
    for (const instance of BoardState.tokens()) rebuildToken(instance.id);
}

/**
 * Resolve one effect axis for a Token, merging **every scope into one set of
 * buckets** before applying the three-bucket formula.
 *
 * Scopes, all contributing to the same buckets:
 *  - the Token's own inbound modifiers (its neighbours' buffs)
 *  - the guild-wide aggregator (Guild Hall Global upgrades, D-121)
 *  - **the loadout of the hero working it** (Unified Effects P4)
 *
 * @param {string} instanceId the Token, by instance id (slice 1.6b)
 * @param {string} effectType EFFECT_TYPES key
 * @param {number} base       the authored value
 * @param {string} [category] skill category, for targeted buffs
 */
export function resolveAxis(instanceId, effectType, base, category = TARGET_CATEGORIES.ALL) {
    const tile = getTokenAggregator(instanceId);
    const guild = getGlobalAggregator();
    const hero = heroContributions(instanceId, effectType, category);

    const flat = [
        tile.getFlat(effectType, category),
        guild.getFlat(effectType, category),
        hero.flat
    ];
    const multipliers = [
        ...tile.collectMultipliers(effectType, category),
        ...guild.collectMultipliers(effectType, category),
        ...hero.multipliers
    ];
    const percentages = [
        ...tile.collectPercentages(effectType, category),
        ...guild.collectPercentages(effectType, category),
        ...hero.percentages
    ];

    return applyThreeBucket(base, { flat, multipliers, percentages });
}

/**
 * What the hero working this tile contributes, out of the items they carry.
 *
 * ## ⚠️ Read live, not cached into the tile's aggregator, and that is deliberate
 * A tile's aggregator is rebuilt when the **board** changes. A loadout is not
 * the board: a hero can be re-equipped, walk to another tile, or run their
 * potions dry without a single Token moving, and every one of those would leave
 * a cached contribution stale. It is a handful of items read once per axis
 * resolution, which is the same order of work `applicableStatements` already
 * does for the eight neighbours.
 *
 * ## Why an item's `Provides` needs no filter (UE-24)
 * A Token's buff has to say which of its eight neighbours it reaches. An item
 * has exactly one hero and that hero is standing on exactly one tile, so there
 * is only one thing a number could be about — the work being done here. Any
 * filter authored on it is ignored rather than obeyed, because there is nothing
 * for it to choose between.
 */
function heroContributions(instanceId, effectType, category = TARGET_CATEGORIES.ALL) {
    const empty = { flat: 0, multipliers: [], percentages: [] };

    const heroId = BoardState.workerOf(instanceId);
    if (!heroId) return empty;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return empty;

    let flat = 0;
    const multipliers = [];
    const percentages = [];

    /**
     * ⚠️ Carried effects join the loadout here (V7), and for the same reason it
     * is read live: a live effect expires on its own clock, with no board change
     * and no player action, so a cached contribution would outlive it.
     *
     * This is what makes Cookout — *"+10% gathering yield for a while"* —
     * expressible as an ordinary library effect.
     */
    const contributing = [
        ...HeroEffects.loadoutStatements(hero),
        ...LiveEffects.modifierStatements(hero)
    ];

    for (const statement of contributing) {
        if (statement.keyword !== KEYWORD.PROVIDES) continue;

        const payload = statement.payload || {};
        if (payload.type !== effectType) continue;

        /**
         * ⚠️ The narrowing field, honoured here by hand (P4).
         *
         * Everything else on this path bypasses `ModifierAggregator` — the
         * loadout is read live rather than cached — so it also bypasses
         * `_forEachMatching`, which is where a category is normally matched. An
         * item scoped to Mining would otherwise apply to Fishing, silently, and
         * only when carried rather than when placed. Mirrored rather than
         * trusted, the same way `combatContributions` mirrors the flat-bucket
         * rule instead of relying on the palette to have refused it.
         */
        if (payload.category && payload.category !== category) continue;

        const value = Number(payload.value);
        if (!Number.isFinite(value)) continue;

        if (payload.bucket === 'flat') flat += value;
        else if (payload.bucket === 'multiplier') multipliers.push(value);
        else percentages.push(value);
    }

    return { flat, multipliers, percentages };
}
