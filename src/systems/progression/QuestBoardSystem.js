import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';
import { getAllAreaSets, getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { getCard } from '../../config/registries/cardRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { ProgressionSystem } from './ProgressionSystem.js';
import { GuildUpgradeManager } from './GuildUpgradeManager.js';
import {
    QUEST_REFRESH_MS, INSTANT_REFRESH_BASE, INSTANT_REFRESH_GROWTH,
    BASE_QUEST_SLOTS, GATHER_VALUE_BUDGET, GATHER_MIN, GATHER_MAX,
    DEFEAT_KILL_BUDGET, DEFEAT_MIN, DEFEAT_MAX,
    REWARD_MARGIN, DEFEAT_GOLD_PER_KILL_LEVEL, BONUS_ITEM_CHANCE,
    getUnlockThreshold
} from '../../config/questConfig.js';

/**
 * QuestBoardSystem — Quest System v2 (quest_system_concept.md).
 *
 * Each LOCKED area runs a quest board: Main Story Quests (authored in the
 * area set's `unlockQuestIds`, tracked by QuestTracker) claim slots first;
 * the remaining capacity holds PROCEDURAL gather/defeat quests generated
 * from the possible outputs/enemies of every UNLOCKED area's card pool.
 *
 * Unlock = all MSQs turned in AND `completed` >= the area's threshold.
 * One global refresh clock fills empty procedural slots; Abandon All empties
 * them (slots then wait for the timer or a paid instant refresh).
 */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const QuestBoardSystem = {
    init() {
        logger.info('QuestBoard', 'Quest boards ready (v2 — procedural + MSQ slots)');
    },

    /**
     * GameLoop hook. Seeding is done here (not init) because new games and
     * loads REPLACE GameState.state wholesale — the tick self-heals any
     * unseeded board so first-run players aren't staring at empty slots for
     * a whole refresh cycle.
     */
    tick() {
        this._ensureState();
        const qb = this._qb();
        if (!qb) return;
        if (!qb.seeded) {
            this._fillAllBoards();
            qb.seeded = true;
        }
        if (Date.now() >= qb.refreshAt) {
            qb.refreshAt = Date.now() + QUEST_REFRESH_MS;
            qb.instantRefreshUses = 0;
            this._fillAllBoards();
            logger.debug('QuestBoard', 'Natural quest refresh');
        }
    },

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    _qb() {
        return GameState.state?.questBoard || null;
    },

    _ensureState() {
        const state = GameState.state;
        if (!state) return;
        if (!state.questBoard) {
            state.questBoard = {
                refreshAt: Date.now() + QUEST_REFRESH_MS,
                instantRefreshUses: 0,
                seeded: false,
                areas: {}
            };
        }
        const qb = state.questBoard;
        if (!qb.areas) qb.areas = {};
        for (const areaId of this._lockedAreaIds()) {
            if (!qb.areas[areaId]) {
                qb.areas[areaId] = { completed: 0, slots: [] };
            }
        }
    },

    _lockedAreaIds() {
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        return Object.keys(getAllAreaSets()).filter(id => !unlocked.includes(id));
    },

    _board(areaId) {
        this._ensureState();
        return this._qb()?.areas?.[areaId] || null;
    },

    // ------------------------------------------------------------------
    // Capacity: MSQs claim slots first (concept §2)
    // ------------------------------------------------------------------

    getSlotCount() {
        return Math.min(12, BASE_QUEST_SLOTS + GuildUpgradeManager.getRank('quest_slots'));
    },

    /** MSQ ids for an area that are NOT yet turned in. */
    getOpenMsqIds(areaId) {
        const areaSet = getAreaSet(areaId);
        const msqIds = areaSet?.unlockQuestIds || [];
        const done = GameState.state?.areaStates?.[areaId]?.completedQuestIds || [];
        return msqIds.filter(id => !done.includes(id));
    },

    /** Procedural capacity = slots not claimed by open MSQs. */
    getProceduralCapacity(areaId) {
        return Math.max(0, this.getSlotCount() - this.getOpenMsqIds(areaId).length);
    },

    // ------------------------------------------------------------------
    // Generation (concept §4)
    // ------------------------------------------------------------------

    /** Gather/defeat candidates from every UNLOCKED area's card pool. */
    _buildPool() {
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        const items = new Set();
        const enemies = new Set();
        for (const areaId of unlocked) {
            const areaSet = getAreaSet(areaId);
            for (const poolEntry of areaSet?.cardPool || []) {
                const card = getCard(poolEntry.cardId);
                if (!card) continue;
                const cfg = card.config || {};
                if (cfg.enemyId) enemies.add(cfg.enemyId);
                for (const out of cfg.outputs || []) {
                    if (out.itemId && getItem(out.itemId)) items.add(out.itemId);
                    if (out.enemyId && getEnemy(out.enemyId)) enemies.add(out.enemyId);
                }
            }
        }
        return {
            items: [...items],
            enemies: [...enemies].filter(id => getEnemy(id))
        };
    },

    _generateQuest(pool, taken) {
        const candidates = [
            ...pool.items.map(id => ({ type: 'gather', targetId: id })),
            ...pool.enemies.map(id => ({ type: 'defeat', targetId: id }))
        ].filter(c => !taken.has(`${c.type}:${c.targetId}`));
        // Pool exhausted for uniques — allow repeats rather than starving slots.
        const pick = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : null;
        if (!pick) return null;
        taken.add(`${pick.type}:${pick.targetId}`);

        const quest = {
            id: `pq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            type: pick.type,
            targetId: pick.targetId,
            required: 1,
            progress: 0,
            gold: 0,
            bonusItemId: null
        };

        if (pick.type === 'gather') {
            const value = Math.max(1, getItem(pick.targetId)?.baseValue || 1);
            quest.required = clamp(Math.round(GATHER_VALUE_BUDGET / value), GATHER_MIN, GATHER_MAX);
            quest.gold = Math.ceil(value * quest.required * REWARD_MARGIN);
        } else {
            const level = Math.max(1, getEnemy(pick.targetId)?.level || 1);
            quest.required = clamp(Math.round(DEFEAT_KILL_BUDGET / level), DEFEAT_MIN, DEFEAT_MAX);
            quest.gold = Math.ceil(level * quest.required * DEFEAT_GOLD_PER_KILL_LEVEL);
        }

        if (pool.items.length > 0 && Math.random() < BONUS_ITEM_CHANCE) {
            quest.bonusItemId = pool.items[Math.floor(Math.random() * pool.items.length)];
        }
        return quest;
    },

    /** Fill every empty procedural slot on every locked board. */
    _fillAllBoards() {
        this._ensureState();
        const qb = this._qb();
        if (!qb) return;
        const pool = this._buildPool();

        for (const areaId of this._lockedAreaIds()) {
            const board = qb.areas[areaId];
            if (!board) continue;
            const capacity = this.getProceduralCapacity(areaId);

            // Normalize slot array to capacity (capacity only ever grows —
            // MSQ completion and slot upgrades both add room).
            while (board.slots.length < capacity) board.slots.push(null);
            if (board.slots.length > capacity) board.slots.length = capacity;

            const taken = new Set(
                board.slots.filter(Boolean).map(q => `${q.type}:${q.targetId}`)
            );
            for (let i = 0; i < board.slots.length; i++) {
                if (!board.slots[i]) board.slots[i] = this._generateQuest(pool, taken);
            }
        }
        EventBus.publish('quest_board_updated');
    },

    // ------------------------------------------------------------------
    // Progress + turn-in (concept §5)
    // ------------------------------------------------------------------

    /** Fan-out from QuestTracker.processEvent: advance defeat quests. */
    processEvent(eventType, payload) {
        if (eventType !== 'ON_ENEMY_KILLED') return;
        const qb = this._qb();
        if (!qb) return;
        let changed = false;
        for (const board of Object.values(qb.areas)) {
            for (const q of board.slots) {
                if (q && q.type === 'defeat' && q.targetId === payload.enemyId && q.progress < q.required) {
                    q.progress += 1;
                    changed = true;
                }
            }
        }
        if (changed) EventBus.publish('quest_board_updated');
    },

    /** Live progress for display / turn-in checks. */
    getQuestProgress(quest) {
        if (!quest) return 0;
        if (quest.type === 'gather') {
            return Math.min(quest.required, InventoryManager.getItemCount(quest.targetId));
        }
        return Math.min(quest.required, quest.progress || 0);
    },

    /** Turn in a completed procedural quest: consume/reward/count/free slot. */
    turnIn(areaId, slotIndex) {
        const board = this._board(areaId);
        const quest = board?.slots?.[slotIndex];
        if (!quest) return { success: false, error: 'No quest in that slot' };
        if (this.getQuestProgress(quest) < quest.required) {
            return { success: false, error: 'Quest is not complete yet' };
        }

        if (quest.type === 'gather') {
            if (InventoryManager.getItemCount(quest.targetId) < quest.required) {
                return { success: false, error: 'Items missing' }; // race guard
            }
            InventoryManager.removeItem(quest.targetId, quest.required);
        }

        CurrencyManager.addGold(quest.gold, 'quest_reward');
        if (quest.bonusItemId) InventoryManager.addItem(quest.bonusItemId, 1, 'quest_bonus');

        board.completed = (board.completed || 0) + 1;
        board.slots[slotIndex] = null;

        logger.info('QuestBoard', `Quest turned in for ${areaId} (+${quest.gold}g) — ${board.completed} completed`);
        EventBus.publish('quest_board_updated');
        EventBus.publish('quest_completed', { areaId, procedural: true });
        this.checkUnlock(areaId);
        return { success: true, gold: quest.gold, bonusItemId: quest.bonusItemId };
    },

    // ------------------------------------------------------------------
    // Controls (concept §3)
    // ------------------------------------------------------------------

    /** Abandon EVERY procedural quest on EVERY board. MSQs untouched. */
    abandonAll() {
        const qb = this._qb();
        if (!qb) return;
        for (const board of Object.values(qb.areas)) {
            board.slots = board.slots.map(() => null);
        }
        logger.info('QuestBoard', 'All procedural quests abandoned');
        EventBus.publish('quest_board_updated');
    },

    getInstantRefreshCost() {
        const uses = this._qb()?.instantRefreshUses || 0;
        return Math.round(INSTANT_REFRESH_BASE * Math.pow(INSTANT_REFRESH_GROWTH, uses));
    },

    /** Pay gold to fill empty slots NOW. Does not touch the natural timer. */
    instantRefresh() {
        const qb = this._qb();
        if (!qb) return { success: false, error: 'No quest board' };
        const cost = this.getInstantRefreshCost();
        if (!CurrencyManager.spendGold(cost, 'quest_refresh')) {
            return { success: false, error: `Not enough gold (${cost} needed)` };
        }
        qb.instantRefreshUses += 1;
        this._fillAllBoards();
        logger.info('QuestBoard', `Instant quest refresh paid (${cost}g)`);
        return { success: true, cost };
    },

    // ------------------------------------------------------------------
    // Unlock (concept §1)
    // ------------------------------------------------------------------

    getUnlockProgress(areaId) {
        const board = this._board(areaId);
        const threshold = getUnlockThreshold(getAreaSet(areaId));
        return { completed: board?.completed || 0, threshold };
    },

    /** Both gates: all MSQs done AND the procedural counter at threshold. */
    checkUnlock(areaId) {
        const { completed, threshold } = this.getUnlockProgress(areaId);
        if (completed < threshold) return false;
        if (this.getOpenMsqIds(areaId).length > 0) return false;

        const unlocked = ProgressionSystem.unlockArea(areaId);
        if (unlocked) {
            const qb = this._qb();
            if (qb?.areas?.[areaId]) delete qb.areas[areaId];
            EventBus.publish('ui:open_area_unlock_overlay', { areaId });
            EventBus.publish('quest_board_updated');
        }
        return unlocked;
    }
};

export default QuestBoardSystem;
