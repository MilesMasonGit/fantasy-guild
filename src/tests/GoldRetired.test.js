import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';

/**
 * Slice 2.2 — gold removed from play (SP-65: gold is retired, items are the
 * only price).
 *
 * Every action that used to earn or spend gold is exercised here and gold must
 * stay at 0. The Market Token's currency output is covered in `Market.test.js`
 * and `RosterAndMarkets.test.js`; coin loot in `MapBurst.test.js`.
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
});

describe('No action earns or spends gold (SP-65)', () => {
    afterEach(() => QuestManager.cleanup());

    it('a new game starts at 0 gold, and every tutorial quest pays items', () => {
        expect(GameState.state.currency.gold).toBe(0);
        for (const t of TUTORIAL_QUESTS) {
            expect(t.rewardMapId, t.id).toBeUndefined();
            expect(t.rewardItems.length, t.id).toBeGreaterThan(0);
            for (const r of t.rewardItems) expect(r.itemId.startsWith('item_'), t.id).toBe(true);
        }
    });

    it('claiming every tutorial quest leaves gold at 0 and puts no Map on the mat', () => {
        QuestManager.init();
        for (const t of TUTORIAL_QUESTS) {
            const q = QuestManager.getActiveQuests().find(x => x.id === t.id);
            expect(q, t.id).toBeDefined();
            q.currentCount = q.requiredCount;
            expect(QuestManager.claimQuest(t.id).success, t.id).toBe(true);
        }
        expect(GameState.state.currency.gold).toBe(0);
        expect(BoardState.getTotalMapCount()).toBe(0);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(10 * TUTORIAL_QUESTS.length);
    });

    it('a Map is bought with Oak Wood, not gold', () => {
        const map = Cartographer.catalogue().find(m => m.priceItems.length > 0);
        expect(map, 'a priced Map').toBeDefined();
        const [price] = map.priceItems;
        expect(price.itemId).toBe('item_oak_wood');

        // Gold alone buys nothing.
        GameState.state.currency.gold = 1e9;
        expect(Cartographer.canBuy(map.id).success).toBe(false);
        GameState.state.currency.gold = 0;

        InventoryManager.addItem(price.itemId, price.quantity);
        expect(Cartographer.buyMap(map.id).success).toBe(true);
        expect(InventoryManager.getItemCount(price.itemId)).toBe(0);
        expect(GameState.state.currency.gold).toBe(0);
    });

    it('a gold entry in a Map burst pays nothing', () => {
        // Open the scripted Guild Hall Map through its whole sequence.
        for (let i = 0; i < 12; i++) {
            Cartographer.openMap({ typeId: 'token_guild_hall_map', mapId: 'map_guild_hall' });
        }
        for (const s of SpriteLayer.getSprites()) SpriteLayer.collectSprite(s.id);
        expect(GameState.state.currency.gold).toBe(0);
    });
});

describe('No screen renders gold (SP-65)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const uiRoot = join(here, '..', 'ui');
    const files = [];
    (function walk(dir) {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) walk(p);
            else if (/\.(jsx|js)$/.test(name)) files.push(p);
        }
    })(uiRoot);

    it('no UI component reads the gold balance', () => {
        const readers = files.filter(f => /currency\?*\.gold/.test(readFileSync(f, 'utf8')));
        expect(readers).toEqual([]);
    });

    it('no UI component writes a gold amount or a sale price', () => {
        const offenders = files.filter(f => {
            const text = readFileSync(f, 'utf8');
            return /\} GP\b|GP<\/span>|\} gold\b|for \$\{[^}]+\}g`|SellControls|sellItem|TokenBank\.sell\(/.test(text)
                && !f.endsWith('SellControls.jsx')
                && !f.endsWith('EntityRibbon.jsx');
        });
        expect(offenders).toEqual([]);
    });
});
