// Fantasy Guild - Quest Manager
// Hears the game's events and reports quest progress; generates bounties and
// works out rewards. The quests themselves are Tokens on the mat since B6.1
// (TL-18): see QuestTokens.js.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { tutorialTemplate } from './tutorialQuests.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as RecipeResolver from '../board/RecipeResolver.js';
// One way only: QuestTokens no longer imports this module (it took the bounty
// and reward helpers from here, which formed a cycle; CR3-023 group 3). They
// live in the leaf `questBounties.js` and are re-exported below.
import * as QuestTokens from './QuestTokens.js';
import { createRandomQuest } from './questBounties.js';

export {
    BOUNTY_REWARD_ITEMS, copyReward, questReward, RANDOM_ITEMS, RANDOM_HUNTS
} from './questBounties.js';

/**
 * ⭐ **B6.1 (TL-18, FB-41–FB-43): the sidebar's slots are retired.** Quests are
 * Tokens the Guild Hall spawns (`QuestTokens.js`), which own the cap, the
 * game-time clock, the tutorial chain, claiming and saves. This manager keeps
 * what does not care where a quest is:
 *
 * * **the event subscriptions** — every report it has always made, now
 *   counted on the quest Tokens (`QuestTokens.reportProgress`);
 * * **bounty generation** ({@link QuestManager.createRandomQuest}; the pools
 *   and the generator itself live in `questBounties.js`, CR3-023);
 * * **the reward rule** (`questReward`, also in `questBounties.js`).
 *
 * Gone: `MAX_ACTIVE_QUESTS`, the instant refill, the `Date.now()` abandon
 * cooldown (`ABANDON_COOLDOWN_MS`, `status: 'abandoned'` slots) and
 * `generateRandomQuest`. `state.quests.active` is read once more, by the
 * migration that turns a save's sidebar quests into Tokens, and is then empty.
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
        // Since B6.1 `active` holds only a save's sidebar quests waiting to be
        // turned into quest Tokens (`QuestTokens.migrateSidebarQuests`).
        if (!Array.isArray(q.active)) q.active = [];
        // A save from before the list existed kept only a step number. The
        // chain it counted is gone (9.5), so the number maps onto nothing.
        if (!Array.isArray(q.completedTutorials)) q.completedTutorials = [];
        // The bounty clock, in game ms (B6.1); replaces `nextQuestAt`.
        if (!Number.isFinite(q.clockMs)) q.clockMs = 0;
        // Counts only steps the chain still has: an old save's `tutorial_N`
        // ids stay in the list, harmless, and count for nothing.
        q.tutorialStep = q.completedTutorials.filter(id => tutorialTemplate(id)).length;
    },

    /**
     * The quests on the mat, as the live quest objects on their Tokens
     * (B6.1). Each Token's instance id is `QuestTokens.questTokens()[i].id`.
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
     * Kept for the sidebar, which calls it on mount until B6.2 removes it. It
     * no longer fills slots: it asks `QuestTokens` to bring the mat up to what
     * is owed (a save's quests, the tutorial step).
     */
    ensureQuests() {
        this.ensureState();
        QuestTokens.ensure();
    },

    setupListeners() {
        unsubs.push(
            // A new game or a load: the mat is checked on the next tick too
            // (a new game's Guild Hall lands after this subscriber runs).
            EventBus.subscribe('react:slot_selected', () => {
                QuestTokens.requestCheck();
                this.ensureQuests();
            }),
            EventBus.subscribe('game_loaded', () => {
                QuestTokens.requestCheck();
                this.ensureQuests();
            }),
            // ⚠️ **One event per player action, and only one** (CR2-085, tidied
            // 2026-08-25 alongside the CR2-055/CR2-177 event fix).
            //
            // A quest counter must hear about an action exactly once. This block
            // used to subscribe to a *pair* of events for each of the two board
            // actions — the semantic one (`TOKEN_PLACED`, `hero_deployed`) and a
            // board-lifecycle one (`TILE_CHANGED`, `HERO_MOVED`) — and
            // `Placement` publishes both members of each pair for a single
            // action, so every counter advanced by 2.
            //
            // The lifecycle events exist to redraw the UI, not to describe what
            // the player did: `TILE_CHANGED` also fires for clearing, depletion,
            // pushes, restocks, grows and turns. So the semantic event is the
            // quest signal, and the lifecycle subscriptions are gone. **Do not
            // add a second source back.**
            EventBus.subscribe(BOARD_EVENTS.TOKEN_PLACED, (data) => {
                this.reportProgress('token_placed', 1, { typeId: data?.typeId });
                if (data?.instanceId != null && data?.typeId) {
                    const def = getTokenType(data.typeId);
                    // The event names the placed Token by instance id (Free Playmat 1.6b).
                    const serves = RecipeResolver.servesFrom(data.instanceId);
                    if (serves.length > 0 || def?.tokenType === 'context' || (def?.provides && def.provides.length > 0)) {
                        this.reportProgress('context_token_placed');
                    }
                }
            }),
            // A Shop purchase (Token Lifecycle 5.1). It also lands the Token
            // through `placeTokenAt`, which raised `TOKEN_PLACED` above: two
            // different targets, not one action counted twice.
            EventBus.subscribe('token_purchased', (data) => {
                this.reportProgress('token_purchased', 1, { typeId: data?.typeId });
            }),
            // A Foundation became what it built, or Farmland what was planted
            // (Token Lifecycle 6.1; published by `BoardRunner` since 9.5).
            EventBus.subscribe(BOARD_EVENTS.TOKEN_BUILT, (data) => {
                this.reportProgress('token_built', 1, { typeId: data?.typeId, fromTypeId: data?.fromTypeId });
            }),
            EventBus.subscribe('hero_deployed', () => this.reportProgress('hero_deployed')),
            // A finished cycle: gathering, crafting, exploring, a kill (D-129).
            // A failed cycle did nothing, so it counts for nothing. The Token's
            // type and skill, and each item it made, let a step ask for one
            // kind of work ("log an Oak Tree", "craft Charcoal").
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
            EventBus.subscribe('inventory_updated', () => this.syncInventoryQuests()),
            EventBus.subscribe('hero_recruited', () => this.reportProgress('hero_recruited')),
            EventBus.subscribe('guild_upgrades_updated', (data) => {
                this.reportProgress('guild_upgrade_purchased');
                if (data?.upgradeId === 'wishing_well') {
                    this.reportProgress('wishing_well_upgraded');
                }
            }),
            // ⚠️ **`ui_modal:opened` comes from the React layer, not the engine**
            // (CR2-094). Its only publisher is `src/ui/hooks/useUIModals.js`,
            // which carries the full contract in its header — including the rule
            // that any NEW route into the Bank or the Shop has to publish it
            // too, or these quest targets silently stall. The Shop is still the
            // `cartographer` pane. Do not rename these strings on one side only.
            EventBus.subscribe('ui_modal:opened', (data) => {
                if (data?.modalId === 'bank') this.reportProgress('open_bank');
                else if (data?.modalId === 'cartographer') this.reportProgress('open_cartographer');
            }),
            // ⚠️ Retired with the systems that published them (Token Lifecycle
            // 9.5): `map_burst` / `map_opened` / `map_purchased` (Map bursts and
            // the Map shop, 9.1), `vault_withdrawn` / `vault_deposited` /
            // `loot_token_placed` and the `vault` modal (the Token Vault, 9.3),
            // and `board_recall` / `return_to_tray` (never published at all).
            // `QuestTutorialChain.test.js` fails if one comes back.
            //
            // ⚠️ `hero_equipped` is NOT an engine event — nothing publishes it.
            // Equipping is announced as `hero_equipment_changed` with
            // `action: 'equip'` (EquipmentManager), which is what feeds the
            // `hero_equipped` quest target below.
            EventBus.subscribe('hero_equipment_changed', (data) => {
                if (data?.action === 'equip') this.reportProgress('hero_equipped');
            }),
            // ⚠️ `token_exhausted` is a quest TARGET name and a tile-log entry
            // type — it is NOT an engine event (CR2-195).
            // `BOARD_EVENTS.TOKEN_DEPLETED` is the real event and the only one
            // that should report here.
            EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, () => this.reportProgress('token_exhausted')),
            EventBus.subscribe('combat_victory', (data) => {
                this.reportProgress('combat_victory');
                if (data?.enemyId) {
                    this.reportProgress('enemy_hunted', 1, { enemyId: data.enemyId });
                }
            })
        );
    },

    /** Collection bounties follow the Bank (unchanged rule, now on the Tokens). */
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
     * the quest Tokens' clock (B6.1). The per-tick Bank sync is gone; it
     * follows `inventory_updated` instead.
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
     * ⚠️ Retired with the sidebar (B6.1): a bounty is discarded by dragging its
     * Token to the bin (FB-43), with no cooldown. Kept so the sidebar's button
     * fails politely until B6.2 removes it.
     */
    abandonQuest(questId) {
        const token = findQuestToken(questId);
        if (token?.quest?.tutorial) return { success: false, reason: 'Tutorial quests cannot be abandoned' };
        return { success: false, reason: 'Drag a quest to the bin to discard it' };
    },

    /**
     * Claim a quest by its quest id or its Token's instance id — see
     * `QuestTokens.claimQuest` (B6.1: the reward drops as loot beside the
     * Token, and the Token vanishes).
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
