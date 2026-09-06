import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resolveSpritePath } from '../utils/AssetManager.js';
import tokenData from '../../data/tokens.json';
import itemData from '../../data/items.json';
import mapData from '../../data/maps.json';

describe('AssetManager path resolution', () => {
    it('should successfully resolve flattened item paths from legacy manifest paths', () => {
        // Ores
        expect(resolveSpritePath('ore_copper')).toBe('assets/items/ore/ore_copper.png');
        
        // Ingots
        expect(resolveSpritePath('ingot_copper')).toBe('assets/items/ingot/ingot_copper.png');

        // Keys
        expect(resolveSpritePath('key_copper')).toBe('assets/items/key/key_copper.png');

        // Weapons / Equipment
        expect(resolveSpritePath('battleaxe_copper')).toBe('assets/items/weapon/axe/w_axe_copper.png');
        expect(resolveSpritePath('longsword_copper')).toBe('assets/items/weapon/sword/w_sword_copper.png');
        expect(resolveSpritePath('staff_rotten')).toBe('assets/items/weapon/staff/w_staff_rotten.png');

        // Drinks
        expect(resolveSpritePath('drink_water')).toBe('assets/items/drink/d_water.png');

        // Normal/direct paths
        expect(resolveSpritePath('wood_oak')).toBe('assets/items/wood/wood_oak.png');
        expect(resolveSpritePath('d_water')).toBe('assets/items/drink/d_water.png');
    });

    it('should successfully resolve direct/default hero sprite paths', () => {
        // Hero Class defaults (bypassing legacy manifest references)
        expect(resolveSpritePath({ classId: 'fighter' })).toBe('assets/heroes/hm_fighter.png');
        expect(resolveSpritePath({ classId: 'ranger' })).toBe('assets/heroes/hn_range.png');
        expect(resolveSpritePath({ classId: 'wizard' })).toBe('assets/heroes/hm_wizard.png');

        // Custom hero selectors
        expect(resolveSpritePath({ spriteId: 'hero_knight' })).toBe('assets/heroes/hm_fighter.png');
        expect(resolveSpritePath({ spriteId: 'hero_rogue' })).toBe('assets/heroes/hn_sneak.png');

        // Direct prefixes
        expect(resolveSpritePath('hf_alchemist')).toBe('assets/heroes/hf_alchemist.png');
    });

    it('should successfully translate and resolve CMS area backgrounds', () => {
        expect(resolveSpritePath('bg_area_whispering_woods')).toBe('assets/backgrounds/area/bg_lush_forest.png');
        expect(resolveSpritePath('bg_area_guild_hall')).toBe('assets/backgrounds/area/bg_guild_hall.png');
        expect(resolveSpritePath('bg_area_misty_mountains')).toBe('assets/backgrounds/area/bg_mountains_snowy.png');
        expect(resolveSpritePath('bg_area_sunken_bog')).toBe('assets/backgrounds/area/bg_swamp.png');
    });

    it('should successfully translate and resolve Playmat backgrounds and board tiles', () => {
        // Direct ID resolution
        expect(resolveSpritePath('pm_table_wood_spruce')).toBe('assets/playmat/tables/pm_table_wood_spruce.png');
        expect(resolveSpritePath('pm_board_forest_1')).toBe('assets/playmat/tiles/pm_board_forest_1.png');

        // Legacy path translations from manifest references
        expect(resolveSpritePath('assets/backgrounds/playmat/guild_hall/pm_table_wood_spruce.png')).toBe('assets/playmat/tables/pm_table_wood_spruce.png');
        expect(resolveSpritePath('assets/backgrounds/playmat/forest/pm_board_forest_1.png')).toBe('assets/playmat/tiles/pm_board_forest_1.png');
    });

    it('should resolve token sprite paths correctly', () => {
        expect(resolveSpritePath('t_pick_copper')).toBe('assets/items/tool/pick/t_pick_copper.png');
        // ⚠️ Was `assets/tokens/token_ore_copper.png` until 2026-09-05, which
        // was a path with no file behind it — the token art moved into
        // subfolders and the manifest was never repointed. The assertion was
        // pinning the broken value.
        expect(resolveSpritePath('token_ore_copper')).toBe('assets/tokens/ore/token_ore_copper.png');
        expect(resolveSpritePath('map_base')).toBe('assets/tokens/map_base.png');
        expect(resolveSpritePath('skill_nature')).toBe('assets/skills/skill_nature.png');
    });
});

/**
 * ⚠️ The guard that was missing.
 *
 * Every assertion above compares a **string**, so the suite stayed green while
 * 158 of the manifest's 305 paths pointed at no file at all — 35 of them for
 * sprites the shipped content actually uses. The art had been reorganised into
 * subfolders and the manifest was never repointed, so a third of the CMS's
 * sprites silently rendered as nothing while every test passed. That is the
 * "reads as passing when it should have failed" category.
 *
 * This asserts the thing that actually matters: whatever the content asks for,
 * a file has to be there. It names no ids — it checks whatever content exists,
 * per the house rule.
 */
describe('Every sprite the content asks for exists on disk', () => {
    const used = new Set();
    for (const collection of [tokenData, itemData, mapData]) {
        for (const record of Object.values(collection)) {
            if (record?.sprite) used.add(record.sprite);
        }
    }

    it('has content to check', () => {
        expect(used.size).toBeGreaterThan(0);
    });

    it('resolves every one of them to a file that is really there', () => {
        const missing = [];
        for (const sprite of used) {
            const resolved = resolveSpritePath(sprite);
            if (!resolved || !fs.existsSync(path.join('public', resolved))) {
                missing.push(`${sprite} -> ${resolved ?? '(unresolved)'}`);
            }
        }
        expect(missing, `${missing.length} of ${used.size} sprites have no file`).toEqual([]);
    });
});
