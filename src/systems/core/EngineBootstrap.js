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
import { QuestManager } from '../quests/QuestManager.js';
// B6.1: quest Tokens on the mat, exposed for console probes (`Game.QuestTokens`).
import * as QuestTokens from '../quests/QuestTokens.js';
// B7.1: enemies pottering by their spawner (`Game.EnemyMotion`).
import * as EnemyMotion from '../board/EnemyMotion.js';
// B7.2: hostile enemies attacking heroes near their spawner (`Game.Hostiles`).
import * as Hostiles from '../board/Hostiles.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { matW, matH } from '../../config/matGeometry.js';
import { reportContentIntegrity, reportSaveContent } from './ContentAudit.js';

/**
 * The opening state of a new game (FP-44): the Guild Hall already standing on
 * the mat with the starter set beside it (10.1), and zero Heroes. The Bank's
 * opening items are `OPENING_ITEMS`, below.
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
 * ## The starter set (Token Lifecycle 10.1, SP-14; contents are SP-72 placeholders)
 * Beside the Hall stand an **Oak Forest** (left) and a **Copper Mine** (right),
 * both `placed`: the Forest turns Oak Seeds into Oak Trees, and Oak Wood buys
 * everything else at the Shop; the Mine needs no upkeep. `OPENING_OFFSET` keeps
 * them clear of the Hall's art and close enough that one flag between them
 * reaches both.
 *
 * @returns {Array<{typeId: string, x: number, y: number}>}
 */
export function openingMat() {
    const x = Math.round(matW() / 2);
    const y = Math.round(matH() / 2);
    return [
        { typeId: 'token_guild_hall', x, y },
        { typeId: 'token_oak_forest', x: x - OPENING_OFFSET, y },
        { typeId: 'token_copper_mine', x: x + OPENING_OFFSET, y }
    ];
}

/** How far the starter Forest and Mine stand from the Hall's centre, in mat units. */
export const OPENING_OFFSET = 320;

/**
 * What a new game's Bank holds (Token Lifecycle 10.1, SP-14, SP-72
 * placeholders): Oak Seeds so the Forest spawns trees at once (it pays one
 * seed per spawn), a little Oak Wood towards the first Shop purchase, and two
 * Wheat Seeds for the first Farmland. The Guild Hall's trickle (in the CMS)
 * keeps the seeds coming.
 */
export const OPENING_ITEMS = Object.freeze([
    Object.freeze({ itemId: 'item_oak_seed', quantity: 3 }),
    Object.freeze({ itemId: 'item_oak_wood', quantity: 10 }),
    Object.freeze({ itemId: 'item_wheat_seed', quantity: 2 })
]);

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
            QuestManager,
            QuestTokens,
            EnemyMotion,
            Hostiles,
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
    /**
     * ⭐ **Explicit priorities (CR3-031, round 3 review R1 §6).** `onTick`
     * defaults every handler to 100, so this order used to come only from
     * `Array.prototype.sort`'s stability plus registration order below — true,
     * but accidental. A permutation spike (R1: same seed, 4,000 S2 ticks, a
     * uses/Bank/XP fingerprint) found every reordering gives an identical
     * result **except one**: `quest_manager` before `board_runner` draws a
     * bounty Token's spawn one tick earlier, consuming the shared random
     * stream in a different order (uses 125,738 → 125,739, Bank 498 → 497,
     * XP 491,452 → 491,449). So only that one relation is load-bearing; the
     * ten-apart spacing below reproduces today's registration order exactly
     * (`TickHandlerOrder.test.js` pins `quest_manager` after `board_runner`)
     * while leaving room to insert a handler later without renumbering nine.
     */
    _registerTickHandlers() {
        // 10: the game clock. Nothing else reads a tick-fresher gameTimeMs.
        GameLoop.onTick('time_tracking', (delta) => {
            if (GameState.getIsInitialized()) {
                GameState.updateTime({
                    gameTimeMs: GameState.time.gameTimeMs + delta,
                    lastTickAt: Date.now()
                });
                // Lifetime playtime for the save-slot screen (CR-006).
                GameState.state.meta.totalPlaytime = (GameState.state.meta.totalPlaytime || 0) + delta;
            }
        }, 10);

        // 20: live effect instances — poisons, regenerations, anything with a
        // clock on it. Fires on the same 5s interval the status engine used, so
        // a re-authored Poison ticks at exactly the rate it always did. No
        // ordering dependency on the board found by the spike; kept early as
        // it always ran.
        GameLoop.onTick('live_effects', (delta) => {
            if (GameState.getIsInitialized()) {
                LiveEffects.tick(delta, TriggerSystem.fireLiveStatement);
            }
        }, 20);

        // 30: hero regen. No measured ordering dependency.
        GameLoop.onTick('regen_system', (delta) => {
            if (GameState.getIsInitialized()) RegenSystem.tick(delta);
        }, 30);

        // 40: the board (spawners, growth, work, combat). ⚠️ Must run BEFORE
        // `quest_manager` (50): a bounty spawned before the board advances this
        // tick is seen one tick earlier, drawing from the shared random stream
        // in a different order (R1 permutation spike, above).
        GameLoop.onTick('board_runner', (delta) => {
            if (GameState.getIsInitialized()) BoardRunner.tick(delta);
        }, 40);

        // 45: the time bank. No measured ordering dependency; kept between the
        // board and the quest manager, as registered.
        GameLoop.onTick('time_bank', (delta) => {
            if (GameState.getIsInitialized()) TimeBankManager.tick(delta);
        }, 45);

        // 50: bounty quests. Must run AFTER `board_runner` (40) — see there.
        GameLoop.onTick('quest_manager', (delta) => {
            if (GameState.getIsInitialized()) QuestManager.tick(delta);
        }, 50);

        // 60: loot sprites. No measured ordering dependency.
        GameLoop.onTick('sprite_layer', (delta) => {
            if (GameState.getIsInitialized()) SpriteLayer.tick(delta);
        }, 60);

        // 70: the wounded clock. No measured ordering dependency.
        GameLoop.onTick('wounded_system', (delta) => {
            if (GameState.getIsInitialized()) WoundedSystem.tick(delta);
        }, 70);

        // 80: status effects. No measured ordering dependency.
        GameLoop.onTick('status_effects', (delta) => {
            if (GameState.getIsInitialized()) StatusEffectSystem.tick(delta);
        }, 80);
    },

    /**
     * Create default heroes and cards for a new game
     */
    createDefaultGameData() {
        logger.debug('Engine', 'Creating default game data...');

        const state = GameState.state;
        if (!state) return;

        // The Bank starts with the opening items only (10.1). Through
        // `InventoryManager`, like every other gain.
        if (state.inventory) state.inventory.items = {};
        for (const { itemId, quantity } of OPENING_ITEMS) {
            InventoryManager.addItem(itemId, quantity, 'opening');
        }

        // Start with no Heroes (first hero recruited via Guild Hall upgrade)
        if (state.heroes) {
            state.heroes = [];
        }

        // The opening Tokens stand on the mat (FP-44).
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

        logger.info('Engine', 'New game: 0 heroes, the starter Tokens on the mat, the opening items in the Bank.');
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
            // Save the finished opening now (CR3-100). The save that claimed
            // the slot (`SaveManager.newGame`) was written before the Hall and
            // the opening items existed, and the next one is the autosave
            // minutes later, so a game that died before then loaded as an
            // empty table with no Guild Hall.
            SaveManager.save(false);
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
