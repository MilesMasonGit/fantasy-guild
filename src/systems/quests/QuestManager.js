// Fantasy Guild - Quest Manager
// Manages Multi-Tutorial Chain, Instant Replenishment, Abandon Mechanics, Progress Tracking, and Claim Actions

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { TUTORIAL_QUESTS, TUTORIAL_REWARD_ITEMS, tutorialTemplate } from './tutorialQuests.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as RecipeResolver from '../board/RecipeResolver.js';

export const MAX_ACTIVE_QUESTS = 3;

/**
 * What a random bounty pays (slice 2.2, SP-65). Quests used to reward a Map;
 * they pay items now. A placeholder amount (TL-5), in a live `item_*` id.
 */
export const BOUNTY_REWARD_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 })
]);

/** A fresh, mutable copy of a reward list, safe to store on a quest. */
function copyReward(list) {
    return (list || []).map(r => ({ itemId: r.itemId, quantity: r.quantity }));
}

/**
 * What claiming a quest pays, as `[{ itemId, quantity, name }]`.
 *
 * A quest from a save made before slice 2.2 carries `rewardMapId` and no
 * `rewardItems`; it pays the default for its kind instead of a Map, so an old
 * save cannot claim a Map (or the gold the last Guild Hall Map drop held).
 */
export function questReward(quest) {
    const list = Array.isArray(quest?.rewardItems) && quest.rewardItems.length
        ? quest.rewardItems
        : (quest?.isTutorial ? TUTORIAL_REWARD_ITEMS : BOUNTY_REWARD_ITEMS);
    return list
        .filter(r => r?.itemId && r.quantity > 0)
        .map(r => ({ itemId: r.itemId, quantity: r.quantity, name: getItem(r.itemId)?.name || r.itemId }));
}
export const ABANDON_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Content pools for random bounties: items a new game can make (Token
 * Lifecycle §6), each with the range a bounty asks for. Placeholders (TL-5).
 *
 * Bounties used to be sized from a random Map's gold price (the Map shop and
 * the bursts retired in 9.1, gold in 9.4); the ranges replace that.
 */
export const RANDOM_ITEMS = [
    { id: 'item_oak_wood', name: 'Oak Wood', min: 10, max: 25 },
    { id: 'item_copper_ore', name: 'Copper Ore', min: 8, max: 20 },
    { id: 'item_stone', name: 'Stone', min: 8, max: 20 },
    { id: 'item_copper_ingot', name: 'Copper Ingot', min: 2, max: 5 },
    { id: 'item_charcoal', name: 'Charcoal', min: 4, max: 10 },
    { id: 'item_wheat', name: 'Wheat', min: 5, max: 15 }
];

/**
 * Exported so the boot-time content check can confirm these creatures exist
 * (CR2-108). It is read, never written.
 *
 * ⚠️ An `id` is an enemy **Token** id: `combat_victory` carries the Token's id
 * as `enemyId` (enemies are Tokens since 2026-09-06). The old `goblin`,
 * `wolf`, `bandit` and `skeleton` ids matched nothing, so no hunt could ever
 * finish (Token Lifecycle 9.5). The Goblin Camp is the only enemy a new game
 * can buy (§6).
 */
export const RANDOM_HUNTS = [
    { id: 'token_goblin', name: 'Goblins', min: 2, max: 5 }
];

/** An integer from `min` to `max`, both included. */
function rollBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Whether a report's metadata satisfies a quest. A quest narrows its target
 * with `match` (tutorial steps), `enemyId` (hunts) or `itemId` (collections);
 * every value it names must be present and equal in the report.
 *
 * ⚠️ Stricter than before 9.5, when a report with NO `itemId` or `enemyId`
 * counted for every quest that named one. Every reporter of those two targets
 * passes the id, so nothing that used to count stops counting.
 */
function reportMatches(quest, metadata) {
    const wanted = { ...(quest.match || {}) };
    if (quest.enemyId) wanted.enemyId = quest.enemyId;
    if (quest.itemId) wanted.itemId = quest.itemId;
    return Object.entries(wanted).every(([k, v]) => metadata?.[k] === v);
}

let unsubs = [];
let initialized = false;

function nextId() {
    return `quest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const QuestManager = {
    init() {
        if (initialized) return;
        this.ensureState();
        this.refreshTutorialCopies();
        this.setupListeners();
        this.ensureQuests();
        initialized = true;
    },

    cleanup() {
        unsubs.forEach(unsub => unsub?.());
        unsubs = [];
        initialized = false;
    },

    ensureState() {
        if (!GameState.state) return;
        if (!GameState.state.quests) {
            GameState.state.quests = {
                active: [],
                completedTutorials: [],
                tutorialStep: 0
            };
        }
        const q = GameState.state.quests;
        if (!Array.isArray(q.active)) q.active = [];
        // A save from before the list existed kept only a step number. The
        // chain it counted is gone (9.5), so the number maps onto nothing.
        if (!Array.isArray(q.completedTutorials)) q.completedTutorials = [];
        // Counts only steps the chain still has: an old save's `tutorial_N`
        // ids stay in the list, harmless, and count for nothing.
        q.tutorialStep = q.completedTutorials.filter(id => tutorialTemplate(id)).length;
    },

    /**
     * An active tutorial quest carries a COPY of its template, so a saved game
     * would keep a step's old wording and target forever. Re-read them from the
     * template when a game starts or loads.
     *
     * A tutorial step the chain no longer has (the whole old chain, replaced in
     * Token Lifecycle 9.5) is dropped: its event may have no publisher, and it
     * would hold a quest slot for ever. `ensureQuests` refills the slot.
     */
    refreshTutorialCopies() {
        this.ensureState();
        const q = GameState.state?.quests;
        if (!q) return;
        q.active = q.active.filter(quest => !quest?.isTutorial || tutorialTemplate(quest.id));
        for (const quest of q.active) {
            if (!quest?.isTutorial) continue;
            const template = tutorialTemplate(quest.id);
            quest.step = template.step;
            quest.title = template.title;
            quest.instruction = template.instruction;
            quest.targetType = template.targetType;
            quest.requiredCount = template.requiredCount;
            quest.currentCount = Math.min(quest.currentCount || 0, template.requiredCount);
            if (template.match) quest.match = { ...template.match };
            else delete quest.match;
            // Slice 2.2: a saved copy may still name a reward Map.
            quest.rewardItems = copyReward(template.rewardItems);
            delete quest.rewardMapId;
            delete quest.rewardMapName;
        }
    },

    getActiveQuests() {
        this.ensureState();
        return GameState.state?.quests?.active || [];
    },

    getTutorialStep() {
        this.ensureState();
        return GameState.state?.quests?.tutorialStep || 0;
    },

    ensureQuests() {
        this.ensureState();
        if (!GameState.state?.quests) return;
        const q = GameState.state.quests;
        let changed = false;

        // 1. Clean up expired abandoned slots
        const now = Date.now();
        const initialLen = q.active.length;
        q.active = q.active.filter(quest => {
            if (quest.status === 'abandoned') {
                return quest.readyAt > now;
            }
            return true;
        });
        if (q.active.length !== initialLen) changed = true;

        // 2. Fill available slots up to MAX_ACTIVE_QUESTS with tutorial quests first
        const completedSet = new Set(q.completedTutorials || []);
        const activeTutorialIds = new Set(
            q.active.filter(qu => qu.isTutorial).map(qu => qu.id)
        );

        for (const template of TUTORIAL_QUESTS) {
            if (q.active.length >= MAX_ACTIVE_QUESTS) break;
            if (!completedSet.has(template.id) && !activeTutorialIds.has(template.id)) {
                q.active.push({
                    id: template.id,
                    isTutorial: true,
                    step: template.step,
                    title: template.title,
                    instruction: template.instruction,
                    targetType: template.targetType,
                    ...(template.match ? { match: { ...template.match } } : {}),
                    requiredCount: template.requiredCount,
                    currentCount: 0,
                    rewardItems: copyReward(template.rewardItems),
                    status: 'active',
                    createdAt: Date.now()
                });
                activeTutorialIds.add(template.id);
                changed = true;
            }
        }

        // 3. If all tutorial quests are completed/offered, fill empty slots with random bounties
        const allTutorialsDoneOrOffered = TUTORIAL_QUESTS.every(
            t => completedSet.has(t.id) || activeTutorialIds.has(t.id)
        );
        if (allTutorialsDoneOrOffered) {
            while (q.active.length < MAX_ACTIVE_QUESTS) {
                const bounty = this.createRandomQuest();
                if (!bounty) break;
                q.active.push(bounty);
                changed = true;
            }
        }

        if (changed) {
            EventBus.publish('quests_updated', {});
            EventBus.publish('state_changed', {});
        }
    },

    setupListeners() {
        unsubs.push(
            EventBus.subscribe('react:slot_selected', () => this.ensureQuests()),
            EventBus.subscribe('game_loaded', () => {
                this.refreshTutorialCopies();
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

    syncInventoryQuests() {
        this.ensureState();
        const active = GameState.state?.quests?.active;
        if (!active || active.length === 0) return;

        let changed = false;
        for (const quest of active) {
            if (quest.status === 'active' && quest.type === 'collection' && quest.itemId) {
                const held = InventoryStore.getItems()?.[quest.itemId]?.quantity || 0;
                const nextCount = Math.min(quest.requiredCount, held);
                if (nextCount !== quest.currentCount) {
                    quest.currentCount = nextCount;
                    changed = true;
                }
            }
        }

        if (changed) {
            EventBus.publish('quests_updated', {});
            EventBus.publish('state_changed', {});
        }
    },

    reportProgress(targetType, amount = 1, metadata = {}) {
        this.ensureState();
        const active = GameState.state?.quests?.active;
        if (!active || active.length === 0) return;

        let changed = false;
        for (const quest of active) {
            if (quest.status !== 'active') continue;
            if (quest.targetType === targetType) {
                if (!reportMatches(quest, metadata)) continue;
                const nextCount = Math.min(quest.requiredCount, (quest.currentCount || 0) + amount);
                if (nextCount !== quest.currentCount) {
                    quest.currentCount = nextCount;
                    changed = true;
                }
            }
        }

        if (changed) {
            EventBus.publish('quests_updated', {});
            EventBus.publish('state_changed', {});
        }
    },

    tick(deltaMs) {
        this.ensureState();
        const q = GameState.state?.quests;
        if (!q) return;

        const now = Date.now();

        // 1. Check for expired abandoned cooldown slots
        const hasExpiredSlot = q.active.some(quest => quest.status === 'abandoned' && quest.readyAt <= now);
        if (hasExpiredSlot) {
            this.ensureQuests();
        }

        // 2. Sync inventory collection quests
        this.syncInventoryQuests();
    },

    createRandomQuest() {
        // Balance collection vs hunt based on current active quests
        const active = GameState.state?.quests?.active || [];
        const huntCount = active.filter(qu => qu.type === 'hunt').length;
        const collectionCount = active.filter(qu => qu.type === 'collection').length;
        const isHunt = huntCount < collectionCount ? true : collectionCount < huntCount ? false : Math.random() > 0.5;

        if (isHunt) {
            const hunt = RANDOM_HUNTS[Math.floor(Math.random() * RANDOM_HUNTS.length)];
            const count = rollBetween(hunt.min, hunt.max);
            return {
                id: nextId(),
                isTutorial: false,
                type: 'hunt',
                title: `Defeat ${count} ${hunt.name}`,
                targetType: 'enemy_hunted',
                enemyId: hunt.id,
                requiredCount: count,
                currentCount: 0,
                rewardItems: copyReward(BOUNTY_REWARD_ITEMS),
                status: 'active',
                createdAt: Date.now()
            };
        } else {
            const item = RANDOM_ITEMS[Math.floor(Math.random() * RANDOM_ITEMS.length)];
            const requiredCount = rollBetween(item.min, item.max);
            return {
                id: nextId(),
                isTutorial: false,
                type: 'collection',
                title: `Collect ${requiredCount} ${item.name}`,
                targetType: 'item_collected',
                itemId: item.id,
                requiredCount: requiredCount,
                currentCount: InventoryStore.getItems()?.[item.id]?.quantity || 0,
                rewardItems: copyReward(BOUNTY_REWARD_ITEMS),
                status: 'active',
                createdAt: Date.now()
            };
        }
    },

    generateRandomQuest() {
        this.ensureState();
        if (!GameState.state?.quests) return null;
        const q = GameState.state.quests;
        if (q.active.length >= MAX_ACTIVE_QUESTS) return null;

        const quest = this.createRandomQuest();
        if (quest) {
            q.active.push(quest);
            EventBus.publish('quests_updated', {});
            EventBus.publish('state_changed', {});
        }
        return quest;
    },

    abandonQuest(questId) {
        this.ensureState();
        if (!GameState.state?.quests) return { success: false, reason: 'No active state' };
        const q = GameState.state.quests;
        const index = q.active.findIndex(qu => qu.id === questId);
        if (index === -1) return { success: false, reason: 'Quest not found' };

        const abandoned = q.active[index];
        if (abandoned.isTutorial) {
            return { success: false, reason: 'Tutorial quests cannot be abandoned' };
        }

        // Replace slot with an abandoned cooldown placeholder
        q.active[index] = {
            id: nextId(),
            status: 'abandoned',
            originalId: abandoned.id,
            readyAt: Date.now() + ABANDON_COOLDOWN_MS
        };

        NotificationSystem.info(`Abandoned quest. Searching for new quest in 5m.`);
        EventBus.publish('quests_updated', {});
        EventBus.publish('state_changed', {});
        return { success: true };
    },

    // `sourceRect` is still passed by the quest card; it placed the reward
    // Map's flight and has nothing to place now that the reward is items.
    // eslint-disable-next-line no-unused-vars
    claimQuest(questId, sourceRect = null) {
        this.ensureState();
        const q = GameState.state?.quests;
        if (!q || !Array.isArray(q.active)) return { success: false, reason: 'No active quests' };

        const index = q.active.findIndex(qu => qu.id === questId);
        if (index === -1) return { success: false, reason: 'Quest not found' };

        const quest = q.active[index];
        if (quest.status !== 'active' || quest.currentCount < quest.requiredCount) {
            return { success: false, reason: 'Quest requirements not met yet' };
        }

        // If collection quest, deduct items
        if (quest.type === 'collection' && quest.itemId) {
            const held = InventoryStore.getItems()?.[quest.itemId]?.quantity || 0;
            if (held < quest.requiredCount) {
                return { success: false, reason: `Need ${quest.requiredCount}× ${getItem(quest.itemId)?.name || quest.itemId}` };
            }
            InventoryManager.removeItem(quest.itemId, quest.requiredCount);
        }

        // Pay the reward: items, into the Bank (slice 2.2, SP-65). It used to
        // toss a Map Token onto the mat. `addItem` drops any overflow on the
        // mat as loot, so nothing is lost to a full Bank (D-138), and its
        // `inventory_updated` is the announcement (no second toast, CR2-092).
        const rewardItems = questReward(quest);
        for (const r of rewardItems) InventoryManager.addItem(r.itemId, r.quantity, 'quest_reward');

        EventBus.publish('quest_claimed', { questId, rewardItems });

        // Record tutorial completion
        if (quest.isTutorial) {
            if (!q.completedTutorials.includes(quest.id)) {
                q.completedTutorials.push(quest.id);
            }
            q.tutorialStep = q.completedTutorials.length;
        }

        // Remove claimed quest from active list
        q.active.splice(index, 1);

        // Immediately replenish the slot
        this.ensureQuests();

        EventBus.publish('quests_updated', {});
        EventBus.publish('state_changed', {});
        return { success: true, rewardItems };
    }
};
