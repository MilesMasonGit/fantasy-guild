import { useState, useMemo } from 'react';
import {
  Package, Sword, Skull, Map, Scroll, BookOpen, Swords, Hammer, GraduationCap, Sparkles,
  Plus, Search, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';

const ENTITY_TABS = [
  { key: 'items', label: 'Items', icon: Package, color: 'var(--color-item)' },
  { key: 'recipes', label: 'Recipes', icon: BookOpen, color: 'var(--color-item)' },
  { key: 'tasks', label: 'Tasks', icon: Sword, color: 'var(--color-task)' },
  { key: 'workstations', label: 'Workstations', icon: Hammer, color: 'var(--color-accent)' },
  { key: 'enemies', label: 'Enemies', icon: Skull, color: 'var(--color-enemy)' },
  { key: 'areas', label: 'Areas', icon: Map, color: 'var(--color-area)' },
  { key: 'quests', label: 'Quests', icon: Scroll, color: 'var(--color-quest)' },
  { key: 'subskills', label: 'Subskills', icon: GraduationCap, color: 'var(--color-quest)' },
  { key: 'effects', label: 'Effects', icon: Sparkles, color: '#FFD700' },
  { key: 'lootTables', label: 'Loot Tables', icon: Package, color: 'var(--color-item)' },
];

const ADD_ACTIONS = {
  items: 'addItem',
  recipes: 'addRecipe',
  tasks: 'addTask',
  workstations: 'addWorkstation',
  enemies: 'addEnemy',
  areas: 'addArea',
  quests: 'addQuest',
  subskills: 'addSubskill',
  effects: 'addEffect',
  lootTables: 'addLootTable',
};

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState('items');
  const [searchQuery, setSearchQuery] = useState('');

  const entities = useEntityStore((s) => s[activeTab]);
  const store = useEntityStore();
  const addEntity = store[ADD_ACTIONS[activeTab]];
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const areas = useEntityStore((s) => s.areas);

  const entityType = activeTab === 'enemies' ? 'enemy' : activeTab === 'lootTables' ? 'lootTable' : activeTab.slice(0, -1);

  const filteredEntities = useMemo(() => {
    const list = Object.values(entities || {});
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((e) => e.name.toLowerCase().includes(q) || e.id.includes(q));
  }, [entities, searchQuery]);

  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const groupedEntities = useMemo(() => {
    if (!['recipes', 'tasks', 'workstations', 'effects', 'quests'].includes(activeTab)) return null;
    const groups = {};
    filteredEntities.forEach(entity => {
      let groupName = 'Uncategorized';
      if (activeTab === 'recipes') {
        groupName = entity.subskillId || 'Uncategorized';
      } else if (activeTab === 'effects') {
        const types = entity.targetEntityTypes || (entity.targetEntityType ? [entity.targetEntityType] : []);
        groupName = types[0] || 'All';
      } else {
        if (entity.areaId && areas[entity.areaId]) {
          groupName = areas[entity.areaId].name;
        }
      }
      
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(entity);
    });
    
    // Sort within groups
    Object.values(groups).forEach(group => {
      if (activeTab === 'recipes') {
        group.sort((a, b) => (a.levelRequirement || 1) - (b.levelRequirement || 1));
      } else if (activeTab === 'tasks') {
        group.sort((a, b) => (a.skillRequirement || 1) - (b.skillRequirement || 1));
      } else {
        group.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
    return groups;
  }, [filteredEntities, activeTab, areas]);

  const handleAdd = () => {
    if (typeof addEntity !== 'function') {
      console.error('addEntity is not a function for tab:', activeTab);
      return;
    }
    const id = addEntity();
    setActiveEntity(id, entityType);
  };

  const renderEntityButton = (entity) => {
    const isSelected = entity.id === activeEntityId;
    return (
      <button
        key={entity.id}
        onClick={() => setActiveEntity(entity.id, entityType)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors"
        style={{
          background: isSelected ? 'var(--color-bg-hover)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      >
        <span className="text-sm">{entity.icon || '•'}</span>
        <span className="flex-1 text-sm truncate">
          {activeTab === 'recipes' && <span className="mr-1.5 text-xs opacity-70">Lv.{entity.levelRequirement || 1}</span>}
          {activeTab === 'tasks' && <span className="mr-1.5 text-xs opacity-70">Lv.{entity.skillRequirement || 1}</span>}
          {entity.name}
        </span>
        <ChevronRight size={12} style={{ opacity: isSelected ? 1 : 0 }} />
      </button>
    );
  };

  return (
    <aside className="flex flex-col h-full border-r"
      style={{
        width: 280,
        minWidth: 280,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}>
      {/* Tab Bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {ENTITY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
              className="flex-1 flex items-center justify-center py-2.5 transition-colors"
              style={{
                color: isActive ? tab.color : 'var(--color-text-muted)',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                cursor: 'pointer',
              }}
              title={tab.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      {/* Header + Add Button */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}>
          {ENTITY_TABS.find((t) => t.key === activeTab)?.label}
        </span>
        <button onClick={handleAdd} className="btn-ghost flex items-center gap-1" style={{ padding: '4px 8px' }}>
          <Plus size={14} />
          <span className="text-xs">New</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {filteredEntities.length === 0 && (
          <div className="text-center py-8" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            {searchQuery ? 'No results found' : `No ${activeTab} yet. Click + New to create one.`}
          </div>
        )}
        
        {groupedEntities ? (
          Object.entries(groupedEntities).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupItems]) => {
            const isExpanded = expandedGroups[groupName] !== false; // Default to true
            return (
              <div key={groupName} className="mb-2">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors"
                  style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {groupName} ({groupItems.length})
                  </span>
                  {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
                </button>
                
                {isExpanded && (
                  <div className="pl-2 space-y-0.5 mt-0.5">
                    {groupItems.map(entity => renderEntityButton(entity))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          filteredEntities.map((entity) => renderEntityButton(entity))
        )}
      </div>

      {/* Footer: Entity Count */}
      <div className="px-3 py-2 border-t text-xs"
        style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
        {Object.keys(entities || {}).length} {activeTab}
      </div>
    </aside>
  );
}
