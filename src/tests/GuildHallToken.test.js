import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { openingMat } from '../systems/core/EngineBootstrap.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { PASSIVE_PRODUCTION_MS } from '../config/registries/tokenConstants.js';

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

    describe('Wishing Well Upgrade and Water Generation (T-099)', () => {
        const water = () => SpriteLayer.countOnBoard('item_water');

        it('is accessible on Tile 31 directly from the start', () => {
            expect(GuildUpgradeManager.isAccessible('wishing_well')).toBe(true);
        });

        it("never rewrites the Guild Hall's type: it has no work cycle at any rank", () => {
            const ghDef = getTokenType('token_guild_hall');
            const before = { config: ghDef.config, tokenType: ghDef.tokenType, requiresHero: ghDef.requiresHero };
            expect(ghDef.config).toBeNull();

            expect(GuildUpgradeManager.purchase('wishing_well').success).toBe(true);   // rank 1 is free
            for (let i = 0; i < 2; i++) {
                GuildUpgradeManager.getNextCost('wishing_well')
                    .forEach(p => InventoryManager.addItem(p.itemId, p.quantity));
                expect(GuildUpgradeManager.purchase('wishing_well').success).toBe(true);
            }
            expect(GuildUpgradeManager.getRank('wishing_well')).toBe(3);
            expect({ config: ghDef.config, tokenType: ghDef.tokenType, requiresHero: ghDef.requiresHero }).toEqual(before);
        });

        it('pays 10 Water per rank every 5 minutes as Passive Production, no hero on the Hall', () => {
            SpriteLayer.init();
            const gh = BoardState.createTokenInstance('token_guild_hall');
            put(24, gh);

            BoardRunner.tick(PASSIVE_PRODUCTION_MS);
            expect(water()).toBe(0);                                // rank 0: no Water

            GuildUpgradeManager.purchase('wishing_well');            // rank 1
            BoardRunner.tick(PASSIVE_PRODUCTION_MS - 1);
            expect(water()).toBe(0);
            BoardRunner.tick(1);
            expect(water()).toBe(10);

            GuildUpgradeManager.getNextCost('wishing_well').forEach(p => InventoryManager.addItem(p.itemId, p.quantity));
            GuildUpgradeManager.purchase('wishing_well');            // rank 2
            BoardRunner.tick(PASSIVE_PRODUCTION_MS);
            expect(water()).toBe(30);
            expect(GuildUpgradeManager.getDisplayList().find(u => u.id === 'wishing_well').statLabel).toBe('20 Water / 5 min');
        });

        it("a hero's flag on the Hall changes nothing: no work cycle, the same timer", () => {
            SpriteLayer.init();
            GuildUpgradeManager.purchase('wishing_well');
            const gh = BoardState.createTokenInstance('token_guild_hall');
            put(24, gh);
            plant('hero_test_1', 24);

            BoardRunner.tick(10000);
            expect(gh.cycleElapsedMs || 0).toBe(0);
            BoardRunner.tick(PASSIVE_PRODUCTION_MS - 10000);
            expect(water()).toBe(10);
        });
    });
});
