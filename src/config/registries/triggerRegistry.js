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
    GLOBAL: 'global',
    /**
     * React to **this Token's own** cycle finishing.
     *
     * ⚠️ Every trigger before this one listened *outward*. A Token reacting to
     * itself is the shape that can recurse, so `TriggerSystem` carries an
     * explicit re-entrancy guard and a cascade depth cap rather than relying on
     * the author remembering to set a cooldown — see the note there.
     */
    SELF: 'self'
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
         * The other moment the owner asked for first, beside the cycle start:
         * a rule acting as a fight begins rather than as one ends (UE-15).
         *
         * `COMBAT_RESOLVED` above is the mirror — that one is a kill, this one
         * is the swing before it.
         */
        id: 'COMBAT_ENGAGED',
        event: BOARD_EVENTS.COMBAT_ENGAGED,
        label: 'A neighbouring fight begins',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        hint: 'Fires each time a hero engages an adjacent enemy — including every fresh enemy after a kill, not just the first.'
    },
    {
        /**
         * The enemy's own half: a Token reacting to being fought.
         *
         * Same recursion caveat as the other self-scoped rows — read the note
         * on `TRIGGER_SCOPES.SELF` and the guard in `TriggerSystem` first.
         */
        id: 'SELF_COMBAT_ENGAGED',
        event: BOARD_EVENTS.COMBAT_ENGAGED,
        label: 'A hero engages THIS enemy',
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires on the enemy Token itself each time a hero engages it. This is how an enemy acts when it is attacked.'
    },
    {
        /**
         * Finer than `CYCLE_COMPLETE`, which only says *that* a neighbour
         * finished. This fires only when the neighbour actually produced the
         * named item, so a Token can react to Copper Ore appearing rather than
         * to the Ore Vein ticking over — including on a cycle that rolled a
         * chance-based output and missed.
         *
         * It composes with the existing source filter, so "when a neighbour
         * tagged Forge produces an Ingot" is two pickers rather than a new
         * concept.
         */
        id: 'ITEM_PRODUCED',
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: 'A neighbour produces a specific item',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        needsItem: true,
        hint: 'Fires only when the adjacent Token really produced the named item that cycle. A chance-based output that missed does not count.'
    },
    {
        /**
         * ⚠️ **The self-trigger, and the one row here that can bite.**
         *
         * Everything else listens outward. This one lets a Token react to its
         * own completion — "every time I finish, poison whoever is working the
         * Coast next door".
         *
         * A cooldown is a **rate** limit, not a recursion limit: it stops a
         * re-entry only while it is non-zero, and nothing forces an author to
         * set one. So `TriggerSystem` guards this structurally instead — a
         * statement already firing cannot fire again, and a cascade is depth
         * capped. Read the note there before adding another self-scoped event.
         */
        id: 'SELF_CYCLE_COMPLETE',
        event: BOARD_EVENTS.CYCLE_COMPLETE,
        label: "This Token's own cycle completes",
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires when this very Token finishes its own work — not a neighbour. Its rule then reaches out from here as usual.'
    },
    {
        /**
         * The mirror of `CYCLE_COMPLETE`, and the moment the owner asked for
         * first (Unified Effects P5).
         *
         * `CYCLE_COMPLETE` is for reacting to work that *happened* — a bonus
         * alongside the output. This is for acting on work about to be done: a
         * buff that should already be up while the hero swings, rather than
         * arriving as they finish.
         */
        id: 'CYCLE_START',
        event: BOARD_EVENTS.CYCLE_START,
        label: 'A neighbour begins a cycle',
        scopes: [TRIGGER_SCOPES.ADJACENT],
        hint: 'Fires as an adjacent Token starts work — not when it finishes. A Token waiting for inputs has not started, so it does not fire until it genuinely resumes.'
    },
    {
        /**
         * The self-scoped half. Same recursion caveat as `SELF_CYCLE_COMPLETE`
         * — read the note there and the guard in `TriggerSystem` before adding
         * another self-scoped row.
         */
        id: 'SELF_CYCLE_START',
        event: BOARD_EVENTS.CYCLE_START,
        label: "This Token's own cycle begins",
        scopes: [TRIGGER_SCOPES.SELF],
        hint: 'Fires as this very Token starts its own work. Its rule then reaches out from here as usual.'
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
