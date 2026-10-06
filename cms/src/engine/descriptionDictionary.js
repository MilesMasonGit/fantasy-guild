import { statementsOf, stationSkillOf, renderStatement, derivedTokenType } from '../utils/constants';

/** Description Dictionary Engine: composes mechanical descriptions for Tokens from their production, recipes, effects, triggers and lifecycle. */

/**
 * Formats an item quantity or min-max range for display.
 * @param {object} entry - { quantity, minQty, maxQty }
 * @returns {string} e.g. "2", "1–3"
 */
function formatQty(entry) {
  if (!entry) return '1';
  if (entry.minQty != null && entry.maxQty != null && entry.minQty !== entry.maxQty) {
    return `${entry.minQty}–${entry.maxQty}`;
  }
  return `${entry.quantity ?? entry.minQty ?? 1}`;
}

/**
 * Gets an item's display name from the items dictionary.
 * @param {string} itemId
 * @param {Record<string, object>} items
 * @returns {string}
 */
function getItemName(itemId, items = {}) {
  if (!itemId) return 'items';
  return items[itemId]?.name || itemId.replace(/^item_/, '').replace(/_/g, ' ');
}

/**
 * Formats a list of item entries into English text (e.g. "3 Copper Ore and 1 Charcoal").
 * @param {Array<object>} list
 * @param {Record<string, object>} items
 * @returns {string}
 */
function formatItemList(list = [], items = {}) {
  if (!list || list.length === 0) return '';
  const parts = list.map((entry) => {
    const qty = formatQty(entry);
    const name = getItemName(entry.id || entry.itemId, items);
    const chance = entry.dropChance ?? entry.chance ?? 100;
    const chanceStr = chance < 100 ? ` (${chance}%)` : '';
    return `${qty} ${name}${chanceStr}`;
  });

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Generates the production or gathering clause for a Token.
 * @param {object} token
 * @param {Record<string, object>} items
 * @param {Record<string, Array>} recipePools - unused; kept so the two callers keep one signature
 * @returns {string|null}
 */
export function getProductionClause(token, items = {}, recipePools = {}) {
  if (!token) return null;

  // ⚠️ A station gets no clause here, deliberately: station-ness is a `Works as` statement and the rules clause below already renders every statement, so a branch here would say the same thing twice. `stationSkillOf` marks the case.
  if (stationSkillOf(token)) return null;

  const inputs = token.inputs || [];
  const outputs = token.outputs || [];
  const timeSec = token.cycleTime || (token.baseTickTime ? token.baseTickTime / 1000 : 12);

  if (inputs.length > 0 && outputs.length > 0) {
    const inStr = formatItemList(inputs, items);
    const outStr = formatItemList(outputs, items);
    return `Consumes ${inStr} to produce ${outStr} (${timeSec}s).`;
  }

  if (outputs.length > 0) {
    const outStr = formatItemList(outputs, items);
    return `Produces ${outStr} every ${timeSec}s.`;
  }

  return null;
}

/** A Token's rules, as sentences. ⚠️ There is exactly one renderer, in the game's `statementText.js`, shared by the editor row, the rules panel here and the in-game tooltip, so a description cannot disagree with an effect. */
export function getEffectBlockClauses(token, items = {}) {
  if (!token) return [];
  return statementsOf(token).map((statement) =>
    renderStatement(statement, {
      item: (id) => getItemName(id, items),
      token: (id) => id,
    })
  );
}

/**
 * Generates accepted tokens / tool requirements clause (e.g. "Requires a nearby Pickaxe (Tier 1+).").
 * @param {object} token
 * @returns {string|null}
 */
export function getAcceptedTokensClause(token) {
  if (!token || !token.acceptedTokens || token.acceptedTokens.length === 0) return null;
  const parts = token.acceptedTokens.map((req) => {
    const tagName = (req.tag || 'tool').replace(/_/g, ' ');
    const capitalTag = tagName.charAt(0).toUpperCase() + tagName.slice(1);
    const minTier = req.minTier || 1;
    const tierStr = minTier > 1 ? ` (Tier ${minTier}+)` : '';
    return `${capitalTag}${tierStr}`;
  });
  if (parts.length === 1) {
    return `Requires a nearby ${parts[0]}.`;
  }
  return `Requires a nearby ${parts.join(' and ')}.`;
}

/**
 * Generates combat loot clauses for enemies.
 * @param {object} token
 * @param {Record<string, object>} items
 * @returns {string|null}
 */
export function getCombatLootClause(token, items = {}) {
  if (!token || derivedTokenType(token) !== 'enemy') return null;
  // ⚠️ Enemy drops live at `config.outputs`; neither `token.drops` nor a top-level `token.outputs` exists.
  const drops = token.config?.outputs || [];
  if (drops.length === 0) return 'Can be fought by heroes in combat.';

  const dropListStr = formatItemList(drops, items);
  return `Drops ${dropListStr} when defeated in combat.`;
}

/**
 * Generates special trait clauses (Manager, Passive, etc.).
 * @param {object} token
 * @returns {Array<string>}
 */
export function getTraitClauses(token) {
  if (!token) return [];
  const clauses = [];

  // ⚠️ No clause promises that a `manager` Token restocks stations: a Manager is decided by what it restocks, and a Restocks statement says so.

  if (token.requiresHero === false) {
    clauses.push('Operates passively without requiring a hero.');
  }

  return clauses;
}

/**
 * Composes a full, polished description for a Token from its mechanics.
 * @param {object} token - Token entity
 * @param {Record<string, object>} items - Items catalog
 * @param {Record<string, Array>} recipePools - Recipe pools catalog
 * @returns {string} Composed description
 */
export function composeTokenDescription(token, items = {}, recipePools = {}) {
  if (!token) return '';

  // ⚠️ There is no manual override: an override is how a description drifts from the effect it describes.

  const clauses = [];

  const acceptedClause = getAcceptedTokensClause(token);
  if (acceptedClause) clauses.push(acceptedClause);

  const prodClause = getProductionClause(token, items, recipePools);
  if (prodClause) clauses.push(prodClause);

  const lootClause = getCombatLootClause(token, items);
  if (lootClause) clauses.push(lootClause);

  const effectClauses = getEffectBlockClauses(token, items);
  clauses.push(...effectClauses);

  const traitClauses = getTraitClauses(token);
  clauses.push(...traitClauses);

  // Fallback if empty. Deliberately NOT the old description: a Token with no rules should read as having none.
  if (clauses.length === 0) {
    return 'A token for the guild playmat.';
  }

  return clauses.join(' ');
}
