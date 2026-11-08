/**
 * Economic simulator: the refusal catalogue. Every card has three parts: what, why in game terms, and ranked remedies.
 * ⚠️ Every remedy names a tag or a dial, never a raw number (tag it a slower Tempo, not set its chance to 17%); a band or ratio may appear in the `why` as observation. The catalogue is one module so the same refusal cannot carry different remedy strings in different passes.
 */

import { makeRow, SEVERITY } from './rows.js';

/**
 * The catalogue: each entry is `{ severity, remedies }`, where `remedies` is a fixed list or a function of the row's context.
 * ⚠️ Ranked most-likely-to-be-what-you-meant first.
 */
export const REFUSAL_CATALOGUE = Object.freeze({
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

    'training-loss-over-cap': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Raise the XPH gold factor dial, if training should cost the player less across the board.',
            'Give it cheaper inputs — the loss is what its materials cost, not what it makes.',
            'Raise the training-loss cap dial, if a recipe this expensive to train on is intended.',
            'Re-tag its Purpose to Items or Gold, if it is not really a training recipe.',
        ],
    },

    'iph-quantity-exemption': {
        severity: SEVERITY.WARNING,
        remedies: () => [
            'Nothing, if volume is this Token\'s character — that is what the IPH tag asks for.',
            'Re-tag its Purpose to Gold, if it should earn through price rather than through volume.',
            'Flag a different source as this item\'s anchor, if the price it inherits is what forced the move.',
        ],
    },

    'anchor-candidate-changed': {
        severity: SEVERITY.INFO,
        remedies: () => [
            'Re-elect (re-prices this item\'s whole chain).',
            'Dismiss — keeping the current anchor costs nothing.',
        ],
    },

    // The one refusal aimed at the developer's dials: it says the dial set itself has broken the progression guard, so every remedy names a dial.
    'progression-guard': {
        severity: SEVERITY.CRITICAL,
        remedies: () => [
            'Narrow the band widths — a wide band is how much slack the sim is allowed, and this much slack swallows a decade of levelling.',
            'Steepen the earn curve pins, so ten levels of progress is worth more than one level\'s spread.',
            'Nothing about the content — no Token caused this, and re-tagging one will not clear it.',
        ],
    },

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
