import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as NotificationSystem from '../core/NotificationSystem.js';

/**
 * BinderTabManager — user-sortable tabs for the Card Binder pane
 * (UI overhaul Phase 3, spec §COMP-CARD).
 *
 * Deliberately the same model as the Bank's tabs (owner decision
 * 2026-07-11: one consistent system): an ordered list of renamable tabs,
 * cards placed manually via overrides, compact ordered lists (no slot
 * grid). Lives under `collection.binder` so it persists with the save and
 * re-renders anything subscribed to `collection_updated`.
 *
 * Placement model (mirrors the Bank's): a card with no override belongs
 * to the FIRST tab; `cardOverrides[templateId]` pins it to a specific tab;
 * each tab's `orderedCards` holds its manual order, unlisted cards append.
 * Tab count starts at 1 and is raised by Guild Hall upgrades (`maxTabs`).
 */

const DEFAULT_TAB_ID = 'binder-main';

function ensure() {
    const col = GameState.collection;
    if (!col) return null;
    if (!col.binder) {
        col.binder = {
            tabOrder: [DEFAULT_TAB_ID],
            tabDefs: {
                [DEFAULT_TAB_ID]: { id: DEFAULT_TAB_ID, title: 'Binder', orderedCards: [] }
            },
            cardOverrides: {},
            maxTabs: 1
        };
    }
    const b = col.binder;
    if (!b.tabOrder?.length) b.tabOrder = [DEFAULT_TAB_ID];
    if (!b.tabDefs) b.tabDefs = {};
    if (!b.tabDefs[b.tabOrder[0]]) {
        b.tabDefs[b.tabOrder[0]] = { id: b.tabOrder[0], title: 'Binder', orderedCards: [] };
    }
    if (!b.cardOverrides) b.cardOverrides = {};
    if (b.maxTabs === undefined) b.maxTabs = 1;
    return b;
}

export const BinderTabManager = {
    /** Current binder tab state (initialized on first use), or null pre-load. */
    getState() {
        return ensure();
    },

    /** The tab a card belongs to (override, else the first tab). */
    getCardTabId(templateId) {
        const b = ensure();
        if (!b) return null;
        const target = b.cardOverrides[templateId];
        return (target && b.tabOrder.includes(target)) ? target : b.tabOrder[0];
    },

    createTab(name) {
        const b = ensure();
        if (!b || !name?.trim()) return null;
        if (b.tabOrder.length >= (b.maxTabs ?? 1)) {
            NotificationSystem.warning('Binder tab limit reached — unlock more via Guild Hall upgrades.');
            return null;
        }
        const id = `binder-${Date.now()}`;
        b.tabDefs[id] = { id, title: name.trim().slice(0, 15), orderedCards: [] };
        b.tabOrder.push(id);
        EventBus.publish('collection_updated');
        return id;
    },

    renameTab(tabId, newName) {
        const b = ensure();
        if (!b || !newName?.trim() || !b.tabDefs[tabId]) return false;
        b.tabDefs[tabId].title = newName.trim().slice(0, 15);
        EventBus.publish('collection_updated');
        return true;
    },

    /** Replace a tab's manual card order wholesale (reorder commit). */
    setTabOrder(tabId, orderedIds) {
        const b = ensure();
        if (!b || !b.tabDefs[tabId] || !Array.isArray(orderedIds)) return false;
        b.tabDefs[tabId].orderedCards = [...orderedIds];
        EventBus.publish('collection_updated');
        return true;
    },

    /** Move a card to a tab, optionally at a specific position (reorder). */
    moveCardToTab(templateId, tabId, targetIndex = -1) {
        const b = ensure();
        if (!b || !b.tabDefs[tabId]) return false;
        for (const id of b.tabOrder) {
            const list = b.tabDefs[id]?.orderedCards;
            if (!list) continue;
            const idx = list.indexOf(templateId);
            if (idx !== -1) list.splice(idx, 1);
        }
        b.cardOverrides[templateId] = tabId;
        const target = b.tabDefs[tabId].orderedCards;
        if (targetIndex >= 0 && targetIndex <= target.length) {
            target.splice(targetIndex, 0, templateId);
        } else {
            target.push(templateId);
        }
        EventBus.publish('collection_updated');
        return true;
    }
};

export default BinderTabManager;
