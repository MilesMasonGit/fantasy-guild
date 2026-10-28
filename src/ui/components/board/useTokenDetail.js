
import { useTokenState } from './tokenEvents.js';
import { BOARD_EVENTS } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import * as StationRecipe from '../../../systems/board/StationRecipe.js';
import * as SpawnerSystem from '../../../systems/board/SpawnerSystem.js';
import * as TimedChanges from '../../../systems/board/TimedChanges.js';
import * as Respawn from '../../../systems/board/Respawn.js';
import * as Fields from '../../../systems/board/Fields.js';
import * as Demolition from '../../../systems/board/Demolition.js';
import * as QuestTokens from '../../../systems/quests/QuestTokens.js';
import { stationSkillOf } from '../../../systems/effects/statements.js';

/**
 * A quest Token's quest as a flat projection for `detail`: what the idle plate, the glow and the
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
        says: q.says || null,
        firstMaps: !!q.firstMaps,
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
    // Marked for demolition: its own clocks stand still (`TimedChanges` skips it), so no countdown.
    const marked = Demolition.isMarked(instance);
    return {
        usesRemaining: instance.usesRemaining ?? null,
        alert: instance.alert || null,
        disallowed: Flags.isDisallowed(instance),
        heroId: BoardState.workerOf(id),
        // The side the working hero stands on (-1 left, 1 right), for the ring row. `workerOf`
        // is null until they arrive.
        heroSide: sideOfWorker(id),
        stationSkill,
        // A Field's pick is its next sowing (a wild one's starting crop until the player picks).
        recipe: stationSkill ? (Fields.isField(def) ? Fields.pickOf(instance, def) : StationRecipe.selectedRecipe(instance, def)) : null,
        // Something to choose from: a station with an empty pool is not waiting on the player,
        // so it gets no gear.
        hasPool: stationSkill ? StationRecipe.poolFor(def).length > 0 : false,
        isFoundation: !!def?.foundation,
        // A Field picks a crop with the same gear, sown for its seed.
        isField: Fields.isField(def),
        isSpawner,
        // The family's live count against its cap, `{ count, cap }`: the idle plate's spawner count.
        spawnerCounts: isSpawner ? SpawnerSystem.spawnerCounts(id) : null,
        // A Token that turns (or has turned) counts down to its next roll.
        turns: !marked && !!TimedChanges.nextTurnRoll(instance),
        // A Token that grows (a Sapling) counts down to the change.
        grows: !marked && !!TimedChanges.nextGrowth(instance),
        // A Field's growing crop counts down to its ripening.
        ripens: !marked && !!Fields.nextRipening(instance),
        // Out of charges and waiting to respawn: drawn resting, a refill counting down.
        resting: !marked && Respawn.isResting(instance, def),
        // The picture it is drawn as instead of its own art, by its state: a Field's empty, growing
        // or ripe picture, a resting vein's empty rock.
        stateSprite: marked ? null : (Fields.stateSpriteOf(instance, def) ?? Respawn.restingSpriteOf(instance, def)),
        // Marked for demolition: the marked badge.
        marked,
        // A quest Token's quest: plate, glow, tooltip, click to claim.
        quest: questProjection(instance)
    };
}

/** Events that name this Token by `instanceId` and can change its details. */
const BY_ID = Object.freeze([
    BOARD_EVENTS.TILE_CHANGED,              // disallowed, marked, a recipe picked, moved, transformed
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
 * The hook: `tokenDetailOf`, woken only by events about this Token, never by
 * `board:progress`.
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
