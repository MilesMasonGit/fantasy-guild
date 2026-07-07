import { useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import SupplyChainColumn from './SupplyChainColumn';

/**
 * SupplyChainLayout — Orchestrates the 3-column view.
 * 
 * Left: Origins (Inputs for Tasks, Producers for Items, Area Contents, Quest Requirements, Workstation Area, Encounter Location)
 * Center: Active Entity Editor
 * Right: Products (Outputs for Tasks, Consumers for Items, Downstream Areas, Quest Rewards, Craftable Recipes, Loot Table Entries, Enemy Deck, Encounter Pools)
 */
export default function SupplyChainLayout({ children }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const activeType = useEntityStore((s) => s.activeEntityType);
  
  // Data for sidebars
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const recipes = useEntityStore((s) => s.recipes);
  const enemies = useEntityStore((s) => s.enemies);
  const quests = useEntityStore((s) => s.quests);
  const areas = useEntityStore((s) => s.areas);
  const workstations = useEntityStore((s) => s.workstations);
  const encounters = useEntityStore((s) => s.encounters);
  const encounterTables = useEntityStore((s) => s.encounterTables);
  const lootTables = useEntityStore((s) => s.lootTables);

  // Update functions
  const updateTask = useEntityStore((s) => s.updateTask);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const updateEnemy = useEntityStore((s) => s.updateEnemy);
  const updateQuest = useEntityStore((s) => s.updateQuest);
  const updateArea = useEntityStore((s) => s.updateArea);
  const updateWorkstation = useEntityStore((s) => s.updateWorkstation);
  const updateEncounter = useEntityStore((s) => s.updateEncounter);
  const updateEncounterTable = useEntityStore((s) => s.updateEncounterTable);
  const updateLootTable = useEntityStore((s) => s.updateLootTable);

  const activeEntity = useMemo(() => {
    if (!activeId) return null;
    let collectionKey = activeType + 's';
    if (activeType === 'enemy') collectionKey = 'enemies';
    const collection = useEntityStore.getState()[collectionKey] || useEntityStore.getState()[activeType];
    return collection?.[activeId];
  }, [activeId, activeType, items, tasks, recipes, enemies, quests, areas, workstations, encounters, encounterTables, lootTables]);

  // Sidebar Logic
  const sidebarData = useMemo(() => {
    if (!activeId || !activeEntity) return { left: [], right: [], leftTitle: '', rightTitle: '' };

    // --- CASE: TASK / RECIPE ---
    if (activeType === 'task' || activeType === 'recipe') {
      const isTask = activeType === 'task';
      const updateFn = isTask ? updateTask : updateRecipe;

      return {
        leftTitle: 'Inputs (Costs)',
        rightTitle: 'Outputs (Rewards)',
        left: activeEntity.inputs || [],
        right: activeEntity.outputs || [],
        onAddLeft: (id, type) => {
          if (type === 'tag') {
            updateFn(activeId, { inputs: [...(activeEntity.inputs || []), { tag: id, quantity: 1 }] });
          } else {
            updateFn(activeId, { inputs: [...(activeEntity.inputs || []), { id, quantity: 1 }] });
          }
        },
        onUpdateLeft: (i, patch) => updateFn(activeId, { inputs: activeEntity.inputs.map((v, idx) => idx === i ? { ...v, ...patch } : v) }),
        onRemoveLeft: (i) => updateFn(activeId, { inputs: activeEntity.inputs.filter((_, idx) => idx !== i) }),
        onAddRight: (id, type) => {
          if (type === 'encounter') {
            updateFn(activeId, { outputs: [...(activeEntity.outputs || []), { id, type: 'encounter', chance: 100, enemies: [] }] });
          } else {
            updateFn(activeId, { outputs: [...(activeEntity.outputs || []), { id, type: type || 'item', quantity: 1, chance: 100, isPrimarySource: false }] });
          }
        },
        onUpdateRight: (i, patch) => updateFn(activeId, { outputs: activeEntity.outputs.map((v, idx) => idx === i ? { ...v, ...patch } : v) }),
        onRemoveRight: (i) => updateFn(activeId, { outputs: activeEntity.outputs.filter((_, idx) => idx !== i) }),
      };
    }

    // --- CASE: ENEMY ---
    if (activeType === 'enemy') {
       return {
          leftTitle: 'Conditions',
          rightTitle: 'Drops (Loot)',
          left: [],
          right: activeEntity.drops || [],
          onAddRight: (id, type) => {
            if (type === 'encounter') {
              updateEnemy(activeId, { drops: [...(activeEntity.drops || []), { id, type: 'encounter', chance: 100, enemies: [] }] });
            } else {
              updateEnemy(activeId, { drops: [...(activeEntity.drops || []), { itemId: id, type: type || 'item', minQty: 1, maxQty: 1, dropChance: 100, isPrimarySource: false }] });
            }
          },
          onUpdateRight: (i, patch) => updateEnemy(activeId, { drops: activeEntity.drops.map((v, idx) => idx === i ? { ...v, ...patch } : v) }),
          onRemoveRight: (i) => updateEnemy(activeId, { drops: activeEntity.drops.filter((_, idx) => idx !== i) }),
       };
    }

    // --- CASE: ITEM ---
    if (activeType === 'item') {
      // Find Producers
      const producers = [];
      Object.values(tasks).forEach(t => {
        if (t.outputs?.some(o => (o.id || o.itemId) === activeId)) producers.push({ id: t.id, type: 'task' });
      });
      Object.values(recipes).forEach(r => {
        if (r.outputs?.some(o => (o.id || o.itemId) === activeId)) producers.push({ id: r.id, type: 'recipe' });
      });
      Object.values(enemies).forEach(e => {
        if (e.drops?.some(o => (o.id || o.itemId) === activeId)) producers.push({ id: e.id, type: 'enemy' });
      });

      // Find Consumers
      const consumers = [];
      Object.values(tasks).forEach(t => {
        if (t.inputs?.some(i => (i.id || i.itemId) === activeId)) consumers.push({ id: t.id, type: 'task' });
      });
      Object.values(recipes).forEach(r => {
        if (r.inputs?.some(i => (i.id || i.itemId) === activeId)) consumers.push({ id: r.id, type: 'recipe' });
      });

      return {
        leftTitle: 'Produced By',
        rightTitle: 'Consumed By',
        left: producers,
        right: consumers,
        onAddLeft: (id) => {
          const task = tasks[id];
          if (task) updateTask(id, { outputs: [...(task.outputs || []), { id: activeId, quantity: 1, chance: 1, isPrimarySource: false }] });
          const recipe = recipes[id];
          if (recipe) updateRecipe(id, { outputs: [...(recipe.outputs || []), { id: activeId, quantity: 1, chance: 1, isPrimarySource: false }] });
        },
        onUpdateLeft: (i, patch) => {
          const producer = producers[i];
          if (producer.type === 'task') {
            const task = tasks[producer.id];
            const nextOutputs = task.outputs.map(o => (o.id || o.itemId) === activeId ? { ...o, ...patch } : o);
            updateTask(producer.id, { outputs: nextOutputs });
          }
          if (producer.type === 'recipe') {
            const recipe = recipes[producer.id];
            const nextOutputs = recipe.outputs.map(o => (o.id || o.itemId) === activeId ? { ...o, ...patch } : o);
            updateRecipe(producer.id, { outputs: nextOutputs });
          }
        },
        onRemoveLeft: (i) => {
           const producer = producers[i];
           if (producer.type === 'task') updateTask(producer.id, { outputs: tasks[producer.id].outputs.filter(o => (o.id || o.itemId) !== activeId) });
           if (producer.type === 'recipe') updateRecipe(producer.id, { outputs: recipes[producer.id].outputs.filter(o => (o.id || o.itemId) !== activeId) });
        },
        onAddRight: (id) => {
          const task = tasks[id];
          if (task) updateTask(id, { inputs: [...(task.inputs || []), { id: activeId, quantity: 1 }] });
          const recipe = recipes[id];
          if (recipe) updateRecipe(id, { inputs: [...(recipe.inputs || []), { id: activeId, quantity: 1 }] });
        },
        onRemoveRight: (i) => {
          const consumer = consumers[i];
          if (consumer.type === 'task') updateTask(consumer.id, { inputs: tasks[consumer.id].inputs.filter(o => (o.id || o.itemId) !== activeId) });
          if (consumer.type === 'recipe') updateRecipe(consumer.id, { inputs: recipes[consumer.id].inputs.filter(o => (o.id || o.itemId) !== activeId) });
        }
      };
    }

    // --- CASE: AREA ---
    if (activeType === 'area') {
      const parentArea = activeEntity.parentAreaId ? [{ id: activeEntity.parentAreaId, type: 'area' }] : [];
      const childAreasList = Object.values(areas).filter(a => a.parentAreaId === activeId);
      const childAreas = childAreasList.map(a => ({ id: a.id, type: 'area', quantity: a.totalFragments }));

      return {
        leftTitle: 'Unlock Source (Parent)',
        rightTitle: 'Downstream Unlocks (Children)',
        left: parentArea,
        right: childAreas,
        onAddLeft: () => {},
        onRemoveLeft: () => updateArea(activeId, { parentAreaId: '' }),
        onAddRight: (id) => {
          if (id !== activeId) {
            updateArea(id, { parentAreaId: activeId });
          }
        },
        onUpdateRight: (i, patch) => {
          const child = childAreasList[i];
          if (child && patch.quantity !== undefined) {
            updateArea(child.id, { totalFragments: patch.quantity });
          }
        },
        onRemoveRight: (i) => {
          const child = childAreasList[i];
          if (child) {
            updateArea(child.id, { parentAreaId: '' });
          }
        }
      };
    }

    // --- CASE: QUEST ---
    if (activeType === 'quest') {
      const requirements = activeEntity.targetId 
        ? [{ id: activeEntity.targetId, type: activeEntity.targetEvent === 'Kill Enemy' ? 'enemy' : 'item', quantity: activeEntity.maxProgress }]
        : [];
      
      const rewards = (activeEntity.rewards || []).map(r => {
        if (r.type === 'gold') {
          return { type: 'gold', quantity: r.amount };
        } else {
          return { id: r.itemId, type: 'item', quantity: r.amount };
        }
      });

      return {
        leftTitle: 'Requirements',
        rightTitle: 'Rewards',
        left: requirements,
        right: rewards,
        onAddLeft: (id, type) => {
          updateQuest(activeId, { targetId: id, targetEvent: type === 'enemy' ? 'Kill Enemy' : 'Gain Item' });
        },
        onUpdateLeft: (i, patch) => {
          if (patch.quantity !== undefined) {
            updateQuest(activeId, { maxProgress: patch.quantity });
          }
        },
        onRemoveLeft: () => {
          updateQuest(activeId, { targetId: '', targetEvent: 'Gain Item' });
        },
        onAddRight: (id, type) => {
          if (type === 'gold') {
            updateQuest(activeId, { rewards: [...(activeEntity.rewards || []), { type: 'gold', amount: 100 }] });
          } else {
            updateQuest(activeId, { rewards: [...(activeEntity.rewards || []), { type: 'item', itemId: id, amount: 1 }] });
          }
        },
        onUpdateRight: (i, patch) => {
          const updatedRewards = activeEntity.rewards.map((r, idx) => {
            if (idx === i) {
              return {
                ...r,
                itemId: patch.id || r.itemId,
                amount: patch.quantity !== undefined ? patch.quantity : (patch.amount !== undefined ? patch.amount : r.amount)
              };
            }
            return r;
          });
          updateQuest(activeId, { rewards: updatedRewards });
        },
        onRemoveRight: (i) => {
          updateQuest(activeId, { rewards: activeEntity.rewards.filter((_, idx) => idx !== i) });
        }
      };
    }

    // --- CASE: WORKSTATION ---
    if (activeType === 'workstation') {
      const areaLink = activeEntity.areaId ? [{ id: activeEntity.areaId, type: 'area' }] : [];
      const craftableRecipes = Object.values(recipes)
        .filter(r => r.subskillId === activeEntity.subskillId && (!activeEntity.skillCap || r.levelRequirement <= activeEntity.skillCap))
        .map(r => ({ id: r.id, type: 'recipe' }));

      return {
        leftTitle: 'Area Location',
        rightTitle: 'Craftable Recipes',
        left: areaLink,
        right: craftableRecipes,
        onAddLeft: (id) => updateWorkstation(activeId, { areaId: id }),
        onRemoveLeft: () => updateWorkstation(activeId, { areaId: '' }),
        onAddRight: () => {}, // Determined by recipe subskill
        onRemoveRight: () => {}
      };
    }

    // --- CASE: LOOT TABLE ---
    if (activeType === 'lootTable') {
      const usedIn = [];
      Object.values(tasks).forEach(t => {
        if (t.outputs?.some(o => o.id === activeId)) usedIn.push({ id: t.id, type: 'task' });
      });
      Object.values(recipes).forEach(r => {
        if (r.outputs?.some(o => o.id === activeId)) usedIn.push({ id: r.id, type: 'recipe' });
      });
      Object.values(enemies).forEach(e => {
        if (e.drops?.some(d => d.itemId === activeId || d.id === activeId)) usedIn.push({ id: e.id, type: 'enemy' });
      });

      const entries = (activeEntity.entries || []).map(entry => ({
        id: entry.itemId,
        type: 'item',
        quantity: entry.dropWeight || 1
      }));

      return {
        leftTitle: 'Dropped By',
        rightTitle: 'Pool Entries (Weights)',
        left: usedIn,
        right: entries,
        onAddLeft: () => {},
        onRemoveLeft: () => {},
        onAddRight: (id) => {
          const entries = [...(activeEntity.entries || [])];
          if (!entries.some(e => e.itemId === id)) {
            updateLootTable(activeId, { entries: [...entries, { itemId: id, dropWeight: 1 }] });
          }
        },
        onUpdateRight: (i, patch) => {
          const nextEntries = activeEntity.entries.map((e, idx) => {
            if (idx === i) {
              return {
                ...e,
                itemId: patch.id || e.itemId,
                dropWeight: patch.quantity !== undefined ? patch.quantity : (patch.dropWeight !== undefined ? patch.dropWeight : e.dropWeight)
              };
            }
            return e;
          });
          updateLootTable(activeId, { entries: nextEntries });
        },
        onRemoveRight: (i) => {
          updateLootTable(activeId, { entries: activeEntity.entries.filter((_, idx) => idx !== i) });
        }
      };
    }

    // --- CASE: ENCOUNTER ---
    if (activeType === 'encounter') {
      const areaLink = activeEntity.areaId ? [{ id: activeEntity.areaId, type: 'area' }] : [];
      const enemiesList = (activeEntity.assignedEnemies || []).map(e => ({
        id: e.enemyId,
        type: 'enemy',
        quantity: e.spawnChance || 0
      }));

      return {
        leftTitle: 'Area Location',
        rightTitle: 'Enemy Deck Weights',
        left: areaLink,
        right: enemiesList,
        onAddLeft: (id) => updateEncounter(activeId, { areaId: id }),
        onRemoveLeft: () => updateEncounter(activeId, { areaId: '' }),
        onAddRight: (id) => {
          const assigned = [...(activeEntity.assignedEnemies || [])];
          if (!assigned.some(e => e.enemyId === id)) {
            updateEncounter(activeId, { assignedEnemies: [...assigned, { enemyId: id, spawnChance: 1 }] });
          }
        },
        onUpdateRight: (i, patch) => {
          const nextAssigned = activeEntity.assignedEnemies.map((e, idx) => {
            if (idx === i) {
              return {
                ...e,
                enemyId: patch.id || e.enemyId,
                spawnChance: patch.quantity !== undefined ? patch.quantity : e.spawnChance
              };
            }
            return e;
          });
          updateEncounter(activeId, { assignedEnemies: nextAssigned });
        },
        onRemoveRight: (i) => {
          updateEncounter(activeId, { assignedEnemies: activeEntity.assignedEnemies.filter((_, idx) => idx !== i) });
        }
      };
    }

    // --- CASE: ENCOUNTER TABLE ---
    if (activeType === 'encounterTable') {
      const entries = (activeEntity.entries || []).map(entry => ({
        id: entry.encounterId,
        type: 'encounter',
        quantity: entry.dropWeight || 1
      }));

      return {
        leftTitle: 'Usage Locations',
        rightTitle: 'Encounter Deck Pools',
        left: [],
        right: entries,
        onAddLeft: () => {},
        onRemoveLeft: () => {},
        onAddRight: (id) => {
          const entries = [...(activeEntity.entries || [])];
          if (!entries.some(e => e.encounterId === id)) {
            updateEncounterTable(activeId, { entries: [...entries, { encounterId: id, dropWeight: 1 }] });
          }
        },
        onUpdateRight: (i, patch) => {
          const nextEntries = activeEntity.entries.map((e, idx) => {
            if (idx === i) {
              return {
                ...e,
                encounterId: patch.id || e.encounterId,
                dropWeight: patch.quantity !== undefined ? patch.quantity : e.dropWeight
              };
            }
            return e;
          });
          updateEncounterTable(activeId, { entries: nextEntries });
        },
        onRemoveRight: (i) => {
          updateEncounterTable(activeId, { entries: activeEntity.entries.filter((_, idx) => idx !== i) });
        }
      };
    }

    return { left: [], right: [], leftTitle: 'Origins', rightTitle: 'Products' };
  }, [activeId, activeType, activeEntity, items, tasks, recipes, enemies, quests, areas, workstations, encounters, encounterTables, lootTables]);

  if (!activeId) return <div className="h-full w-full">{children}</div>;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Origins (Left) */}
      <SupplyChainColumn 
        side="left"
        title={sidebarData.leftTitle}
        entities={sidebarData.left}
        onAdd={sidebarData.onAddLeft}
        onUpdate={sidebarData.onUpdateLeft}
        onRemove={sidebarData.onRemoveLeft}
      />

      {/* Main Editor (Center) */}
      <div className="flex-1 overflow-y-auto px-10 py-6 bg-[#0f0f12] custom-scrollbar">
        {children}
      </div>

      {/* Products (Right) */}
      <SupplyChainColumn 
        side="right"
        title={sidebarData.rightTitle}
        entities={sidebarData.right}
        onAdd={sidebarData.onAddRight}
        onUpdate={sidebarData.onUpdateRight}
        onRemove={sidebarData.onRemoveRight}
      />
    </div>
  );
}
