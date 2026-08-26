// Fantasy Guild - Quest Manager
// Manages Multi-Tutorial Chain, Instant Replenishment, Abandon Mechanics, Progress Tracking, and Claim Actions

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from '../board/boardEvents.js';
import { TUTORIAL_QUESTS } from './tutorialQuests.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryStore } from '../inventory/InventoryStore.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getMap, listMaps } from '../../config/registries/mapRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { tokenForMap, getPurchasedMaps } from '../board/Cartographer.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as BoardState from '../board/BoardState.js';
import * as RecipeResolver from '../board/RecipeResolver.js';

export const MAX_ACTIVE_QUESTS = 3;
export const ABANDON_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Content pools for random bounties
const RANDOM_ITEMS = [
    { id: 'item_oak_wood', name: 'Oak Wood', sellPrice: 6 },
    { id: 'item_copper_ore', name: 'Copper Ore', sellPrice: 6 },
    { id: 'item_copper_ingot', name: 'Copper Ingot', sellPrice: 15 },
    { id: 'item_charcoal', name: 'Charcoal', sellPrice: 8 },
    { id: 'item_water', name: 'Water', sellPrice: 4 }
];

/**
 * Exported so the boot-time content check can confirm these creatures exist
 * (CR2-108). It is read, never written.
 */
export const RANDOM_HUNTS = [
    { id: 'goblin', name: 'Goblins', min: 2, max: 5 },
    { id: 'wolf', name: 'Wolves', min: 2, max: 4 },
    { id: 'bandit', name: 'Bandits', min: 2, max: 4 },
    { id: 'skeleton', name: 'Skeletons', min: 2, max: 5 }
];

let unsubs = [];
let initialized = false;

function nextId() {
    return `quest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const QuestManager = {
    init() {
        if (initialized) return;
        this.ensureState();
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
        if (!Array.isArray(q.completedTutorials)) {
            q.completedTutorials = [];
            if (typeof q.tutorialStep === 'number' && q.tutorialStep > 0) {
                for (let i = 0; i < Math.min(q.tutorialStep, TUTORIAL_QUESTS.length); i++) {
                    q.completedTutorials.push(TUTORIAL_QUESTS[i].id);
                }
            }
        }
        q.tutorialStep = q.completedTutorials.length;
    },

    getActiveQuests() {
        this.ensureState();
        return GameState.state?.quests?.active || [];
    },

    getTutorialStep() {
        this.ensureState();
        return GameState.state?.quests?.tutorialStep || 0;
    },

    isTokenVaultSendUnlocked() {
        this.ensureState();
        const qState = GameState.state?.quests;
        if (!qState) return true;
        if (qState.completedTutorials?.includes('tutorial_5')) return true;
        const tDrop = qState.active?.find(q => q.targetType === 'loot_token_placed' || q.id === 'tutorial_5');
        if (tDrop && (tDrop.currentCount || 0) >= (tDrop.requiredCount || 1)) return true;
        if (typeof qState.tutorialStep === 'number' && qState.tutorialStep >= 5) return true;
        const hasTutorials = qState.active?.some(q => q.isTutorial) || (qState.completedTutorials && qState.completedTutorials.length > 0);
        if (!hasTutorials) return true;
        return false;
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
                    requiredCount: template.requiredCount,
                    currentCount: 0,
                    rewardMapId: template.rewardMapId,
                    rewardMapName: template.rewardMapName,
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
            EventBus.subscribe('map_burst', () => this.reportProgress('map_burst')),
            EventBus.subscribe('map_opened', () => this.reportProgress('map_burst')),
            // ⚠️ **One event per player action, and only one** (CR2-085, tidied
            // 2026-08-25 alongside the CR2-055/CR2-177 event fix).
            //
            // A quest counter must hear about an action exactly once. This block
            // used to subscribe to a *pair* of events for each of the two board
            // actions — the semantic one (`TOKEN_PLACED`, `hero_deployed`) and a
            // board-lifecycle one (`TILE_CHANGED`, `HERO_MOVED`) — and
            // `Placement` publishes both members of each pair for a single
            // action, so every counter advanced by 2. It was invisible only
            // because tutorials 4 and 11 ask for one and `reportProgress` caps
            // at the target.
            //
            // The lifecycle events exist to redraw the UI, not to describe what
            // the player did: `TILE_CHANGED` also fires for clearing, depletion,
            // pushes, restocks and vault moves. So the semantic event is the
            // quest signal, and the lifecycle subscriptions are gone. **Do not
            // add a second source back.**
            EventBus.subscribe(BOARD_EVENTS.TOKEN_PLACED, (data) => {
                this.reportProgress('token_placed');
                if (data?.tile != null && data?.typeId) {
                    const def = getTokenType(data.typeId);
                    const serves = RecipeResolver.servesFrom(data.tile);
                    if (serves.length > 0 || def?.tokenType === 'context' || (def?.provides && def.provides.length > 0)) {
                        this.reportProgress('context_token_placed');
                    }
                }
            }),
            // Dropping a loot Token is a *kind of* placement, not a second one:
            // it reaches the board through `Placement.placeToken`, which has
            // already raised `TOKEN_PLACED` above. So this only adds the extra
            // fact that the Token came off the floor.
            EventBus.subscribe('loot_token_placed', () => {
                this.reportProgress('loot_token_placed');
            }),
            EventBus.subscribe('hero_deployed', () => this.reportProgress('hero_deployed')),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => {
                this.reportProgress('cycle_completed');
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
            // that any NEW route into the Bank, Vault or Cartographer has to
            // publish it too, or these three tutorial quests silently stall.
            // Do not rename these three strings on one side only.
            EventBus.subscribe('ui_modal:opened', (data) => {
                if (data?.modalId === 'bank') this.reportProgress('open_bank');
                else if (data?.modalId === 'vault') this.reportProgress('open_vault');
                else if (data?.modalId === 'cartographer') this.reportProgress('open_cartographer');
            }),
            EventBus.subscribe('vault_withdrawn', () => this.reportProgress('vault_withdrawn')),
            EventBus.subscribe('vault_deposited', () => this.reportProgress('vault_deposited')),
            EventBus.subscribe('board_recall', () => this.reportProgress('quick_recall')),
            EventBus.subscribe('return_to_tray', () => this.reportProgress('quick_recall')),
            EventBus.subscribe('map_purchased', () => this.reportProgress('map_purchased')),
            // ⚠️ `hero_equipped` is NOT an engine event — nothing publishes it.
            // Equipping is announced as `hero_equipment_changed` with
            // `action: 'equip'` (EquipmentManager), which is what feeds the
            // `hero_equipped` quest target below. A subscription to the
            // non-existent `hero_equipped`, and one to `context_connected`
            // (also never published — `token_placed` already reports
            // `context_token_placed`), were deleted on 2026-08-24 (CR2-088),
            // along with `recipe_satisfied`, whose quest target no quest uses.
            EventBus.subscribe('hero_equipment_changed', (data) => {
                if (data?.action === 'equip') this.reportProgress('hero_equipped');
            }),
            // ⚠️ `token_exhausted` is a quest TARGET name and a tile-log entry
            // type — it is NOT an engine event. A second subscription to the
            // bare string `'token_exhausted'` sat here until 2026-08-26
            // (CR2-195); it looked like a double-count and was in fact dead,
            // because nothing publishes it. `BOARD_EVENTS.TOKEN_DEPLETED` below
            // is the real event and the only one that should report here.
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
                if (quest.enemyId && metadata.enemyId && quest.enemyId !== metadata.enemyId) {
                    continue;
                }
                if (quest.itemId && metadata.itemId && quest.itemId !== metadata.itemId) {
                    continue;
                }
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
        // Pick from player's purchased maps, falling back to catalog maps
        const purchased = getPurchasedMaps();
        let mapPool = purchased.length > 0 ? purchased : listMaps().map(m => m.id);
        if (!mapPool || mapPool.length === 0) mapPool = ['map_test_map'];

        const pickedMapId = mapPool[Math.floor(Math.random() * mapPool.length)];
        const mapDef = getMap(pickedMapId);
        const mapPrice = mapDef?.price || 100;
        const targetCost = Math.max(30, Math.round(mapPrice * 0.65));

        // Balance collection vs hunt based on current active quests
        const active = GameState.state?.quests?.active || [];
        const huntCount = active.filter(qu => qu.type === 'hunt').length;
        const collectionCount = active.filter(qu => qu.type === 'collection').length;
        const isHunt = huntCount < collectionCount ? true : collectionCount < huntCount ? false : Math.random() > 0.5;

        if (isHunt) {
            const hunt = RANDOM_HUNTS[Math.floor(Math.random() * RANDOM_HUNTS.length)];
            const count = Math.floor(Math.random() * (hunt.max - hunt.min + 1)) + hunt.min;
            return {
                id: nextId(),
                isTutorial: false,
                type: 'hunt',
                title: `Defeat ${count} ${hunt.name}`,
                targetType: 'enemy_hunted',
                enemyId: hunt.id,
                requiredCount: count,
                currentCount: 0,
                rewardMapId: pickedMapId,
                rewardMapName: mapDef?.name || 'Map',
                status: 'active',
                createdAt: Date.now()
            };
        } else {
            const item = RANDOM_ITEMS[Math.floor(Math.random() * RANDOM_ITEMS.length)];
            const sellPrice = item.sellPrice || 5;
            const requiredCount = Math.max(3, Math.round(targetCost / sellPrice));
            return {
                id: nextId(),
                isTutorial: false,
                type: 'collection',
                title: `Collect ${requiredCount} ${item.name}`,
                targetType: 'item_collected',
                itemId: item.id,
                requiredCount: requiredCount,
                currentCount: InventoryStore.getItems()?.[item.id]?.quantity || 0,
                rewardMapId: pickedMapId,
                rewardMapName: mapDef?.name || 'Map',
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

        // Check 50-map total limit
        if (!BoardState.hasMapSpace()) {
            return { success: false, reason: 'Map limit reached (50/50) — burst existing maps to acquire more' };
        }

        // If collection quest, deduct items
        if (quest.type === 'collection' && quest.itemId) {
            const held = InventoryStore.getItems()?.[quest.itemId]?.quantity || 0;
            if (held < quest.requiredCount) {
                return { success: false, reason: `Need ${quest.requiredCount}× ${getItem(quest.itemId)?.name || quest.itemId}` };
            }
            InventoryManager.removeItem(quest.itemId, quest.requiredCount);
        }

        // Toss Map Token sideways onto the playmat with natural spread across the left/mid playmat
        const clampX = Math.round(50 + Math.random() * 320);
        let clampY = Math.round(260 + Math.random() * 150);

        // If triggered from a specific quest card in the UI, match the flight Y height to the card!
        if (sourceRect && typeof document !== 'undefined') {
            const boardEl = document.querySelector('[data-board-origin]') || document.querySelector('[data-dnd-surface="board"]');
            const boardRect = boardEl?.getBoundingClientRect();
            if (boardRect) {
                const questCenterY = sourceRect.top + (sourceRect.height || 0) / 2;
                const relativeY = Math.round(questCenterY - boardRect.top - 64);
                // Clamp within valid playmat area
                clampY = Math.max(120, Math.min(720, relativeY));
            }
        }

        // Fly straight sideways onto the playmat (pure horizontal movement: fromY = 0)
        const fromX = -(clampX + 240);
        const fromY = 0;

        const rewardMapId = quest.rewardMapId || 'map_guild_hall';
        const tokenTypeId = tokenForMap(rewardMapId) || 'token_guild_hall_map';
        const spawnedMap = BoardState.addBoardMap(tokenTypeId, clampX, clampY, 1, {
            bornAt: Date.now(),
            fromX,
            fromY
        });

        const mapDef = getMap(rewardMapId);
        const mapDisplayName = mapDef?.name || quest.rewardMapName || 'Map';

        EventBus.publish('map_reward_spawned', {
            map: spawnedMap,
            mapId: rewardMapId,
            x: clampX,
            y: clampY
        });

        EventBus.publish('quest_claimed', { questId, rewardMapId });

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
        return { success: true, rewardMapId, map: spawnedMap };
    }
};
