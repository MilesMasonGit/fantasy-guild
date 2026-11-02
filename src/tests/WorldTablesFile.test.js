import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';

/**
 * ⭐ A new game generates its world from `data/world.json` once the CMS has synced it, and exactly as
 * before (the placeholder) while it is absent or cannot be generated from. The registry reads the
 * file once, at load, through `DatabaseManager.worldFilesSingle`; each case here loads it afresh over
 * a stand-in for that glob.
 */

const SYNCED = JSON.parse(JSON.stringify(PLACEHOLDER_WORLD_TABLES));
SYNCED.lines.find((l) => l.id === 'herbs').name = 'Herbs from the file';

let files = {};
vi.mock('../config/DatabaseManager.js', () => ({
    DatabaseManager: { get worldFilesSingle() { return files; } }
}));

async function registry() {
    vi.resetModules();
    return import('../config/registries/worldTablesRegistry.js');
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
afterEach(() => {
    files = {};
    vi.restoreAllMocks();
});

describe('⭐ the world tables a new game generates from', () => {
    it('⭐ are data/world.json\'s when the CMS has synced it', async () => {
        files = { '/data/world.json': { default: SYNCED } };
        const { worldTables, isPlaceholderTables } = await registry();
        expect(isPlaceholderTables()).toBe(false);
        expect(worldTables().lines.find((l) => l.id === 'herbs').name).toBe('Herbs from the file');
    });

    it('⭐ are the placeholder while it is absent: as before', async () => {
        files = {};
        const { worldTables, isPlaceholderTables } = await registry();
        expect(isPlaceholderTables()).toBe(true);
        expect(worldTables().lines.find((l) => l.id === 'herbs').name).toBe('Herbs');
    });

    it('are the placeholder, with a warning, when the file cannot be generated from', async () => {
        files = { '/data/world.json': { default: { lines: [] } } };
        const { isPlaceholderTables } = await registry();
        expect(isPlaceholderTables()).toBe(true);
        expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/not usable world tables/));
    });
});
