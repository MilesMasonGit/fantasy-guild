// Fantasy Guild - Card Work Pre-flight (Card Mutators & Tokens, Phase 6)

import { InventoryManager } from '../../inventory/InventoryManager.js';
import { resolveInputCost } from '../../effects/EffectAxes.js';

/**
 * Pre-flight — can this Card actually complete its exchange?
 *
 * ## Why this exists (roadmap F5)
 * `completeWorkCycle` used to grant loot at step 5 and only *then* try to pay
 * for it at step 6. A Card could hand out its outputs and afterwards discover
 * it could not afford its inputs — the player got something for nothing, and
 * §10 requires the opposite: a Card that cannot pay produces *nothing*.
 *
 * The fix is to decide the whole exchange up front. Everything the Card would
 * give and take is checked here, before a single item moves, so output and
 * consumption are atomic: either both happen or neither does.
 *
 * ## Failure is not a no-op (§16)
 * A failed Card still burns its full Work Time and still resolves — "End of
 * Work" fires. It simply produces nothing and consumes nothing. Any Token
 * riding it is spent and wasted all the same (§10 "Penalty of Failure"),
 * because Tokens are wiped at the Cycle boundary regardless of outcome.
 */

/** How many of an item the card is holding in its own stack. */
function stackCount(card, itemId) {
    if (!Array.isArray(card.stack)) return 0;
    return card.stack.filter(e => e?.type === 'item' && e.id === itemId).length;
}

/**
 * Everything this Card must consume to complete, with Token INPUT_COST already
 * applied (§15.8) — so a Mutator that doubles Bait cost is what gets checked,
 * which is exactly the §10 scenario where a greedy combo starves itself.
 *
 * Mirrors the two shapes `consumeInputs` walks: an active recipe (stations)
 * and `inputslot` traits (task cards). Tool slots are not consumed and are
 * skipped.
 *
 * @returns {Array<{itemId: string, quantity: number}>}
 */
export function collectRequiredInputs(card, template) {
    const required = [];
    const agg = card.aggregator;

    if (card.activeRecipe) {
        const inputs = card.activeRecipe.inputs || [];
        const assigned = card.assignedItems || {};
        inputs.forEach((input, index) => {
            const assignedVal = assigned[index];
            const itemId = assignedVal?.id || assignedVal;
            if (!itemId) return;
            required.push({ itemId, quantity: resolveInputCost(agg, input.quantity || 1) });
        });
        return required;
    }

    const isProject = !!template?.isProject;
    const inputSlots = (card.traits || []).filter(t => t.type === 'inputslot');

    for (let i = 0; i < inputSlots.length; i++) {
        const slotTrait = inputSlots[i];
        const inputsToConsume = slotTrait.inputs || [slotTrait];

        for (let j = 0; j < inputsToConsume.length; j++) {
            const reqTrait = inputsToConsume[j];
            if (reqTrait.isTool) continue;   // tools are held, not spent

            const slotIndex = slotTrait.inputs ? j : (slotTrait.slotIndex ?? i);
            const assigned = card.assignedItems?.[slotIndex];
            const itemId = assigned?.id || assigned;
            if (!itemId) continue;           // generic/empty slot — nothing named to check

            const totalRequired = resolveInputCost(agg, reqTrait.quantity || 1);
            const progress = isProject ? (card.project?.progress?.[itemId] || 0) : 0;
            const quantity = isProject ? Math.min(1, totalRequired - progress) : totalRequired;
            if (quantity > 0) required.push({ itemId, quantity });
        }
    }

    return required;
}

/**
 * Can the Card pay for everything it needs? Consumption draws from the card's
 * own stack first and the bank second, so availability is the sum of both —
 * the same order `consumeInputs` spends them in.
 *
 * @returns {{ok: boolean, missing: Array<{itemId, needed, available}>}}
 */
export function checkInputsAvailable(card, required) {
    const missing = [];
    for (const { itemId, quantity } of required) {
        const available = stackCount(card, itemId) + InventoryManager.getItemCount(itemId);
        if (available < quantity) missing.push({ itemId, needed: quantity, available });
    }
    return { ok: missing.length === 0, missing };
}

/**
 * Can the bank store what this Card would produce (§8)?
 *
 * Outputs are rolled at grant time (drop chances, quantity ranges), so this
 * checks the *declared* output types rather than a rolled result.
 *
 * **The Card fails only when NONE of its possible outputs can be stored.**
 * `LootSystem.handleTaskReward` wraps a task's outputs in a single "pick one"
 * cluster, so a Card listing wheat-or-seeds produces one of them, not both.
 * Failing because a single listed item happens to be at max stack would throw
 * away the outputs that *could* still have landed. A Card is only genuinely
 * blocked when there is nowhere for any of its outputs to go.
 *
 * Partial fits still succeed — a stack with room for 3 of a possible 40 takes
 * the 3 and drops the rest, exactly as before.
 *
 * @returns {{ok: boolean, blocked: string[]}}
 */
export function checkOutputCapacity(outputs) {
    const blocked = [];
    let storable = 0;

    for (const out of outputs || []) {
        if (!out || out.type === 'combat_trigger') continue;
        const itemId = out.itemId || out.id;
        if (!itemId) continue;
        if (InventoryManager.canAccept(itemId, 1)) storable++;
        else blocked.push(itemId);
    }

    // Nothing item-shaped to store (e.g. a pure combat_trigger) is not a failure.
    if (storable === 0 && blocked.length === 0) return { ok: true, blocked: [] };

    return { ok: storable > 0, blocked };
}

/**
 * Decide the Card's whole exchange before any of it happens.
 *
 * @param {object} card
 * @param {object} template
 * @param {Array} [outputs] the Card's declared outputs, for the capacity check
 * @returns {null|{reason: string, detail: object}} null when the Card may proceed
 */
export function preflightWorkCycle(card, template, outputs = []) {
    const required = collectRequiredInputs(card, template);
    if (required.length) {
        const { ok, missing } = checkInputsAvailable(card, required);
        if (!ok) return { reason: 'inputs', detail: { missing } };
    }

    if (outputs.length && !template?.isProject) {
        const { ok, blocked } = checkOutputCapacity(outputs);
        if (!ok) return { reason: 'capacity', detail: { blocked } };
    }

    return null;
}
