// === Content-derived card type (CMS rework Phase 4, §4 ruleset) ===
//
// A card's TYPE is derived from its CONTENT, never picked from a dropdown and
// never manually overridden (L13). This is the single source of truth the
// unified card editor's quiet type label reads from, and what a card's
// `cardType`/`preset` are set to before sync.
//
// The rules (roadmap §4, R1–R6), evaluated in order — first match wins:
//   R1  carries a token to apply to other cards (config.tokenId)   → action (mutator)
//   R2  the card itself defines a crafting station                 → station   [provisional]
//   R3  crafts at a linked station (stationId + inputs/outputs)     → recipe    [provisional]
//   R4  the enemy is the subject: enemyId and NO item outputs       → combat
//   R6  legacy ambush: enemyId AND item outputs (grandfathered)     → task (legacy)
//   R5  otherwise (gathers/processes items)                         → task
//
// R2/R3 (the station/recipe boundary) are marked provisional: the roadmap flags
// that how stations and recipes relate in the game's cardRegistry still needs
// confirming. They are implemented conservatively here and must be validated
// against real station/recipe content before they are relied on.

/** Game cardType values these map to (see cardConstants.js CARD_TYPES). */
export const CARD_TYPE = {
  action: 'action', // a mutator is cardType 'action' + preset 'MUTATOR'
  station: 'station',
  recipe: 'recipe',
  combat: 'combat',
  task: 'task',
};

/** Read a content signal from either the flat entity or its nested config. */
function sig(card) {
  const cfg = card?.config || {};
  const tokenId = card?.tokenId ?? cfg.tokenId ?? null;
  const enemyId = card?.enemyId ?? cfg.enemyId ?? null;
  const outputs = card?.outputs ?? cfg.outputs ?? card?.drops ?? [];
  const inputs = card?.inputs ?? cfg.inputs ?? [];
  const stationId = card?.stationId ?? cfg.stationId ?? null;
  // "Item outputs" excludes combat triggers — an ambush trigger is not a yield.
  const itemOutputs = (outputs || []).filter(
    (o) => o && o.type !== 'combat_trigger' && (o.id || o.itemId)
  );
  return { tokenId, enemyId, inputs: inputs || [], itemOutputs, stationId };
}

/**
 * Derive a card's type from its content.
 * @param {object} card - a card entity (flat CMS shape or with nested `config`).
 * @returns {{ type: string, label: string, reason: string, legacy: boolean, provisional: boolean }}
 *   `type` is the game cardType; `label` is the human word ('mutator' for action);
 *   `reason` explains the verdict for the quiet label's tooltip; `legacy` marks
 *   the grandfathered ambush case (R6); `provisional` marks R2/R3 verdicts.
 */
export function inferCardType(card) {
  const { tokenId, enemyId, inputs, itemOutputs, stationId } = sig(card);

  // R1 — a mutator carries a token it hands out to later cards in the deck.
  if (tokenId) {
    return { type: CARD_TYPE.action, label: 'mutator', legacy: false, provisional: false,
      reason: 'Mutator — it carries a token to apply to other cards.' };
  }

  // R2 — the card itself defines a crafting station. [provisional]
  if (card?.isStation === true || card?.cardType === 'station') {
    return { type: CARD_TYPE.station, label: 'station', legacy: false, provisional: true,
      reason: 'Station — it defines a crafting station.' };
  }

  // R3 — crafts at a linked station. [provisional]
  if (stationId && (inputs.length > 0 || itemOutputs.length > 0)) {
    return { type: CARD_TYPE.recipe, label: 'recipe', legacy: false, provisional: true,
      reason: 'Recipe — it crafts at a linked station.' };
  }

  // R4 — the enemy is the subject: an enemy and no item yield.
  if (enemyId && itemOutputs.length === 0) {
    return { type: CARD_TYPE.combat, label: 'combat', legacy: false, provisional: false,
      reason: 'Combat — the enemy is the subject of the card.' };
  }

  // R6 — legacy ambush: an enemy AND item outputs. Grandfathered to task; the
  // editor must refuse to create new cards of this shape (no new ambush cards).
  if (enemyId && itemOutputs.length > 0) {
    return { type: CARD_TYPE.task, label: 'task', legacy: true, provisional: false,
      reason: 'Task (legacy) — gathers items, with a legacy ambush trigger.' };
  }

  // R5 — otherwise it gathers or processes items.
  return { type: CARD_TYPE.task, label: 'task', legacy: false, provisional: false,
    reason: 'Task — it gathers or processes items.' };
}

/**
 * True when a card already has item outputs, so the editor must refuse to add a
 * combat trigger to it (L14/L15 — no new ambush cards). A card with an enemy
 * subject and no item outputs is fine (that's a normal combat card).
 */
export function wouldBeAmbush(card) {
  const { itemOutputs } = sig(card);
  return itemOutputs.length > 0;
}
