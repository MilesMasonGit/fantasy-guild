import { logger } from '../../utils/Logger.js';
import { EventBus } from './EventBus.js';
import { GameLoop } from './GameLoop.js';
import { TimeManager } from './TimeManager.js';
import * as CatchUp from './CatchUp.js';
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
import * as LoadoutMoments from '../board/LoadoutMoments.js';
import * as BoardPromotion from '../board/BoardPromotion.js';
import * as MatResize from '../board/MatResize.js';
import * as Flags from '../board/Flags.js';
import * as FlagRules from '../board/FlagRules.js';
// Marking Tokens for demolition from the console (`Game.Demolition.mark(id)`).
import * as Demolition from '../board/Demolition.js';
import { QuestManager } from '../quests/QuestManager.js';
// Quest Tokens on the mat, exposed for console probes (`Game.QuestTokens`).
import * as QuestTokens from '../quests/QuestTokens.js';
// Enemies pottering by their spawner (`Game.EnemyMotion`).
import * as EnemyMotion from '../board/EnemyMotion.js';
// Hostile enemies attacking heroes near their spawner (`Game.Hostiles`).
import * as Hostiles from '../board/Hostiles.js';
import * as SpawnerSystem from '../board/SpawnerSystem.js';
// The guild's Regions and travel (`Game.Atlas`).
import * as Atlas from '../atlas/Atlas.js';
import * as RegionRules from '../atlas/RegionRules.js';
import * as StarterCamp from '../atlas/StarterCamp.js';
import { reportContentIntegrity, reportSaveContent } from './ContentAudit.js';
import { ENGINE_EVENTS } from './engineEvents.js';

/**
 * The Tokens a new game opens with, at their points on the mat as it is now: the Starter Camp's
 * (`StarterCamp.js`), the Guild Hall first. A new game opens with zero Heroes.
 *
 * ⚠️ A function, not a constant: the mat's size is live (`matGeometry.js`).
 *
 * @returns {Array<{typeId: string, x: number, y: number}>}
 */
export function openingMat() {
    return StarterCamp.placementsOf();
}

/** EngineBootstrap - Orchestrates game lifecycle and system registration. */
export const EngineBootstrap = {
    /** Assemble all core systems into a unified Engine object for context-based UI access. */
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
            Demolition,
            QuestManager,
            QuestTokens,
            EnemyMotion,
            Hostiles,
            Atlas,
            TimeManager,
            GuildUpgradeManager,
            GameLoop,
            CatchUp
        };
    },

    /**
     * Entry point for game-ready initialization
     */
    init() {
        logger.info('Engine', 'Initializing Game Systems...');
        
        // 1. System Subscriptions
        LootSystem.init();
        CatchUp.init();             // gaps the live loop could not deliver
        GuildUpgradeManager.init(); // Guild Hall upgrade tree

        // Unified status effect engine (buffs/debuffs on the 5s global clock)
        StatusEffectSystem.init();

        // Loot sprites. ⚠️ Must init BEFORE anything can produce: it carries the
        // guarantee that nothing is lost to a full Bank, and that guarantee is
        // exactly one subscription deep.
        SpriteLayer.init();
        // A hero arriving changes which Tokens a `being worked` filter reaches,
        // so the tile caches follow hero movement as well as board changes.
        TileModifiers.init();
        // The mat can be resized while the game runs; shrinking pulls back what no longer fits, and this is what listens.
        MatResize.init();
        BoardRunner.init();
        BoardCombat.init();
        // Subscribes to COMBAT_ENGAGED. ⚠️ Must come after BoardRunner.init() (which calls
        // TriggerSystem.init() internally) so this subscription registers LAST for that event.
        LoadoutMoments.init();
        BoardPromotion.init();
        Flags.init();
        QuestManager.init();
        SpawnerSystem.init();
        // The active Region's own rules, put back in the guild-wide aggregator on every load,
        // travel and new game.
        RegionRules.init();

        // 2. Register Game Loop Intervals
        this._registerTickHandlers();

        reportContentIntegrity({ starterCamp: StarterCamp.starterCamp() });

        // The same audit over the loaded SAVE, on every load: the content audit above
        // cannot see a Token renamed after the save was written. Reports only.
        EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => reportSaveContent(GameState.state));

        logger.info('Engine', 'Core systems ready.');
    },

    /**
     * Register the tick handlers with GameLoop. Priorities are explicit and spaced
     * by ten. Only one relation is load-bearing: `quest_manager` before `board_runner`
     * draws a bounty Token's spawn a tick earlier and consumes the shared random stream
     * in a different order (`TickHandlerOrder.test.js` pins the order).
     */
    _registerTickHandlers() {
        // 10: the game clock. Nothing else reads a tick-fresher gameTimeMs.
        GameLoop.onTick('time_tracking', (delta) => {
            if (GameState.getIsInitialized()) {
                GameState.updateTime({
                    gameTimeMs: GameState.time.gameTimeMs + delta,
                    lastTickAt: Date.now()
                });
                // Lifetime playtime for the save-slot screen.
                GameState.state.meta.totalPlaytime = (GameState.state.meta.totalPlaytime || 0) + delta;
            }
        }, 10);

        // 20: live effect instances — poisons, regenerations, anything with a
        // clock on it. Fires on the 5s status interval.
        GameLoop.onTick('live_effects', (delta) => {
            if (GameState.getIsInitialized()) {
                LiveEffects.tick(delta, TriggerSystem.fireLiveStatement);
            }
        }, 20);

        // 30: hero regen.
        GameLoop.onTick('regen_system', (delta) => {
            if (GameState.getIsInitialized()) RegenSystem.tick(delta);
        }, 30);

        // 40: the board (spawners, growth, work, combat). ⚠️ Must run BEFORE
        // `quest_manager` (50): a bounty spawned before the board advances this
        // tick is seen one tick earlier and draws from the shared random stream
        // in a different order.
        GameLoop.onTick('board_runner', (delta) => {
            if (GameState.getIsInitialized()) BoardRunner.tick(delta);
        }, 40);

        // 50: bounty quests. Must run AFTER `board_runner` (40) — see there.
        GameLoop.onTick('quest_manager', (delta) => {
            if (GameState.getIsInitialized()) QuestManager.tick(delta);
        }, 50);

        // 60: loot sprites.
        GameLoop.onTick('sprite_layer', (delta) => {
            if (GameState.getIsInitialized()) SpriteLayer.tick(delta);
        }, 60);

        // 70: the wounded clock.
        GameLoop.onTick('wounded_system', (delta) => {
            if (GameState.getIsInitialized()) WoundedSystem.tick(delta);
        }, 70);

        // 80: status effects.
        GameLoop.onTick('status_effects', (delta) => {
            if (GameState.getIsInitialized()) StatusEffectSystem.tick(delta);
        }, 80);
    },

    /**
     * Play the time the game was closed (`CatchUp.run`, up to 24 h), then save once. A failure is
     * reported and the game goes on from where it is; the slot still holds the save it loaded.
     * @returns {Promise<object|null>} the catch-up's result, or null
     */
    async catchUpOnLoad() {
        const savedAt = SaveManager.loadedSavedAt;
        // The untouched save, for "Load as I left it"; taken either way so it is not held on to.
        const before = SaveManager.takeLoadedJson();
        if (!savedAt) return null;
        try {
            return await CatchUp.run({ savedAt, reset: false, before });
        } catch (err) {
            console.error('[Engine] Catching up the time away failed', err);
            return null;
        }
    },

    /** Create the default game data for a new game. */
    createDefaultGameData() {
        logger.debug('Engine', 'Creating default game data...');

        const state = GameState.state;
        if (!state) return;
        const camp = StarterCamp.starterCamp();

        // The Bank starts with the Starter Camp's items only. Through
        // `InventoryManager`, like every other gain.
        if (state.inventory) state.inventory.items = {};
        for (const { itemId, quantity } of StarterCamp.openingBank(camp)) {
            InventoryManager.addItem(itemId, quantity, 'opening');
        }

        // Start with no Heroes (first hero recruited via Guild Hall upgrade)
        if (state.heroes) {
            state.heroes = [];
        }

        // The Starter Camp's Tokens stand on the mat, and it becomes the guild's first Region.
        Atlas.createStarterRegion(camp);
        // What a loaded save gets on `game_loaded`: the tile caches built for
        // the Tokens already standing on the mat.
        TileModifiers.rebuildAll();

        // Initialize exploration tracking
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }

        logger.info('Engine', `New game: 0 heroes, the ${StarterCamp.isBuiltIn() ? 'built-in' : 'synced'} Starter Camp on the mat, its items in the Bank.`);
    },

    /**
     * Finalize game preparation once a slot is selected. A loaded save first catches up the time
     * since it was written, before the loop starts.
     *
     * ⚠️ Async only for a load: a new game runs to the end synchronously.
     */
    async onSlotSelected(slotIndex, isNewGame) {
        logger.info('Engine', `Slot ${slotIndex + 1} finalized (New: ${isNewGame})`);

        // 1. Critical System Startups
        DiscoveryManager.init();
        AudioSystem.init();
        InventoryManager.init();

        // 2. Data Initialization
        if (isNewGame) {
            this.createDefaultGameData();
            // Save the finished opening now: the save that claimed the slot
            // (`SaveManager.newGame`) was written before the Hall and the opening
            // items existed, so a game that died before the next autosave loaded
            // as an empty table with no Guild Hall.
            SaveManager.save(false);
        } else {
            await this.catchUpOnLoad();
        }

        // 3. State Sync
        // ⚠️ Whatever is added here must be exercised from a fresh new game, not just
        // a loaded save: a path only a loaded save had been through once left a new
        // game booting to an empty screen unnoticed.

        // 4. Start the Engine
        GameLoop.start();

        // 5. Trigger Initial UI Sync. GAME_RESET is the one "everything may
        // have changed" event.
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: isNewGame ? 'new_game' : 'load' });
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
        EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
    }
};
