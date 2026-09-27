import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';

/**
 * Slice 2.2 — gold removed from play (SP-65: gold is retired, items are the
 * only price).
 *
 * Every action that used to earn or spend gold is exercised here and gold must
 * stay at 0. The Market Token's currency output is covered in `Market.test.js`
 * and `RosterAndMarkets.test.js`; coin loot below (it moved here from
 * `MapBurst.test.js` when the Map bursts were deleted, Token Lifecycle 9.1).
 *
 * Two cases went with the Map code in 9.1: the Oak-Wood-priced Map purchase
 * (there is no Map purchase now) and a gold entry in a burst (there are no
 * bursts).
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
});

describe('No action earns or spends gold (SP-65)', () => {
    afterEach(() => QuestManager.cleanup());

    it('a new game has no gold at all, and every tutorial quest pays items', () => {
        expect(GameState.state.currency).toBeUndefined();
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
        expect(GameState.state.currency).toBeUndefined();
        expect(BoardState.tokens().some(t => getTokenType(t.typeId)?.mapId)).toBe(false);
        // Each step pays its own small reward (slice 9.5); every item arrives.
        const owed = {};
        for (const t of TUTORIAL_QUESTS) {
            for (const r of t.rewardItems) owed[r.itemId] = (owed[r.itemId] || 0) + r.quantity;
        }
        for (const [itemId, quantity] of Object.entries(owed)) {
            expect(InventoryManager.getItemCount(itemId), itemId).toBe(quantity);
        }
    });

});

describe('Coins floor loot collection', () => {
    // ⚠️ Changed in slice 2.2 (SP-65). This used to assert the pile credited
    // 2000 gold. Gold is retired: the coins are swept off the floor and pay
    // nothing, and they are not banked as an item either.
    it('sweeps coins off the floor without crediting gold or banking them (SP-65)', () => {
        const sprite = SpriteLayer.addSprite('item', 'item_coins', 2000, { x: 0.5, y: 0.5 });
        expect(sprite).toBeDefined();
        expect(sprite.refId).toBe('item_coins');
        expect(sprite.quantity).toBe(2000);

        const collected = SpriteLayer.collectSprite(sprite.id);
        expect(collected).toBe(true);
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
        expect(InventoryManager.getItemCount('item_coins')).toBe(0);
        expect(SpriteLayer.getSprites().some(s => s.id === sprite.id)).toBe(false);
    });
});

describe('The gold code is deleted (Token Lifecycle 9.4)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = join(here, '..');

    it('CurrencyManager, CommerceSystem, TransactionProcessor and SellControls are gone', () => {
        for (const rel of [
            'systems/economy/CurrencyManager.js',
            'systems/economy/CommerceSystem.js',
            'systems/economy/TransactionProcessor.js',
            'ui/components/drawer/SellControls.jsx'
        ]) {
            expect(() => statSync(join(src, rel)), rel).toThrow();
        }
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
            return /\} GP\b|GP<\/span>|\} gold\b|for \$\{[^}]+\}g`|SellControls|sellItem|TokenBank\.sell\(/.test(text);
        });
        expect(offenders).toEqual([]);
    });
});
