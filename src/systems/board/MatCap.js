// the mat-wide Token cap

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { matTuning } from '../../config/matTuning.js';
import * as BoardState from './BoardState.js';

/**
 * How many Tokens the mat may hold. Every Token counts, placed or spawned, on the mat or waiting in
 * the discard bin (a binned Token counts until it is discarded, so the bin cannot dodge the cap).
 * The Guild Hall and quest Tokens never count: the Hall is always there, and quests are bounded by
 * the quest cap.
 *
 * Who asks: the Shop and a station making a Token (`Placement.hasRoomForProduct`) ask {@link
 * canPlaceMore} before adding one; a spawner waits while it says no (`SpawnerSystem`). Nothing is
 * ever removed for being over the cap: a save already over it keeps every Token, and adding waits
 * until the count drops below.
 */

/** The cap every guild starts with. A Guild Hall upgrade may raise it later. */
export const BASE_TOKEN_CAP = 80;

/** Whether an instance is the Guild Hall — the same test `Cartographer` uses. */
export function isGuildHall(instance) {
    return instance?.typeId === 'token_guild_hall' || !!getTokenType(instance?.typeId)?.isGuildHall;
}

/** Whether a Token counts toward the cap. */
export function countsTowardCap(instance) {
    return !!instance?.typeId && instance.typeId !== QUEST_TOKEN_TYPE && !isGuildHall(instance);
}

/**
 * The count, memoised on what can change it: mat membership, the bin (binning and discarding change
 * it without touching the mat) and the Token registry (`isGuildHall` reads a type). Spawners ask
 * every tick, so this is one pass per change, not per question.
 */
let memo = { tokens: null, version: -1, bin: null, binLength: -1, regVersion: -1, count: 0 };

/** Tokens counting toward the cap: on the mat and in the discard bin. */
export function tokenCount() {
    const { tokens, version } = BoardState.membershipVersion();
    const bin = BoardState.binTokens();
    const regVersion = registryVersion();
    if (memo.tokens === tokens && memo.version === version && memo.bin === bin
        && memo.binLength === bin.length && memo.regVersion === regVersion) return memo.count;
    let count = 0;
    for (const t of BoardState.tokens()) if (countsTowardCap(t)) count++;
    for (const t of bin) if (countsTowardCap(t)) count++;
    memo = { tokens, version, bin, binLength: bin.length, regVersion, count };
    return count;
}

/**
 * The cap: {@link BASE_TOKEN_CAP}, unless the Mat Tuner's dev override (`tokenCap`, 0 = off) is
 * set on this device.
 */
export function matCap() {
    const override = Math.round(matTuning('tokenCap'));
    return override > 0 ? override : BASE_TOKEN_CAP;
}

/** Whether `count` more Tokens would still fit under the cap. */
export function canPlaceMore(count = 1) {
    return tokenCount() + count <= matCap();
}
