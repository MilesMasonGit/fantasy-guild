import { SKILLS, expandBearer, isWorkedWithoutSkill, WORK_SKILL_WHY, auditLifecycleBlocks, findUnknownRefs } from '../utils/constants';

/** Connectivity & Graph Auditor: audits the Token, Recipe and Item graph in three pillars: Data Integrity (missing references, invalid IDs, solver refusals), Economic Blockers (orphaned inputs, unreachable items, dead ends) and Pacing Gaps (level gaps in skills). */

/** A Token's inputs/outputs live on `token.config`; recipes carry them at the top level. The top-level form is tolerated as a fallback for Tokens so a fixture in either shape still audits. */
const tokenIO = (token, field) => token?.config?.[field] || token?.[field] || [];

/** ⚠️ A Token keeps its skill and level at `config.skill` and `config.skillRequired`, and no Token carries a top-level `skill` (`OneRuleOnePlace` asserts it), so Pillar 3 must read the config. */
const tokenSkill = (token) => token?.config?.skill ?? token?.skill ?? token?.skillId ?? null;
const tokenLevel = (token) => token?.config?.skillRequired ?? token?.skillRequirement ?? 1;

export function auditConnectivity(entities, solverRefusals = []) {
  const { items = {}, tokens = {}, recipes = {}, enemies = {}, maps = {}, effects = {} } = entities;
  const issues = [];

  const allItems = Object.values(items || {});
  const allTokens = Object.values(tokens || {});
  const allRecipes = Object.values(recipes || {});
  const allEnemies = Object.values(enemies || {});

  const producedBy = {};
  const consumedBy = {};

  for (const token of allTokens) {
    for (const output of tokenIO(token, 'outputs')) {
      const oid = output.id || output.itemId;
      if (oid) {
        if (!producedBy[oid]) producedBy[oid] = [];
        producedBy[oid].push({ id: token.id, type: 'token' });
      }
    }
    for (const input of tokenIO(token, 'inputs')) {
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

  for (const token of allTokens) {
    for (const input of tokenIO(token, 'inputs')) {
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
    for (const output of tokenIO(token, 'outputs')) {
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

  // A hero-worked Token must name a skill. The rule is the game's own (`workSkillRule.js`), so this tab and the boot audit name the same Tokens. Expanded first: a Promotion Token is only recognisable by its Promotes rule, which lives in the effect library.
  for (const token of allTokens) {
    if (!isWorkedWithoutSkill(expandBearer(token, effects))) continue;
    issues.push({
      entityId: token.id,
      entityName: token.name || token.id,
      entityType: 'Token',
      issueType: 'Data Integrity',
      severity: 'Warning',
      details: `Worked by a hero but names no skill. ${WORK_SKILL_WHY}`,
    });
  }

  // The game's own lifecycle checker (spawner / grows / turns / foundation / shop / trickle, and recipes that build on a Foundation), so this tab and the boot audit report the same problems. Expanded first: the shop warning recognises a station by its Station rule.
  const expandedTokens = {};
  for (const [id, token] of Object.entries(tokens || {})) {
    expandedTokens[id] = expandBearer(token, effects);
  }
  for (const f of auditLifecycleBlocks({ tokens: expandedTokens, items, recipes, skills: SKILLS })) {
    issues.push({
      entityId: f.entityId,
      entityName: f.entityName,
      entityType: f.entityType,
      issueType: 'Data Integrity',
      severity: f.severity === 'warning' ? 'Warning' : 'Critical',
      details: f.message,
    });
  }

  // A skill or job the game does not have (a renamed or dropped one). The game's own rule (`unknownRefRule.js`), so this tab and the boot audit name the same things.
  for (const f of findUnknownRefs({ tokens: expandedTokens, items, recipes })) {
    issues.push({
      entityId: f.entityId,
      entityName: f.entityName,
      entityType: f.entityType,
      issueType: 'Data Integrity',
      severity: 'Critical',
      details: f.message,
    });
  }

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

  /*
   * Record simulator refusals as audit rows.
   * ⚠️ A refusal may be a string (meaning Warning) or an object carrying its own severity, entity and text; forcing every row to Warning hid real Criticals among Info notes (see `describeRow` in `useEntityStore`).
   */
  /*
   * Items the simulator has already reported as having no source at all.
   * ⚠️ The Unreachable Item and Orphaned Input checks below say the same thing in vaguer words, so they are suppressed only for items the simulator has already named; where it says nothing, both behave as before.
   */
  const simReportedOrphans = new Set(
    solverRefusals
      .filter((r) => r && typeof r === 'object' && r.code === 'orphan-item' && r.itemId)
      .map((r) => r.itemId)
  );

  for (const refusal of solverRefusals) {
    const structured = refusal && typeof refusal === 'object' ? refusal : null;
    issues.push({
      entityId: 'solver_refusal',
      entityName: structured?.entityName || 'Balance Solver',
      entityType: 'Solver',
      issueType: 'Data Integrity',
      severity: structured?.severity || 'Warning',
      details: structured ? structured.details : refusal,
    });
  }

  for (const item of allItems) {
    const producers = producedBy[item.id] || [];
    if (producers.length === 0 && !item.isRoot && !simReportedOrphans.has(item.id)) {
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

  for (const recipe of allRecipes) {
    for (const input of (recipe.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && (!producedBy[iid] || producedBy[iid].length === 0)) {
        const item = items[iid];
        if (!item?.isRoot && !simReportedOrphans.has(iid)) {
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

  for (const skill of SKILLS) {
    const skillTokens = allTokens.filter((t) => tokenSkill(t) === skill.id);
    if (skillTokens.length === 0) continue;

    const levels = skillTokens.map((t) => tokenLevel(t)).sort((a, b) => a - b);
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

  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.entityId}:${issue.issueType}:${issue.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
