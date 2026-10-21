// The QA panel's tools preview: the tools-as-gear change pack laid over the content, in memory.
// ⚠️ DEV BUILDS ONLY (`ToolsDevSection` is rendered behind `import.meta.env.DEV`), and the one
// place outside the tests that calls `registerItems` and changes Token types: on purpose, so the
// owner can try the rules before accepting the pack. Nothing is saved; a reload undoes it.

import { getItem, getAllItems, registerItems } from '../../config/registries/itemRegistry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { RETIRED_TOOL_TAGS, starterToolIds } from '../../config/registries/toolKinds.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import * as Flags from '../../systems/board/Flags.js';
import { TOOL_ITEMS, TOKEN_NEEDS } from './toolsPackContent.js';

/**
 * Register the pack's tool items, give its gathering Tokens their Needs tool (dropping their old
 * "a nearby pickaxe" requirement), and put one of each starter tool in the Bank, as a new game
 * would. Safe to press twice.
 *
 * @returns {{ items: number, tokens: number, granted: string[] }}
 */
export function applyToolsPreview() {
    const items = {};
    for (const [id, def] of Object.entries(TOOL_ITEMS)) items[id] = { ...(getItem(id) || {}), ...def };
    registerItems(items);

    let tokens = 0;
    for (const [id, [kind, minTier]] of Object.entries(TOKEN_NEEDS)) {
        const def = getTokenType(id);
        if (!def) continue;
        def.needsTool = { kind, minTier };
        if (Array.isArray(def.acceptedTokens)) {
            def.acceptedTokens = def.acceptedTokens.filter(r => !(r?.tag && RETIRED_TOOL_TAGS[r.tag]));
        }
        tokens++;
    }

    const granted = [];
    for (const itemId of starterToolIds(getAllItems())) {
        if (InventoryManager.hasItem(itemId, 1)) continue;
        if (InventoryManager.addItem(itemId, 1, 'dev') > 0) granted.push(itemId);
    }
    Flags.markDirty();
    return { items: Object.keys(items).length, tokens, granted };
}

/** Whether the preview is on: the starter tools exist and an ore vein needs a pickaxe. */
export function toolsPreviewOn() {
    return !!getTokenType('token_copper_ore_vein')?.needsTool && starterToolIds(getAllItems()).length > 0;
}
