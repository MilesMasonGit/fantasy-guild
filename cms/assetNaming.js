// Fantasy Guild — where new art goes, by docs/reference/ASSET_NAMING.md.
//
// ⚠️ Imports nothing, and lives in cms/: the CMS's server (plain Node), the Studio page (which may
// import nothing outside cms/) and the rename checker all read it.

/** Item groups say what an item is, never a skill or a source. */
export const ITEM_GROUPS = Object.freeze([
    'ore', 'ingot', 'wood', 'gem', 'food', 'drink', 'potion', 'tool', 'gear', 'jewelry', 'seed', 'coin',
    'fish', 'meat', 'flower', 'herb', 'key', 'weapon', 'mat'
]);

/** The Studio's save categories: the kind's top folder and its name prefix. */
export const STUDIO_KINDS = Object.freeze({
    items: Object.freeze({ dir: 'items', prefix: 'i', groups: ITEM_GROUPS }),
    enemy: Object.freeze({ dir: 'enemies', prefix: 'e', groups: null }),
    input256: Object.freeze({ dir: 'backgrounds', prefix: 'b', groups: null })
});

/** A name as lower-case words joined by `_`. */
function words(text) {
    return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Where the Studio saves a picture: `<kind>/<group>/<prefix>_<name>.png` under `public/assets`.
 * The kind's prefix is added when the name lacks it.
 *
 * @param {{name: string, category: string, group: string}} what
 * @returns {{rel: string, name: string} | {error: string}}
 */
export function studioAssetPath({ name, category, group } = {}) {
    const kind = STUDIO_KINDS[category];
    if (!kind) return { error: `Unknown category: ${category}` };
    const g = words(group);
    if (!g || g.includes('_')) return { error: 'Choose a group: one word, the folder the picture goes in' };
    if (kind.groups && !kind.groups.includes(g)) return { error: `${g} is not an item group (${kind.groups.join(', ')})` };
    let stem = words(name);
    if (stem === kind.prefix) stem = '';
    else if (stem.startsWith(`${kind.prefix}_`)) stem = stem.slice(kind.prefix.length + 1);
    if (!stem) return { error: 'Give the picture a name' };
    const file = `${kind.prefix}_${stem}`;
    return { rel: `${kind.dir}/${g}/${file}.png`, name: file };
}
