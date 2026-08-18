import { SKILLS } from '../utils/constants';

/**
 * Description Dictionary Engine — Implements Phase 9 (CMS-66, CMS-67, CMS-81, CMS-87)
 *
 * Automatically composes clean, accurate, human-readable mechanical descriptions
 * for Tokens based on their production, recipes, effect blocks, triggers, and lifecycle.
 */

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
 * Generates the production or gathering clause for a Token (CMS-81).
 * @param {object} token
 * @param {Record<string, object>} items
 * @param {Record<string, Array>} recipePools
 * @returns {string|null}
 */
export function getProductionClause(token, items = {}, recipePools = {}) {
  if (!token) return null;

  // 1. Skill-pooled station
  if (token.recipePool) {
    const skillName = SKILLS.find((s) => s.id === token.recipePool)?.name || token.recipePool;
    return `Crafts recipes from the ${skillName} pool.`;
  }

  // 2. Private multi-recipe station
  if (token.recipes && token.recipes.length > 1) {
    return `Crafts ${token.recipes.length} specialized recipes.`;
  }

  // 3. Single private recipe station
  if (token.recipes && token.recipes.length === 1) {
    const recipe = token.recipes[0];
    const inStr = formatItemList(recipe.inputs, items);
    const outStr = formatItemList(recipe.outputs, items);
    const timeSec = (recipe.cycleTimeMs || recipe.baseTickTime || 12000) / 1000;
    if (inStr && outStr) {
      return `Consumes ${inStr} to produce ${outStr} (${timeSec}s).`;
    }
    if (outStr) {
      return `Produces ${outStr} every ${timeSec}s.`;
    }
  }

  // 4. Standard Token outputs / gathering resource
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

/**
 * Generates clauses for effect blocks, buffs, and adjacency modifiers (CMS-20/25/58).
 * @param {object} token
 * @param {Record<string, object>} items
 * @returns {Array<string>}
 */
export function getEffectBlockClauses(token, items = {}) {
  if (!token) return [];
  const clauses = [];
  const blocks = token.effectBlocks || [];

  // 1. Context / Tool provision (provides)
  const allProvides = [];
  const defaultTier = token.tier || 1;
  for (const p of token.provides || []) {
    if (typeof p === 'string') allProvides.push({ tag: p, tier: defaultTier });
    else if (p?.tag) allProvides.push({ tag: p.tag, tier: p.tier || defaultTier });
  }
  for (const block of blocks) {
    const blockTier = block.tier || defaultTier;
    for (const p of block.provides || []) {
      if (typeof p === 'string') allProvides.push({ tag: p, tier: blockTier });
      else if (p?.tag) allProvides.push({ tag: p.tag, tier: p.tier || blockTier });
    }
  }
  if (allProvides.length > 0) {
    const list = allProvides
      .map(({ tag, tier }) => {
        const name = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/_/g, ' ');
        return tier > 1 ? `Tier ${tier} ${name}` : name;
      })
      .join(', ');
    clauses.push(`Acts as ${list} for adjacent stations.`);
  }

  for (const block of blocks) {
    // Modifier / Buff blocks
    if (block.modifiers && block.modifiers.length > 0) {
      for (const mod of block.modifiers) {
        const target = mod.targetMode === 'adjacent' ? 'Adjacent tokens' : 'Matching tokens';
        const axis = mod.axis ? mod.axis.replace(/_/g, ' ') : 'Speed';
        const sign = mod.value >= 0 ? '+' : '';
        const isPercent = mod.isPercent !== false;
        const valStr = isPercent ? `${sign}${Math.round(mod.value * 100)}%` : `${sign}${mod.value}`;
        clauses.push(`${target} gain ${valStr} ${axis}.`);
      }
    }

    // Trigger blocks (CMS-32/72)
    if (block.trigger) {
      const trig = block.trigger;
      const eventName = (trig.event || 'ON_CYCLE_COMPLETE').toLowerCase().replace(/^on_/, '').replace(/_/g, ' ');
      const scope = trig.scope || 'adjacent';

      if (block.convert) {
        const inStr = formatItemList(block.convert.consumes, items);
        const outStr = formatItemList(block.convert.produces, items);
        clauses.push(`When ${scope} ${eventName}: converts ${inStr} into ${outStr}.`);
      } else if (block.bonusDrop) {
        const bonusItem = getItemName(block.bonusDrop.itemId, items);
        const chance = block.bonusDrop.chance ?? 100;
        const qty = block.bonusDrop.quantity ?? 1;
        clauses.push(`When ${scope} ${eventName}: ${chance < 100 ? `${chance}% chance ` : ''}+${qty} ${bonusItem}.`);
      } else {
        clauses.push(`Triggers when ${scope} ${eventName}.`);
      }
    }
  }

  // Legacy single buff fallback
  if (token.buff && clauses.length === 0) {
    const b = token.buff;
    const target = b.target || 'Adjacent tokens';
    const val = b.speedMult ? `+${Math.round((b.speedMult - 1) * 100)}% Speed` : '+bonus';
    clauses.push(`${target} gain ${val}.`);
  }

  return clauses;
}

/**
 * Generates accepted tokens / tool requirements clause (e.g. "Requires an adjacent Pickaxe (Tier 1+).").
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
    return `Requires an adjacent ${parts[0]}.`;
  }
  return `Requires an adjacent ${parts.join(' and ')}.`;
}

/**
 * Generates combat loot clauses for enemies (CMS-51).
 * @param {object} token
 * @param {Record<string, object>} items
 * @returns {string|null}
 */
export function getCombatLootClause(token, items = {}) {
  if (!token || token.tokenType !== 'enemy') return null;
  const drops = token.drops || token.outputs || [];
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

  if (token.tokenType === 'manager' || token.isManager) {
    clauses.push('Automatically restocks adjacent stations from the Guild Bank.');
  }

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

  // If manual override is explicitly enabled and has custom text, preserve it (CMS-67)
  if (token.descriptionOverride && token.description?.trim()) {
    return token.description.trim();
  }

  const clauses = [];

  // 1. Accepted Tokens / Requirements Clause
  const acceptedClause = getAcceptedTokensClause(token);
  if (acceptedClause) clauses.push(acceptedClause);

  // 2. Production / Gathering Clause (CMS-81)
  const prodClause = getProductionClause(token, items, recipePools);
  if (prodClause) clauses.push(prodClause);

  // 3. Combat Loot Clause (if enemy)
  const lootClause = getCombatLootClause(token, items);
  if (lootClause) clauses.push(lootClause);

  // 4. Effect Blocks & Modifiers Clauses
  const effectClauses = getEffectBlockClauses(token, items);
  clauses.push(...effectClauses);

  // 5. Trait Clauses
  const traitClauses = getTraitClauses(token);
  clauses.push(...traitClauses);

  // Fallback if empty
  if (clauses.length === 0) {
    return token.description || 'A token for the guild playmat.';
  }

  return clauses.join(' ');
}
