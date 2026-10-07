// per-Token modifier scope

import { ModifierAggregator, applyThreeBucket } from '../effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { TARGET_CATEGORIES } from '../effects/constants.js';
import { nearby, reachFrom, tokensAround, nearRadius, centreOf, distanceSq } from './nearby.js';
import { onMatTuningChanged } from '../../config/matTuning.js';
import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsOf } from '../effects/statements.js';
import { isStatementPaid } from './BlockUpkeep.js';
import { REACH, RELATION, reachOf, reachCovers } from '../../config/registries/reachRegistry.js';
import { FILTER_NEEDS, matchesFilters, filtersOf, getFilterKind } from '../../config/registries/filterRegistry.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as LiveEffects from '../effects/LiveEffects.js';

/**
 * TileModifiers: one runtime `ModifierAggregator` per Token, and the resolver that reads them.
 *
 * Runtime-only, rebuilt from board state, never serialized. Persisting a derived aggregator would
 * freeze a stale buff into the save, and a silently empty one after a reload is the classic
 * failure; `ModifierScopes.test.js` pins both.
 *
 * ⚠️ Every scope pushes into the SAME buckets, resolved once: `Final = (Base + Σflat) ×
 * (Σmultipliers) × (1 + Σpercentages)`. Resolving each scope separately and multiplying compounds
 * them: three +25% sources give ×1.95 instead of ×1.75, which is how deliberately small adjacency
 * effects turn into large ones. `ModifierScopes.test.js` exists to prevent it.
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
 * One aggregator per Token instance id: the inbound modifiers of the Token with that id.
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
    lastWorkOf.clear();
    // Every Token's buffs are gone, so the next board-reach rebuild is whole.
    lastRebuild = null;
}

/** Live subscriptions, so `init` is idempotent across reloads and tests. */
let unsubscribers = [];

/**
 * ⚠️ A hero arriving changes what the buffs on this tile are.
 *
 * A tile's aggregator is a cache, rebuilt when the board changes. That was enough while every
 * filter asked about definitions; the `being worked` filter does not: the same Token matches or not
 * depending on whether anybody is standing there, and hero movement is the game's most frequent
 * action. Without this, a rule reading to every nearby Token being worked would be evaluated once,
 * at placement, and never again.
 *
 * ⚠️ This is the same reasoning `heroContributions` uses to read a loadout live rather than caching
 * it: a hero is not the board. The difference is that a loadout can be read at the moment it
 * matters, and an aggregator cannot.
 */
export function init() {
    teardown();
    // ⚠️ A hero LEAVING matters as much as one arriving, and the event does not always say where
    // they left. `HERO_MOVED` on a recall names only where the hero is now (the Dock). Rebuilding
    // only on arrival would switch a `being worked` buff ON when a hero stepped up and never OFF
    // when they were recalled.
    // So the departure case rebuilds around the hero's last known point, which `lastPointOf`
    // remembers precisely because the event cannot say. Where they are now is asked of the seam
    // (`displayPointOf`, null in the Dock), not read off the payload.
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.HERO_MOVED, ({ heroId } = {}) => {
        const left = lastPointOf.get(heroId) || null;
        const now = BoardState.displayPointOf(heroId);
        if (now) lastPointOf.set(heroId, now);
        else lastPointOf.delete(heroId);

        // Skip when no Token's worker changed.
        // A Token's inbound buffs read the hero side of the board in exactly one way: who works it
        // (`workerOf`, for the `being worked` and `whose hero carries` filters). This hero changes
        // that answer for some Token on the mat only when the Token they work, counted only while
        // it is still on the mat, differs from last time. A kill (the enemy left; they now work
        // nothing), a re-plant while idle or walking, and a claim on a Token not yet reached all
        // leave it unchanged; the board change itself is rebuilt by whoever made it.
        // ⚠️ Not "the point is unchanged": a pinned flag stands on its Token's centre, so a hero
        // ARRIVING there keeps the same point while starting to work, and that rebuild must run
        // (`HeroMovedRebuild.test.js`). The publish itself stays: several UI subscribers redraw on
        // it.
        const board = BoardState.membershipVersion().tokens;
        if (board !== lastWorkBoard) {
            lastWorkOf.clear();
            lastWorkBoard = board;
        }
        const workNow = BoardState.workTokenOf(heroId);
        const known = lastWorkOf.has(heroId);
        const workBefore = known ? lastWorkOf.get(heroId) : null;
        lastWorkOf.set(heroId, workNow);
        const before = workBefore && BoardState.getTokenById(workBefore) ? workBefore : null;
        if (known && before === workNow) return;

        rebuildAround([left, now]);
    }));

    // ⚠️ A new Near radius changes what every tile reaches. Nothing on the board moves when the Mat
    // Tuner's radius does, so no board event would ever refresh the aggregators. Rebuilding all of
    // them is one pass over the Tokens, once per slider change, never per frame.
    unsubscribers.push(onMatTuningChanged((key) => {
        if (key == null || key === 'nearRadius') rebuildAll();
    }));
}

/**
 * Where each hero was drawn when we last heard, as a mat point. Runtime-only and rebuilt from
 * events, like the aggregators; it exists solely because `HERO_MOVED` reports a destination and
 * never an origin.
 */
const lastPointOf = new Map();

/**
 * The Token each hero worked when we last heard (`workTokenOf`, null for none), for the skip in the
 * `HERO_MOVED` handler. Runtime-only like `lastPointOf`; a hero with no entry yet is always rebuilt
 * around. Forgotten on a new board (a load), on {@link clearAll} (before a rehydrate) and on {@link
 * rebuildAll}, so the first event after any of them always rebuilds.
 */
const lastWorkOf = new Map();
let lastWorkBoard = null;

/** Drop the subscriptions. */
export function teardown() {
    unsubscribers.forEach(u => u?.());
    unsubscribers = [];
    lastPointOf.clear();
    lastWorkOf.clear();
}

/** The source id one Token's buff registers under. Per COPY (instance id), never per type. */
const sourceIdFor = (instanceId, typeId) => `token:${instanceId}:${typeId}`;

/**
 * Does a targeted buff apply to the Token on the tile being rebuilt?
 *
 * A buff with no `targetToken` is untargeted and applies to everything nearby: those effects are
 * deliberately tiny precisely because they touch everything nearby. A buff with one is narrow:
 * double all nearby Shrimp output needs the specific target beside it to matter at all, so it can
 * afford real weight without letting power come from stacking modifiers.
 *
 * Three modes, chosen per Token:
 * - `tag`: boost all nearby seafood (a Token's `tags`)
 * - `id`: boost specifically Shrimp Beds (exact `typeId`)
 * - `tokenType`: boost all nearby resources (the coarse category)
 *
 * ⚠️ An unknown mode matches NOTHING. A typo in a target spec should make a buff visibly inert, not
 * silently universal, which would turn a narrow, large effect into a board-wide one.
 */
export function matchesTokenTarget(spec, def, ctx = null) {
    if (!modeMatches(spec, def)) return false;

    // ⚠️ The stacked filters, which need more than a definition. `ctx` is what the caller could
    // supply (an instance, the id of a Token standing on the mat (`tokenId`), both or neither) and
    // `matchesFilters` refuses any filter it cannot evaluate rather than guessing. A caller passing
    // nothing gets the basic behaviour exactly, which keeps every older rule unchanged. The filter
    // kinds call where it stands `FILTER_NEEDS.TILE`; it is satisfied by a Token id on the mat.
    const available = new Set([FILTER_NEEDS.DEF]);
    if (ctx?.instance) available.add(FILTER_NEEDS.INSTANCE);
    if (ctx?.tokenId) available.add(FILTER_NEEDS.TILE);

    // The filter context keeps its `heroOnTile` field name; it is filled from the worker seam, by
    // instance id.
    const heroOnTile = ctx?.tokenId ? BoardState.workerOf(ctx.tokenId) : null;
    return matchesFilters(spec, {
        def,
        instance: ctx?.instance,
        heroOnTile,
        // Supplied as a closure so the filter never has to reach into the hero registry itself: the
        // same reason `renderStatement` takes a `names` resolver rather than importing one.
        heroCarries: (effectId) => LiveEffects.heroCarries(HeroManager.getHero(heroOnTile), effectId)
    }, available);
}

/** The single primary mode: tag, id, or everything. */
function modeMatches(spec, def) {
    if (!spec || !spec.mode) return true;   // untargeted
    if (spec.mode === 'all') return !!def; // every nearby Token
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
 * The Tokens a statement's filter names, seen from the Token carrying it.
 *
 * A filter is matched in two directions. Inbound: `applicableStatements` asks does this neighbour's
 * rule reach me? That is `matchesTokenTarget(statement.to, myDef)`, and it is how every ambient
 * effect resolves. Outbound: a triggered rule fires on the Token that owns it and has to ask the
 * opposite question: which of my neighbours did I just name? The triggered path and `Applies` share
 * this one answer.
 *
 * Answers with the instance ids of the Tokens named, in arrival order. `fallbackPoint` is for a
 * bearer that has already left the mat (a rule firing on its own depletion): the reach is then
 * measured from that point, with no self to include.
 *
 * @param {string} sourceId  the Token carrying the statement
 * @param {object} statement
 * @param {{x:number,y:number}|null} [fallbackPoint]
 * @returns {string[]} instance ids of the Tokens the filter names
 */
export function filterTargets(sourceId, statement, fallbackPoint = null) {
    // The candidate set is the reach, and only the reach: a distance query measured centre to
    // centre.
    const source = BoardState.getTokenById(sourceId);
    const candidates = source
        ? nearby(source.id, reachOf(statement))
        : reachFrom(fallbackPoint, null, reachOf(statement));

    const targets = [];
    for (const id of candidates) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;

        // ⚠️ `board` includes the Token carrying the rule, and that is right: every Token on the
        // board is not every Token except me. A rule that means to skip itself is `nearby`, which
        // is the default.
        if (!matchesTokenTarget(statement?.to, getTokenType(instance.typeId),
            { instance, tokenId: id })) continue;
        targets.push(id);
    }

    return targets;
}

/**
 * Rebuild one tile's inbound modifiers from the Tokens within reach of it. Called whenever the
 * neighbourhood changes; only the Tokens within Near of the change are rebuilt
 * (`nearby.tokensAround`).
 *
 * Two rules land here: a Buff Token affects every nearby Token (the same scarce Sawmill nudges each
 * Forge beside it), and duplicates stack, uncapped: eight Sawmills genuinely give eight times a
 * very small number, which is safe because effects are small. Individual Tokens may still opt out
 * with `noStackDuplicates`.
 */

/** Whether a statement applies continuously: an ambient keyword and no `When`. */
const isAmbient = (statement) => !statement?.when?.event && AMBIENT_KEYWORDS.has(statement?.keyword);

/**
 * The ambient-source index: the Tokens on the mat whose type carries at least one ambient statement
 * (`isAmbient`), in arrival order (a filter of `BoardState.tokens()`, so the order the no-stack
 * guard and the aggregators see is unchanged), plus whether any Token carries a `board`-reach rule.
 *
 * Keyed on the membership counter (a move cannot change which Tokens are on the mat or their order)
 * and the Token registry's version (a content reload can make a type a source). {@link rebuildAll}
 * also drops it, so a definition edited in place and followed by a full rebuild (what
 * `GuildUpgradeManager.recompute` does to the Guild Hall) is re-read too.
 *
 * Statements, reach, upkeep and filters are still evaluated live per rebuild; the index only
 * decides which Tokens are worth asking.
 */
const EMPTY_INDEX = Object.freeze({
    tokens: null, version: -1, regVersion: -1, sources: [], boardReach: false, stateFilters: false
});
let sourceIndex = EMPTY_INDEX;

function ambientSourceIndex() {
    const { tokens, version } = BoardState.membershipVersion();
    const regVersion = registryVersion();
    if (sourceIndex.tokens === tokens && sourceIndex.version === version
        && sourceIndex.regVersion === regVersion) return sourceIndex;

    const sources = [];
    let boardReach = false;
    let stateFilters = false;
    for (const instance of BoardState.tokens()) {
        const statements = statementsOf(getTokenType(instance.typeId));
        if (!statements.length) continue;
        if (!boardReach && statements.some(s => reachOf(s) === REACH.BOARD)) boardReach = true;
        if (statements.some(isAmbient)) {
            sources.push(instance);
            if (!stateFilters && statements.some(s => isAmbient(s) && readsLiveState(s))) stateFilters = true;
        }
    }
    sourceIndex = { tokens, version, regVersion, sources, boardReach, stateFilters };
    return sourceIndex;
}

/** Forget the index, so the next read re-scans the mat. */
function dropSourceIndex() {
    sourceIndex = EMPTY_INDEX;
}

/**
 * Whether a statement's filter reads anything but the target's definition: its charges
 * (`charges_below`) or who works it (`worked`, `carrying`).
 *
 * Those answers change with no board change at all (a cycle spends a charge, a hero picks up an
 * effect), so nothing rebuilds around the target when they do. See {@link rebuildTokens} for why
 * that matters to the board-reach refresh.
 */
function readsLiveState(statement) {
    return filtersOf(statement?.to).some(f => getFilterKind(f.kind).needs !== FILTER_NEEDS.DEF);
}

/**
 * Whether where a Token of this type stands decides whom its ambient rules
 * reach — any reach that tells a Near Token from a distant one (`nearby`,
 * `self_and_nearby`). `self` and `board` reach the same Tokens wherever the
 * source stands.
 */
function reachDependsOnPlace(typeId) {
    return statementsOf(getTokenType(typeId)).some(s => isAmbient(s)
        && reachCovers(reachOf(s), RELATION.NEARBY) !== reachCovers(reachOf(s), RELATION.DISTANT));
}

/**
 * Generator yielding every statement reaching this tile.
 *
 * Handles:
 * - many statements per Token, each considered independently
 * - targeted statements matching tag, id, or `all`
 * - duplicate protection (`noStackDuplicates: true`)
 * - the paid upkeep check, keyed by the statement's stable id
 * - the statement's declared reach, which decides whether a source Token is even a candidate
 *
 * ⚠️ A statement carrying a `When` clause is skipped here: it belongs to `TriggerSystem`. The
 * grammar does not let an ambient effect carry one.
 *
 * ⚠️ The source set is every ambient-source Token, including the target itself: each statement's
 * `reach` decides whether it carries from there to here (`reachCovers`). A Token can therefore
 * reach itself with a rule.
 *
 * It walks only the ambient-source index (`ambientSourceIndex`), which is rebuilt whenever
 * membership or the registry changes and on every `rebuildAll`, and measures Near per source
 * directly. One rebuild is O(sources).
 */
function* applicableStatements(selfId) {
    const self = BoardState.getTokenById(selfId);
    if (!self) return;
    const selfDef = getTokenType(self.typeId);
    const seenTypes = new Set();

    // `nearby` means Near: every other Token whose centre is within the Near radius of this Token's
    // centre. Measured per source below with exactly `tokensWithin`'s test: both centres present
    // and `distanceSq <= radius²`.
    const selfCentre = centreOf(self);
    const radius = nearRadius();
    const radiusSq = radius * radius;

    // Only the Tokens that can be ambient sources, in arrival order. Every other Token was
    // `continue`d past below without touching `seenTypes`, so skipping them is exact.
    for (const instance of ambientSourceIndex().sources) {
        // Where this source stands relative to the Token being rebuilt. Computed once per source
        // rather than per statement, because it is a fact about the board and every statement on
        // the Token shares it.
        let relation;
        if (instance.id === self.id) relation = RELATION.SELF;
        else {
            const centre = selfCentre ? centreOf(instance) : null;
            relation = centre && distanceSq(selfCentre, centre) <= radiusSq
                ? RELATION.NEARBY : RELATION.DISTANT;
        }

        const def = getTokenType(instance.typeId);

        // A Token may carry SEVERAL statements, two effects aimed at different neighbours, say.
        // Each is considered independently.
        const statements = statementsOf(def);
        if (!statements.length) continue;

        // ⚠️ The duplicate guard runs AFTER the reach test, not before. Claiming the `seenTypes`
        // slot before checking reach would let a DISTANT copy of a `noStackDuplicates` Token take
        // the slot and suppress a NEARBY one whose rule actually reached here, depending only on
        // scan order.
        const duplicate = def.noStackDuplicates && seenTypes.has(instance.typeId);
        let claimed = false;

        for (const statement of statements) {
            if (statement?.when?.event) continue;
            if (!AMBIENT_KEYWORDS.has(statement?.keyword)) continue;
            // Does this rule carry from where its Token sits to here? An unauthored reach resolves
            // to `nearby`.
            if (!reachCovers(reachOf(statement), relation)) continue;
            if (duplicate) continue;
            if (def.noStackDuplicates && !claimed) {
                seenTypes.add(instance.typeId);
                claimed = true;
            }
            // Every ambient keyword must name the thing it does, or it reaches nothing: an effect
            // axis for the two that scale a number, a status for the one that puts something on a
            // person.
            if (statement.keyword === KEYWORD.APPLIES) {
                // ⚠️ EITHER shape counts: an `Applies` naming a library effect carries no
                // `statusId`, so testing `statusId` alone would never yield it and the feature
                // would be inert on a Token while rendering a perfectly good sentence.
                if (!statement.payload?.statusId && !statement.payload?.effectId) continue;
                // An `Applies` aimed at a role is not a filter rule, so it never reaches a tile's
                // occupants this way.
                if (statement.target?.role) continue;
            } else if (!statement.payload?.type) {
                continue;
            }

            // A targeted statement only reaches Tokens it names.
            if (!matchesTokenTarget(statement.to, selfDef, { instance: self, tokenId: self.id })) continue;

            // An unpaid statement is simply off until stock returns.
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
        // The source id carries the statement's stable id rather than its position, so reordering a
        // Token's rules cannot make one statement's contribution look like another's.
        const source = `${sourceIdFor(neighbour, instance.typeId)}:${statement.id}`;
        // ⚠️ `category` is authored flat and registered nested. The aggregator matches
        // `mod.target.category`, an awkward shape to ask an author for, so the payload carries a
        // plain `category` and the translation happens here, at the one point a payload becomes a
        // modifier.
        // `BoardRunner` passes the Token's own `config.skill` as the category on every
        // `resolveAxis` call, which is what makes +10% yield to Mining only resolve.
        const { category, ...payload } = statement.payload;
        agg.addModifier({
            ...payload, source,
            ...(category ? { target: { category } } : {})
        });
    }
}

/**
 * Statements that put a status on whoever is working this tile.
 *
 * The mirror of `collectItemGrants`, deliberately the same shape: both are things that happen to
 * this tile when it finishes a cycle, sent by a neighbour that named it. The filter has already
 * been matched against this tile's Token by `applicableStatements`, so the caller only has to find
 * the person standing here.
 */
export function collectStatusApplications(instanceId) {
    const out = [];
    for (const { statement } of applicableStatements(instanceId)) {
        // The title rides along so the caller can announce which named effect landed. Copied rather
        // than pushed by reference, because the payload belongs to the statement and callers should
        // not be able to reach back into the library through it.
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
 * The loadout comes in through the same door as the neighbours: a hero's items and a Token's
 * neighbours are different sources of the same kind of thing, something reaching this tile at the
 * moment it finishes a cycle. Feeding them into the collectors the board already calls means
 * `BoardRunner` needs no new loop, and the failed-cycle rule and the needs-a-person rule apply
 * unchanged.
 *
 * `sourceItemIds` rides with the payload because paying an item rule's cost means consuming one of
 * the items that granted it, and by the time the caller acts, which items those were is no longer
 * derivable.
 */
function loadoutPayloads(instanceId, keyword) {
    const heroId = BoardState.workerOf(instanceId);
    if (!heroId) return [];

    const hero = HeroManager.getHero(heroId);
    if (!hero) return [];

    return HeroEffects.loadoutStatementsWith(hero, keyword)
        // A role-aimed rule reaches its role, never this tile's occupant.
        .filter(statement => !statement?.target?.role)
        .map(statement => ({
        ...statement.payload,
        effectTitle: statement.effectTitle,
        chargeDelta: statement.chargeDelta,
        sourceItemIds: statement.sourceItemIds
    }));
}

/** Item-granting statements reaching this tile, as raw payloads. */
export function collectItemGrants(instanceId, effectType) {
    const grants = [];
    for (const { statement } of applicableStatements(instanceId)) {
        const payload = statement.payload;
        // Carries `effectTitle` for the same reason as the statuses above.
        if (payload?.type === effectType && payload.itemId) {
            grants.push({ ...payload, effectTitle: statement.effectTitle });
        }
    }
    // The hero's own items grant at this tile too.
    for (const payload of loadoutPayloads(instanceId, KEYWORD.GRANTS)) {
        if (payload?.type === effectType && payload.itemId) grants.push(payload);
    }
    return grants;
}

/**
 * Whether a board-reach rule was on the board at the last rebuild.
 *
 * ⚠️ Needed because the Token that matters may be the one that just LEFT: by the time its departure
 * is rebuilt it is gone and the scan above cannot see it. Remembering that one was there is what
 * makes its leaving refresh every Token. Refreshed by every rebuild below, so it can only be stale
 * for a Token that arrived with no rebuild at all.
 */
let boardReachLive = false;

/**
 * What every Token's buffs were last computed from, while a board-reach rule is (or just was) on
 * the mat. Null whenever the next such rebuild must be whole.
 *
 * `{ tokens, regVersion, radius, signature, layout, gen }`:
 * - `signature`: {@link boardSignature} at that rebuild;
 * - `layout`: per Token on the mat, `{ inst, x, y, typeId, placeDep, gen }`: where it stood and
 * whether where it stands decides whom it reaches ({@link reachDependsOnPlace}). Kept current by
 * every rebuild below.
 */
let lastRebuild = null;

/**
 * The board-reach rules that can reach a Token from anywhere: every ambient
 * `board` statement on the mat, in arrival order, with the Token carrying it
 * and whether it is paid (`isStatementPaid`). A flat list of
 * `instance, statement, paid` triples, compared element by element.
 *
 * Object identity covers the rest: a source replaced or re-typed, or a content
 * reload handing out new statement objects, is a different entry.
 */
function boardSignature(index) {
    const signature = [];
    for (const instance of index.sources) {
        for (const statement of statementsOf(getTokenType(instance.typeId))) {
            if (!isAmbient(statement) || reachOf(statement) !== REACH.BOARD) continue;
            signature.push(instance, statement, isStatementPaid(instance, statement.id));
        }
    }
    return signature;
}

function sameSignature(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function layoutEntry(instance, gen, placeDep) {
    return { inst: instance, x: instance.x, y: instance.y, typeId: instance.typeId, placeDep, gen };
}

/** Remember the mat as every Token's buffs were just computed from (a whole rebuild). */
function rememberWholeRebuild(index, signature) {
    if (index.stateFilters) {
        lastRebuild = null;
        return;
    }
    const placeDep = new Map();
    const layout = new Map();
    for (const instance of BoardState.tokens()) {
        let dep = placeDep.get(instance.typeId);
        if (dep === undefined) {
            dep = reachDependsOnPlace(instance.typeId);
            placeDep.set(instance.typeId, dep);
        }
        layout.set(instance.id, layoutEntry(instance, 0, dep));
    }
    lastRebuild = {
        tokens: BoardState.membershipVersion().tokens,
        regVersion: registryVersion(),
        radius: nearRadius(),
        signature,
        layout,
        gen: 0
    };
}

/**
 * Every Token that arrived, left, moved or was replaced since the last
 * rebuild, as what to rebuild for it: the Token itself (`ids`) and, for one
 * whose place decides whom it reaches, the points it left and arrived at
 * (`points`). Brings the remembered layout up to date as it goes.
 */
function layoutChanges() {
    const state = lastRebuild;
    const gen = ++state.gen;
    const ids = [];
    const points = [];
    for (const instance of BoardState.tokens()) {
        const was = state.layout.get(instance.id);
        if (was && was.inst === instance && was.typeId === instance.typeId
            && was.x === instance.x && was.y === instance.y) {
            was.gen = gen;
            continue;
        }
        if (was?.placeDep) points.push({ x: was.x, y: was.y });
        const now = layoutEntry(instance, gen, reachDependsOnPlace(instance.typeId));
        state.layout.set(instance.id, now);
        ids.push(instance.id);
        if (now.placeDep) points.push({ x: now.x, y: now.y });
    }
    for (const [id, was] of state.layout) {
        if (was.gen === gen) continue;
        if (was.placeDep) points.push({ x: was.x, y: was.y });
        state.layout.delete(id);
    }
    return { ids, points };
}

/**
 * Rebuild exactly these Tokens, and, while a board-reach rule is (or just was) on the mat, whatever
 * else a whole-mat rebuild would change.
 *
 * The board-reach refresh: a `board` rule reaches every Token, however far. Rebuilding only the
 * Tokens within Near of a change would leave distant Tokens holding a buff from a Token that had
 * left, or missing one from a Token that had just arrived or changed, until the next full rebuild.
 * So while such a rule is (or was) present, every rebuild leaves every Token's buffs exactly as a
 * whole-mat rebuild would.
 *
 * The whole mat only when the board-reach rules changed. A Token's buffs can only change, with
 * nothing near it named by the caller, when:
 * 1. the board-reach rules changed (a source arrived, left, was replaced, or went paid/unpaid
 * ({@link boardSignature}); or content was reloaded, Near was retuned or the board itself swapped):
 * the whole mat;
 * 2. a filter reads live state (`charges_below`, `worked`, `carrying`) on any ambient rule on the
 * mat: those answers change with no board event, and the whole rebuild is what refreshes them: the
 * whole mat;
 * 3. a Token arrived, left or moved since the last rebuild without its caller naming the place (a
 * walking enemy rebuilds only when its walk ends): that Token, plus Near of both its places when
 * its place decides whom it reaches ({@link layoutChanges}).
 *
 * Nothing else a Token's buffs read can change between two rebuilds: its own type and its sources'
 * types change only with content (1), a `board` or `self` rule reaches the same Tokens wherever its
 * source stands, and a Near source's upkeep flipping is rebuilt around at once
 * (`BoardRunner.tick`). So a Token outside all of those keeps exactly the buffs a whole rebuild
 * would give it, and is skipped. `BoardReachRebuild.test.js` checks every Token against a whole
 * rebuild after every step.
 *
 * Without a board-reach rule nothing here runs: exactly `ids`.
 *
 * @param {string[]} ids instance ids
 */
export function rebuildTokens(ids) {
    const index = ambientSourceIndex();
    const now = index.boardReach;
    const inMode = now || boardReachLive;
    boardReachLive = now;
    if (!inMode) {
        lastRebuild = null;
        for (const id of ids || []) rebuildToken(id);
        return;
    }

    const signature = boardSignature(index);
    const last = lastRebuild;
    if (index.stateFilters || !last
        || last.tokens !== BoardState.membershipVersion().tokens
        || last.regVersion !== registryVersion()
        || last.radius !== nearRadius()
        || !sameSignature(last.signature, signature)) {
        for (const instance of BoardState.tokens()) rebuildToken(instance.id);
        rememberWholeRebuild(index, signature);
        return;
    }

    const changed = layoutChanges();
    if (!changed.ids.length && !changed.points.length) {
        for (const id of ids || []) rebuildToken(id);
        return;
    }
    const todo = new Set(ids || []);
    for (const id of changed.ids) todo.add(id);
    for (const id of tokensAround(changed.points)) todo.add(id);
    for (const id of todo) rebuildToken(id);
}

/**
 * Rebuild every Token whose modifiers a change at these mat points can touch: every Token within
 * Near (+ the largest art radius) of ANY of them (`nearby.tokensAround`).
 *
 * ⚠️ Pass the departure point AND the arrival point. A Token moving from A to B takes its buffs
 * away from A's neighbours and gives them to B's; rebuilding around only one of the two leaves the
 * other side holding a stale buff. `null` entries are ignored, so a caller can pass `[oldPoint,
 * newPoint]` without checking either.
 *
 * Follows the live radius, not a fixed ring, so raising Near in the Mat Tuner cannot leave stale
 * buffs outside the old reach.
 *
 * @param {Array<{x:number,y:number}|null>} points
 */
export function rebuildAround(points) {
    // ⚠️ A tile number here would be silently ignored as no point and leave buffs stale, so a
    // caller still holding a tile fails loudly instead.
    if (typeof points === 'number') {
        throw new TypeError('TileModifiers.rebuildAround takes mat points, not a tile');
    }
    rebuildTokens(tokensAround(Array.isArray(points) ? points : [points]));
}

/** Rebuild every Token on the mat — on boot and after a save load. */
export function rebuildAll() {
    clearAll(); // also forgets lastWorkOf and lastRebuild
    dropSourceIndex();
    const index = ambientSourceIndex();
    boardReachLive = index.boardReach;
    for (const instance of BoardState.tokens()) rebuildToken(instance.id);
    if (boardReachLive) rememberWholeRebuild(index, boardSignature(index));
}

/**
 * Resolve one effect axis for a Token, merging EVERY scope into one set of buckets before applying
 * the three-bucket formula.
 *
 * Scopes, all contributing to the same buckets:
 * - the Token's own inbound modifiers (its neighbours' buffs)
 * - the guild-wide aggregator (Guild Hall Global upgrades)
 * - the loadout of the hero working it
 *
 * @param {string} instanceId the Token, by instance id
 * @param {string} effectType EFFECT_TYPES key
 * @param {number} base the authored value
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
 * ⚠️ Read live, not cached into the tile's aggregator, and that is deliberate. A tile's aggregator
 * is rebuilt when the board changes. A loadout is not the board: a hero can be re-equipped, walk to
 * another tile, or run their potions dry without a single Token moving, and every one of those
 * would leave a cached contribution stale. It is a handful of items read once per axis resolution.
 *
 * Why an item's `Provides` needs no filter: a Token's buff has to say which neighbours it reaches.
 * An item has exactly one hero and that hero is standing on exactly one tile, so there is only one
 * thing a number could be about: the work being done here. Any filter authored on it is ignored
 * rather than obeyed, because there is nothing for it to choose between.
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

    // ⚠️ Carried effects join the loadout here, and for the same reason it is read live: a live
    // effect expires on its own clock, with no board change and no player action, so a cached
    // contribution would outlive it. This is what makes Cookout (+10% gathering yield for a while)
    // expressible as an ordinary library effect.
    const contributing = [
        ...HeroEffects.loadoutStatements(hero),
        ...LiveEffects.modifierStatements(hero)
    ];

    for (const statement of contributing) {
        if (statement.keyword !== KEYWORD.PROVIDES) continue;

        const payload = statement.payload || {};
        if (payload.type !== effectType) continue;

        // ⚠️ The narrowing field, honoured here by hand. Everything else on this path bypasses
        // `ModifierAggregator` (the loadout is read live rather than cached), so it also bypasses
        // `_forEachMatching`, which is where a category is normally matched. An item scoped to
        // Mining would otherwise apply to Fishing, silently, and only when carried rather than when
        // placed.
        if (payload.category && payload.category !== category) continue;

        const value = Number(payload.value);
        if (!Number.isFinite(value)) continue;

        if (payload.bucket === 'flat') flat += value;
        else if (payload.bucket === 'multiplier') multipliers.push(value);
        else percentages.push(value);
    }

    return { flat, multipliers, percentages };
}
