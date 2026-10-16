// The art was renamed (docs/reference/ASSET_NAMING.md): the workspace's sprite fields that still
// hold a name from before the rename, and the same workspace with the new names.

import { currentSpriteName } from '../../../src/utils/AssetManager.js';

/** The collections whose entities name a sprite, and the fields that hold the name. */
const SPRITE_FIELDS = Object.freeze({ items: ['sprite', 'spriteId'], tokens: ['sprite', 'spriteId'] });

/**
 * Every sprite field that holds an old name, in the order the collections list their entities.
 *
 * @param {{items?: object, tokens?: object}} workspace
 * @returns {Array<{collection: string, id: string, name: string, field: string, from: string, to: string}>}
 */
export function pendingSpriteRenames(workspace = {}) {
    const out = [];
    for (const [collection, fields] of Object.entries(SPRITE_FIELDS)) {
        for (const [id, entity] of Object.entries(workspace[collection] || {})) {
            if (!entity || typeof entity !== 'object') continue;
            for (const field of fields) {
                const from = entity[field];
                if (typeof from !== 'string') continue;
                const to = currentSpriteName(from);
                if (to !== from) out.push({ collection, id, name: entity.name || id, field, from, to });
            }
        }
    }
    return out;
}

/**
 * The collections with every old sprite name replaced. A collection with nothing to rename comes
 * back as the same object, so applying twice changes nothing the second time.
 *
 * @returns {{items?: object, tokens?: object}} only the collections that changed
 */
export function applySpriteRenamesTo(workspace = {}) {
    const changed = {};
    for (const r of pendingSpriteRenames(workspace)) {
        const collection = changed[r.collection] || (changed[r.collection] = { ...workspace[r.collection] });
        collection[r.id] = { ...collection[r.id], [r.field]: r.to };
    }
    return changed;
}
