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
import * as LiveEffects from '../effects/LiveEffects.js';
import * as TriggerSystem from '../board/TriggerSystem.js';
import * as RecipeResolver from '../board/RecipeResolver.js';
import * as BoardCombat from '../board/BoardCombat.js';
import * as BoardPromotion from '../board/BoardPromotion.js';
import * as MatResize from '../board/MatResize.js';
import * as Flags from '../board/Flags.js';
import * as FlagRules from '../board/FlagRules.js';
import * as TokenBank from '../board/TokenBank.js';
import * as Cartographer from '../board/Cartographer.js';
import { QuestManager } from '../quests/QuestManager.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { matW, matH } from '../../config/matGeometry.js';
import { reportContentIntegrity, reportSaveContent } from './ContentAudit.js';

/**
 * The opening state of a new game (FP-44): the Guild Hall already standing on
 * the mat, an empty Tray, no items, and zero Heroes.
 *
 * Each entry is a Token type and the mat point it starts at.
 *
 * ## ⭐ Where the Hall stands: the middle of the mat (slice 1.6d-3)
 * Dead centre of whatever size the mat currently is — (880, 563) at the shipped
 * 11 steps. **This is a visible change to new games.** Until now it stood at
 * (960, 643): half a step down and right of centre, which was the centre of the
 * old Guild Hall *tile* on a 6×6 grid with no true middle square. The grid went
 * in 1.6d-2 and the mat became resizable here, so the off-by-half has nothing
 * left to preserve and the Hall simply starts in the middle.
 *
 * ## ⚠️ A function, not a constant
 * The mat's size is live (`matGeometry.js`), so a module-level array would pin
 * the opening spot to whatever size the mat happened to be when this file was
 * first imported. Call it when a new game is being built.
 *
 * @returns {Array<{typeId: string, x: number, y: number}>}
 */
export function openingMat() {
    return [
        {
            typeId: 'token_guild_hall',
            x: Math.round(matW() / 2),
            y: Math.round(matH() / 2)
        }
    ];
}

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
            BoardPromotion,
            Flags,
            FlagRules,
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
        // A hero arriving changes which Tokens a `being worked` filter reaches,
        // so the tile caches follow hero movement as well as board changes (V4).
        TileModifiers.init();
        // ⭐ The mat can be resized while the game runs (slice 1.6d-3). Shrinking
        // it pulls what no longer fits back inside (FP-98); this is what listens.
        MatResize.init();
        BoardRunner.init();
        BoardCombat.init();
        BoardPromotion.init();
        Flags.init();
        Cartographer.init();
        QuestManager.init();

        // 2. Register Game Loop Intervals
        this._registerTickHandlers();

        // `openingTray` is the audit's name for "the Tokens a new game starts with".
        reportContentIntegrity({ openingTray: openingMat().map(t => t.typeId) });

        // The same question asked of the loaded SAVE, every time one is loaded
        // (CR2-120). The audit above sees only the authored content set, so a
        // Token that was renamed after this save was written is invisible to
        // it. This reports; it never repairs and never deletes.
        EventBus.subscribe('game_loaded', () => reportSaveContent(GameState.state));

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

        // Live effect instances — poisons, regenerations, anything with a clock
        // on it. Fires on the same 5s interval the status engine used, so a
        // re-authored Poison ticks at exactly the rate it always did.
        GameLoop.onTick('live_effects', (delta) => {
            if (GameState.getIsInitialized()) {
                LiveEffects.tick(delta, TriggerSystem.fireLiveStatement);
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

        // Start with no items
        if (state.inventory) state.inventory.items = {};

        // Start with no Heroes (first hero recruited via Guild Hall upgrade)
        if (state.heroes) {
            state.heroes = [];
        }

        // The Tray starts empty; the opening Tokens stand on the mat (FP-44).
        if (state.board) {
            state.board.tray = [];
        }
        for (const { typeId, x, y } of openingMat()) {
            BoardState.addToken(
                BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)), x, y
            );
        }
        // What a loaded save gets on `game_loaded`: the tile caches built for
        // the Tokens already standing on the mat.
        TileModifiers.rebuildAll();

        // Initialize exploration tracking
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }

        logger.info('Engine', 'New game: 0 heroes, the Guild Hall on the mat, an empty Tray, 0 items.');
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
        // `cards_updated` was published here too until 2026-08-26 (CR2-046).
        // It retired with the card system and had no subscribers left.
    }
};
