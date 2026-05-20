import { SKILLS } from '../utils/constants';

/**
 * Audits the entity graph for structural issues.
 * Returns an array of issue objects for the Audit Panel.
 */
export function auditConnectivity(entities) {
  const { items, tasks, enemies, areas, quests, lootTables = {} } = entities;
  const issues = [];

  const allItems = Object.values(items || {});
  const allTasks = Object.values(tasks || {});
  const allEnemies = Object.values(enemies || {});
  const allQuests = Object.values(quests || {});
  const allLootTables = Object.values(lootTables || {});

  // Build lookup: which items are produced by which tasks/enemies
  const producedBy = {}; // itemId → [taskId/enemyId]
  const consumedBy = {}; // itemId → [taskId/questId]

  for (const task of allTasks) {
    for (const output of (task.outputs || [])) {
      if (output.itemId) {
        if (!producedBy[output.itemId]) producedBy[output.itemId] = [];
        producedBy[output.itemId].push({ id: task.id, type: 'task' });
      }
    }
    for (const input of (task.inputs || [])) {
      if (input.itemId) {
        if (!consumedBy[input.itemId]) consumedBy[input.itemId] = [];
        consumedBy[input.itemId].push({ id: task.id, type: 'task' });
      }
    }
  }

  for (const enemy of allEnemies) {
    for (const drop of (enemy.drops || [])) {
      if (drop.itemId) {
        if (!producedBy[drop.itemId]) producedBy[drop.itemId] = [];
        producedBy[drop.itemId].push({ id: enemy.id, type: 'enemy' });
      }
    }
  }

  for (const table of allLootTables) {
    for (const entry of (table.entries || [])) {
      if (entry.itemId) {
        if (!producedBy[entry.itemId]) producedBy[entry.itemId] = [];
        producedBy[entry.itemId].push({ id: table.id, type: 'lootTable' });
      }
    }
  }

  for (const quest of allQuests) {
    if (quest.targetId && quest.targetEvent === 'Gain Item') {
      if (!consumedBy[quest.targetId]) consumedBy[quest.targetId] = [];
      consumedBy[quest.targetId].push({ id: quest.id, type: 'quest' });
    }
  }

  // 1. ORPHANED ITEMS — items referenced as inputs but have no producing source
  for (const task of allTasks) {
    for (const input of (task.inputs || [])) {
      if (input.itemId && !producedBy[input.itemId]) {
        const item = items[input.itemId];
        if (item) {
          issues.push({
            entityId: input.itemId,
            entityName: item?.name || input.itemId,
            entityType: 'Item',
            issueType: 'Orphan',
            severity: 'Critical',
            details: `Required by task "${tasks[task.id]?.name}" but has no producing task or enemy.`,
          });
        }
      }
    }
  }

  // 2. DEAD-END ITEMS — produced but never consumed anywhere
  for (const item of allItems) {
    const isProduced = producedBy[item.id];
    const isConsumed = consumedBy[item.id];
    if (isProduced && !isConsumed) {
      // Not a dead-end if it's a final product type
      const finalTypes = ['Consumable', 'Treasure', 'Food', 'Drink', 'Weapon', 'Armor', 'Tool'];
      if (!finalTypes.includes(item.type)) {
        issues.push({
          entityId: item.id,
          entityName: item.name,
          entityType: 'Item',
          issueType: 'Dead-End',
          severity: 'Warning',
          details: `Produced but never used as an input, quest target, or reward.`,
        });
      }
    }
  }

  // 3. INCOMPLETE CHAINS — tasks with inputs that reference non-existent items
  for (const task of allTasks) {
    for (const input of (task.inputs || [])) {
      if (input.itemId && !items[input.itemId]) {
        issues.push({
          entityId: task.id,
          entityName: task.name,
          entityType: 'Task',
          issueType: 'Incomplete',
          severity: 'Critical',
          details: `References item ID "${input.itemId}" which does not exist.`,
        });
      }
    }
    for (const output of (task.outputs || [])) {
      if (output.itemId && !items[output.itemId]) {
        issues.push({
          entityId: task.id,
          entityName: task.name,
          entityType: 'Task',
          issueType: 'Incomplete',
          severity: 'Warning',
          details: `Output references item ID "${output.itemId}" which does not exist.`,
        });
      }
    }
  }

  // 4. SKILL PROGRESSION GAPS — find level ranges with no tasks
  for (const skill of SKILLS) {
    const skillTasks = allTasks.filter((t) => t.skill === skill.id);
    if (skillTasks.length === 0) continue;

    const levels = skillTasks.map((t) => t.skillRequirement).sort((a, b) => a - b);
    const maxLevel = Math.max(...levels);

    // Check for gaps > 10 levels
    let prev = 1;
    for (const level of levels) {
      if (level - prev > 10) {
        issues.push({
          entityId: skill.id,
          entityName: skill.name,
          entityType: 'Skill',
          issueType: 'Skill Gap',
          severity: 'Warning',
          details: `No tasks between level ${prev} and ${level} (${level - prev} level gap).`,
        });
      }
      prev = level;
    }
    // Check gap to 99
    if (maxLevel < 90) {
      issues.push({
        entityId: skill.id,
        entityName: skill.name,
        entityType: 'Skill',
        issueType: 'Skill Gap',
        severity: 'Info',
        details: `Highest task requires level ${maxLevel}. No content for levels ${maxLevel + 1}–99.`,
      });
    }
  }

  // 5. TASKS WITHOUT AREA — tasks not assigned to any area
  for (const task of allTasks) {
    if (!task.areaId) {
      issues.push({
        entityId: task.id,
        entityName: task.name,
        entityType: 'Task',
        issueType: 'Orphan',
        severity: 'Warning',
        details: `Not assigned to any Area.`,
      });
    }
  }

  // 6. ENEMIES WITHOUT AREA
  for (const enemy of allEnemies) {
    if (!enemy.biomeId) {
      issues.push({
        entityId: enemy.id,
        entityName: enemy.name,
        entityType: 'Enemy',
        issueType: 'Orphan',
        severity: 'Warning',
        details: `Not assigned to any Area.`,
      });
    }
  }

  // Deduplicate by entityId + issueType
  const seen = new Set();
  return issues.filter((issue) => {
    const key = `${issue.entityId}:${issue.issueType}:${issue.details}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
