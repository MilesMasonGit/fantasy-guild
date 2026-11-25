// the mat-wide Token cap

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { isSpotKind } from '../../config/registries/fishingSpots.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * How many Tokens the mat may hold. Every Token on the mat counts, placed or spawned, but those
 * {@link countsTowardCap} leaves out. The Guild Hall never counts: it is always there; nor does a
 * node a map wrote with its place (`BoardState.FIXTURE.MAP`). The Starter Camp's Tokens count.
 * Landmarks (the endgame sites) count like any placed Token. The cap is the guild's,
 * but it counts only the Region the guild is in: the others are frozen in the Atlas, off the mat.
 *
 * Who asks: the Shop and a station making a Token (`Placement.hasRoomForProduct`) ask {@link
 * canPlaceMore} before adding one; a spawner waits while it says no (`SpawnerSystem`). Nothing is
 * ever removed for being over the cap: a save already over it keeps every Token, and adding waits
 * until the count drops below.
 */

/** The cap: fixed (the Guild Hall's Token Cap star is retired). */
export const BASE_TOKEN_CAP = 128;

/** Whether an instance is the Guild Hall. */
export function isGuildHall(instance) {
    return instance?.typeId === 'token_guild_hall' || !!getTokenType(instance?.typeId)?.isGuildHall;
}

/**
 * Whether a Token counts toward the cap: not an event Token (`instance.event`), an arrival
 * enemy (`instance.arrival`), a map's node (a settled place's own Tokens stand outside the cap, so
 * the count starts from what the player adds), a fishing spot (its type a spot kind) or the Guild
 * Hall. Events, arrivals and spots come to the mat on their own and must never stop the player
 * building. One type lookup.
 */
export function countsTowardCap(instance) {
    const typeId = instance?.typeId;
    if (!typeId || instance.event || instance.arrival || instance.fixture === BoardState.FIXTURE.MAP) return false;
    if (typeId === 'token_guild_hall') return false;
    const def = getTokenType(typeId);
    return !def?.isGuildHall && !isSpotKind(def);
}

/**
 * The count, memoised on what can change it: mat membership and the Token registry
 * (`countsTowardCap` reads a type). Spawners ask every tick, so this is one pass per change, not per
 * question.
 */
let memo = { tokens: null, version: -1, regVersion: -1, count: 0 };

/** Tokens on the mat counting toward the cap. */
export function tokenCount() {
    const { tokens, version } = BoardState.membershipVersion();
    const regVersion = registryVersion();
    if (memo.tokens === tokens && memo.version === version && memo.regVersion === regVersion) return memo.count;
    let count = 0;
    for (const t of BoardState.tokens()) if (countsTowardCap(t)) count++;
    memo = { tokens, version, regVersion, count };
    return count;
}

/** The cap: {@link BASE_TOKEN_CAP}, unless the Mat Tuner's dev override (`tokenCap`, 0 = off) is set on this device. */
export function matCap() {
    const override = Math.round(matTuning('tokenCap'));
    if (override > 0) return override;
    return BASE_TOKEN_CAP;
}

/** Whether `count` more Tokens would still fit under the cap. */
export function canPlaceMore(count = 1) {
    return tokenCount() + count <= matCap();
}
