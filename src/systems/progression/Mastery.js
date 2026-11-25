// Science's mastery: the guild's points in each node kind, and the rules its ranks hold on every Token of the kind

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { getRecipe } from '../../config/registries/recipePoolRegistry.js';
import { getEffect } from '../../config/registries/effectRegistry.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { masteryTrackOf, rankAt, nextRankOf, heldRanksOf, isMasteredAt, kindOfToken, kindOfType } from '../../config/registries/mastery.js';
import { statementsFromStack, normaliseScale } from '../effects/effectLibrary.js';
import { KEYWORD } from '../effects/statements.js';
import { setKindModifiers } from '../effects/GuildModifiers.js';
import * as TileModifiers from '../board/TileModifiers.js';

/**
 * **Mastery belongs to the node kind, guild-wide** (brief 810 K6). A Laboratory's study gives its
 * kind points (`Laboratories.js`); the guild's points are the save's, `progress.mastery = { [kind]:
 * points }`, kept across every Region. A kind is a node's Token type (a Stump counts as its tree,
 * `mastery.kindOfType`) or, for a Field, the crop in its ground (its recipe id).
 *
 * Each kind with a **track** (`mastery.masteryTrackOf`, on the kind's Token type or crop recipe)
 * holds the ranks its points reach; every held rank's library effect is in force on every Token of
 * the kind, now and later, wherever it stands: its `Provides` rules go into each such Token's own
 * aggregator as it is rebuilt (`GuildModifiers.setKindModifiers`), so a badge, a cycle and a
 * growth read them as any rule. Ranks are read off the points every time, never saved, so a track
 * the CMS changes holds at once.
 *
 * ⚠️ Not saved: {@link apply} puts the rules in on every load, new game, travel and catch-up
 * (`GAME_LOADED`, `GAME_RESET`) and on every rank reached, and rebuilds the mat only when they changed.
 */

const OWNER = 'mastery';

/** The source id a mastery rule registers under; `sourceOfMastery` reads it back. */
const sourceFor = (kind, effectId, statementId) => `mastery:${kind}|${effectId}|${statementId || 'rule'}`;

/** The kind a modifier came from, read off its `source`, or null for any other source. */
export function masteryKindOfSource(source) {
    const match = /^mastery:([^|]+)\|/.exec(typeof source === 'string' ? source : '');
    return match ? match[1] : null;
}

/** The guild's points, by kind: the save's own record, made on first write. */
function store(create = false) {
    const progress = GameState.state?.progress;
    if (!progress) return null;
    const held = progress.mastery;
    if (held && typeof held === 'object' && !Array.isArray(held)) return held;
    if (!create) return null;
    progress.mastery = {};
    return progress.mastery;
}

/** What a kind is in content: its Token type, or the crop recipe a Field grows it from. */
function holderOf(kind) {
    if (!kind) return null;
    return getTokenType(kind) || getRecipe(kind) || null;
}

/** A kind's track, or null when it has none: then it cannot be studied. */
export function trackOf(kind) {
    return masteryTrackOf(holderOf(kind));
}

/** The kind's name: its Token's, or its crop's. */
export function kindName(kind) {
    if (!kind) return '';
    if (getTokenType(kind)) return tokenName(kind) || kind;
    return getRecipe(kind)?.name || kind;
}

/**
 * The gathering level of a kind: its Token's `skillRequired`, or its crop's `levelRequirement`,
 * at least 1. A Laboratory studies a kind up to its own reach, and only a hero of that Science level.
 */
export function levelOf(kind) {
    const def = getTokenType(kind);
    const level = def ? Number(def.config?.skillRequired) : Number(getRecipe(kind)?.levelRequirement);
    return Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
}

/** The node kind a Token on the mat counts as now (`mastery.kindOfToken`). */
export function kindOf(instance) {
    return instance ? kindOfToken(instance, getTokenType(instance.typeId), getTokenType) : null;
}

/** The node kind a Token type counts as (`mastery.kindOfType`). */
export function kindOfTypeId(typeId) {
    return kindOfType(typeId, getTokenType);
}

/** The guild's points in a kind. */
export function pointsOf(kind) {
    const n = Number(store()?.[kind]);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/** The rank the guild holds in a kind (0 with none, or no track). */
export function rankOf(kind) {
    return rankAt(trackOf(kind), pointsOf(kind));
}

/** Whether the guild holds every rank of a kind's track: then there is nothing left to study. */
export function isMastered(kind) {
    return isMasteredAt(trackOf(kind), pointsOf(kind));
}

/**
 * Where a kind stands, for a card or the Encyclopedia: `{ kind, name, points, rank, ranks, next,
 * held, mastered }`, `next` the next rank's row (null at full mastery) and `held` the ranks held;
 * null for a kind with no track.
 */
export function standingOf(kind) {
    const track = trackOf(kind);
    if (!track) return null;
    const points = pointsOf(kind);
    return {
        kind,
        name: kindName(kind),
        points,
        rank: rankAt(track, points),
        ranks: track.ranks.length,
        next: nextRankOf(track, points),
        held: heldRanksOf(track, points),
        mastered: isMasteredAt(track, points),
        track
    };
}

/**
 * Add `points` to a kind (a study cycle's). A kind with no track takes none. A rank reached puts its
 * rule in force at once and says so (`MASTERY_RANK_UP`).
 * @returns {{ points: number, rank: number, rankedUp: boolean }|null}
 */
export function addPoints(kind, points = 1, { heroId = null, instanceId = null } = {}) {
    const track = trackOf(kind);
    const n = Number(points);
    if (!track || !(n > 0)) return null;
    const held = store(true);
    if (!held) return null;
    const before = pointsOf(kind);
    const from = rankAt(track, before);
    held[kind] = before + n;
    const rank = rankAt(track, held[kind]);
    if (rank > from) {
        apply();
        for (let r = from + 1; r <= rank; r++) {
            const row = track.ranks[r - 1];
            EventBus.publish(ENGINE_EVENTS.MASTERY_RANK_UP, {
                kind, kindName: kindName(kind), rank: r, ranks: track.ranks.length,
                effectId: row.effectId, scale: row.scale, heroId, instanceId
            });
        }
    }
    return { points: held[kind], rank, rankedUp: rank > from };
}

/**
 * The modifiers one kind's held ranks put on its Tokens: every `Provides` rule of every held rank's
 * effect, a rank naming an effect again adding its scale (as perks do), as `TileModifiers.rebuildToken`
 * registers a Token's own rules. A rule the guild cannot carry on a Token (another keyword, a
 * triggered one, no number, a retired axis) is left out; the audit names it (`masteryRule.js`).
 */
export function modifiersOfKind(kind, points = pointsOf(kind)) {
    const track = trackOf(kind);
    if (!track) return [];
    const scales = new Map();
    for (const row of heldRanksOf(track, points)) {
        scales.set(row.effectId, (scales.get(row.effectId) || 0) + normaliseScale(row.scale));
    }
    const out = [];
    for (const [effectId, scale] of scales) {
        const entry = getEffect(effectId);
        if (!entry) continue;
        for (const statement of statementsFromStack(entry, { effectId, scale })) {
            if (statement?.keyword !== KEYWORD.PROVIDES || statement.when?.event) continue;
            const payload = statement.payload;
            const value = Number(payload?.value);
            if (!payload?.type || !Number.isFinite(value) || getPaletteEntry(payload.type)?.retired) continue;
            const { category, ...rest } = payload;
            out.push({
                ...rest,
                value,
                source: sourceFor(kind, effectId, statement.id),
                ...(category ? { target: { category } } : {})
            });
        }
    }
    return out;
}

/** What the kind rules were last made of, so the mat is rebuilt only when they change. */
let appliedKey = '';

/**
 * Make every Token of every kind hold exactly the rules of the ranks the guild holds now, and
 * rebuild the mat when that changed.
 * @returns {number} how many kinds hold a rule
 */
export function apply() {
    const byKind = new Map();
    for (const kind of Object.keys(store() || {})) {
        const list = modifiersOfKind(kind);
        if (list.length) byKind.set(kind, list);
    }
    const key = [...byKind].map(([kind, list]) => `${kind}=${list.map(m => `${m.source}:${m.type}:${m.value}:${m.bucket}`).join(',')}`).join('|');
    setKindModifiers(OWNER, byKind);
    if (key !== appliedKey) {
        appliedKey = key;
        TileModifiers.rebuildAll();
    }
    return byKind.size;
}

let unsubscribers = [];

/** Listen for a load, a new game, a travel and a catch-up: the points or the mat may be new. */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => apply()));
    unsubscribers.push(EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => apply()));
}

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}
