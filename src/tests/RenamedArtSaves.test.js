// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { resolveSpritePath } from '../utils/AssetManager.js';

/**
 * Saves and settings from before the art was renamed (docs/reference/ASSET_NAMING.md) hold the old
 * sprite names: a hero's portrait (`spriteId`) and dock icon (`icon`), and the table background
 * setting. Loading one rewrites them to the new names, and they draw the same pictures.
 */

const onDisk = (p) => !!p && fs.existsSync(path.join('public', p.replace(/^\//, '')));

/** A save as the game wrote it before the rename: four heroes with old portrait and icon names. */
function oldSave() {
    GameState.initNew();
    const heroes = [
        { spriteId: 'hero_recruit_0', icon: 'icon_recruit_0' },
        { spriteId: 'hf_mage1', icon: 'icon_recruit_0' },
        { spriteId: 'hn_adventure1', icon: '🧔' },
        { spriteId: 'fighter', icon: 'icon_recruit_0' }
    ].map(({ spriteId, icon }) => ({ ...generateHero({ name: spriteId }), spriteId, icon }));
    const data = GameState.serialize();
    data.state.heroes = JSON.parse(JSON.stringify(heroes, (k, v) => (k === 'aggregator' ? undefined : v)));
    return JSON.parse(JSON.stringify(data));
}

describe('a save from before the rename', () => {
    let data;
    beforeEach(() => { data = oldSave(); });

    it('loads with the new names', () => {
        const migrated = migrateState(data.state, GAME_VERSION);
        expect(migrated.heroes.map(h => [h.spriteId, h.icon])).toEqual([
            ['hn_recruit_por', 'hn_recruit_icon_por'],
            ['hf_mage_por_1', 'hn_recruit_icon_por'],
            ['hn_adventure_por', '🧔'],
            // A retired class name is not a file name: the resolver's class table keeps answering it.
            ['fighter', 'hn_recruit_icon_por']
        ]);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).valid).toBe(true);
    });

    it('draws the same pictures, all on disk', () => {
        const before = data.state.heroes.map(h => resolveSpritePath(h.spriteId));
        const migrated = migrateState(data.state, GAME_VERSION);
        expect(migrated.heroes.map(h => resolveSpritePath(h.spriteId))).toEqual(before);
        for (const h of migrated.heroes) {
            expect(onDisk(resolveSpritePath(h.spriteId)), h.spriteId).toBe(true);
        }
        expect(onDisk(resolveSpritePath('hn_recruit_icon_por'))).toBe(true);
    });

    it('changes nothing a second time, and does not touch the save it was given', () => {
        const frozen = JSON.stringify(data.state);
        const once = migrateState(data.state, GAME_VERSION);
        expect(JSON.stringify(data.state)).toBe(frozen);
        const twice = migrateState(once, GAME_VERSION);
        expect(twice.heroes).toBe(once.heroes);
    });

    it('a hero with no portrait or icon is left for rehydration to fill', () => {
        delete data.state.heroes[0].spriteId;
        delete data.state.heroes[0].icon;
        const migrated = migrateState(data.state, GAME_VERSION);
        expect('spriteId' in migrated.heroes[0]).toBe(false);
        expect('icon' in migrated.heroes[0]).toBe(false);
    });
});

describe('a new hero', () => {
    it('wears the new recruit names', () => {
        const hero = generateHero({ name: 'New' });
        expect(hero.spriteId).toBe('hn_recruit_por');
        expect(hero.icon).toBe('hn_recruit_icon_por');
    });
});

describe('the table background setting', () => {
    beforeEach(() => {
        localStorage.clear();
        SettingsManager.resetOptions();
    });

    it('defaults to the new name', () => {
        expect(SettingsManager.get('ui.backgroundTile')).toBe('u_table_wood_spruce');
    });

    it('an old name saved before the rename loads as the new one', () => {
        localStorage.setItem('fantasy_guild_settings', JSON.stringify({ ui: { backgroundTile: 'pm_table_forest' } }));
        SettingsManager.load();
        expect(SettingsManager.get('ui.backgroundTile')).toBe('u_table_forest');
    });

    it('every table the settings offer is on disk, where the page draws it from', () => {
        const modal = fs.readFileSync('src/ui/modals/SettingsModal.jsx', 'utf8');
        const tiles = [...modal.matchAll(/value: '(u_table_[a-z_]+)'/g)].map(m => m[1]);
        expect(tiles.length).toBe(4);
        for (const t of tiles) expect(onDisk(`/assets/ui/${t}.png`), t).toBe(true);
    });
});
