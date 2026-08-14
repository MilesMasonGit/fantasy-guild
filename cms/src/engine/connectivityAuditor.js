import { SKILLS } from '../utils/constants';

/**
 * Connectivity & Graph Auditor — Audits the Token, Recipe, and Item graph
 * (CMS-10, CMS-86, CMS-115)
 *
 * Groups issues into 3 clear design pillars:
 * 1. Data Integrity (Missing References / Invalid IDs / Solver Refusals)
 * 2. Economic Blockers (Orphaned Inputs / Unreachable Items CMS-86 / Dead-Ends)
 * 3. Pacing Gaps (Level gaps in skills)
 */
export function auditConnectivity(entities, solverRefusals = []) {
  const { items = {}, tokens = {}, recipes = {}, enemies = {}, maps = {} } = entities;
  const issues = [];

  const allItems = Object.values(items || {});
  const allTokens = Object.values(tokens || {});
  const allRecipes = Object.values(recipes || {});
  const allEnemies = Object.values(enemies || {});

  // Build lookup: which items are produced / consumed by which entities
  const producedBy = {}; // itemId → [{ id, type }]
  const consumedBy = {}; // itemId → [{ id, type }]

  for (const token of allTokens) {
    for (const output of (token.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid) {
        if (!producedBy[oid]) producedBy[oid] = [];
        producedBy[oid].push({ id: token.id, type: 'token' });
      }
    }
    for (const input of (token.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid) {
        if (!consumedBy[iid]) consumedBy[iid] = [];
        consumedBy[iid].push({ id: token.id, type: 'token' });
      }
    }
  }

  for (const recipe of allRecipes) {
    for (const output of (recipe.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid) {
        if (!producedBy[oid]) producedBy[oid] = [];
        producedBy[oid].push({ id: recipe.id, type: 'recipe' });
      }
    }
    for (const input of (recipe.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid) {
        if (!consumedBy[iid]) consumedBy[iid] = [];
        consumedBy[iid].push({ id: recipe.id, type: 'recipe' });
      }
    }
  }

  for (const enemy of allEnemies) {
    for (const drop of (enemy.drops || [])) {
      const did = drop.id || drop.itemId;
      if (did) {
        if (!producedBy[did]) producedBy[did] = [];
        producedBy[did].push({ id: enemy.id, type: 'enemy' });
      }
    }
  }

  // --- PILLAR 1: DATA INTEGRITY (Hard Breaks & Missing References) ---

  // Check for tokens referencing non-existent items
  for (const token of allTokens) {
    for (const input of (token.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && !items[iid]) {
        issues.push({
          entityId: token.id,
          entityName: token.name || token.id,
          entityType: 'Token',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Input references item ID "${iid}" which does not exist in the database.`,
        });
      }
    }
    for (const output of (token.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid && !items[oid]) {
        issues.push({
          entityId: token.id,
          entityName: token.name || token.id,
          entityType: 'Token',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Output references item ID "${oid}" which does not exist in the database.`,
        });
      }
    }
  }

  // Check for recipes referencing non-existent items
  for (const recipe of allRecipes) {
    for (const input of (recipe.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && !items[iid]) {
        issues.push({
          entityId: recipe.id,
          entityName: recipe.name || recipe.id,
          entityType: 'Recipe',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Recipe input references item ID "${iid}" which does not exist in the database.`,
        });
      }
    }
    for (const output of (recipe.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid && !items[oid]) {
        issues.push({
          entityId: recipe.id,
          entityName: recipe.name || recipe.id,
          entityType: 'Recipe',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Recipe output references item ID "${oid}" which does not exist in the database.`,
        });
      }
    }
  }

  // Record solver refusals as audit warnings (CMS-115)
  for (const refusal of solverRefusals) {
    issues.push({
      entityId: 'solver_refusal',
      entityName: 'Balance Solver',
      entityType: 'Solver',
      issueType: 'Data Integrity',
      severity: 'Warning',
      details: refusal,
    });
  }

  // --- PILLAR 2: ECONOMIC BLOCKERS (Orphans, Unreachable Items CMS-86, Dead-Ends) ---

  // Unreachable Items (CMS-86): Items that have no producing source anywhere in the game
  for (const item of allItems) {
    const producers = producedBy[item.id] || [];
    if (producers.length === 0 && !item.isRoot) {
      issues.push({
        entityId: item.id,
        entityName: item.name || item.id,
        entityType: 'Item',
        issueType: 'Economic Blocker',
        severity: 'Critical',
        details: `Unreachable Item (CMS-86): Has no producing Token, Recipe, or Enemy drop and is not marked as a Root Item.`,
      });
    }
  }

  // Orphaned Inputs: Required by a recipe/token but unproduced
  for (const recipe of allRecipes) {
    for (const input of (recipe.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && (!producedBy[iid] || producedBy[iid].length === 0)) {
        const item = items[iid];
        if (!item?.isRoot) {
          issues.push({
            entityId: iid,
            entityName: item?.name || iid,
            entityType: 'Item',
            issueType: 'Economic Blocker',
            severity: 'Critical',
            details: `Orphaned Input: Required by recipe "${recipe.name || recipe.id}" but has no producing source.`,
          });
        }
      }
    }
  }

  // Dead-End Items: Produced in the game, but never consumed by any recipe/token
  for (const item of allItems) {
    const isProduced = producedBy[item.id];
    const isConsumed = consumedBy[item.id];
    if (isProduced && !isConsumed) {
      const finalTypesAndTags = ['consumable', 'treasure', 'food', 'drink', 'weapon', 'armor', 'tool', 'fuel', 'drop'];
      const itemTypeLower = (item.type || '').toLowerCase();
      const itemTagsLower = (item.tags || []).map((t) => t.toLowerCase());

      const hasFinalTypeOrTag =
        finalTypesAndTags.includes(itemTypeLower) ||
        itemTagsLower.some((t) => finalTypesAndTags.includes(t));

      if (!hasFinalTypeOrTag) {
        issues.push({
          entityId: item.id,
          entityName: item.name || item.id,
          entityType: 'Item',
          issueType: 'Economic Blocker',
          severity: 'Info',
          details: `Dead-End Material: Produced by tokens/recipes but not consumed downstream.`,
        });
      }
    }
  }

  // --- PILLAR 3: PACING GAPS (Level Progression Spacing) ---
  for (const skill of SKILLS) {
    const skillTokens = allTokens.filter((t) => t.skill === skill.id || t.skillId === skill.id);
    if (skillTokens.length === 0) continue;

    const levels = skillTokens.map((t) => t.skillRequirement || 1).sort((a, b) => a - b);
    const maxLevel = Math.max(...levels);

    let prev = 1;
    for (const level of levels) {
      if (level - prev > 15) {
        issues.push({
          entityId: skill.id,
          entityName: skill.name,
          entityType: 'Skill',
          issueType: 'Pacing Gap',
          severity: 'Warning',
          details: `Progression Gap: No tokens available in "${skill.name}" between level ${prev} and ${level} (a ${level - prev} level gap).`,
        });
      }
      prev = level;
    }
  }

  // Deduplicate issues by entityId + issueType + details hash
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.entityId}:${issue.issueType}:${issue.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
