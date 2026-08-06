import { QuestBoardSystem } from './QuestBoardSystem.js';

/**
 * QuestTracker — the event fan-out for the quest system.
 *
 * ## Status after the 7×7 playmat rework: DORMANT (roadmap G-9)
 * §12 of the grid concept says quests "may be cut" but has not decided, so the
 * quest system is **muted rather than deleted**: `QuestBoardSystem` keeps its
 * tick removed and its UI hidden, and this fan-out short-circuits. Nothing is
 * lost; nothing runs.
 *
 * `processEvent` is still called from live code paths — `InventoryManager` on
 * every item gained, and combat on every kill — so it must stay cheap and it
 * must not throw. It is a single flag check.
 *
 * ## What was deleted here, and why it is different from "dormant"
 * This class used to carry the **area unlock quest** machinery: `_processUnlockQuests`,
 * `completeUnlockQuestManual` and `_completeUnlockQuest`, all keyed on locked
 * areas, `areaSet.unlockQuestIds` and `areaStates[…].unlockQuestProgress`.
 *
 * That is not dormant — it is **deleted**. Grid concept §10.1 lists "area unlock
 * quests" explicitly among the things the rework removes, and with no areas
 * there is nothing for them to unlock. Only the *procedural quest board* is
 * being held in reserve.
 *
 * ⚠️ Note for whoever resolves §12: the quest board is itself **area-scoped** —
 * boards are per area and `QuestBoardSystem` reads `getAllAreaSets()`
 * throughout. Reviving it for the board is a rework, not a switch-on.
 *
 * @see playmat_roadmap_v1.md Phase 1 §F, Appendix A-2
 */

/**
 * Master switch. Flip to `true` (and restore the tick in `EngineBootstrap`)
 * to bring the quest board back — after reworking it off areas.
 */
export const QUESTS_ENABLED = false;

class QuestTrackerClass {
    /**
     * Route a gameplay event to any system that tracks progress against it.
     *
     * Called from hot paths (every item gained, every kill), so the disabled
     * case does no work at all.
     */
    processEvent(eventType, payload) {
        if (!QUESTS_ENABLED) return;
        QuestBoardSystem.processEvent(eventType, payload);
    }
}

export const QuestTracker = new QuestTrackerClass();
