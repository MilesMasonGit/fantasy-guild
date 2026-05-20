/**
 * Transforms CMS entities into ReactFlow nodes and edges.
 */
export function transformToGraph(entities, filters = {}) {
  const { items, tasks, enemies } = entities;
  const nodes = [];
  const edges = [];

  const allItems = Object.values(items);
  const allTasks = Object.values(tasks);
  const allEnemies = Object.values(enemies);

  // Track which entities to include based on filters
  const includedItems = new Set();
  const includedTasks = new Set();
  const includedEnemies = new Set();

  // Apply area filter
  let filteredTasks = allTasks;
  let filteredEnemies = allEnemies;

  if (filters.areaId) {
    filteredTasks = allTasks.filter((t) => t.areaId === filters.areaId);
    filteredEnemies = allEnemies.filter((e) => e.biomeId === filters.areaId);
  }

  if (filters.skill) {
    filteredTasks = filteredTasks.filter((t) => t.skill === filters.skill);
  }

  if (filters.levelRange) {
    const [min, max] = filters.levelRange;
    filteredTasks = filteredTasks.filter((t) => t.skillRequirement >= min && t.skillRequirement <= max);
  }

  // Add task nodes and collect related items
  let taskY = 0;
  for (const task of filteredTasks) {
    includedTasks.add(task.id);
    for (const inp of (task.inputs || [])) if (inp.itemId) includedItems.add(inp.itemId);
    for (const out of (task.outputs || [])) if (out.itemId) includedItems.add(out.itemId);
    taskY += 1;
  }

  // Add enemy nodes and collect related items
  for (const enemy of filteredEnemies) {
    includedEnemies.add(enemy.id);
    for (const drop of (enemy.drops || [])) if (drop.itemId) includedItems.add(drop.itemId);
  }

  // Supply chain filter: expand from a specific item
  if (filters.supplyChainItemId && items[filters.supplyChainItemId]) {
    includedItems.clear();
    includedTasks.clear();
    includedEnemies.clear();
    expandSupplyChain(filters.supplyChainItemId, items, allTasks, allEnemies, includedItems, includedTasks, includedEnemies);
  }

  // Build nodes — Items on left, Tasks in center, Enemies on right
  let ix = 0;
  for (const itemId of includedItems) {
    const item = items[itemId];
    if (!item) continue;
    nodes.push({
      id: item.id,
      type: 'entity',
      position: { x: 0, y: ix * 100 },
      data: { label: item.name, icon: item.icon, entityType: 'item', trueCost: item.trueCost, sellPrice: item.sellPrice },
    });
    ix++;
  }

  let tx = 0;
  for (const taskId of includedTasks) {
    const task = tasks[taskId];
    if (!task) continue;
    nodes.push({
      id: task.id,
      type: 'entity',
      position: { x: 350, y: tx * 100 },
      data: { label: task.name, icon: '⚔️', entityType: 'task', ev: task.calculatedEV, targetEV: task.targetEV },
    });

    // Edges: inputs → task
    for (const inp of (task.inputs || [])) {
      if (inp.itemId && includedItems.has(inp.itemId)) {
        edges.push({ id: `${inp.itemId}->${task.id}`, source: inp.itemId, target: task.id, animated: true, style: { stroke: '#60a5fa' } });
      }
    }
    // Edges: task → outputs
    for (const out of (task.outputs || [])) {
      if (out.itemId && includedItems.has(out.itemId)) {
        edges.push({ id: `${task.id}->${out.itemId}`, source: task.id, target: out.itemId, style: { stroke: '#34d399' } });
      }
    }
    tx++;
  }

  let ex = 0;
  for (const enemyId of includedEnemies) {
    const enemy = enemies[enemyId];
    if (!enemy) continue;
    nodes.push({
      id: enemy.id,
      type: 'entity',
      position: { x: 700, y: ex * 100 },
      data: { label: enemy.name, icon: '💀', entityType: 'enemy', tier: enemy.tier },
    });
    for (const drop of (enemy.drops || [])) {
      if (drop.itemId && includedItems.has(drop.itemId)) {
        edges.push({ id: `${enemy.id}->${drop.itemId}`, source: enemy.id, target: drop.itemId, style: { stroke: '#f87171' } });
      }
    }
    ex++;
  }

  return { nodes, edges };
}

function expandSupplyChain(itemId, items, tasks, enemies, includedItems, includedTasks, includedEnemies) {
  if (includedItems.has(itemId)) return;
  includedItems.add(itemId);

  // Find tasks that produce this item
  for (const task of tasks) {
    for (const out of (task.outputs || [])) {
      if (out.itemId === itemId) {
        includedTasks.add(task.id);
        for (const inp of (task.inputs || [])) {
          if (inp.itemId) expandSupplyChain(inp.itemId, items, tasks, enemies, includedItems, includedTasks, includedEnemies);
        }
      }
    }
  }

  // Find enemies that drop this item
  for (const enemy of enemies) {
    for (const drop of (enemy.drops || [])) {
      if (drop.itemId === itemId) includedEnemies.add(enemy.id);
    }
  }

  // Find tasks that consume this item
  for (const task of tasks) {
    for (const inp of (task.inputs || [])) {
      if (inp.itemId === itemId) {
        includedTasks.add(task.id);
        for (const out of (task.outputs || [])) {
          if (out.itemId) expandSupplyChain(out.itemId, items, tasks, enemies, includedItems, includedTasks, includedEnemies);
        }
      }
    }
  }
}
