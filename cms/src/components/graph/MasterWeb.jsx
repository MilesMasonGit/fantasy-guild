import { useMemo, useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { transformToGraph } from './graphTransformer';
import { useEntityStore } from '../../stores/useEntityStore';
import GraphFilters from './GraphFilters';

const nodeTypes = { entity: EntityNode };

export default function MasterWeb({ onViewChange }) {
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const enemies = useEntityStore((s) => s.enemies);
  const recipes = useEntityStore((s) => s.recipes);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const activeType = useEntityStore((s) => s.activeEntityType);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const [filters, setFilters] = useState({});

  const { nodes, edges } = useMemo(
    () => transformToGraph({ items, tasks, enemies, recipes, activeId, activeType }, filters),
    [items, tasks, enemies, recipes, activeId, activeType, filters]
  );

  const onNodeClick = useCallback((_event, node) => {
    const type = node.data?.entityType;
    if (type) {
      setActiveEntity(node.id, type);
    }
  }, [setActiveEntity]);

  const activeEntityName = useMemo(() => {
    if (!activeId) return null;
    if (items[activeId]) return items[activeId].name;
    if (tasks[activeId]) return tasks[activeId].name;
    if (recipes[activeId]) return recipes[activeId].name;
    if (enemies[activeId]) return enemies[activeId].name;
    return activeId;
  }, [activeId, items, tasks, recipes, enemies]);

  return (
    <div className="h-full flex flex-col space-y-3">
      <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-xl border border-white/5 gap-4">
        <GraphFilters filters={filters} onFiltersChange={setFilters} />
        {activeId && (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Focusing: <strong className="text-white font-black">{activeEntityName}</strong>
            </span>
            <button 
              onClick={() => setActiveEntity(null, null)}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
            >
              Reset Focus
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          key={activeId || 'all'} // Force flow rebuild on active ID change to trigger fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-border-subtle)" gap={24} size={1} />
          <Controls
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 8 }}
          />
          <MiniMap
            nodeColor={(n) => {
              const type = n.data?.entityType;
              if (type === 'item') return '#60a5fa';
              if (type === 'task') return '#34d399';
              if (type === 'recipe') return '#a855f7';
              if (type === 'enemy') return '#f87171';
              return '#5a5f78';
            }}
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 8 }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
