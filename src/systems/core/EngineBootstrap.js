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
import * as BoardCombat from '../board/BoardCombat.js';
import * as Managers from '../board/Managers.js';
import * as TokenBank from '../board/TokenBank.js';
import * as Cartographer from '../board/Cartographer.js';
import { tokenStartingUses } from '../../config/registries/tokenRegistry.js';

/**
 * The four Tokens a new game puts in the Tray (D-122/D-123).
 *
 * Exported so `ContentRules.test.js` can assert them against the Foundation
 * six rather than keeping its own copy of the list — a duplicated list is
 * exactly how the Still survived here after Alchemy became a specialist.
 */
export const OPENING_TRAY = [
    'token_forest',        // Logging — gather
    'token_trout_stream',  // Fishing — gather, and never depletes
    'token_stew_pot',      // Cooking — consumes what the Stream catches
    'token_sawmill'        // no hero needed; teaches adjacency
];

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
            BoardCombat,
            Managers,
            TokenBank,
            Cartographer,
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

        // The board's own systems land here as they are built:
        //   Phase 2 — BoardState / Placement
        //   Phase 3 — SpriteLayer
        //   Phase 4 — BoardRunner (the cycle engine)
        //   Phase 6 — board combat
        //   Phase 7 — Managers, driven from BoardRunner.tick
        //   Phase 8 — Cartographer (no tick: Maps cost no hero-time, D-142)
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

        // Combat has a tick owner again: `BoardRunner` routes enemy Tokens to
        // `BoardCombat`, which drives the unchanged `CombatProcessor`. That gap
        // (gap analysis §2.2) is closed.

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
    /**
     * The opening state of a new game (D-122, D-123, roadmap Phase 9 §D).
     *
     * The intended first minute is: **place Tokens → station the hero →
     * produce → sell → buy the first Map → burst it → receive new Tokens.**
     * The core loop must be reachable within a minute and the progression loop
     * within a session, which is why the first Map is priced as a visible
     * near-goal rather than a distant one.
     *
     * ## The board starts nearly empty, and that is intended (D-123)
     * Four Tokens on 48 tiles. **Emptiness is progress feedback, not a content
     * gap** — filling the board is the visible measure of growth, and inventing
     * filler to hide the space would delete the feedback. If the early board
     * ever reads as *barren* rather than *promising*, board size (D-1) is the
     * thing to revisit, not this function.
     *
     * ## One hero, not two
     * D-122 said two; **D-181 superseded it** with a roster that runs from 1 to
     * about 8 across the whole game, and the roadmap follows D-181. One hero
     * also makes the opening unambiguous — there is exactly one thing to place,
     * so the tutorial is the board rather than a prompt.
     */
    createDefaultGameData() {
        logger.debug('Engine', 'Creating default game data...');

        const state = GameState.state;
        if (!state) return;

        // Enough to buy the first Woodland Map (200g) after a little work —
        // close enough to feel reachable, far enough that the board earns it.
        if (state.currency) state.currency.gold = 120;

        // One hero (D-181). Recruitment grows the roster from here.
        if (!state.heroes?.length) {
            const hero = HeroManager.createHero();
            if (hero) HeroManager.addHero(hero);
        }

        // A few basic Commons, in the TRAY rather than on the board: placement
        // is the first thing the player does, and handing them a pre-built
        // board would skip the one action that teaches the game (grid §1).
        //
        // Deliberately a working chain rather than four of the same thing — two
        // nodes to gather from, a station that consumes what one of them makes,
        // and a Sawmill so adjacency is discoverable on the first board.
        //
        // ⚠️ **Changed for the skill rework.** The opening used to be Grove,
        // Seam, Still, Sawmill: the Still demanded Alchemy, a specialist skill
        // no Recruit holds, so a new player was handed a Token their only hero
        // could never work. Swapping in the Stew Pot fixes the skill but breaks
        // the chain — it eats shrimp, and nothing in the tray caught any — so
        // the Seam is replaced by the Trout Stream and the pair becomes a
        // genuine two-step: **fish → raw shrimp → Stew Pot → shrimp.**
        //
        // Mining is not in the opening any more. It is not lost: the Copper
        // Seam is still in the Woodland pool and arrives with the first Map,
        // which is a few minutes away.
        for (const typeId of OPENING_TRAY) {
            BoardState.addToTray(
                BoardState.createTokenInstance(typeId, tokenStartingUses(typeId))
            );
        }

        // Initialize exploration tracking
        if (!GameState.exploration) {
            GameState.exploration = { count: 0 };
        }

        // The Cartographer opens itself on a new game (D-122): the progression
        // loop should be visible from the first minute, with every Map listed
        // cheapest first. Deferred a beat so the React layer has mounted its
        // subscription before the event fires.
        setTimeout(() => EventBus.publish('ui:open_drawer', { tab: 'cartographer' }), 800);

        logger.info('Engine', `New game: 1 hero, ${OPENING_TRAY.length} Tokens in the Tray, 120 gold.`);
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
