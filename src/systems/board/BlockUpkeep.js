// Fantasy Guild — Effect-block upkeep (CMS rework Phase 5)

import { effectBlocksOf } from '../../config/registries/tokenRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';

/**
 * An effect block can cost items to sustain, on **its own clock** (CMS-60).
 *
 * ## Why this is separate from production
 * An aura's upkeep — 1 Incense every 30s — is not folded into the Token's
 * production inputs and is not tied to its cycle time. A Token can therefore
 * produce on one rhythm and sustain an effect on an entirely different one, and
 * a Token with **no** production at all can still have upkeep.
 *
 * ## Unpaid means OFF, not degraded (CMS-97)
 * When the Bank cannot pay, the block's modifiers stop applying and resume the
 * moment stock returns. This mirrors how a station with missing inputs behaves
 * — it waits, it does not run slower (D-127) — so "the thing it needs isn't
 * there" has one meaning across the whole board.
 *
 * Deliberately NOT: accruing debt (an effect that works while unpaid makes the
 * cost decorative), destroying the Token (depletion is the one wear mechanic,
 * and it is charges — D-118), or scaling to a fraction paid (partial effects
 * contradict D-127 and the modifier system has no shape for them).
 *
 * ## State lives on the instance
 * Timers are per Token **copy**, not per type — two Shrines burn their own
 * incense — so they live on the board instance and are saved with it.
 */

/** Blocks that cost something to sustain. */
function costedBlocks(def) {
    return effectBlocksOf(def).filter(b => b?.cost?.items?.length && b.cost.cadenceMs > 0);
}

/**
 * Per-block upkeep state on an instance, created on first use.
 *
 * `{ [blockIndex]: { elapsedMs, paid } }` — `paid` starts true so a block works
 * from the moment it is placed and only lapses if a later charge fails. Placing
 * a Token and having its aura be dead until the first tick would read as broken.
 */
function upkeepState(instance) {
    if (!instance.blockUpkeep) instance.blockUpkeep = {};
    return instance.blockUpkeep;
}

/** Whether block `i` on this instance is currently paid up. */
export function isBlockPaid(instance, blockIndex) {
    const state = instance?.blockUpkeep?.[blockIndex];
    return state ? state.paid !== false : true;
}

/**
 * Advance every costed block's clock on one Token, charging when due.
 *
 * Returns true when any block's paid/unpaid state CHANGED, so the caller can
 * rebuild the tile's modifiers — an aura switching off has to actually stop
 * applying, which means the aggregator must be rebuilt, not just flagged.
 */
export function tickUpkeep(instance, def, delta) {
    const blocks = costedBlocks(def);
    if (!blocks.length) return false;

    const state = upkeepState(instance);
    const all = effectBlocksOf(def);
    let changed = false;

    for (const block of blocks) {
        const i = all.indexOf(block);
        if (!state[i]) state[i] = { elapsedMs: 0, paid: true };
        const entry = state[i];

        entry.elapsedMs += delta;
        if (entry.elapsedMs < block.cost.cadenceMs) continue;

        entry.elapsedMs -= block.cost.cadenceMs;

        // Check the whole cost before spending any of it — the same pay-first,
        // all-or-nothing discipline production uses, so a block can never
        // half-consume its upkeep and still lapse.
        const affordable = block.cost.items.every(
            it => InventoryManager.getItemCount(it.itemId) >= (it.quantity || 1)
        );

        if (affordable) {
            for (const it of block.cost.items) {
                InventoryManager.removeItem(it.itemId, it.quantity || 1);
            }
        }

        if (entry.paid !== affordable) {
            entry.paid = affordable;
            changed = true;
        }
    }

    return changed;
}

/** Whether any block on this Token costs upkeep at all. */
export function hasUpkeep(def) {
    return costedBlocks(def).length > 0;
}
