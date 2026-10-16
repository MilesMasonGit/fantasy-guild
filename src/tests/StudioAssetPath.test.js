import { describe, it, expect } from 'vitest';
import { studioAssetPath, ITEM_GROUPS } from '../../cms/assetNaming.js';

/**
 * Where the Studio's "Export Variant" saves a picture: `<kind>/<group>/<prefix>_<name>.png` under
 * public/assets, by docs/reference/ASSET_NAMING.md. Before the rename it split the file name on `_`
 * into nested folders (`items/tool/pick/tool_pick_copper.png`).
 */
describe('studioAssetPath', () => {
    it('files an item in its group with the i_ prefix', () => {
        expect(studioAssetPath({ name: 'pick_ruby', category: 'items', group: 'tool' }))
            .toEqual({ rel: 'items/tool/i_pick_ruby.png', name: 'i_pick_ruby' });
    });

    it('does not double a prefix the name already has, and tidies the name', () => {
        expect(studioAssetPath({ name: 'i_pick_ruby', category: 'items', group: 'tool' }).rel).toBe('items/tool/i_pick_ruby.png');
        expect(studioAssetPath({ name: '  Pick Ruby (2) ', category: 'items', group: 'Tool' }).rel).toBe('items/tool/i_pick_ruby_2.png');
    });

    it('files enemies and backgrounds by their own prefix', () => {
        expect(studioAssetPath({ name: 'goblin_shaman', category: 'enemy', group: 'goblin' }).rel).toBe('enemies/goblin/e_goblin_shaman.png');
        expect(studioAssetPath({ name: 'harbour', category: 'input256', group: 'area' }).rel).toBe('backgrounds/area/b_harbour.png');
    });

    it('takes only the approved item groups', () => {
        expect(ITEM_GROUPS).toContain('mat');
        expect(ITEM_GROUPS).not.toContain('material');
        expect(studioAssetPath({ name: 'x', category: 'items', group: 'pickaxes' }).error).toMatch(/not an item group/);
    });

    it('refuses a missing or two-word group, a missing name and an unknown category', () => {
        expect(studioAssetPath({ name: 'x', category: 'items', group: '' }).error).toBeTruthy();
        expect(studioAssetPath({ name: 'x', category: 'enemy', group: 'big goblin' }).error).toBeTruthy();
        expect(studioAssetPath({ name: 'i_', category: 'items', group: 'tool' }).error).toBeTruthy();
        expect(studioAssetPath({ name: 'x', category: 'dataset', group: 'tool' }).error).toBeTruthy();
    });
});
