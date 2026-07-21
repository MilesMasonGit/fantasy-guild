// Fantasy Guild - Token Registry
// Card Mutators & Tokens, Phase 0 scaffolding (mutator_roadmap_v1.md).
// Every Token is data: the engine reads this registry; no token has one-off
// code scattered elsewhere. Mirrors the statusRegistry.js pattern.
//
// LEXICON (status_effects_plan.md §16): a **Mutator** is the Card the Hero
// works; a **Token** is the marker that Mutator stamps onto a target Card.
// This registry defines Tokens. It is deliberately EMPTY of real content in
// Phase 0 — schema and doc comment only. Content lands in Phase 10.

/**
 * === Token Schema ===
 * {
 *   tokenId: string,          // canonical id, also the handle counters name (§15.6)
 *   name: string,             // player-facing, uses the §16 lexicon
 *   icon: string,             // emoji badge shown on the card face (§12)
 *   category: 'boon'          // purely beneficial
 *           | 'bane'          // purely detrimental (e.g. Cursed)
 *           | 'tradeoff',     // gives on one axis, takes on another (e.g. Trawler)
 *                             //   NOTE: category is for UI colour/sorting ONLY.
 *                             //   It must never drive cleansing — Purify is a
 *                             //   targeted counter, never a "strip all
 *                             //   negatives" sweep (§15.6).
 *
 *   // --- Targeting (§15.14) --------------------------------------------
 *   target_tags: string[],    // Card tags this token can attach to (Phase 2).
 *                             //   ['*'] means "any card".
 *   targeting: 'charges'      // stamp the next N matching slots (§15.5)
 *            | 'area',        // stamp EVERY matching slot left in the Cycle
 *   charges?: number,         // 'charges' mode only. Surplus charges with no
 *                             //   matching slot are WASTED, never carried to
 *                             //   the next Cycle (§15.5).
 *
 *   // --- Effect axes (§15.8) -------------------------------------------
 *   // Three-Bucket math (§15.3), resolved in sequence:
 *   //   Final = (Base + Σ flat) × (Σ multipliers) × (1 + Σ percentages)
 *   // Canonical case: Base 1 Shrimp, +1 flat, ×2, +25% → (1+1) × 2 × 1.25 = 5.
 *   //  - Multipliers SUM, they do not compound: ×2 and ×3 give ×5, not ×6.
 *   //    Defaults to ×1 when empty, clamped at 0 — so a curse is authored as
 *   //    a NEGATIVE multiplier (-2), never as ×0.
 *   //  - Percentages SUM AS PERCENTAGES and never inflate one another:
 *   //    +25% and +50% give +75% (×1.75), not ×1.875 and not ×2.75.
 *   flat?: {                  // omitted keys contribute 0
 *     yield?: number,         // units of output
 *     time?: number,          // milliseconds of Work Time
 *     cost?: number           // units of input consumed
 *   },
 *   multiplier?: {            // ×N factors; omitted keys contribute nothing
 *     yield?: number,
 *     time?: number,
 *     cost?: number
 *   },
 *   percentage?: {            // fractions, 0.25 meaning "+25%"
 *     yield?: number,
 *     time?: number,
 *     cost?: number
 *   },
 *
 *   // --- Combat axis (§15.13) ------------------------------------------
 *   // A combat-targeting token gets NO math axis of its own. It rides the
 *   // combat slot and, when that Card materializes, applies real Status
 *   // Effects to the spawned enemy through the existing StatusEffectSystem —
 *   // the same path a weapon proc uses. Do not build a parallel debuff path.
 *   applyStatuses?: Array<{ statusId: string, stacks: number }>,
 *
 *   // --- Targeted counters (§15.6) --------------------------------------
 *   // Mirrors the `immune_to` array in §13. A curative names exactly what it
 *   // removes; there is no generic cleanse.
 *   removes?: string[],       // tokenIds this token strips on stamping
 *
 *   description: string       // tooltip text, §16 lexicon
 * }
 *
 * === Stamped Token instance (runtime, NOT this registry) ===
 * What actually lands on a deck slot is the smaller instance shape from §13 /
 * roadmap Phase 3:
 *   { tokenId, sourceCardId, charges }
 * The effect payload is NOT copied onto the instance — it is read from this
 * registry at apply time, so a retune here takes effect immediately and no
 * stale copy can be stranded on a live slot. Stacking N identical tokens means
 * N instances, never one merged blob.
 * Instances live in a runtime-only registry keyed by slot index and are never
 * serialized (roadmap F3): upcoming cards do not exist as objects (F1), so
 * tokens attach to SLOTS and are applied when LoopRunner materializes the
 * card. Everything is wiped at the Cycle boundary (F2, §15.3/§7).
 */

export const TOKENS = {
    // Intentionally empty in Phase 0.
    // Phase 10 ships the §14 catalog: Abundance, Trawler, Hex, Cursed, Dam.
    // (Midas is cut from v1 — §15.8.)
};

export function getToken(tokenId) {
    return TOKENS[tokenId] || null;
}

export function getAllTokens() {
    return TOKENS;
}

/**
 * Does a token definition apply to a card carrying these tags?
 * Tags are case-normalised on read (§15.4 / roadmap Phase 2) so 'Fishing' and
 * 'fishing' can never both circulate as distinct tags.
 *
 * @param {object} tokenDef - a TOKENS entry
 * @param {string[]} cardTags - the target card's tags
 * @returns {boolean}
 */
export function tokenMatchesTags(tokenDef, cardTags) {
    if (!tokenDef?.target_tags?.length) return false;
    if (tokenDef.target_tags.includes('*')) return true;
    if (!cardTags?.length) return false;
    const normalized = new Set(cardTags.map(t => String(t).toLowerCase()));
    return tokenDef.target_tags.some(t => normalized.has(String(t).toLowerCase()));
}
