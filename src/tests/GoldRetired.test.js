import { describe, it, expect, beforeEach } from 'vitest';
import { statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { SRC, listFiles, readSource, SCAN_TIMEOUT } from './fixtures/sourceScan.js';

/**
 * Slice 2.2 — gold removed from play (gold is retired, items are the only
 * price).
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
});

describe('No action earns or spends gold (SP-65)', () => {
    it('a new game has no gold at all', () => {
        expect(GameState.state.currency).toBeUndefined();
    });
});

describe('Coins floor loot collection', () => {
    // ⚠️ Changed in slice 2.2. This used to assert the pile credited 2000
    // gold. Gold is retired: the coins are swept off the floor and pay
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

describe('No screen renders gold (SP-65)', { timeout: SCAN_TIMEOUT }, () => {
    const files = listFiles(`${SRC}/ui`, { ext: /\.(jsx|js)$/ });

    it('no UI component reads the gold balance', () => {
        const readers = files.filter(f => /currency\?*\.gold/.test(readSource(f)));
        expect(readers).toEqual([]);
    });

    it('no UI component writes a gold amount or a sale price', () => {
        const offenders = files.filter(f => {
            const text = readSource(f);
            return /\} GP\b|GP<\/span>|\} gold\b|for \$\{[^}]+\}g`|SellControls|sellItem|TokenBank\.sell\(/.test(text);
        });
        expect(offenders).toEqual([]);
    });
});
