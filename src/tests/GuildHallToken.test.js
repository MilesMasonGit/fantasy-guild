import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { CurrencyManager } from '../systems/economy/CurrencyManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { OPENING_TRAY } from '../systems/core/EngineBootstrap.js';
import { GUILD_HALL_TILE } from '../config/boardGeometry.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';

describe('Guild Hall Mobile Token (New Token System)', () => {
    beforeEach(() => {
        GameState.initNew();
        TileModifiers.clearAll();
        GuildUpgradeManager.recompute();
    });

    it('starts with the Guild Hall token in the opening tray for new games', () => {
        expect(OPENING_TRAY).toContain('token_guild_hall');
    });

    it('can be placed from tray onto any legal tile including Tile 24', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');
        
        // Place on Tile 24 (the center tile)
        const resCenter = Placement.placeToken(GUILD_HALL_TILE, gh);
        expect(resCenter.success).toBe(true);
        expect(BoardState.getToken(GUILD_HALL_TILE).typeId).toBe('token_guild_hall');

        // Move to another tile (Tile 10)
        const resMove = Placement.moveToken(GUILD_HALL_TILE, 10);
        expect(resMove.success).toBe(true);
        expect(BoardState.getToken(GUILD_HALL_TILE)).toBeNull();
        expect(BoardState.getToken(10).typeId).toBe('token_guild_hall');
    });

    it('cannot be removed from the playmat back to Tray or Vault once placed, and emits a disallow alert', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');
        Placement.placeToken(15, gh);

        const alerts = [];
        const unsub = EventBus.subscribe('board:tile_event_alert', (e) => alerts.push(e));

        // Attempt return to Tray
        const trayRes = Placement.returnTokenToTray(15);
        expect(trayRes.success).toBe(false);
        expect(trayRes.reason).toMatch(/cannot be removed from the playmat/i);
        expect(BoardState.getToken(15)).not.toBeNull();

        expect(alerts).toHaveLength(1);
        expect(alerts[0].tile).toBe(15);
        expect(alerts[0].severity).toBe('disallow');
        expect(alerts[0].type).toBe('drop_rejected');
        expect(alerts[0].title).toBe('Guild Hall cannot be removed from the playmat.');

        // Attempt deposit to Vault
        const vaultRes = Placement.returnTokenToVault(15);
        expect(vaultRes.success).toBe(false);
        expect(vaultRes.reason).toMatch(/cannot be removed from the playmat/i);
        expect(BoardState.getToken(15)).not.toBeNull();

        expect(alerts).toHaveLength(2);
        expect(alerts[1].tile).toBe(15);
        expect(alerts[1].severity).toBe('disallow');
        expect(alerts[1].title).toBe('Guild Hall cannot be removed from the playmat.');

        unsub();
    });

    it('allows heroes to staff the Guild Hall token', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');
        Placement.placeToken(20, gh);

        const heroRes = Placement.placeHero('hero_test_1', 20);
        expect(heroRes.success).toBe(true);
        expect(BoardState.heroOnTile(20)).toBe('hero_test_1');
    });

    describe('Push & Cascade Shoving Protection', () => {
        it('shoves adjacent tokens out of the way when Guild Hall is pushed at board boundary', () => {
            // Place regular token on corner tile 0 and Guild Hall on tile 1
            const regularA = BoardState.createTokenInstance('token_copper_pickaxe');
            const gh = BoardState.createTokenInstance('token_guild_hall');
            const incoming = BoardState.createTokenInstance('token_copper_ore_vein');

            Placement.placeToken(0, regularA);
            Placement.placeToken(1, gh);

            // Drop incoming token onto tile 1 (where Guild Hall is)
            const res = Placement.placeToken(1, incoming);
            expect(res.success).toBe(true);

            // Guild Hall must still be on the board (shoved to tile 0 or an open neighbor)
            const ghFound = BoardState.occupiedTiles().find(([idx, inst]) => inst?.typeId === 'token_guild_hall');
            expect(ghFound).toBeDefined();
            expect(ghFound[0]).toBeDefined();
        });

        it('is never displaced to Tray during a 2x2 cascade placement', () => {
            // Place Guild Hall inside a 2x2 footprint (e.g. tile 8 in 2x2 anchored at 0)
            const gh = BoardState.createTokenInstance('token_guild_hall');
            Placement.placeToken(8, gh);

            // 2x2 token
            const bearDef = getTokenType('token_smelter') || { size: 2 };
            bearDef.size = 2;

            const res = Placement.placeToken(0, { typeId: 'token_smelter', usesRemaining: null });
            expect(res.success).toBe(true);

            // Guild Hall MUST still be on the playmat
            const ghPos = BoardState.occupiedTiles().find(([idx, inst]) => inst?.typeId === 'token_guild_hall');
            expect(ghPos).toBeDefined();
            expect(BoardState.getTray().some(t => t.typeId === 'token_guild_hall')).toBe(false);
        });
    });

    describe('Wishing Well Upgrade and Water Generation', () => {
        it('is accessible on Tile 31 directly from the start', () => {
            expect(GuildUpgradeManager.isAccessible('wishing_well')).toBe(true);
        });

        it('dynamically configures water output on Guild Hall token based on upgrade level', () => {
            // Initially rank 0
            expect(GuildUpgradeManager.getRank('wishing_well')).toBe(0);
            const ghDef = getTokenType('token_guild_hall');
            expect(ghDef.config).toBeNull();

            // Give gold and purchase rank 1
            CurrencyManager.addGold(1000);
            const p1 = GuildUpgradeManager.purchase('wishing_well');
            expect(p1.success).toBe(true);
            expect(GuildUpgradeManager.getRank('wishing_well')).toBe(1);

            // Guild Hall should now output 1 item_water every 10s
            expect(ghDef.config).toBeDefined();
            expect(ghDef.config.cycleTimeMs).toBe(10000);
            expect(ghDef.config.outputs).toHaveLength(1);
            expect(ghDef.config.outputs[0].itemId).toBe('item_water');
            expect(ghDef.config.outputs[0].minQty).toBe(1);
            expect(ghDef.config.outputs[0].maxQty).toBe(1);

            // Upgrade to rank 3 (3 water)
            CurrencyManager.addGold(5000);
            GuildUpgradeManager.purchase('wishing_well');
            GuildUpgradeManager.purchase('wishing_well');
            expect(GuildUpgradeManager.getRank('wishing_well')).toBe(3);
            expect(ghDef.config.outputs[0].minQty).toBe(3);
            expect(ghDef.config.outputs[0].maxQty).toBe(3);
        });

        it('operates on a 10s cycle and is unaffected by playmat buffs', () => {
            CurrencyManager.addGold(1000);
            GuildUpgradeManager.purchase('wishing_well'); // rank 1 = 1 water

            const gh = BoardState.createTokenInstance('token_guild_hall');
            Placement.placeToken(24, gh);
            Placement.placeHero('hero_test_1', 24);

            // Inject a mock haste/speed modifier on tile 24 that would normally cut work time in half
            TileModifiers.getTileAggregator(24).addModifier(EFFECT_TYPES.WORK_TIME, {
                percentage: -0.50
            });

            // Run 5000ms: should NOT complete yet because Guild Hall cycle is strictly 10000ms
            BoardRunner.tick(5000);
            expect(gh.cycleElapsedMs).toBe(5000);

            // Run another 5000ms: completes the 10s cycle and generates water
            BoardRunner.tick(5000);
            expect(gh.cycleElapsedMs).toBe(0);
        });
    });
});
