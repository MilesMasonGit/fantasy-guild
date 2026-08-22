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
import * as HeroManager from '../hero/HeroManager.js';
import * as RegenSystem from '../hero/RegenSystem.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as PromotionSystem from '../hero/PromotionSystem.js';
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
import * as BoardCombat from '../board/BoardCombat.js';
import * as Managers from '../board/Managers.js';
import * as TokenBank from '../board/TokenBank.js';
import * as Cartographer from '../board/Cartographer.js';
import { QuestManager } from '../quests/QuestManager.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { reportContentIntegrity } from './ContentAudit.js';

/**
 * The opening state of a new game.
 * The player starts with no tokens in the tray, no items, zero gold, and one Hero.
 */
export const OPENING_TRAY = [];

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
            HeroManager,
            SkillSystem,
            PromotionSystem,
            WoundedSystem,
            LootSystem,
            StatusEffectSystem,
            EquipmentManager,
            BoardState,
            BoardPlacement,
            SpriteLayer,
            BoardRunner,
            InputAllocator,
            TileModifiers,
            RecipeResolver,
            BoardCombat,
            Managers,
            TokenBank,
            Cartographer,
            QuestManager,
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
        BoardCombat.init();
        Managers.init();
        Cartographer.init();
        QuestManager.init();

        // 2. Register Game Loop Intervals
        this._registerTickHandlers();

        reportContentIntegrity({ openingTray: OPENING_TRAY });

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

        GameLoop.onTick('board_runner', (delta) => {
            if (GameState.getIsInitialized()) BoardRunner.tick(delta);
        });

        GameLoop.onTick('time_bank', (delta) => {
            if (GameState.getIsInitialized()) TimeBankManager.tick(delta);
        });

        GameLoop.onTick('quest_manager', (delta) => {
            if (GameState.getIsInitialized()) QuestManager.tick(delta);
        });

        GameLoop.onTick('sprite_layer', (delta) => {
            if (GameState.getIsInitialized()) SpriteLayer.tick(delta);
        });

        GameLoop.onTick('wounded_system', (delta) => {
            if (GameState.getIsInitialized()) WoundedSystem.tick(delta);
        });

        GameLoop.onTick('status_effects', (delta) => {
            if (GameState.getIsInitialized()) StatusEffectSystem.tick(delta);
        });
    },

    /**
     * Create default heroes and cards for a new game
     */
    createDefaultGameData() {
        logger.debug('Engine', 'Creating default game data...');

        const state = GameState.state;
        if (!state) return;

        // Start with zero gold and no items
        if (state.currency) state.currency.gold = 0;
        if (state.inventory) state.inventory.items = {};

        // Start with one Hero
        if (!state.heroes?.length) {
            HeroManager.createHero({}, true);
        }

        // Start with no tokens in the tray
        if (state.board) {
            state.board.tray = [];
        }
        for (const typeId of OPENING_TRAY) {
            BoardState.addToTray(
                BoardState.createTokenInstance(typeId, tokenStartingUses(typeId))
            );
        }

        // Initialize exploration tracking
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }

        logger.info('Engine', 'New game: 1 hero, 0 tokens in tray, 0 items, 0 gold.');
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
