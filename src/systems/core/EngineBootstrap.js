import { logger } from '../../utils/Logger.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';
import { EventBus } from './EventBus.js';
import { GameLoop } from './GameLoop.js';
import { TimeManager } from './TimeManager.js';
import { TimeBankManager } from './TimeBankManager.js';
import { GuildUpgradeManager } from '../progression/GuildUpgradeManager.js';
import { SaveManager } from './SaveManager.js';
import { GameState } from '../../state/GameState.js';
import * as NotificationSystem from './NotificationSystem.js';
import './NotificationSubscriptions.js';

// === Logic Systems ===
import { LootSystem } from '../combat/LootSystem.js';
import { InvasionManager } from '../combat/InvasionManager.js';
import { ThreatSystem } from '../threat/ThreatSystem.js';
import { DiscoveryManager } from './DiscoveryManager.js';
import { AudioSystem } from './AudioSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryGroupManager } from '../economy/InventoryGroupManager.js';
import ProjectManager from '../project/ProjectManager.js';
import { AreaSystem } from '../area/AreaSystem.js';
import { ProgressionSystem } from '../progression/ProgressionSystem.js';
import { CollectionManager } from '../progression/CollectionManager.js';
import { ExplorationManager } from '../progression/ExplorationManager.js';
import { QuestTracker } from '../progression/QuestTracker.js';
import * as CardManager from '../cards/CardManager.js';
import CardSystem from '../cards/CardSystem.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as RegenSystem from '../hero/RegenSystem.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { WoundedSystem } from '../combat/WoundedSystem.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { MasterySystem } from '../progression/MasterySystem.js';
import * as EffectProcessor from '../effects/EffectProcessor.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import ConsumableSystem from '../equipment/ConsumableSystem.js';
import { AssignmentSystem } from '../global/AssignmentSystem.js';
import * as HeroAssignmentManager from '../area/HeroAssignmentManager.js';
import { ensureAreaState } from '../area/AreaStateManager.js';
import { LoopRunner } from '../loop/LoopRunner.js';
import { StationManager } from '../loop/StationManager.js';
import { StationSlotManager } from '../loop/StationSlotManager.js';
import { DeckSlotManager } from '../loop/DeckSlotManager.js';
import * as ModeManager from '../loop/ModeManager.js';

/**
 * EngineBootstrap - Orchestrates game lifecycle and system registration.
 * Evolves legacy main.jsx monolith into a modular orchestration layer.
 */
export const EngineBootstrap = {
    /**
     * Assemble all core systems into a unified Engine object.
     * This restores the API for context-based UI access.
     */
    getEngine() {
        return {
            GameState,
            EventBus,
            SaveManager,
            InventoryManager,
            InventoryGroupManager,
            HeroManager,
            CardManager,
            SkillSystem,
            CombatSystem,
            WoundedSystem,
            LootSystem,
            InvasionManager,
            AreaSystem,
            ProgressionSystem,
            CollectionManager,
            ExplorationManager,
            QuestTracker,
            MasterySystem,
            EffectProcessor,
            StatusEffectSystem,
            EquipmentManager,
            ProjectManager,
            AssignmentSystem,
            HeroAssignmentManager,
            LoopRunner,
            StationManager,
            StationSlotManager,
            DeckSlotManager,
            ModeManager,
            TimeManager,
            TimeBankManager,
            GuildUpgradeManager,
            GameLoop
        };
    },

    /**
     * Entry point for game-ready initialization
     */
    init() {
        logger.info('Engine', 'Initializing Game Systems...');
        
        // 1. System Subscriptions
        LootSystem.init();
        // Chaos/Invasion managers are muted under the deck loop rework (Phase 1);
        // they spawn cards onto the 2D grid, which doesn't exist in the new mode.
        // Kept intact for a future re-design against the 1D loop.
        if (!USE_DECK_LOOP) {
            InvasionManager.init();
            ThreatSystem.init();
        }
        // Hero ↔ Area binding for the deck loop system (Phase 2 §2D)
        if (USE_DECK_LOOP) {
            HeroAssignmentManager.init();
            LoopRunner.init();
            StationSlotManager.init(); // station slots + passive buff registry (Phase 4)
            TimeBankManager.init();    // offline time bank + fast-forward (Phase 8)
            GuildUpgradeManager.init(); // Guild Hall upgrade tree (UI overhaul Phase 4)
            // Ownership invariant after in-session loads (Phase 5): every
            // slotted card must be owned in collection.playsets.
            EventBus.subscribe('game_loaded', () => DeckSlotManager.reconcileOwnership());
        }

        // Unified status effect engine (buffs/debuffs on the 5s global clock)
        StatusEffectSystem.init();

        // 2. Register Game Loop Intervals
        this._registerTickHandlers();

        logger.info('Engine', 'Core systems ready.');
    },

    /**
     * Map Tick Logic to GameLoop
     */
    _registerTickHandlers() {
        GameLoop.onTick('time_tracking', (delta) => {
            if (GameState.getIsInitialized()) {
                GameState.updateTime({
                    gameTimeMs: GameState.time.gameTimeMs + delta,
                    lastTickAt: Date.now()
                });
            }
        });

        GameLoop.onTick('regen_system', (delta) => {
            if (GameState.getIsInitialized()) RegenSystem.tick(delta);
        });

        // Old playmat card engine — replaced by LoopRunner (Phase 3) under USE_DECK_LOOP
        if (!USE_DECK_LOOP) {
            GameLoop.onTick('card_system', (delta) => {
                if (GameState.getIsInitialized()) CardSystem.tick(delta);
            });
        } else {
            // Area Deck Loop engine (Phase 3 §3A/§3B). Registered in the slot
            // the old card_system occupied so it keeps the same relative tick
            // order (after time tracking and regen — regen order matters for
            // the energy-pause auto-resume).
            GameLoop.onTick('loop_runner', (delta) => {
                if (GameState.getIsInitialized()) LoopRunner.tick(delta);
            });
            // Station crafting engine (Phase 4 §4F) — same priority tier,
            // registered after loop_runner so it ticks right behind it.
            GameLoop.onTick('station_manager', (delta) => {
                if (GameState.getIsInitialized()) StationManager.tick(delta);
            });
            // Time Bank drain (Phase 8) — while fast-forwarding, spends the
            // bank as game-time advances. `delta` is already time-scaled, so
            // this runs after the engines that consumed the accelerated tick.
            GameLoop.onTick('time_bank', (delta) => {
                if (GameState.getIsInitialized()) TimeBankManager.tick(delta);
            });
        }

        GameLoop.onTick('wounded_system', (delta) => {
            if (GameState.getIsInitialized()) WoundedSystem.tick(delta);
        });

        // Status effect global clock (5s): hero DoT ticks + time decay.
        // Registered after the loop/combat engines so a tick that downs a
        // hero is routed by LoopRunner on the following frame.
        GameLoop.onTick('status_effects', (delta) => {
            if (GameState.getIsInitialized()) StatusEffectSystem.tick(delta);
        });

        // Regional chaos / invasion threat builder — muted under the deck loop
        // rework (Phase 1); it feeds the grid-based event/invasion spawners.
        if (!USE_DECK_LOOP) {
            GameLoop.onTick('threat_system', (delta) => {
                if (GameState.getIsInitialized()) ThreatSystem.tick(delta);
            });
        }

        GameLoop.onTick('consumable_system', (delta) => {
            if (GameState.getIsInitialized()) {
                // Check consumption needs every 1 second
                this._consumableTimer = (this._consumableTimer || 0) + delta;
                if (this._consumableTimer >= 1000) {
                    ConsumableSystem.processAutoConsume();
                    this._consumableTimer = 0;
                }
            }
        });
    },

    /**
     * Create default heroes and cards for a new game
     */
    createDefaultGameData() {
        logger.debug('Engine', 'Creating default game data...');

        // Starting gold for pack purchases
        if (GameState.state?.currency) {
            GameState.state.currency.gold = 100;
        }

        // Initialize exploration tracking
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }

        logger.debug('Engine', 'Initialized starting gold (100) and legacy exploration state.');
    },

    /**
     * Finalize game preparation once a slot is selected
     */
    onSlotSelected(slotIndex, isNewGame) {
        logger.info('Engine', `Slot ${slotIndex + 1} finalized (New: ${isNewGame})`);

        // 1. Critical System Startups
        DiscoveryManager.init();
        AudioSystem.init();
        InventoryManager.init();
        InventoryGroupManager.init();
        ProjectManager.init();

        // 2. Data Initialization
        if (isNewGame) {
            // The 2D grid doesn't exist under the deck loop (Phase 3 §3B)
            if (!USE_DECK_LOOP) AreaSystem.initGridForArea(GameState.state.ui.activeAreaId);
            this.createDefaultGameData();
        }

        // 3. State Sync
        GameState.rebuildCardCache();
        CardManager.rehydrateCards();
        CardManager.reapplyAllPersistentModifiers();
        if (!USE_DECK_LOOP) AreaSystem.initGridForArea(GameState.state.ui.activeAreaId);
        // Area aggregators are runtime-only — rebuild station passive buffs
        // from the loaded state (Phase 4 §4G). Ownership reconcile grants
        // authored default-deck cards into playsets (Phase 5 §5B).
        if (USE_DECK_LOOP) {
            // Build the deck-loop areaState (default deck included) for every
            // unlocked area. Nothing else on the boot path does this for a
            // NEW game — gap found by the Phase 7 smoke test: earlier phases
            // tested against saves that already carried areaStates, so a
            // fresh game booted to an empty center screen. Idempotent for
            // loaded saves.
            (GameState.collection?.unlockedAreaSets || []).forEach(areaId => ensureAreaState(areaId));
            DeckSlotManager.reconcileOwnership();
            StationSlotManager.rehydrateBuffs();
        }

        // 4. Start the Engine
        GameLoop.start();

        // 5. Trigger Initial UI Sync
        EventBus.publish('state_changed');
        EventBus.publish('heroes_updated');
        EventBus.publish('inventory_updated');
        EventBus.publish('cards_updated');

        NotificationSystem.success('Game systems online.');
    }
};
