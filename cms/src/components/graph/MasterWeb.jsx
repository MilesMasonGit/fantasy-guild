import { useMemo, useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EntityNode from './EntityNode';
import { transformToGraph } from './graphTransformer';
import { useEntityStore } from '../../stores/useEntityStore';
import GraphFilters from './GraphFilters';

const nodeTypes = { entity: EntityNode };

export default function MasterWeb() {
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const enemies = useEntityStore((s) => s.enemies);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const [filters, setFilters] = useState({});

  const { nodes, edges } = useMemo(
    () => transformToGraph({ items, tasks, enemies }, filters),
    [items, tasks, enemies, filters]
  );

  const onNodeClick = useCallback((_event, node) => {
    const type = node.data?.entityType;
    if (type) setActiveEntity(node.id, type);
  }, [setActiveEntity]);

  return (
    <div className="h-full flex flex-col">
      <GraphFilters filters={filters} onFiltersChange={setFilters} />
      <div className="flex-1 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
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
