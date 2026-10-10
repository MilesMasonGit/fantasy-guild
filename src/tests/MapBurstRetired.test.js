import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as BoardState from '../systems/board/BoardState.js';
import { DatabaseManager } from '../config/DatabaseManager.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';

/**
 * The Map bursts are retired, and so is the Map catalogue behind them: maps are items now
 * (`systems/atlas/mapItems.js`).
 */

const src = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('The burst code is deleted (9.1)', () => {
    it('Cartographer, the Guild Hall Maps and the Map inspection panel are gone', () => {
        for (const rel of [
            'systems/board/Cartographer.js',
            'config/registries/guildHallMaps.js',
            'ui/components/drawer/MapInspection.jsx'
        ]) {
            expect(() => statSync(join(src, rel)), rel).toThrow();
        }
    });

    it('the Shop panel has no Maps section', () => {
        const tab = readFileSync(join(src, 'ui/components/drawer/ShopDrawer.jsx'), 'utf8');
        expect(tab).not.toMatch(/MapCard|buyMap|Cartographer\.|>Maps</);
    });

    it('nothing on the board keeps Maps lying loose any more', () => {
        expect(BoardState.getBoardMaps).toBeUndefined();
        expect(BoardState.addBoardMap).toBeUndefined();
        expect(BoardState.MAX_MAP_LIMIT).toBeUndefined();
    });
});

describe('The Map catalogue is gone: maps are items', () => {
    it('no registry, no loader, no CMS pass reads data/maps.json', () => {
        expect(() => statSync(join(src, 'config/registries/mapRegistry.js'))).toThrow();
        expect(() => statSync(join(src, '../cms/src/engine/sim/mapPass.js'))).toThrow();
        expect(DatabaseManager.mapFilesSingle).toBeUndefined();
    });

    it('a leftover mapId makes nothing a Map Token', () => {
        expect(deriveTokenType({ mapId: 'map_anything' }).type).not.toBe('map');
    });
});
