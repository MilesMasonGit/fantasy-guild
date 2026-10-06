// Fantasy Guild — Quest Tokens: quests live on the mat (B6.1: FB-41, FB-42, FB-43, TL-18)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { TimeBankManager } from '../core/TimeBankManager.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import * as BoardState from '../board/BoardState.js';
import * as EffectActions from '../board/EffectActions.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import * as TokenNotices from '../board/TokenNotices.js';
import { isGuildHall } from '../board/MatCap.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { matTuning } from '../../config/matTuning.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { GuildUpgradeManager } from '../progression/GuildUpgradeManager.js';
import { TUTORIAL_QUESTS, tutorialTemplate } from './tutorialQuests.js';
// The bounty and reward helpers come from the leaf `questBounties.js`, not
// QuestManager, so this module does not import QuestManager (CR3-023 group 3).
import { createRandomQuest, questReward, copyReward } from './questBounties.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

export { QUEST_TOKEN_TYPE };

/**
 * ⭐ **Quests are Tokens** (TL-18). The quest sidebar's slots are retired: the
 * Guild Hall spawns quest Tokens beside itself, and each carries its quest.
 *
 * ## The instance (saved with the board)
 * A quest Token is an ordinary instance of the engine-owned type
 * `token_quest` (`engineTokens.js`) with one extra field:
 *
 * ```js
 * instance.quest = {
 *   id, title, instruction?,          // what it says
 *   type?: 'hunt' | 'collection',     // bounties only
 *   targetType, match?, enemyId?, itemId?,   // what it counts (QuestManager's matching)
 *   requiredCount, currentCount,
 *   rewardItems: [{ itemId, quantity }],
 *   tutorial: boolean, step?,         // a tutorial step (FB-42)
 *   done: boolean                     // currentCount >= requiredCount
 * }
 * ```
 *
 * It is `origin: 'spawned'` (the Hall makes it, B6 quest spots), so it never
 * counts toward the mat's Token cap (`MatCap.placedCount`), and the player can
 * drag it like any Token. No hero works it (FB-41: no hero involved).
 *
 * ## Two kinds, two rules
 * * **Tutorial quests** (FB-42) — one at a time, a hidden cap of its own: the
 *   first stands on the mat in a new game, and claiming one brings the next.
 *   They ignore the bounty cap and the timer, and cannot be binned
 *   (`DiscardBin.canBin`).
 * * **Bounties** (FB-41, FB-43) — QuestManager's random hunts and collections.
 *   At most {@link questCap} on the mat (2, +1 per Notice Board rank, to 5);
 *   below the cap a new one arrives every `questEverySec` of game time (3 min).
 *   Binning and discarding one (B3's bin, no refund: it was spawned) frees its
 *   place, so the timer can bring another.
 *
 * ## ⚠️ The clock runs on the tick's `delta` (roadmap §0.3)
 * `state.quests.clockMs`, saved, advanced by {@link tick} from the game loop's
 * `quest_manager` handler, so the time bank and `DevTools.advanceTime` speed it
 * up. It **only runs below the cap**: at the cap it holds, and filling the cap
 * drops any leftover, so a freed place gets its next quest one full interval
 * later (director default, B6.1). The sidebar's `Date.now()` cooldowns are gone.
 *
 * ## Claiming (FB-41: click to claim, then it vanishes)
 * {@link claimQuest}: only when done. The reward drops as floating loot beside
 * the quest Token, exactly as the Hall's trickle pays (FB-53,
 * `SpriteLayer.addSprite` with the Token's id), and is banked when collected
 * through `InventoryManager` (D-138). The Token is then **removed** — not a
 * depletion: no `TOKEN_DEPLETED`, so no restock spot and no "when depleted"
 * rule.
 */

/**
 * Whether bounties arrive while the tutorial is still running. ⭐ Director
 * default for B6.1 (the brief: "tutorial quests don't use the 2-cap … after
 * the last tutorial step, only bounties remain"): yes, alongside. The old
 * sidebar offered no bounty until every tutorial step was done or offered;
 * set this to false to go back to that.
 */
export const BOUNTIES_DURING_TUTORIAL = true;

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

/** The bounty (non-tutorial) quest Tokens on the mat — what the cap counts. */
export function bountyTokens() {
    return questTokens().filter(t => !t.quest.tutorial);
}

/** The tutorial quest Tokens on the mat (normally one). */
export function tutorialTokens() {
    return questTokens().filter(t => t.quest.tutorial);
}

/**
 * ⭐ How many bounties the Hall keeps on the mat (TL-18): the Mat Tuner's
 * `questCap` (2) plus one per Notice Board rank, never above `questCapMax` (5).
 */
export function questCap() {
    const base = Math.round(matTuning('questCap'));
    const max = Math.round(matTuning('questCapMax'));
    const rank = GuildUpgradeManager.getRank('notice_board');
    return Math.max(0, Math.min(max, base + rank));
}

/** The bounty interval in game ms (Mat Tuner `questEverySec`, 3 min). */
export function questIntervalMs() {
    return Math.max(1000, Math.round(matTuning('questEverySec') * 1000));
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function questState() {
    const state = GameState.state;
    if (!state) return null;
    if (!state.quests || typeof state.quests !== 'object') {
        state.quests = { active: [], completedTutorials: [], tutorialStep: 0, clockMs: 0 };
    }
    const q = state.quests;
    if (!Array.isArray(q.active)) q.active = [];
    if (!Array.isArray(q.completedTutorials)) q.completedTutorials = [];
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

/** Whether every tutorial step has been claimed. */
export function tutorialChainDone() {
    const done = new Set(questState()?.completedTutorials || []);
    return TUTORIAL_QUESTS.every(t => done.has(t.id));
}

function guildHall() {
    return BoardState.tokens().find(isGuildHall) || null;
}

function publishChanged(instanceId = null) {
    EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, instanceId ? { instanceId } : {});
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, {});
}

// ---------------------------------------------------------------------------
// Making a quest
// ---------------------------------------------------------------------------

/** A quest object for tutorial `template`, keeping `currentCount` from `from`. */
function tutorialQuest(template, from = null) {
    const quest = {
        id: template.id,
        tutorial: true,
        step: template.step,
        title: template.title,
        instruction: template.instruction,
        targetType: template.targetType,
        requiredCount: template.requiredCount,
        currentCount: Math.min(Number(from?.currentCount) || 0, template.requiredCount),
        rewardItems: copyReward(template.rewardItems),
        done: false
    };
    if (template.match) quest.match = { ...template.match };
    quest.done = quest.currentCount >= quest.requiredCount;
    return quest;
}

/**
 * A quest object from one of QuestManager's bounties, or a saved sidebar
 * bounty (B6.1 migration). The sidebar's bookkeeping (`status`, `createdAt`,
 * `isTutorial`, a pre-2.2 reward Map) is left behind.
 */
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
 * ⭐ **Put a quest on the mat**: the Guild Hall spawns a `token_quest` beside
 * itself, through the same `EffectActions.spawn` (`nearest_free`) a spawner
 * uses — so it lands like any spawn, pushes only spawned Tokens, and is
 * `origin: 'spawned'`. Returns the new instance, or null when there is no Hall
 * or no room (the caller retries on a later tick).
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

    // A green notice, as a spawner's new Token gets (FB-48); not while the time
    // bank replays time away.
    if (!TimeBankManager.isSpending) TokenNotices.raiseNotice(instance.id, {
        type: 'token_spawned',
        title: quest.tutorial ? 'New tutorial quest' : 'New quest',
        rulesText: quest.title
    });
    EventBus.publish(ENGINE_EVENTS.QUEST_SPAWNED, { instanceId: instance.id, questId: quest.id, tutorial: !!quest.tutorial });
    publishChanged(instance.id);
    return instance;
}

/** Spawn one random bounty (QuestManager's pools). */
export function spawnBounty(random = Math.random) {
    const bounty = createRandomQuest(questTokens().map(t => t.quest));
    return bounty ? spawnQuest(bountyQuest(bounty), random) : null;
}

/**
 * The tutorial step to show next: the first not yet claimed. Null once the
 * chain is done.
 */
export function nextTutorialTemplate() {
    const done = new Set(questState()?.completedTutorials || []);
    return TUTORIAL_QUESTS.find(t => !done.has(t.id)) || null;
}

/**
 * ⭐ **The tutorial chain's hidden cap** (FB-42): while a step is left and no
 * tutorial quest stands on the mat, the next step arrives. So a new game
 * starts with the first, and claiming one brings the next.
 *
 * @returns {boolean} false when a step is owed but could not land (no Hall,
 *          no room) — the caller retries
 */
export function ensureTutorial() {
    if (tutorialTokens().length) return true;
    const template = nextTutorialTemplate();
    if (!template) return true;
    return !!spawnQuest(tutorialQuest(template));
}

// ---------------------------------------------------------------------------
// Saves: the sidebar's quests become Tokens (B6.1 migration)
// ---------------------------------------------------------------------------

/**
 * Re-read every tutorial quest Token from its template (a save keeps a copy,
 * which would keep a step's old wording and target for ever — as the sidebar
 * did in `refreshTutorialCopies`). A tutorial Token whose step the chain no
 * longer has is taken off the mat.
 */
export function refreshTutorialTokens() {
    let changed = false;
    const refreshed = [];
    for (const instance of tutorialTokens()) {
        const template = tutorialTemplate(instance.quest.id);
        if (!template) {
            removeQuestToken(instance);
            changed = true;
            continue;
        }
        instance.quest = tutorialQuest(template, instance.quest);
        refreshed.push(instance.id);
    }
    // Each refreshed copy says so by id (CR3-304: a quest Token hears its own
    // QUESTS_UPDATED, not the catch-all state_changed).
    for (const instanceId of refreshed) EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, { instanceId });
    if (changed) publishChanged();
}

/**
 * ⭐ **Convert a save's sidebar quests into quest Tokens** (B6.1). Each active
 * quest in `state.quests.active` — tutorial or bounty — lands beside the Hall
 * as a quest Token **with its progress**; an abandoned slot (a cooldown
 * placeholder) is dropped, and so is a tutorial step the chain no longer has.
 * A quest that finds no room stays in `active` and is tried again later.
 *
 * A save made mid-tutorial therefore carries its current step (and any other
 * steps the sidebar had offered alongside it — up to three) onto the mat.
 * Claiming them does not bring a new step until the last one is claimed, so
 * the chain settles back to one at a time.
 *
 * @returns {boolean} true once `active` is empty
 */
export function migrateSidebarQuests() {
    const q = questState();
    if (!q || !q.active.length) return true;
    if (!guildHall()) return false;
    const onMat = new Set(questTokens().map(t => t.quest.id));
    const done = new Set(q.completedTutorials);
    const left = [];
    for (const old of q.active) {
        if (!old || old.status === 'abandoned') continue;
        if (onMat.has(old.id)) continue;
        let quest = null;
        if (old.isTutorial) {
            const template = tutorialTemplate(old.id);
            if (!template || done.has(old.id)) continue;
            quest = tutorialQuest(template, old);
        } else if (old.targetType) {
            quest = bountyQuest(old);
        }
        if (!quest) continue;
        if (spawnQuest(quest)) onMat.add(quest.id);
        else left.push(old);
    }
    q.active = left;
    return left.length === 0;
}

// ---------------------------------------------------------------------------
// The check (load, new game, claim) and the tick
// ---------------------------------------------------------------------------

/** Set when something may be owed (a tutorial step, a migration); cleared once met. */
let pending = true;
/** The state the last check ran against: a load or a new game swaps it. */
let checkedState = null;

/** Ask for a check on the next tick (a load, a new game, a claim). */
export function requestCheck() {
    pending = true;
}

/**
 * Bring the mat up to what is owed: migrate a save's sidebar quests, refresh
 * tutorial copies, and make sure the tutorial chain has its quest out.
 * Idempotent. Returns true when nothing is left owing.
 */
export function ensure() {
    const q = questState();
    if (!q) return false;
    checkedState = GameState.state;
    q.tutorialStep = q.completedTutorials.filter(id => tutorialTemplate(id)).length;
    const migrated = migrateSidebarQuests();
    refreshTutorialTokens();
    const tutorial = ensureTutorial();
    pending = !(migrated && tutorial);
    return !pending;
}

/**
 * ⭐ **One tick** (`quest_manager`, with the loop's time-scaled `delta`).
 *
 * 1. Anything owed (see {@link ensure}) is retried — only while something is.
 * 2. The bounty clock: below the cap it advances by `delta`, and each full
 *    interval brings one bounty (closed form, so one big tick equals many
 *    small ones). A bounty with nowhere to land holds the clock full and is
 *    retried next tick. At the cap the clock holds; reaching it drops the
 *    leftover.
 *
 * Cost per tick: one pass over the mat's Tokens to count bounties.
 */
export function tick(delta, random = Math.random) {
    if (GameState.state !== checkedState) pending = true;
    if (pending) ensure();
    if (!(delta > 0)) return;
    if (!BOUNTIES_DURING_TUTORIAL && !tutorialChainDone()) return;

    const q = questState();
    if (!q) return;
    const cap = questCap();
    let count = bountyTokens().length;
    if (count >= cap) return;

    const every = questIntervalMs();
    q.clockMs += delta;
    while (q.clockMs >= every && count < cap) {
        if (!spawnBounty(random)) {
            q.clockMs = every;
            return;
        }
        q.clockMs -= every;
        count++;
    }
    if (count >= cap) q.clockMs = 0;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Whether a report's metadata satisfies a quest. A quest narrows its target
 * with `match` (tutorial steps), `enemyId` (hunts) or `itemId` (collections);
 * every value it names must be present and equal in the report. (Moved here
 * from QuestManager with the sidebar, unchanged.)
 */
export function reportMatches(quest, metadata) {
    const wanted = { ...(quest.match || {}) };
    if (quest.enemyId) wanted.enemyId = quest.enemyId;
    if (quest.itemId) wanted.itemId = quest.itemId;
    return Object.entries(wanted).every(([k, v]) => metadata?.[k] === v);
}

/**
 * Advance every quest Token on the mat that counts `targetType` (the same
 * reports QuestManager has always made). A done quest stops counting.
 */
export function reportProgress(targetType, amount = 1, metadata = {}) {
    let changed = null;
    for (const instance of questTokens()) {
        const quest = instance.quest;
        if (quest.done || quest.targetType !== targetType) continue;
        if (quest.type === 'collection') continue;   // follows the Bank instead
        if (!reportMatches(quest, metadata)) continue;
        const next = Math.min(quest.requiredCount, (quest.currentCount || 0) + amount);
        if (next === quest.currentCount) continue;
        quest.currentCount = next;
        quest.done = next >= quest.requiredCount;
        changed = changed === null ? instance.id : changed;
        EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, { instanceId: instance.id });
    }
    if (changed !== null) EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, {});
}

/** A collection bounty's count is what the Bank holds, capped (unchanged rule). */
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
    let changed = false;
    for (const instance of questTokens()) {
        if (syncCollection(instance.quest)) {
            changed = true;
            EventBus.publish(ENGINE_EVENTS.QUESTS_UPDATED, { instanceId: instance.id });
        }
    }
    if (changed) EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, {});
}

// ---------------------------------------------------------------------------
// Claiming
// ---------------------------------------------------------------------------

/** Take a quest Token off the mat for good (claimed, or a dropped old step). */
function removeQuestToken(instance) {
    const at = Number.isFinite(instance.x) && Number.isFinite(instance.y) ? { x: instance.x, y: instance.y } : null;
    BoardState.removeToken(instance.id);
    TokenNotices.clearNotice(instance.id);
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, ...(at || {}), typeId: null });
    if (at) EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
}

/**
 * ⭐ **Claim quest Token `instanceId`** (FB-41). Only when done. A collection
 * bounty hands its items over from the Bank first. The reward drops as loot
 * beside the Token (FB-53), then the Token vanishes. Claiming a tutorial step
 * records it and brings the next (FB-42).
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

    // The reward floats beside the quest, as the Hall's trickle does (FB-53):
    // collected on hover, banked through InventoryManager (D-138). Dropped
    // before the Token leaves, since the drop is placed at its point.
    const rewardItems = questReward(quest);
    for (const r of rewardItems) SpriteLayer.addSprite('item', r.itemId, r.quantity, instance.id);

    removeQuestToken(instance);

    const q = questState();
    if (quest.tutorial && q) {
        if (!q.completedTutorials.includes(quest.id)) q.completedTutorials.push(quest.id);
        q.tutorialStep = q.completedTutorials.filter(id => tutorialTemplate(id)).length;
        if (!ensureTutorial()) pending = true;
    }

    EventBus.publish(ENGINE_EVENTS.QUEST_CLAIMED, { questId: quest.id, instanceId, tutorial: !!quest.tutorial, rewardItems });
    publishChanged(instanceId);
    return { success: true, rewardItems };
}

/**
 * Advance the bounty clock by `ms` of game time, as the loop would (probe for
 * the director and tests; one call, closed form).
 */
export function advanceClock(ms) {
    tick(ms);
    return clockMs();
}

/** Forget the runtime check state (tests). */
export function resetRuntime() {
    pending = true;
    checkedState = null;
}
