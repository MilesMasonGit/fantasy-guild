// Fantasy Guild — Triggered Token vocabulary (CMS rework Phase 6)

import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';

/**
 * What a Triggered Token can react to, and how far it listens.
 *
 * ## The fifth Token category (CMS-29)
 * Producer, Context, Buff and Manager all either run a cycle or work by sitting
 * still. A **Triggered** Token does neither: it has no work cycle and needs no
 * hero, it watches for something to happen and acts, and it is rate-limited by
 * a **cooldown** rather than a cycle time.
 *
 * Distinct from a Passive Generator (D-116), which still runs its own cycle
 * unstaffed — a Triggered Token does not cycle at all, it waits and reacts.
 *
 * ## Extensible by design (CMS-32)
 * The owner was explicit that these are "baseline effects, with more that I
 * might need coded in later". Adding a row here makes the event immediately
 * available in the CMS's trigger picker with no CMS-side change — the same
 * game-defines / CMS-provides-content split as `tokenConstants.js` and
 * `modifierPalette.js`.
 *
 * ## Why these three, and not the rest of BOARD_EVENTS (CMS-33)
 * The UI-only events — `PROGRESS`, `ALERT_CHANGED`, `SPRITES_CHANGED` — are
 * plumbing for progress bars and particle sync, not meaningful game-state
 * changes, so they are deliberately not offered. `TILE_CHANGED`/`HERO_MOVED`
 * ("react to a neighbour being placed, or a hero arriving") are a bigger design
 * surface that was not picked up this round — not ruled out, just not built.
 */

/** How far a trigger listens (CMS-30). Chosen per Token, not fixed once. */
export const TRIGGER_SCOPES = {
    /** React only to the 8 neighbouring tiles — the Wheelbarrow's Ore Vein. */
    ADJACENT: 'adjacent',
    /** React to a condition anywhere, consistent with D-83's global supply. */
    GLOBAL: 'global'
};

/**
 * @type {Array<{id: string, event: string, label: string, scopes: string[], hint: string}>}
 */
export const TRIGGER_EVENTS = [
    {
        id: 'CYCLE_COMPLETE',
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: 'A neighbour completes a cycle',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        hint: 'Fires when an adjacent Token finishes work — or wins a fight, since one kill is one cycle (D-129).'
    },
    {
        id: 'TOKEN_DEPLETED',
        event: BOARD_EVENTS.TOKEN_DEPLETED,
        label: 'A neighbour runs out of charges',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        hint: 'Fires when an adjacent Token spends its last charge and leaves the board.'
    },
    {
        /**
         * ⚠️ Narrow exception to CMS-2's combat deferral, and deliberately so.
         *
         * This is for an economy Token reacting to a kill nearby — it does not
         * model damage, defense or hit chance, and must not be read later as
         * "combat is in scope now".
         */
        id: 'COMBAT_RESOLVED',
        event: BOARD_EVENTS.COMBAT_RESOLVED,
        label: 'A neighbouring fight is won',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        hint: 'Fires when combat on an adjacent enemy Token ends in victory.'
    },
    {
        /**
         * The Sigil's case: "Stone exists anywhere" (CMS-35).
         *
         * There is no per-item "X was produced" event, only the coarse
         * `inventory_updated`. Rather than build item-specific board events, a
         * globally-scoped trigger subscribes to that and evaluates its own
         * author-specified item + threshold each time it fires. Cheap, and it
         * needed no new engine event plumbing.
         */
        id: 'ITEM_THRESHOLD',
        event: 'inventory_updated',
        label: 'The Bank holds enough of an item',
        scopes: [TRIGGER_SCOPES.GLOBAL],
        hint: 'Fires while the Bank holds at least the given quantity. Rate-limited by its cooldown.'
    }
];

/** A trigger definition by id, or null. */
export function getTriggerEvent(id) {
    return TRIGGER_EVENTS.find(t => t.id === id) || null;
}

/** Whether an id is a known trigger event. */
export function isTriggerEvent(id) {
    return TRIGGER_EVENTS.some(t => t.id === id);
}

/** Every distinct EventBus name a trigger can listen on. */
export function triggerEventNames() {
    return [...new Set(TRIGGER_EVENTS.map(t => t.event))];
}
