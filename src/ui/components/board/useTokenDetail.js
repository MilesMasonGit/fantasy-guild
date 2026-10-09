
import { useTokenState } from './tokenEvents.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';

/**
 * A quest Token's quest as a flat projection for `detail`: what the ring, the glow and the
 * tooltip draw. Rebuilt on every read, so the projection's deep compare sees progress. Null
 * for any other Token.
 */
function questProjection(instance) {
    if (!QuestTokens.isQuestToken(instance)) return null;
    const q = instance.quest;
    return {
        id: q.id,
        title: q.title,
        instruction: q.instruction || null,
        type: q.type || null,
        itemId: q.itemId || null,
        enemyId: q.enemyId || null,
        currentCount: q.currentCount || 0,
        requiredCount: q.requiredCount || 1,
        rewardItems: (q.rewardItems || []).map(r => ({ itemId: r.itemId, quantity: r.quantity })),
        tutorial: !!q.tutorial,
        done: !!q.done
    };
}

/** The side the hero working `id` stands on (−1 / 1), or null. */
function sideOfWorker(id) {
    const heroId = BoardState.workerOf(id);
    const side = heroId ? BoardState.heroBodyOf(heroId)?.side : null;
    return side === -1 || side === 1 ? side : null;
}

/**
 * This Token's own details as a flat projection (see `useGameState`'s selector contract), or
 * null when it is not on the mat. ⚠️ Never anything `board:progress` changes: that fires every
 * tick for every working Token, and the ring row draws it imperatively instead.
 */
export function tokenDetailOf(id, def) {
    const instance = BoardState.getTokenById(id);
    if (!instance) return null;
    // A Foundation picks its recipe like a station.
    const stationSkill = def ? (def.foundation?.skill || stationSkillOf(def)) : null;
    const isSpawner = !instance.turnedFrom && SpawnerSystem.isSpawner(def);
    return {
        usesRemaining: instance.usesRemaining ?? null,
        alert: instance.alert || null,
        disallowed: Flags.isDisallowed(instance),
        heroId: BoardState.workerOf(id),
        // The side the working hero stands on (-1 left, 1 right), for the ring row. `workerOf`
        // is null until they arrive.
        heroSide: sideOfWorker(id),
        stationSkill,
        recipe: stationSkill ? StationRecipe.selectedRecipe(instance, def) : null,
        // Something to choose from: a station with an empty pool is not waiting on the player,
        // so it gets no gear.
        hasPool: stationSkill ? StationRecipe.poolFor(def).length > 0 : false,
        isFoundation: !!def?.foundation,
        isSpawner,
        // The family's live count against its cap, `{ count, cap }`: the spawner ring.
        spawnerCounts: isSpawner ? SpawnerSystem.spawnerCounts(id) : null,
        // A Token that turns (or has turned) counts down to its next roll.
        turns: !!TimedChanges.nextTurnRoll(instance),
        // A Token that grows (a Sapling) counts down to the change.
        grows: !!TimedChanges.nextGrowth(instance),
        // Out of charges and waiting to respawn: drawn resting, a refill counting down.
        resting: Respawn.isResting(instance, def),
        // A quest Token's quest: ring, glow, tooltip, click to claim.
        quest: questProjection(instance)
    };
}

/** Events that name this Token by `instanceId` and can change its details. */
const BY_ID = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,              // disallowed, a recipe picked, moved, transformed
    BOARD_EVENTS.ALERT_CHANGED,             // alert
    BOARD_EVENTS.HERO_MOVED,                // a hero arrived here: heroId, heroSide
    BOARD_EVENTS.TOKEN_CHARGES_CHANGED,     // usesRemaining, and with it resting
    BOARD_EVENTS.TOKEN_PLACED,
    ENGINE_EVENTS.QUESTS_UPDATED            // a quest Token's progress
]);

/** A spawner counts its family, so any Token arriving or leaving can change it. */
const SPAWNER_BROADCAST = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.TOKEN_PLACED, BOARD_EVENTS.TOKEN_DEPLETED
]);

/**
 * The hook: `tokenDetailOf`, woken only by events about this Token, never by the catch-all
 * `state_changed` and never by `board:progress`.
 * * by instance id: {@link BY_ID};
 * * by the hero working it: `HERO_MOVED` names the Token a hero went TO, so the one they LEFT
 * hears it through their `heroId`;
 * * broadcast: `GAME_RESET` for every Token, and the family's comings and goings for a
 * spawner. (A quest Token needs none: every change to a quest publishes `QUESTS_UPDATED {
 * instanceId }`, and a quest Token subscribes exactly as often as a plain one; see
 * `QuestTokenUI.test.js`.)
 * Each route is pinned by `TokenDetailRoutes.test.js`.
 */
export function useTokenDetail(id, def) {
    return useTokenState(id, () => tokenDetailOf(id, def), (detail) => ({
        byId: BY_ID,
        byKey: [{ event: BOARD_EVENTS.HERO_MOVED, field: 'heroId', key: detail?.heroId || null }],
        broadcast: [
            ENGINE_EVENTS.GAME_RESET,
            ...(detail?.isSpawner ? SPAWNER_BROADCAST : [])
        ]
    }));
}
