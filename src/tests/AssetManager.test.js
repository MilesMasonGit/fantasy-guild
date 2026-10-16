// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resolveSpritePath, resolveAnimationPath, resolveEnemyAnimationPath, currentSpriteName } from '../utils/AssetManager.js';
import { SPRITE_MANIFEST } from '../config/registries/sprite-manifest.js';
import { LEGACY_SPRITE_NAMES } from '../config/registries/legacySpriteNames.js';
import tokenData from '../../data/tokens.json';
import itemData from '../../data/items.json';

// Exact-case file list: Windows answers fs.existsSync for a path whose case differs from the
// file's, and a case-sensitive server does not (`Item_torch` drew here and nowhere else).
const FILES = new Set();
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.posix.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else FILES.add(full.slice('public/'.length));
    }
})('public/assets');
const onDisk = (p) => !!p && FILES.has(p.replace(/^\//, ''));

describe('AssetManager path resolution', () => {
    it('resolves a sprite by its name, the file name', () => {
        expect(resolveSpritePath('i_ore_copper')).toBe('assets/items/ore/i_ore_copper.png');
        expect(resolveSpritePath('i_ingot_copper')).toBe('assets/items/ingot/i_ingot_copper.png');
        expect(resolveSpritePath('i_key_copper')).toBe('assets/items/key/i_key_copper.png');
        expect(resolveSpritePath('i_wood_oak')).toBe('assets/items/wood/i_wood_oak.png');
        expect(resolveSpritePath('i_water')).toBe('assets/items/drink/i_water.png');
        expect(resolveSpritePath('t_ore_vein_copper')).toBe('assets/tokens/ore/t_ore_vein_copper.png');
        expect(resolveSpritePath('t_map_base')).toBe('assets/tokens/map/t_map_base.png');
        expect(resolveSpritePath('u_coin_med')).toBe('assets/ui/u_coin_med.png');
        expect(resolveSpritePath('b_guild_hall')).toBe('assets/backgrounds/area/b_guild_hall.png');
        expect(resolveSpritePath('e_goblin')).toBe('assets/enemies/goblin/e_goblin.png');
        expect(resolveSpritePath('s_nature')).toBe('assets/skills/s_nature.png');
        expect(resolveSpritePath('hf_alchemist_por')).toBe('assets/heroes/hf_alchemist_por.png');
    });

    it('resolves a name from before the rename to the same picture under its new name', () => {
        expect(resolveSpritePath('ore_copper')).toBe('assets/items/ore/i_ore_copper.png');
        expect(resolveSpritePath('ingot_copper')).toBe('assets/items/ingot/i_ingot_copper.png');
        expect(resolveSpritePath('key_copper')).toBe('assets/items/key/i_key_copper.png');
        expect(resolveSpritePath('battleaxe_copper')).toBe('assets/items/weapon/i_battleaxe_copper.png');
        expect(resolveSpritePath('longsword_copper')).toBe('assets/items/weapon/i_longsword_copper.png');
        expect(resolveSpritePath('drink_water')).toBe('assets/items/drink/i_water.png');
        expect(resolveSpritePath('d_water')).toBe('assets/items/drink/i_water.png');
        expect(resolveSpritePath('wood_oak')).toBe('assets/items/wood/i_wood_oak.png');
        expect(resolveSpritePath('t_pick_copper')).toBe('assets/items/tool/i_pick_copper.png');
        expect(resolveSpritePath('token_ore_copper')).toBe('assets/tokens/ore/t_ore_vein_copper.png');
        expect(resolveSpritePath('map_base')).toBe('assets/tokens/map/t_map_base.png');
        expect(resolveSpritePath('skill_nature')).toBe('assets/skills/s_nature.png');
        expect(resolveSpritePath('hf_alchemist')).toBe('assets/heroes/hf_alchemist_por.png');
        expect(resolveSpritePath('hero_recruit_0')).toBe('assets/heroes/hn_recruit_por.png');
        expect(resolveSpritePath('icon_recruit_0')).toBe('assets/heroes/hn_recruit_icon_por.png');
    });

    it('fixes the two old names that pointed at no file: the torch (case) and the table backgrounds', () => {
        expect(resolveSpritePath('Item_torch')).toBe('assets/items/mat/i_torch.png');
        expect(resolveSpritePath('pm_table_wood_spruce')).toBe('assets/ui/u_table_wood_spruce.png');
        expect(resolveSpritePath('pm_table_forest')).toBe('assets/ui/u_table_forest.png');
    });

    it('resolves hero class names and retired selectors to the portrait they drew', () => {
        expect(resolveSpritePath({ classId: 'fighter' })).toBe('assets/heroes/hm_fighter_por.png');
        expect(resolveSpritePath({ classId: 'ranger' })).toBe('assets/heroes/hn_range_por.png');
        expect(resolveSpritePath({ classId: 'wizard' })).toBe('assets/heroes/hm_wizard_por.png');
        // ⚠️ Not the old knight and rogue drawings that shared their names: these selectors always drew the class portraits.
        expect(resolveSpritePath({ spriteId: 'hero_knight' })).toBe('assets/heroes/hm_fighter_por.png');
        expect(resolveSpritePath({ spriteId: 'hero_rogue' })).toBe('assets/heroes/hn_sneak_por.png');
    });

    it('translates CMS area background ids', () => {
        expect(resolveSpritePath('bg_area_whispering_woods')).toBe('assets/backgrounds/area/b_lush_forest.png');
        expect(resolveSpritePath('bg_area_guild_hall')).toBe('assets/backgrounds/area/b_guild_hall.png');
        expect(resolveSpritePath('bg_area_misty_mountains')).toBe('assets/backgrounds/area/b_mountains_snowy.png');
        expect(resolveSpritePath('bg_area_sunken_bog')).toBe('assets/backgrounds/area/b_swamp.png');
    });

    it('returns a path as it is, and nothing for a name it does not know', () => {
        expect(resolveSpritePath('assets/ui/u_lock.png')).toBe('assets/ui/u_lock.png');
        expect(resolveSpritePath('no_such_sprite')).toBeNull();
        expect(resolveSpritePath('')).toBeNull();
        expect(resolveSpritePath(null)).toBeNull();
    });

    it('gives the current name for an old one and leaves any other name alone', () => {
        expect(currentSpriteName('ore_copper')).toBe('i_ore_copper');
        expect(currentSpriteName('i_ore_copper')).toBe('i_ore_copper');
        expect(currentSpriteName('🧑')).toBe('🧑');
        expect(currentSpriteName('constructor')).toBe('constructor');
        expect(currentSpriteName(undefined)).toBeUndefined();
    });
});

describe('animation sheets', () => {
    it('animates a hero by portrait, old or new name, or by class', () => {
        expect(resolveAnimationPath('hn_recruit_por')).toBe('assets/heroes/hn_recruit_sheet.png');
        expect(resolveAnimationPath('hero_recruit_0')).toBe('assets/heroes/hn_recruit_sheet.png');
        expect(resolveAnimationPath({ spriteId: 'hm_fighter' })).toBe('assets/heroes/hn_fighter_sheet.png');
        expect(resolveAnimationPath({ spriteId: 'hero_knight' })).toBe('assets/heroes/hn_fighter_sheet.png');
        expect(resolveAnimationPath({ classId: 'ranger' })).toBe('assets/heroes/hn_ranger_sheet.png');
        expect(resolveAnimationPath('hf_bard_por')).toBeNull();
    });

    it('draws the adventurer as a still: its sheet was never drawn', () => {
        expect(resolveAnimationPath('hn_adventure_por')).toBeNull();
        expect(resolveAnimationPath('hero_adventure')).toBeNull();
    });

    it('animates the cow by its sprite name', () => {
        expect(resolveEnemyAnimationPath('e_cow')).toBe('assets/enemies/animal/e_cow_sheet.png');
        expect(resolveEnemyAnimationPath('e_goblin')).toBeNull();
    });

    it('every sheet it names is on disk', () => {
        const names = ['hn_recruit_por', 'hm_fighter_por', 'hn_sneak_por', 'hm_wizard_por', 'hn_range_por'];
        for (const n of names) expect(onDisk(resolveAnimationPath(n)), n).toBe(true);
        expect(onDisk(resolveEnemyAnimationPath('e_cow'))).toBe(true);
    });
});

describe('the manifest and the old-name table', () => {
    const NEW_NAME = /^(t|i|e|u|b|s|h[fmn])_/;

    it('every entry named by the rule points at a file on disk', () => {
        const missing = Object.entries(SPRITE_MANIFEST)
            .filter(([k, p]) => NEW_NAME.test(k) && !onDisk(p))
            .map(([k, p]) => `${k} -> ${p}`);
        expect(missing).toEqual([]);
    });

    it('every old name resolves to a picture on disk', () => {
        const missing = Object.keys(LEGACY_SPRITE_NAMES)
            .filter(old => !/_sheet(_|$)/.test(LEGACY_SPRITE_NAMES[old]) && !/^p_/.test(LEGACY_SPRITE_NAMES[old]) && !/^g_/.test(LEGACY_SPRITE_NAMES[old]))
            .filter(old => !onDisk(resolveSpritePath(old)))
            .map(old => `${old} -> ${resolveSpritePath(old)}`);
        expect(missing).toEqual([]);
    });

    it('no old name is the name of a file now', () => {
        const stems = new Set([...FILES].map(f => path.posix.basename(f).replace(/\.[^.]+$/, '')));
        const clash = Object.keys(LEGACY_SPRITE_NAMES).filter(old => stems.has(old));
        expect(clash).toEqual([]);
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
    for (const collection of [tokenData, itemData]) {
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
            if (!resolved || !onDisk(resolved)) {
                missing.push(`${sprite} -> ${resolved ?? '(unresolved)'}`);
            }
        }
        expect(missing, `${missing.length} of ${used.size} sprites have no file`).toEqual([]);
    });
});
