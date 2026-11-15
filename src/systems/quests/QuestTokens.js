// Fantasy Guild — Quest Tokens: quests live on the mat

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as BoardState from '../board/BoardState.js';
import * as EffectActions from '../board/EffectActions.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import { isGuildHall } from '../board/MatCap.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { tunedOr } from '../../config/matTuning.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';
// The bounty and reward helpers come from the leaf `questBounties.js`, not
// QuestManager, so this module does not import QuestManager.
import { createRandomQuest, questReward } from './questBounties.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

export { QUEST_TOKEN_TYPE };

/**
 * Bounties are Tokens. The Guild Hall spawns quest Tokens beside itself, and each
 * carries its quest.
 *
 * ## The instance (saved with the board)
 * A quest Token is an ordinary instance of the engine-owned type
 * `token_quest` (`engineTokens.js`) with one extra field:
 *
 * ```js
 * instance.quest = {
 *   id, title, instruction?,          // what it says
 *   type: 'hunt' | 'collection',
 *   targetType, match?, enemyId?, itemId?,   // what it counts (QuestManager's matching)
 *   requiredCount, currentCount,
 *   rewardItems: [{ itemId, quantity }],
 *   tutorial: false,
 *   done: boolean                     // currentCount >= requiredCount
 * }
 * ```
 *
 * It is `origin: 'spawned'` and never counts toward the mat's Token cap
 * (`MatCap.countsTowardCap`), and the player can drag it like any Token. No hero
 * works it.
 *
 * ## Bounties
 * QuestManager's random hunts and collections. At most {@link questCap} on the
 * mat; below the cap a new one arrives every {@link questIntervalMs} of game
 * time. Dismissing one ({@link dismissBounty}, no reward) frees its place, so the
 * timer can bring another.
 *
 * The game teaches through Limes's lessons (`LimesLessons.js`), not quests. An
 * older save may still hold the cartographer's tutorial step on the mat
 * (`quest.tutorial`): {@link ensure} takes it off.
 *
 * ## ⚠️ The clock runs on the tick's `delta`
 * `state.quests.clockMs`, saved, advanced by {@link tick} from the game loop's
 * `quest_manager` handler, so a catch-up and `DevTools.advanceTime` speed it
 * up. It **only runs below the cap**: at the cap it holds, and filling the cap
 * drops any leftover, so a freed place gets its next quest one full interval
 * later. A bounty with nowhere to land is missed, like a spawner's spawn: the
 * next is tried one whole interval later.
 *
 * ## Claiming
 * {@link claimQuest}: only when done. The reward drops as floating loot beside
 * the quest Token and is banked when collected through `InventoryManager`. The
 * Token is then **removed**, not depleted: no `TOKEN_DEPLETED`, so no restock
 * spot and no "when depleted" rule.
 */

const refuse = (reason) => ({ success: false, reason });

/** Whether an instance is a quest Token. */
export function isQuestToken(instance) {
    return instance?.typeId === QUEST_TOKEN_TYPE && !!instance.quest;
}

/** Every quest Token on the mat, in arrival order. */
export function questTokens() {
    return BoardState.tokens().filter(isQuestToken);
}

/** The quest on Token `instanceId` (on the mat), or null. */
export function questOf(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    return isQuestToken(instance) ? instance.quest : null;
}

/** The bounty quest Tokens on the mat — what the cap counts. */
export function bountyTokens() {
    return questTokens().filter(t => !t.quest.tutorial);
}

/** An older save's tutorial step Tokens still on the mat, which {@link ensure} takes off. */
function oldTutorialTokens() {
    return questTokens().filter(t => t.quest.tutorial);
}

/** ⭐ Game values: the bounties the Hall keeps, and the most a dev build's Mat Tuner may ask for. */
export const QUEST_CAP_BASE = 2;
export const QUEST_CAP_MAX = 5;
/** ⭐ Game value: game seconds between bounties while the mat holds fewer than the cap. */
export const QUEST_EVERY_SEC = 180;

/**
 * How many bounties the Hall keeps on the mat: {@link QUEST_CAP_BASE}, never above
 * {@link QUEST_CAP_MAX} (a dev build's Mat Tuner may stand in for either). Fixed: the Notice Board
 * star that raised it is retired.
 */
export function questCap() {
    const base = Math.round(tunedOr('questCap', QUEST_CAP_BASE));
    const max = Math.round(tunedOr('questCapMax', QUEST_CAP_MAX));
    return Math.max(0, Math.min(max, base));
}

/** The bounty interval in game ms: {@link QUEST_EVERY_SEC}, or a dev build's Mat Tuner. */
export function questIntervalMs() {
    return Math.max(1000, Math.round(tunedOr('questEverySec', QUEST_EVERY_SEC) * 1000));
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** The saved quest state, made whole: the bounty clock. Null before a game exists. */
export function questState() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.quests || typeof state.quests !== 'object') state.quests = { clockMs: 0 };
    const q = state.quests;
    if (!Number.isFinite(q.clockMs)) q.clockMs = 0;
    return q;
}

/** The bounty clock, in game ms (tests, the QA panel). */
export function clockMs() {
    return questState()?.clockMs || 0;
}

/** Game ms until the next bounty, or null while at the cap. */
export function nextBountyInMs() {
    if (bountyTokens().length >= questCap()) return null;
    return Math.max(0, questIntervalMs() - clockMs());
}

function guildHall() {
    return BoardState.tokens().find(isGuildHall) || null;
}

function publishChanged(instanceId = null) {
    EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, instanceId ? { instanceId } : {});
}

// ---------------------------------------------------------------------------
// Making a quest
// ---------------------------------------------------------------------------

/** A quest object from one of QuestManager's bounties. */
function bountyQuest(source) {
    const quest = {
        id: source.id,
        tutorial: false,
        title: source.title || 'Bounty',
        type: source.type,
        targetType: source.targetType,
        requiredCount: Math.max(1, Number(source.requiredCount) || 1),
        currentCount: Math.max(0, Number(source.currentCount) || 0),
        rewardItems: questReward(source).map(r => ({ itemId: r.itemId, quantity: r.quantity })),
        done: false
    };
    if (source.instruction) quest.instruction = source.instruction;
    if (source.match) quest.match = { ...source.match };
    if (source.enemyId) quest.enemyId = source.enemyId;
    if (source.itemId) quest.itemId = source.itemId;
    quest.currentCount = Math.min(quest.currentCount, quest.requiredCount);
    quest.done = quest.currentCount >= quest.requiredCount;
    return quest;
}

/**
 * **Put a quest on the mat**: the Guild Hall spawns a `token_quest` beside
 * itself, through the same `EffectActions.spawn` (`nearest_free`) a spawner
 * uses, so it lands like any spawn, pushes only spawned Tokens, and is
 * `origin: 'spawned'`. Returns the new instance, or null when there is no Hall
 * or no room (see {@link tick} for when it is tried again).
 */
export function spawnQuest(quest, random = Math.random) {
    const hall = guildHall();
    if (!hall || !quest) return null;
    const landed = EffectActions.spawn(
        { payload: { typeId: QUEST_TOKEN_TYPE, placement: PLACEMENT.NEAREST_FREE } },
        { self: hall.id },
        random
    );
    const instance = landed ? BoardState.getTokenById(landed.instanceId) : null;
    if (!instance) return null;
    instance.quest = quest;
    if (quest.type === 'collection') syncCollection(quest);

    // The Guild Hall says it, as a spawner does for its Token.
    EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, {
        spawnerId: hall.id,
        instanceId: instance.id,
        typeId: QUEST_TOKEN_TYPE,
        name: 'quest'
    });
    EventBus.publish(ENGINE_EVENTS.QUEST_SPAWNED, { instanceId: instance.id, questId: quest.id });
    publishChanged(instance.id);
    return instance;
}

/** Spawn one random bounty (QuestManager's pools). */
export function spawnBounty(random = Math.random) {
    const bounty = createRandomQuest(questTokens().map(t => t.quest));
    return bounty ? spawnQuest(bountyQuest(bounty), random) : null;
}

// ---------------------------------------------------------------------------
// The check (load, new game, travel) and the tick
// ---------------------------------------------------------------------------

/** Set when the mat should be checked (a load, a new game, a travel); cleared once it is. */
let pending = true;
/** The state the last check ran against: a load or a new game swaps it. */
let checkedState = null;

/** Ask for a check on the next tick (a load, a new game, a travel). */
export function requestCheck() {
    pending = true;
}

/**
 * Bring the mat up to date: an older save's tutorial step Token is taken off it.
 * Idempotent. Returns false before a game exists.
 */
export function ensure() {
    const q = questState();
    if (!q) return false;
    checkedState = GameState.state;
    let removed = false;
    for (const instance of oldTutorialTokens()) {
        removeQuestToken(instance);
        removed = true;
    }
    if (removed) publishChanged();
    pending = false;
    return true;
}

/**
 * **One tick** (`quest_manager`, with the loop's `delta`).
 *
 * 1. A check asked for (see {@link ensure}) runs.
 * 2. The bounty clock: below the cap it advances by `delta`, and each full
 *    interval brings one try at a bounty (closed form, so one big tick equals
 *    many small ones). A bounty with nowhere to land is missed and the clock
 *    starts its next lap (owner: a missed bus waits for the next one); with no
 *    Hall the clock is held full and asked again next tick. At the cap the
 *    clock holds; reaching it drops the leftover.
 */
export function tick(delta, random = Math.random) {
    if (GameState.state !== checkedState) requestCheck();
    if (pending) ensure();
    if (!(delta > 0)) return;

    const q = questState();
    if (!q) return;
    const cap = questCap();
    let count = bountyTokens().length;
    if (count >= cap) return;

    const every = questIntervalMs();
    q.clockMs += delta;
    while (q.clockMs >= every && count < cap) {
        // No Hall, so nothing can arrive: cheap to ask, so asked again every tick.
        if (!guildHall()) {
            q.clockMs = every;
            return;
        }
        // ⚠️ Landed or not, the next lap starts: a full mat is never searched again on the ticks
        // between tries (each try is a push search, about a millisecond on a full mat).
        if (spawnBounty(random)) count++;
        q.clockMs -= every;
    }
    if (count >= cap) q.clockMs = 0;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Whether a report's metadata satisfies a quest. A quest narrows its target
 * with `match`, `enemyId` (hunts) or `itemId` (collections);
 * every value it names must be present and equal in the report.
 */
export function reportMatches(quest, metadata) {
    const wanted = { ...(quest.match || {}) };
    if (quest.enemyId) wanted.enemyId = quest.enemyId;
    if (quest.itemId) wanted.itemId = quest.itemId;
    return Object.entries(wanted).every(([k, v]) => metadata?.[k] === v);
}

/**
 * Advance every quest Token on the mat that counts `targetType`. A done quest
 * stops counting.
 */
export function reportProgress(targetType, amount = 1, metadata = {}) {
    for (const instance of questTokens()) {
        const quest = instance.quest;
        if (quest.done || quest.targetType !== targetType) continue;
        if (quest.type === 'collection') continue;   // follows the Bank instead
        if (!reportMatches(quest, metadata)) continue;
        const next = Math.min(quest.requiredCount, (quest.currentCount || 0) + amount);
        if (next === quest.currentCount) continue;
        quest.currentCount = next;
        quest.done = next >= quest.requiredCount;
        EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, { instanceId: instance.id });
    }
}

/** A collection bounty's count is what the Bank holds, capped. */
function syncCollection(quest) {
    if (quest?.type !== 'collection' || !quest.itemId) return false;
    const held = InventoryStore.getItems()?.[quest.itemId]?.quantity || 0;
    const next = Math.min(quest.requiredCount, held);
    const done = next >= quest.requiredCount;
    if (next === quest.currentCount && done === quest.done) return false;
    quest.currentCount = next;
    quest.done = done;
    return true;
}

/** Bring every collection bounty on the mat in line with the Bank. */
export function syncCollections() {
    for (const instance of questTokens()) {
        if (syncCollection(instance.quest)) EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, { instanceId: instance.id });
    }
}

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

/** Take a quest Token off the mat for good (claimed, dismissed, or an older save's tutorial step). */
function removeQuestToken(instance) {
    const at = Number.isFinite(instance.x) && Number.isFinite(instance.y) ? { x: instance.x, y: instance.y } : null;
    BoardState.removeToken(instance.id);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, ...(at || {}), typeId: null });
    if (at) EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
}

/**
 * **Claim quest Token `instanceId`.** Only when done. A collection bounty hands
 * its items over from the Bank first. The reward drops as loot beside the
 * Token, then the Token vanishes.
 *
 * @returns {{success: boolean, reason?: string, rewardItems?: object[]}}
 */
export function claimQuest(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!isQuestToken(instance)) return refuse('No quest there');
    const quest = instance.quest;
    syncCollection(quest);
    if (!quest.done) return refuse('Quest requirements not met yet');

    if (quest.type === 'collection' && quest.itemId) {
        const held = InventoryStore.getItems()?.[quest.itemId]?.quantity || 0;
        if (held < quest.requiredCount) {
            return refuse(`Need ${quest.requiredCount}× ${getItem(quest.itemId)?.name || quest.itemId}`);
        }
        InventoryManager.removeItem(quest.itemId, quest.requiredCount);
    }

    // The reward floats beside the quest, as the Hall's Passive Production does: collected
    // on hover, banked through InventoryManager. Dropped before the Token
    // leaves, since the drop is placed at its point.
    const rewardItems = questReward(quest);
    for (const r of rewardItems) SpriteLayer.addSprite('item', r.itemId, r.quantity, instance.id);

    removeQuestToken(instance);

    EventBus.publish(ENGINE_EVENTS.QUEST_CLAIMED, { questId: quest.id, instanceId, rewardItems });
    publishChanged(instanceId);
    return { success: true, rewardItems };
}

/** Whether a quest Token may be dismissed: every bounty may. */
export function canDismiss(instance) {
    return isQuestToken(instance);
}

/**
 * **Dismiss bounty `instanceId`**: it leaves the mat with no reward, and its
 * place is free for the timer's next bounty.
 *
 * @returns {{success: boolean, reason?: string}}
 */
export function dismissBounty(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    if (!isQuestToken(instance)) return refuse('No quest there');
    removeQuestToken(instance);
    publishChanged(instanceId);
    return { success: true };
}

/** Forget the runtime check state (tests). */
export function resetRuntime() {
    pending = true;
    checkedState = null;
}
