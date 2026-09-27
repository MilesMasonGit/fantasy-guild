import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { openingMat } from '../systems/core/EngineBootstrap.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles,
 * and the Guild Hall no longer has one of its own — it stands wherever it is
 * put, like everything else.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** Put a Token on spot `i`, and plant a hero's flag there. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));
const plant = (heroId, i) => Placement.plantFlagAt(heroId, C(i));

describe('Guild Hall Mobile Token (New Token System)', () => {
    beforeEach(() => {
        GameState.initNew();
        TileModifiers.clearAll();
        GuildUpgradeManager.recompute();
    });

    it('starts with the Guild Hall token on the mat for new games (FP-44)', () => {
        expect(openingMat().map(t => t.typeId)).toContain('token_guild_hall');
    });

    it('can be placed anywhere on the mat, and moved anywhere else', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');

        const resCentre = put(21, gh);
        expect(resCentre.success).toBe(true);
        expect(tokenAt(21).typeId).toBe('token_guild_hall');

        const resMove = Placement.moveTokenTo(gh.id, C(10));
        expect(resMove.success).toBe(true);
        expect(tokenAt(21)).toBeNull();
        expect(tokenAt(10).typeId).toBe('token_guild_hall');
    });

    // Was 'cannot be removed from the playmat to the Vault once placed, and
    // emits a disallow alert'. The Vault route (and its alert) went in Token
    // Lifecycle 9.3; Remove (5.2) is the one way off the mat, and it refuses
    // the Hall too.
    it('cannot be removed from the playmat once placed', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');
        put(15, gh);

        const res = Placement.removePlacedToken(idAt(15));
        expect(res.success).toBe(false);
        expect(res.reason).toMatch(/cannot be removed from the playmat/i);
        expect(tokenAt(15)).not.toBeNull();
    });

    it('allows heroes to staff the Guild Hall token', () => {
        const gh = BoardState.createTokenInstance('token_guild_hall');
        put(20, gh);

        const heroRes = plant('hero_test_1', 20);
        expect(heroRes.success).toBe(true);
        // Under flags (1.4b) the hero's flag stands on the Hall. With no Wishing
        // Well rank the Hall has no work cycle, so there is nothing to claim.
        expect(BoardState.displayPointOf('hero_test_1')).toEqual({ x: gh.x, y: gh.y });
    });

    /**
     * ⭐ Free placement (slice 1.6d-1) deleted the push and the cascade, and
     * with them the special shove that kept the Guild Hall on the board when
     * something landed on it. It needs no protection any more: a drop that has
     * no room moves **itself**, so nothing can push the Hall anywhere at all.
     */
    describe('Nothing can shove the Guild Hall (slice 1.6d-1)', () => {
        it('a Token dropped on the Guild Hall leaves it exactly where it stands', () => {
            const gh = BoardState.createTokenInstance('token_guild_hall');
            put(1, gh);
            const where = { x: gh.x, y: gh.y };

            const incoming = BoardState.createTokenInstance('token_copper_ore_vein');
            const res = put(1, incoming);

            expect(res.success).toBe(true);
            expect({ x: BoardState.getTokenById(gh.id).x, y: BoardState.getTokenById(gh.id).y }).toEqual(where);
        });

        it('a large Token dropped over it does not move it', () => {
            const gh = BoardState.createTokenInstance('token_guild_hall');
            put(8, gh);
            const where = { x: gh.x, y: gh.y };

            const bearDef = getTokenType('token_smelter') || { size: 2 };
            bearDef.size = 2;
            // Dropped straight onto the Hall: it is the newcomer that moves.
            const res = put(8, { typeId: 'token_smelter', usesRemaining: null });

            expect(res.success).toBe(true);
            expect({ x: BoardState.getTokenById(gh.id).x, y: BoardState.getTokenById(gh.id).y }).toEqual(where);
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

            // Rank 1 is free (it is the tutorial's first upgrade)
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

            // Upgrade to rank 3 (3 water). Paid in items since slice 2.1
            // (SP-65); this used to add 5000 gold.
            for (let i = 0; i < 2; i++) {
                GuildUpgradeManager.getNextCost('wishing_well')
                    .forEach(p => InventoryManager.addItem(p.itemId, p.quantity));
                expect(GuildUpgradeManager.purchase('wishing_well').success).toBe(true);
            }
            expect(GuildUpgradeManager.getRank('wishing_well')).toBe(3);
            expect(ghDef.config.outputs[0].minQty).toBe(3);
            expect(ghDef.config.outputs[0].maxQty).toBe(3);
        });

        it('operates on a 10s cycle and is unaffected by playmat buffs', () => {
            GuildUpgradeManager.purchase('wishing_well'); // rank 1 = 1 water (free)

            const gh = BoardState.createTokenInstance('token_guild_hall');
            put(24, gh);
            plant('hero_test_1', 24);

            // Inject a mock haste/speed modifier on tile 24 that would normally cut work time in half
            TileModifiers.getTokenAggregator(gh.id).addModifier(EFFECT_TYPES.WORK_TIME, {
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
