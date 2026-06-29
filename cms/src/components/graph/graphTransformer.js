/**
 * Transforms CMS entities into ReactFlow nodes and edges with topological left-to-right layering.
 */
export function transformToGraph(entities, filters = {}) {
  const { items, tasks, enemies, recipes, activeId, activeType } = entities;
  
  const allItems = Object.values(items || {});
  const allTasks = Object.values(tasks || {});
  const allEnemies = Object.values(enemies || {});
  const allRecipes = Object.values(recipes || {});

  const includedItems = new Set();
  const includedTasks = new Set();
  const includedEnemies = new Set();
  const includedRecipes = new Set();

  // Subgraph Isolation Logic
  if (activeId) {
    const visitedUp = new Set();
    const visitedDown = new Set();
    
    function visitUpstream(id, type) {
      const key = `${type}:${id}`;
      if (visitedUp.has(key)) return;
      visitedUp.add(key);

      if (type === 'item') {
        includedItems.add(id);
        // Upstream (Producers only)
        allTasks.forEach(t => {
          if (t.outputs?.some(o => (o.id || o.itemId) === id)) visitUpstream(t.id, 'task');
        });
        allRecipes.forEach(r => {
          if (r.outputs?.some(o => (o.id || o.itemId) === id)) visitUpstream(r.id, 'recipe');
        });
        allEnemies.forEach(e => {
          if (e.drops?.some(o => (o.id || o.itemId) === id)) visitUpstream(e.id, 'enemy');
        });
      } else if (type === 'task') {
        includedTasks.add(id);
        const t = tasks[id];
        if (t) {
          (t.inputs || []).forEach(inp => {
            const iid = inp.id || inp.itemId;
            if (iid) visitUpstream(iid, 'item');
          });
        }
      } else if (type === 'recipe') {
        includedRecipes.add(id);
        const r = recipes[id];
        if (r) {
          (r.inputs || []).forEach(inp => {
            const iid = inp.id || inp.itemId;
            if (iid) visitUpstream(iid, 'item');
          });
        }
      } else if (type === 'enemy') {
        includedEnemies.add(id);
        // Enemies have no upstream inputs in this flow
      }
    }

    function visitDownstream(id, type, depth = 0) {
      if (depth > 1) return;
      const key = `${type}:${id}`;
      if (visitedDown.has(key)) return;
      visitedDown.add(key);

      if (type === 'item') {
        includedItems.add(id);
        // Downstream (Consumers only)
        allTasks.forEach(t => {
          if (t.inputs?.some(i => (i.id || i.itemId) === id)) visitDownstream(t.id, 'task', depth + 1);
        });
        allRecipes.forEach(r => {
          if (r.inputs?.some(i => (i.id || i.itemId) === id)) visitDownstream(r.id, 'recipe', depth + 1);
        });
      } else if (type === 'task') {
        includedTasks.add(id);
        const t = tasks[id];
        if (t) {
          (t.outputs || []).forEach(out => {
            const iid = out.id || out.itemId;
            if (iid) visitDownstream(iid, 'item', depth);
          });
        }
      } else if (type === 'recipe') {
        includedRecipes.add(id);
        const r = recipes[id];
        if (r) {
          (r.outputs || []).forEach(out => {
            const iid = out.id || out.itemId;
            if (iid) visitDownstream(iid, 'item', depth);
          });
        }
      } else if (type === 'enemy') {
        includedEnemies.add(id);
        const e = enemies[id];
        if (e) {
          (e.drops || []).forEach(drop => {
            const iid = drop.itemId;
            if (iid) visitDownstream(iid, 'item', depth);
          });
        }
      }
    }

    visitUpstream(activeId, activeType);
    visitDownstream(activeId, activeType, 0);
  } else {
    // Full overview fallback
    allTasks.forEach(t => includedTasks.add(t.id));
    allRecipes.forEach(r => includedRecipes.add(r.id));
    allEnemies.forEach(e => includedEnemies.add(e.id));
    allItems.forEach(i => includedItems.add(i.id));
  }

  // Setup directed graph structures
  const activeEdges = [];
  const parents = {};
  const children = {};
  
  const allNodeIds = [
    ...Array.from(includedItems),
    ...Array.from(includedTasks),
    ...Array.from(includedRecipes),
    ...Array.from(includedEnemies)
  ];
  
  allNodeIds.forEach(id => {
    parents[id] = [];
    children[id] = [];
  });
  
  function addEdge(source, target, strokeColor, animated = false) {
    activeEdges.push({
      id: `${source}->${target}`,
      source,
      target,
      animated,
      style: { stroke: strokeColor, strokeWidth: 2 }
    });
    if (children[source]) children[source].push(target);
    if (parents[target]) parents[target].push(source);
  }

  // Add Edges for Tasks
  for (const tid of includedTasks) {
    const task = tasks[tid];
    if (!task) continue;
    (task.inputs || []).forEach(inp => {
      const iid = inp.id || inp.itemId;
      if (iid && includedItems.has(iid)) addEdge(iid, tid, '#60a5fa', true);
    });
    (task.outputs || []).forEach(out => {
      const iid = out.id || out.itemId;
      if (iid && includedItems.has(iid)) addEdge(tid, iid, '#34d399');
    });
  }

  // Add Edges for Recipes
  for (const rid of includedRecipes) {
    const recipe = recipes[rid];
    if (!recipe) continue;
    (recipe.inputs || []).forEach(inp => {
      const iid = inp.id || inp.itemId;
      if (iid && includedItems.has(iid)) addEdge(iid, rid, '#60a5fa', true);
    });
    (recipe.outputs || []).forEach(out => {
      const iid = out.id || out.itemId;
      if (iid && includedItems.has(iid)) addEdge(rid, iid, '#34d399');
    });
  }

  // Add Edges for Enemies
  for (const eid of includedEnemies) {
    const enemy = enemies[eid];
    if (!enemy) continue;
    (enemy.drops || []).forEach(drop => {
      const iid = drop.itemId;
      if (iid && includedItems.has(iid)) addEdge(eid, iid, '#f87171');
    });
  }

  // Compute Topological Levels (Layers)
  const levels = {};
  allNodeIds.forEach(id => {
    levels[id] = 0;
  });

  const queue = [];
  const inDegree = {};
  
  allNodeIds.forEach(id => {
    inDegree[id] = parents[id].length;
    if (inDegree[id] === 0) {
      queue.push(id);
      levels[id] = 0;
    }
  });

  // Cycle fallback
  if (queue.length === 0 && allNodeIds.length > 0) {
    const seed = activeId && allNodeIds.includes(activeId) ? activeId : allNodeIds[0];
    queue.push(seed);
    levels[seed] = 0;
  }

  const visits = {};
  allNodeIds.forEach(id => { visits[id] = 0; });

  while (queue.length > 0) {
    const node = queue.shift();
    visits[node]++;
    
    if (visits[node] > allNodeIds.length) continue; // Cycle protection

    const currentLevel = levels[node];
    for (const child of children[node]) {
      if (levels[child] < currentLevel + 1) {
        levels[child] = currentLevel + 1;
        queue.push(child);
      }
    }
  }

  // Group and Position Nodes
  const levelGroups = {};
  allNodeIds.forEach(id => {
    const lvl = levels[id];
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(id);
  });

  const activeNodes = [];
  Object.keys(levelGroups).sort((a, b) => Number(a) - Number(b)).forEach(lvlStr => {
    const lvl = Number(lvlStr);
    const nodeIds = levelGroups[lvl];
    const columnX = lvl * 320;
    
    nodeIds.forEach((id, index) => {
      const rowY = index * 130;
      let nodeData = {};
      let icon = '📦';
      let type = 'item';
      
      if (includedItems.has(id)) {
        const item = items[id] || {};
        type = 'item';
        icon = item.icon || '📦';
        nodeData = { label: item.name || id, icon, entityType: type, trueCost: item.trueCost, sellPrice: item.sellPrice };
      } else if (includedTasks.has(id)) {
        const task = tasks[id] || {};
        type = 'task';
        icon = '⚔️';
        nodeData = { 
          label: task.name || id, 
          icon, 
          entityType: type, 
          baseTickTime: task.baseTickTime, 
          energyCost: task.energyCost, 
          xpAwarded: task.xpAwarded, 
          goldPerMinute: task.goldPerMinute, 
          xpPerMinute: task.xpPerMinute 
        };
      } else if (includedRecipes.has(id)) {
        const recipe = recipes[id] || {};
        type = 'recipe';
        icon = '📜';
        nodeData = { 
          label: recipe.name || id, 
          icon, 
          entityType: type, 
          baseTickTime: recipe.baseTickTime, 
          energyCost: recipe.energyCost, 
          xpAwarded: recipe.xpAwarded, 
          goldPerMinute: recipe.goldPerMinute, 
          xpPerMinute: recipe.xpPerMinute 
        };
      } else if (includedEnemies.has(id)) {
        const enemy = enemies[id] || {};
        type = 'enemy';
        icon = enemy.icon || '💀';
        nodeData = { 
          label: enemy.name || id, 
          icon, 
          entityType: type, 
          tier: enemy.tier, 
          hp: enemy.hp, 
          combatStat: enemy.combatStat 
        };
      }

      activeNodes.push({
        id,
        type: 'entity',
        position: { x: columnX, y: rowY },
        data: nodeData
      });
    });
  });

  return { nodes: activeNodes, edges: activeEdges };
}
