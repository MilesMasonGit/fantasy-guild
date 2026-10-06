// Fantasy Guild - Quest Manager
// Hears the game's events and reports quest progress; generates bounties and
// works out rewards. The quests themselves are Tokens on the mat: see QuestTokens.js.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { tutorialTemplate } from './tutorialQuests.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as RecipeResolver from '../board/RecipeResolver.js';
// One way only: QuestTokens does not import this module, so the bounty and
// reward helpers live in the leaf `questBounties.js` and are re-exported below.
import * as QuestTokens from './QuestTokens.js';
import { createRandomQuest } from './questBounties.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../core/engineEvents.js';

export {
    BOUNTY_REWARD_ITEMS, copyReward, questReward, RANDOM_ITEMS, RANDOM_HUNTS
} from './questBounties.js';

/**
 * Quests are Tokens the Guild Hall spawns (`QuestTokens.js`), which own the cap,
 * the game-time clock, the tutorial chain, claiming and saves. This manager
 * keeps what does not care where a quest is:
 *
 * * the event subscriptions, counted on the quest Tokens
 *   (`QuestTokens.reportProgress`);
 * * bounty generation ({@link QuestManager.createRandomQuest}; the pools and
 *   the generator live in `questBounties.js`);
 * * the reward rule (`questReward`, also in `questBounties.js`).
 *
 * `state.quests.active` is read once, by the migration that turns a save's
 * sidebar quests into Tokens, and is then empty.
 */

let unsubs = [];
let initialized = false;

export const QuestManager = {
    init() {
        if (initialized) return;
        this.ensureState();
        this.setupListeners();
        QuestTokens.requestCheck();
        QuestTokens.ensure();
        initialized = true;
    },

    cleanup() {
        unsubs.forEach(unsub => unsub?.());
        unsubs = [];
        initialized = false;
        QuestTokens.resetRuntime();
    },

    ensureState() {
        if (!GameState.state) return;
        if (!GameState.state.quests) {
            GameState.state.quests = {
                active: [],
                completedTutorials: [],
                tutorialStep: 0,
                clockMs: 0
            };
        }
        const q = GameState.state.quests;
        // `active` holds only a save's sidebar quests waiting to be turned into
        // quest Tokens (`QuestTokens.migrateSidebarQuests`).
        if (!Array.isArray(q.active)) q.active = [];
        // A save from before the list existed kept only a step number, which maps
        // onto nothing now.
        if (!Array.isArray(q.completedTutorials)) q.completedTutorials = [];
        // The bounty clock, in game ms.
        if (!Number.isFinite(q.clockMs)) q.clockMs = 0;
        // Counts only steps the chain still has: an old save's `tutorial_N`
        // ids stay in the list, harmless, and count for nothing.
        q.tutorialStep = q.completedTutorials.filter(id => tutorialTemplate(id)).length;
    },

    /**
     * The quests on the mat, as the live quest objects on their Tokens. Each
     * Token's instance id is `QuestTokens.questTokens()[i].id`.
     */
    getActiveQuests() {
        this.ensureState();
        return QuestTokens.questTokens().map(t => t.quest);
    },

    getTutorialStep() {
        this.ensureState();
        return GameState.state?.quests?.tutorialStep || 0;
    },

    /**
     * Asks `QuestTokens` to bring the mat up to what is owed (a save's quests,
     * the tutorial step).
     */
    ensureQuests() {
        this.ensureState();
        QuestTokens.ensure();
    },

    setupListeners() {
        unsubs.push(
            // A new game or a load: the mat is checked on the next tick too
            // (a new game's Guild Hall lands after this subscriber runs).
            EventBus.subscribe(UI_EVENTS.REACT_SLOT_SELECTED, () => {
                QuestTokens.requestCheck();
                this.ensureQuests();
            }),
            EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => {
                QuestTokens.requestCheck();
                this.ensureQuests();
            }),
            // ⚠️ One event per player action, and only one. A quest counter must hear
            // about an action exactly once, and `Placement` publishes both a semantic
            // event (`TOKEN_PLACED`, `hero_deployed`) and a board-lifecycle one
            // (`TILE_CHANGED`, `HERO_MOVED`) for a single action. The lifecycle events
            // exist to redraw the UI (`TILE_CHANGED` also fires for clearing,
            // depletion, pushes, restocks, grows and turns), so the semantic event is
            // the quest signal. Do not add a second source back.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_PLACED, (data) => {
                this.reportProgress('token_placed', 1, { typeId: data?.typeId });
                if (data?.instanceId != null && data?.typeId) {
                    const def = getTokenType(data.typeId);
                    // The event names the placed Token by instance id.
                    const serves = RecipeResolver.servesFrom(data.instanceId);
                    if (serves.length > 0 || def?.tokenType === 'context' || (def?.provides && def.provides.length > 0)) {
                        this.reportProgress('context_token_placed');
                    }
                }
            }),
            // A Shop purchase. It also lands the Token through `placeTokenAt`, which
            // raised `TOKEN_PLACED` above: two different targets, not one action
            // counted twice.
            EventBus.subscribe(ENGINE_EVENTS.TOKEN_PURCHASED, (data) => {
                this.reportProgress('token_purchased', 1, { typeId: data?.typeId });
            }),
            // A Foundation became what it built, or Farmland what was planted
            // (published by `BoardRunner`).
            EventBus.subscribe(BOARD_EVENTS.TOKEN_BUILT, (data) => {
                this.reportProgress('token_built', 1, { typeId: data?.typeId, fromTypeId: data?.fromTypeId });
            }),
            EventBus.subscribe(ENGINE_EVENTS.HERO_DEPLOYED, () => this.reportProgress('hero_deployed')),
            // A finished cycle: gathering, crafting, exploring, a kill. A failed
            // cycle counts for nothing. The Token's type and skill, and each item it
            // made, let a step ask for one kind of work.
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (data) => {
                if (data?.failed) return;
                const skill = getTokenType(data?.typeId)?.config?.skill || null;
                this.reportProgress('cycle_completed', 1, { typeId: data?.typeId, skill });
                for (const itemId of new Set(data?.produced || [])) {
                    this.reportProgress('item_produced', 1, { itemId });
                }
            }),
            EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, (data) => {
                const qty = data?.quantity || 1;
                if (data?.kind === 'item') {
                    this.reportProgress('loot_collected', qty);
                    if (data?.refId) {
                        this.reportProgress('item_collected', qty, { itemId: data.refId });
                    }
                }
            }),
            EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, () => this.syncInventoryQuests()),
            EventBus.subscribe(ENGINE_EVENTS.HERO_RECRUITED, () => this.reportProgress('hero_recruited')),
            EventBus.subscribe(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, (data) => {
                this.reportProgress('guild_upgrade_purchased');
                if (data?.upgradeId === 'wishing_well') {
                    this.reportProgress('wishing_well_upgraded');
                }
            }),
            // ⚠️ `ui_modal:opened` comes from the React layer, not the engine: its only
            // publisher is `src/ui/hooks/useUIModals.js`, whose header carries the
            // contract, including that any NEW route into the Bank or the Shop must
            // publish it too or these quest targets silently stall. The Shop is the
            // `cartographer` pane.
            EventBus.subscribe(UI_EVENTS.UI_MODAL_OPENED, (data) => {
                if (data?.modalId === 'bank') this.reportProgress('open_bank');
                else if (data?.modalId === 'cartographer') this.reportProgress('open_cartographer');
            }),
            // ⚠️ Retired events that must not come back (`QuestTutorialChain.test.js`
            // fails if one does): `map_burst` / `map_opened` / `map_purchased`,
            // `vault_withdrawn` / `vault_deposited` / `loot_token_placed` and the
            // `vault` modal, and `board_recall` / `return_to_tray`.
            //
            // ⚠️ `hero_equipped` is NOT an engine event. Equipping is announced as
            // `hero_equipment_changed` with `action: 'equip'`, which feeds the
            // `hero_equipped` quest target.
            EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (data) => {
                if (data?.action === 'equip') this.reportProgress('hero_equipped');
            }),
            // ⚠️ `token_exhausted` is a quest TARGET name and a tile-log entry type,
            // NOT an engine event; `BOARD_EVENTS.TOKEN_DEPLETED` is the one that
            // should report here.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => this.reportProgress('token_exhausted')),
            EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (data) => {
                this.reportProgress('combat_victory');
                if (data?.enemyId) {
                    this.reportProgress('enemy_hunted', 1, { enemyId: data.enemyId });
                }
            })
        );
    },

    /** Collection bounties follow the Bank. */
    syncInventoryQuests() {
        this.ensureState();
        QuestTokens.syncCollections();
    },

    /** Count one report against every quest Token on the mat that wants it. */
    reportProgress(targetType, amount = 1, metadata = {}) {
        this.ensureState();
        QuestTokens.reportProgress(targetType, amount, metadata);
    },

    /**
     * The game loop's `quest_manager` handler, with its time-scaled `delta`:
     * the quest Tokens' clock. Bank syncing follows `inventory_updated`, not the tick.
     */
    tick(deltaMs) {
        this.ensureState();
        QuestTokens.tick(deltaMs);
    },

    /**
     * One random bounty's content (not yet on the mat). Hunts and collections
     * are balanced against `existing` — the quests already out.
     */
    createRandomQuest(existing = QuestTokens.questTokens().map(t => t.quest)) {
        return createRandomQuest(existing);
    },

    /**
     * ⚠️ Retired with the sidebar: a bounty is discarded by dragging its Token
     * to the bin, with no cooldown. This only returns a refusal and has no caller.
     */
    abandonQuest(questId) {
        const token = findQuestToken(questId);
        if (token?.quest?.tutorial) return { success: false, reason: 'Tutorial quests cannot be abandoned' };
        return { success: false, reason: 'Drag a quest to the bin to discard it' };
    },

    /**
     * Claim a quest by its quest id or its Token's instance id; see
     * `QuestTokens.claimQuest` (the reward drops as loot beside the Token, and
     * the Token vanishes).
     */
    // eslint-disable-next-line no-unused-vars
    claimQuest(questId, sourceRect = null) {
        this.ensureState();
        const token = findQuestToken(questId);
        if (!token) return { success: false, reason: 'Quest not found' };
        return QuestTokens.claimQuest(token.id);
    }
};

/** The quest Token on the mat with instance id or quest id `id`, or null. */
function findQuestToken(id) {
    if (!id) return null;
    return QuestTokens.questTokens().find(t => t.id === id || t.quest?.id === id) || null;
}
