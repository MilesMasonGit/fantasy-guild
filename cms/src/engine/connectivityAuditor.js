import { SKILLS } from '../utils/constants';

/**
 * Audits the entity graph for structural issues.
 * Groups issues into 3 clear design pillars:
 * 1. Data Integrity (Hard Breaks / Missing References)
 * 2. Economic Blocker (Orphans / Dead-Ends in production chains)
 * 3. Pacing Gap (Level gaps / missing progression tasks)
 */
export function auditConnectivity(entities) {
  const { items, tasks, recipes = {}, enemies, areas, quests, lootTables = {} } = entities;
  const issues = [];

  const allItems = Object.values(items || {});
  const allTasks = Object.values(tasks || {});
  const allRecipes = Object.values(recipes || {});
  const allEnemies = Object.values(enemies || {});
  const allQuests = Object.values(quests || {});
  const allLootTables = Object.values(lootTables || {});

  // Build lookup: which items are produced by which tasks/enemies
  const producedBy = {}; // itemId → [taskId/recipeId/enemyId]
  const consumedBy = {}; // itemId → [taskId/recipeId/questId]

  for (const task of allTasks) {
    for (const output of (task.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid) {
        if (!producedBy[oid]) producedBy[oid] = [];
        producedBy[oid].push({ id: task.id, type: 'task' });
      }
    }
    for (const input of (task.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid) {
        if (!consumedBy[iid]) consumedBy[iid] = [];
        consumedBy[iid].push({ id: task.id, type: 'task' });
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

  for (const table of allLootTables) {
    for (const entry of (table.entries || [])) {
      const eid = entry.itemId || entry.id;
      if (eid) {
        if (!producedBy[eid]) producedBy[eid] = [];
        producedBy[eid].push({ id: table.id, type: 'lootTable' });
      }
    }
  }

  for (const quest of allQuests) {
    if (quest.targetId && (quest.targetEvent === 'Gain Item' || quest.targetEvent === 'ON_ITEM_GAINED')) {
      if (!consumedBy[quest.targetId]) consumedBy[quest.targetId] = [];
      consumedBy[quest.targetId].push({ id: quest.id, type: 'quest' });
    }
  }

  // --- PILLAR 1: DATA INTEGRITY (Hard Breaks & Missing References) ---

  // Check for tasks referencing non-existent items
  for (const task of allTasks) {
    for (const input of (task.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && !items[iid]) {
        issues.push({
          entityId: task.id,
          entityName: task.name,
          entityType: 'Task',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Input references item ID "${iid}" which does not exist in the database.`,
        });
      }
    }
    for (const output of (task.outputs || [])) {
      const oid = output.id || output.itemId;
      if (oid && output.type !== 'encounter' && !items[oid]) {
        issues.push({
          entityId: task.id,
          entityName: task.name,
          entityType: 'Task',
          issueType: 'Data Integrity',
          severity: 'Critical',
          details: `Output references item ID "${oid}" which does not exist in the database.`,
        });
      }
    }
  }

  // Check for tasks and enemies without Area assignment
  for (const task of allTasks) {
    if (!task.areaId) {
      issues.push({
        entityId: task.id,
        entityName: task.name,
        entityType: 'Task',
        issueType: 'Data Integrity',
        severity: 'Warning',
        details: `Task is not assigned to any Area card slot.`,
      });
    }
  }



  // Check for multiple producers and missing Primary Source
  for (const item of allItems) {
    const producers = producedBy[item.id] || [];
    const taskOrRecipeProducers = producers.filter(p => p.type === 'task' || p.type === 'recipe');
    
    if (taskOrRecipeProducers.length > 1) {
      let hasPrimary = false;
      for (const p of taskOrRecipeProducers) {
        const source = p.type === 'task' ? tasks[p.id] : recipes[p.id];
        const outEntry = source?.outputs?.find(o => (o.id || o.itemId) === item.id);
        if (outEntry && (outEntry.isPrimarySource || outEntry.isPrimaryOutput)) {
          hasPrimary = true;
          break;
        }
      }
      
      if (!hasPrimary) {
        issues.push({
          entityId: item.id,
          entityName: item.name,
          entityType: 'Item',
          issueType: 'Data Integrity',
          severity: 'Warning',
          details: `Missing Primary Source: Item has multiple producing tasks/recipes, but no designated Primary Source has been selected. Propagation will fallback to the first producer.`,
        });
      }
    }
  }

  // --- PILLAR 2: ECONOMIC BLOCKERS (Orphans & Dead-Ends in Production Chains) ---

  // Orphaned Items: Required as inputs by some task, but have no producing task, recipe, enemy, or lootTable
  for (const task of allTasks) {
    for (const input of (task.inputs || [])) {
      const iid = input.id || input.itemId;
      if (iid && !producedBy[iid]) {
        const item = items[iid];
        issues.push({
          entityId: iid,
          entityName: item?.name || iid,
          entityType: 'Item',
          issueType: 'Economic Blocker',
          severity: 'Critical',
          details: `Orphaned Input: Required by task "${task.name}" but has no producing source (gathering task, recipe, drops).`,
        });
      }
    }
  }

  // Dead-End Items: Produced in the game, but never consumed by any task inputs or quest requirements
  for (const item of allItems) {
    const isProduced = producedBy[item.id];
    const isConsumed = consumedBy[item.id];
    if (isProduced && !isConsumed) {
      const finalTypesAndTags = ['consumable', 'treasure', 'food', 'drink', 'weapon', 'armor', 'tool', 'fuel'];
      const itemTypeLower = (item.type || '').toLowerCase();
      const itemTagsLower = (item.tags || []).map(t => t.toLowerCase());
      
      const hasFinalTypeOrTag = finalTypesAndTags.includes(itemTypeLower) || 
                               itemTagsLower.some(t => finalTypesAndTags.includes(t));
      
      if (!hasFinalTypeOrTag) {
        issues.push({
          entityId: item.id,
          entityName: item.name,
          entityType: 'Item',
          issueType: 'Economic Blocker',
          severity: 'Warning',
          details: `Dead-End Material: Produced by tasks/enemies but never used as crafting inputs or quest goals.`,
        });
      }
    }
  }

  // Unresolvable EV Deficits (Tasks with locked outputs that cannot converge)
  for (const task of allTasks) {
    if (task.auditFlag === 'Unresolvable Deficit') {
      issues.push({
        entityId: task.id,
        entityName: task.name,
        entityType: 'Task',
        issueType: 'Economic Blocker',
        severity: 'Warning',
        details: `Unresolvable EV Deficit: Outputs are locked and target EV cannot be mathematically achieved under current costing.`,
      });
    }
  }

  // --- PILLAR 3: PACING GAPS (Level Progression Spacing & Content Holes) ---

  // Check for progression level gaps > 10 levels in each skill
  for (const skill of SKILLS) {
    const skillTasks = allTasks.filter((t) => t.skill === skill.id || t.skillId === skill.id);
    if (skillTasks.length === 0) continue;

    const levels = skillTasks.map((t) => t.skillRequirement || 1).sort((a, b) => a - b);
    const maxLevel = Math.max(...levels);

    let prev = 1;
    for (const level of levels) {
      if (level - prev > 10) {
        issues.push({
          entityId: skill.id,
          entityName: skill.name,
          entityType: 'Skill',
          issueType: 'Pacing Gap',
          severity: 'Warning',
          details: `Progression Hole: No tasks available in "${skill.name}" between level ${prev} and ${level} (a ${level - prev} level gap).`,
        });
      }
      prev = level;
    }

    if (maxLevel < 90) {
      issues.push({
        entityId: skill.id,
        entityName: skill.name,
        entityType: 'Skill',
        issueType: 'Pacing Gap',
        severity: 'Info',
        details: `End-Game Gap: Highest task requires level ${maxLevel}. No content available for levels ${maxLevel + 1}–99.`,
      });
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
