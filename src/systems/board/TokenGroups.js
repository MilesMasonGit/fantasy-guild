// Fantasy Guild — Token Vault tabs (R-3 slice 3, D-242)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';

/**
 * TokenGroups — tabs for the Token Vault.
 *
 * ⚠️ **Tabs are system-owned, not player-created** — the same as the Bank's,
 * which `BankTabStrip` describes as "the fixed, system-owned bank tabs… No
 * player create/rename/delete". The strip is padded to the unlocked count by
 * `pad()` below, exactly as `GuildUpgradeManager._ensureBankTabs` does for
 * items. **What the player controls is which tab a Token lives in** — nothing
 * else.
 *
 * ## Why this is a parallel system rather than a shared one
 * `InventoryGroupManager` does exactly this job for items, and it is
 * **item-specific end to end**: `getItemGroupId(itemId)`, `itemOverrides`,
 * `groupDefs` and `groupOrder` all live on `state.inventory` and are read
 * through `InventoryManager.getDisplayInventory()`.
 *
 * Three options were on the table (D-242). Refactoring that manager to be
 * entity-agnostic is the right long-term shape and was **rejected as too risky**:
 * it would rewrite a working, load-bearing system the Bank depends on, and break
 * item filing as a side effect. Deriving tabs from `theme`/`tokenType` needed no
 * new state at all but let the game choose the organisation rather than the
 * player. The owner chose user-managed tabs, so this mirrors the item model
 * deliberately — same shapes, same rules, same default.
 *
 * ## The default is not clever, and that is copied on purpose
 * `InventoryGroupManager.getItemGroupId` checks for an explicit override and
 * otherwise returns `groupOrder[0]` — *"Default: Always go to the TOPMOST
 * group."* There is no auto-classification by type or theme. Tokens behave
 * identically: everything lands in the first tab until the player files it.
 *
 * ## State lives beside the Vault, not inside it
 * `board.tokenBank` is `{ typeId: [instances] }` and is read by Managers,
 * consolidation and selling. Grouping goes in its own `board.tokenGroups` so
 * none of that has to know about tabs.
 *
 * ⚠️ **No save migration.** `ensure()` backfills on read, the same route Tray
 * positions took to avoid a schema break (D-226). A save written before tabs
 * existed simply grows its tabs the first time the Vault is opened.
 */

/** The tab every Token lands in until the player files it elsewhere. */
const DEFAULT_GROUP_ID = 'default-tokens';

const makeDefault = () => ({
    groupOrder: [DEFAULT_GROUP_ID],
    groupDefs: {
        [DEFAULT_GROUP_ID]: {
            id: DEFAULT_GROUP_ID, title: 'Tokens', isCustom: false, orderedTypes: []
        }
    },
    overrides: {}   // typeId -> groupId
});

/**
 * Tab limits, matching the Bank's (owner decision 2026-08-11).
 *
 * The strip always renders `CAP` positions with unpurchased ones greyed, so the
 * player can see what an upgrade buys — the same treatment `BankTabStrip` gives
 * its 20.
 */
export const TOKEN_TAB_FREE = 5;
export const TOKEN_TAB_CAP = 15;

/** The live grouping slice, created if a save predates it. */
function groups() {
    const board = GameState.state?.board;
    if (!board) return null;
    if (!board.tokenGroups) board.tokenGroups = makeDefault();
    return board.tokenGroups;
}

/**
 * Repair anything missing or dangling, and return the slice.
 *
 * ⚠️ Runs on **every read**, cheaply, because a group can be deleted while
 * Tokens still point at it. An override aiming at a tab that no longer exists
 * must not strand a Token somewhere invisible — `groupIdFor` falls back to the
 * topmost tab, and this prunes the dead override so it cannot linger.
 */
export function ensure() {
    const g = groups();
    if (!g) return null;

    if (!Array.isArray(g.groupOrder) || g.groupOrder.length === 0) {
        Object.assign(g, makeDefault());
    }
    if (!g.groupDefs) g.groupDefs = makeDefault().groupDefs;
    if (!g.overrides) g.overrides = {};

    // Drop order entries with no definition, and definitions nothing orders.
    g.groupOrder = g.groupOrder.filter(id => g.groupDefs[id]);
    if (g.groupOrder.length === 0) Object.assign(g, makeDefault());

    pad(g);

    for (const [typeId, groupId] of Object.entries(g.overrides)) {
        if (!g.groupOrder.includes(groupId)) delete g.overrides[typeId];
    }
    return g;
}

/**
 * Grow the strip to the unlocked count.
 *
 * ⚠️ **Tabs are system-owned, exactly as the Bank's are.** `BankTabStrip` is
 * "the fixed, system-owned bank tabs… No player create/rename/delete", and
 * `GuildUpgradeManager._ensureBankTabs` pads `groupOrder` up to `maxTabs` with
 * generically-titled tabs whenever a rank is bought. This is that, for Tokens —
 * so what the player controls is **which tab a Token lives in**, not how many
 * tabs exist or what they are called.
 */
function pad(g) {
    const want = unlockedCount();
    let n = g.groupOrder.length;
    while (g.groupOrder.length < want) {
        n += 1;
        const id = `token-tab-${n}`;
        if (g.groupOrder.includes(id) || g.groupDefs[id]) continue;
        g.groupDefs[id] = {
            id, title: `Tab ${g.groupOrder.length + 1}`, isCustom: false, orderedTypes: []
        };
        g.groupOrder.push(id);
    }
}

/** Tabs in display order: `[{ id, title, isCustom }]`. */
export function list() {
    const g = ensure();
    if (!g) return [];
    return g.groupOrder.map(id => ({ ...g.groupDefs[id] }));
}

/** How many tabs the player has unlocked. Raised by the Guild Hall (D-243). */
export function unlockedCount() {
    const board = GameState.state?.board;
    const bought = board?.tokenTabsUnlocked;
    return Math.min(TOKEN_TAB_CAP, Math.max(TOKEN_TAB_FREE, bought || 0));
}

/**
 * Which tab a Token type belongs to.
 *
 * Mirrors the item rule exactly: an explicit override if it still points
 * somewhere real, otherwise **the topmost tab**.
 */
export function groupIdFor(typeId) {
    const g = ensure();
    if (!g) return null;
    const target = g.overrides[typeId];
    if (target && g.groupOrder.includes(target)) return target;
    return g.groupOrder[0];
}

/**
 * Sort Vault rows into tabs, in display order.
 *
 * @param {Array<{typeId: string}>} rows  from `TokenBank.contents()`
 * @returns {Array<{ id, title, isCustom, rows }>}
 */
export function grouped(rows = []) {
    const g = ensure();
    if (!g) return [];

    const buckets = {};
    for (const id of g.groupOrder) buckets[id] = [];
    for (const row of rows) {
        const id = groupIdFor(row.typeId);
        (buckets[id] || buckets[g.groupOrder[0]]).push(row);
    }

    return g.groupOrder.map(id => ({
        ...g.groupDefs[id],
        rows: orderRows(buckets[id], g.groupDefs[id]?.orderedTypes)
    }));
}

/** Respect a tab's manual ordering, with anything unlisted following after. */
function orderRows(rows, orderedTypes) {
    if (!orderedTypes?.length) return rows;
    const byType = new Map(rows.map(r => [r.typeId, r]));
    const out = [];
    for (const typeId of orderedTypes) {
        if (byType.has(typeId)) { out.push(byType.get(typeId)); byType.delete(typeId); }
    }
    return [...out, ...byType.values()];
}

/**
 * File a Token type into a tab — the drag-onto-a-tab gesture.
 *
 * ⚠️ **This is the only thing the player controls about tabs**, and it is the
 * only thing they control about the Bank's either. Keyed by **type**, not by
 * copy: a tab holds types (D-241), and D-77 leaves at most one partial per type,
 * so filing "half of your Forests" elsewhere is not a state the Vault can
 * represent.
 *
 * Filing into the topmost tab clears the override rather than storing one, so
 * the default stays the default.
 */
export function assign(typeId, groupId) {
    const g = ensure();
    if (!g || !typeId || !g.groupOrder.includes(groupId)) return false;

    if (groupId === g.groupOrder[0]) delete g.overrides[typeId];
    else g.overrides[typeId] = groupId;
    changed();
    return true;
}

function changed() {
    EventBus.publish('token_bank_updated', { source: 'tabs' });
    EventBus.publish('state_changed', {});
}
