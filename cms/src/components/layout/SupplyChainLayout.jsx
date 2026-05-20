import { useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import SupplyChainColumn from './SupplyChainColumn';

/**
 * SupplyChainLayout — Orchestrates the 3-column view.
 * 
 * Left: Origins (Inputs for Tasks, Producers for Items)
 * Center: Active Entity Editor
 * Right: Products (Outputs for Tasks, Consumers for Items)
 */
export default function SupplyChainLayout({ children }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const activeType = useEntityStore((s) => s.activeEntityType);
  
  // Data for sidebars
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const recipes = useEntityStore((s) => s.recipes);
  const enemies = useEntityStore((s) => s.enemies);

  // Update functions
  const updateTask = useEntityStore((s) => s.updateTask);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const updateEnemy = useEntityStore((s) => s.updateEnemy);

  const activeEntity = useMemo(() => {
    if (!activeId) return null;
    let collectionKey = activeType + 's';
    if (activeType === 'enemy') collectionKey = 'enemies';
    const collection = useEntityStore.getState()[collectionKey] || useEntityStore.getState()[activeType];
    return collection?.[activeId];
  }, [activeId, activeType, items, tasks, recipes, enemies]);

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
        onAddLeft: (id) => updateFn(activeId, { inputs: [...(activeEntity.inputs || []), { id, quantity: 1 }] }),
        onUpdateLeft: (i, patch) => updateFn(activeId, { inputs: activeEntity.inputs.map((v, idx) => idx === i ? { ...v, ...patch } : v) }),
        onRemoveLeft: (i) => updateFn(activeId, { inputs: activeEntity.inputs.filter((_, idx) => idx !== i) }),
        onAddRight: (id, type) => {
          if (type === 'encounter') {
            updateFn(activeId, { outputs: [...(activeEntity.outputs || []), { id, type: 'encounter', chance: 100, enemies: [] }] });
          } else {
            updateFn(activeId, { outputs: [...(activeEntity.outputs || []), { id, type: type || 'item', quantity: 1, chance: 100, isPrimaryOutput: false }] });
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
          left: [], // TBD if we want requirement links here
          right: activeEntity.drops || [],
          onAddRight: (id, type) => {
            if (type === 'encounter') {
              updateEnemy(activeId, { drops: [...(activeEntity.drops || []), { id, type: 'encounter', chance: 100, enemies: [] }] });
            } else {
              updateEnemy(activeId, { drops: [...(activeEntity.drops || []), { itemId: id, type: type || 'item', minQty: 1, maxQty: 1, dropChance: 100, isPrimaryOutput: false }] });
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
        // For items, "Adding" a link means editing the OTHER entity
        onAddLeft: (id) => {
          const task = tasks[id];
          if (task) updateTask(id, { outputs: [...(task.outputs || []), { id: activeId, quantity: 1, chance: 1, isPrimaryOutput: false }] });
          const recipe = recipes[id];
          if (recipe) updateRecipe(id, { outputs: [...(recipe.outputs || []), { id: activeId, quantity: 1, chance: 1, isPrimaryOutput: false }] });
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

    return { left: [], right: [], leftTitle: 'Origins', rightTitle: 'Products' };
  }, [activeId, activeType, activeEntity, items, tasks, recipes, enemies]);

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
