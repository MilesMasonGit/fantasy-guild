/**
 * Economic simulator — the refusal catalogue (phase P6).
 *
 * Plan §12 sets one bar, and it is this phase's acceptance criterion rather
 * than decoration:
 *
 * > *A designer who reads no formulas knows which tag or dial to change next.*
 *
 * So every card here has three parts — **what**, **why in game terms**, and
 * **remedies, ranked** — and **every remedy names a tag or a dial, never a raw
 * number**. "Set its chance to 17%" is a forbidden remedy; "tag it a slower
 * Tempo" is the shape. The one thing a remedy may quote is a *band* or a
 * *ratio* as context inside the `why`, because that is the observation, not the
 * instruction.
 *
 * ## Why the catalogue is a module and not prose scattered across passes
 *
 * Four of these refusals are raised in `anchorPass.js` and `pricingPass.js`,
 * three in `tuningPass.js`. Before this file existed each pass carried its own
 * remedy strings, so the same refusal could acquire two different vocabularies
 * depending on which pass noticed it first. The passes now write only the
 * *observation* — the numbers they saw — and take severity and remedies from
 * here.
 *
 * ## The Map cards (phase P7)
 *
 * The plan's table lists **Map underwater** and **Map scrap-rich**; the Map
 * pass adds three more of its own shape — an item-heavy burst, an unlimited
 * Token in an ordinary pool, and an enemy whose loot does not match what the
 * burst charged for it. Every one of them is a **refusal, never an
 * adjustment**: each input to the Map check is authored (a price, a pool, a
 * rarity tag, a charge count), so there is nothing the simulator may quietly
 * move on the author's behalf.
 */

import { makeRow, SEVERITY } from './rows.js';

/**
 * The catalogue. Each entry is `{ severity, remedies }`, where `remedies` is
 * either a fixed list or a function of the row's context.
 *
 * ⚠️ Ranked, most-likely-to-be-what-you-meant first. The ranking is the plan's
 * (§12's table reads left to right), not an alphabet.
 */
export const REFUSAL_CATALOGUE = Object.freeze({
    // ── §5 step 4: the levers ran out ────────────────────────────────────────
    'levers-exhausted': {
        severity: SEVERITY.WARNING,
        remedies: ({ tooFast = false, hasRange = false } = {}) => [
            tooFast
                ? 'Tag it a slower Tempo — a longer cycle is the one lever with real travel left.'
                : 'Tag it a faster Tempo — a shorter cycle is the one lever with real travel left.',
            hasRange
                ? 'Re-author the output\'s quantity range — the spread it has cannot slide far enough in that direction.'
                : 'Give the output a quantity range instead of a fixed amount, so the yield has somewhere to land.',
            'Flag a different source as this item\'s anchor, so this one inherits a value it can live with.',
            'Widen the non-anchor band dial, if this shape is common rather than a one-off.',
        ],
    },

    // ── §5 budget rule: r worse than 3× ──────────────────────────────────────
    'correction-too-large': {
        severity: SEVERITY.WARNING,
        remedies: ({ purpose } = {}) => [
            'Flag a different source as this item\'s anchor — the price it inherits is the problem, not its yield.',
            'Point it at a different item, one whose everyday source works at this pace.',
            purpose === 'iph'
                ? 'Re-tag its Purpose — an IPH source is paid in items, so its gold rate sits well under the curve.'
                : 'Re-tag its Purpose — Gold, Items and XP aim at very different earnings.',
            'Tag it IPH and raise its base quantity, if volume is what this producer is for.',
        ],
    },

    // ── §6 / CMS-122: training costs money, but not this much ────────────────
    'training-loss-over-cap': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Raise the XPH gold factor dial, if training should cost the player less across the board.',
            'Give it cheaper inputs — the loss is what its materials cost, not what it makes.',
            'Raise the training-loss cap dial, if a recipe this expensive to train on is intended.',
            'Re-tag its Purpose to Items or Gold, if it is not really a training recipe.',
        ],
    },

    // ── §5, F2: the character guard is off here, and that must be visible ────
    'iph-quantity-exemption': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Nothing, if volume is this Token\'s character — that is what the IPH tag asks for.',
            'Re-tag its Purpose to Gold, if it should earn through price rather than through volume.',
            'Flag a different source as this item\'s anchor, if the price it inherits is what forced the move.',
        ],
    },

    // ── §3.2 stickiness ──────────────────────────────────────────────────────
    'anchor-candidate-changed': {
        severity: SEVERITY.INFO,
        remedies: () => [
            'Re-elect (re-prices this item\'s whole chain).',
            'Dismiss — keeping the current anchor costs nothing.',
        ],
    },

    // ── §13.6 / CMS-48: the Map check's two sides ────────────────────────────
    'map-scrap-rich': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Put more entries in the pool — the scrap budget is split across the whole pool, so a short pool hands every burst a big share of it.',
            'Re-tag the pool\'s Tokens rarer — a rarer entry draws less often, and the rarity premium dial decides how much less.',
            'Raise the Map\'s price, or ask more materials of it, if a burst this generous is what this Map is for.',
            'Turn the scrap-ratio dial down, if every Map reads this way rather than just this one.',
        ],
    },
    'map-underwater': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Put a stronger producer in the pool — what a burst is worth is what its Tokens earn over their lifetime, not what they scrap for.',
            'Give the pool\'s Tokens more charges, so each one works for longer before it is spent.',
            'Lower the Map\'s price, or ask fewer materials of it.',
            'Turn the productive-return pins down, if Maps at this end of the game should not have to pay for themselves this hard.',
        ],
    },
    'map-item-heavy': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Drop a raw-item entry from the pool, or ask less of it — raw items are counted at face value and eat the scrap budget before any Token is priced.',
            'Raise the Map\'s price, if the pile of raw goods is the point of this Map.',
            'Turn the scrap-ratio dial up, if raw-item entries are normal across the corpus.',
        ],
    },
    'map-unlimited-token': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Give the Token a charge count, so a burst hands out something that is eventually spent.',
            'Take it out of the pool and let the player earn it another way — unlimited is a special design space, not a burst reward.',
            'Nothing, if an unlimited Token really is this Map\'s headline prize; the check cannot bound what never runs out.',
        ],
    },
    'map-enemy-band': {
        severity: SEVERITY.WARNING,
        remedies: ({ generous = false } = {}) => [
            generous
                ? 'Thin the enemy\'s drop table, or tag it rarer so the burst charges more for it.'
                : 'Give the enemy a better drop table, or tag it commoner so the burst charges less for it.',
            'Re-price the items it drops by flagging a different source as their anchor.',
            'Turn the rarity-premium dial, if every rare entry in the corpus is priced this way.',
        ],
    },
    'map-support-entry': {
        severity: SEVERITY.INFO,
        remedies: () => [
            'Nothing — a support Token is counted at exactly what the burst charged for it, so it neither helps nor hurts the verdict.',
            'Give it a work cycle, if it was meant to produce something.',
        ],
    },
    'map-idle-entry': {
        severity: SEVERITY.INFO,
        remedies: () => [
            'Give it a work cycle, if this entry was meant to earn its keep.',
            'Tag its Tempo and Purpose, if it has a cycle the simulator skipped for want of tags.',
            'Nothing, if a burst is allowed to hand out things that do no work.',
        ],
    },

    // ── Unpriceable content (Critical) ───────────────────────────────────────
    'orphan-item': {
        severity: SEVERITY.CRITICAL,
        remedies: () => ['Give it a producer (a Token cycle or a recipe output).'],
    },
    'deferred-only-item': {
        severity: SEVERITY.CRITICAL,
        remedies: () => ['Give it an in-scope source, or accept that it stays unpriced.'],
    },
    'recipe-cycle': {
        severity: SEVERITY.CRITICAL,
        remedies: () => [
            'Break the loop.',
            'If this is a return leg, flag it `downcycle: true` — recycling is a supported shape (CMS-130).',
        ],
    },
    'token-output-recipe': {
        severity: SEVERITY.CRITICAL,
        remedies: () => [
            'Output items instead, for now.',
            'Wait for the Token-as-product pass — it is a named v1 deferral (CMS-128).',
        ],
    },
});

/** Is `code` in the catalogue? */
export function isRefusal(code) {
    return Object.prototype.hasOwnProperty.call(REFUSAL_CATALOGUE, code);
}

/**
 * Build a refusal row from the catalogue.
 *
 * @param {string} code   a catalogue key
 * @param {object} card   `{ what, why }` — the pass's own observation, in prose
 * @param {object} extra  `{ entityId, itemId, detail }`, plus anything the
 *                        catalogue's remedy builder reads (`purpose`, `tooFast`)
 *
 * The row's one-line `message` is `what` and `why` joined, because the audit
 * panel's refusal channel is one line per row (`useEntityStore.describeRow`).
 * Surfaces with room read `what` and `why` separately.
 */
export function makeRefusal(code, { what, why }, extra = {}) {
    const entry = REFUSAL_CATALOGUE[code];
    if (!entry) throw new Error(`Unknown refusal code "${code}" — add it to REFUSAL_CATALOGUE first.`);
    const remedies = typeof entry.remedies === 'function' ? entry.remedies(extra) : entry.remedies;
    return makeRow(entry.severity, code, why ? `${what} ${why}` : what, {
        what,
        why: why ?? null,
        entityId: extra.entityId,
        itemId: extra.itemId,
        detail: extra.detail,
        remedies,
    });
}
