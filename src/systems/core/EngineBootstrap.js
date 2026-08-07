import { logger } from '../../utils/Logger.js';
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
import { DiscoveryManager } from './DiscoveryManager.js';
import { AudioSystem } from './AudioSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { InventoryGroupManager } from '../economy/InventoryGroupManager.js';
import { ProgressionSystem } from '../progression/ProgressionSystem.js';
import { QuestTracker } from '../progression/QuestTracker.js';
import { QuestBoardSystem } from '../progression/QuestBoardSystem.js';
import * as CardManager from '../cards/CardManager.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as RegenSystem from '../hero/RegenSystem.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { WoundedSystem } from '../combat/WoundedSystem.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import * as EquipmentManager from '../equipment/EquipmentManager.js';
import * as BoardState from '../board/BoardState.js';
import * as BoardPlacement from '../board/Placement.js';
import * as SpriteLayer from '../board/SpriteLayer.js';
import * as BoardRunner from '../board/BoardRunner.js';
import * as InputAllocator from '../board/InputAllocator.js';
import * as TileModifiers from '../board/TileModifiers.js';
import * as RecipeResolver from '../board/RecipeResolver.js';

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
            WoundedSystem,
            LootSystem,
            ProgressionSystem,
            QuestTracker,
            QuestBoardSystem,
            StatusEffectSystem,
            EquipmentManager,
            BoardState,
            BoardPlacement,
            SpriteLayer,
            BoardRunner,
            InputAllocator,
            TileModifiers,
            RecipeResolver,
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
        TimeBankManager.init();     // offline time bank + fast-forward
        GuildUpgradeManager.init(); // Guild Hall upgrade tree

        // Unified status effect engine (buffs/debuffs on the 5s global clock)
        StatusEffectSystem.init();

        // Loot sprites. ⚠️ Must init BEFORE anything can produce: it carries
        // D-138's "nothing is ever lost to a full Bank" guarantee, and that
        // guarantee is exactly one subscription deep.
        SpriteLayer.init();
        BoardRunner.init();

        // The board's own systems land here as they are built:
        //   Phase 2 — BoardState / Placement
        //   Phase 3 — SpriteLayer
        //   Phase 4 — BoardRunner (the cycle engine)
        //   Phase 6 — board combat
        //   Phase 7 — Managers
        //
        // QuestBoardSystem.init() is deliberately NOT called: quests are dormant
        // (roadmap G-9) and the board system is still area-scoped, so reviving
        // it is a rework rather than a switch-on. See QuestTracker's header.

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
                // Lifetime playtime for the save-slot screen (CR-006).
                GameState.state.meta.totalPlaytime = (GameState.state.meta.totalPlaytime || 0) + delta;
            }
        });

        GameLoop.onTick('regen_system', (delta) => {
            if (GameState.getIsInitialized()) RegenSystem.tick(delta);
        });

        // The board's cycle engine. After regen deliberately — that ordering
        // is what the old loop relied on, and combat will want it too in
        // Phase 6 (a regen tick should land before the fight tick that might
        // kill on it).
        GameLoop.onTick('board_runner', (delta) => {
            if (GameState.getIsInitialized()) BoardRunner.tick(delta);
        });

        // ⚠️ Combat still has NO tick owner. `LoopRunner._tickCombat` was the
        // only thing driving `CombatProcessor`, and it is gone. Expected until
        // Phase 6 (see playmat_gap_analysis.md §2.2).

        // Time Bank drain — while fast-forwarding, spends the bank as game-time
        // advances. `delta` is already time-scaled, so this runs after the
        // engines that consumed the accelerated tick.
        GameLoop.onTick('time_bank', (delta) => {
            if (GameState.getIsInitialized()) TimeBankManager.tick(delta);
        });

        // Quest board refresh clock — NOT registered. Quests are dormant
        // (roadmap G-9); restoring this tick is half of switching them back on.

        // Loot sprite housekeeping: auto-collect and the visible-stack cap.
        GameLoop.onTick('sprite_layer', (delta) => {
            if (GameState.getIsInitialized()) SpriteLayer.tick(delta);
        });

        GameLoop.onTick('wounded_system', (delta) => {
            if (GameState.getIsInitialized()) WoundedSystem.tick(delta);
        });

        // Status effect global clock (5s): hero DoT ticks + time decay.
        // Registered last so a tick that downs a hero is routed by the board
        // runner on the following frame.
        GameLoop.onTick('status_effects', (delta) => {
            if (GameState.getIsInitialized()) StatusEffectSystem.tick(delta);
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

        // 2. Data Initialization
        if (isNewGame) {
            this.createDefaultGameData();
        }

        // 3. State Sync
        // Board state is built and rehydrated here from Phase 2 onward. The
        // deck loop's equivalent (per-area state, deck ownership reconcile,
        // station buff rehydrate) is gone with it.
        //
        // A lesson from that system worth carrying over: its area state was
        // only ever created by paths a LOADED save had already been through, so
        // a genuinely new game booted to an empty screen and nobody noticed for
        // six phases. Whatever Phase 2 adds here must be exercised from a fresh
        // new game, not just from a save.

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
