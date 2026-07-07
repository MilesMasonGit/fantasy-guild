import { useState, useMemo } from 'react';
import {
  Package, Sword, Skull, Map, Scroll, BookOpen, Swords, Hammer, GraduationCap, Sparkles,
  Plus, Search, ChevronRight, ChevronDown, Tag
} from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { calculateTaskEV } from '../../engine/evCalculator';
import { calculateTargetEV, calculateEVVariance, getVelocityTargets } from '../../engine/taskSolver';
import { simulateCombat, calculateCombatEV } from '../../engine/mockBattle';

const ENTITY_TABS = [
  { key: 'items', label: 'Items', icon: Package, color: 'var(--color-item)' },
  { key: 'recipes', label: 'Recipes', icon: BookOpen, color: 'var(--color-item)' },
  { key: 'tasks', label: 'Tasks', icon: Sword, color: 'var(--color-task)' },
  { key: 'workstations', label: 'Workstations', icon: Hammer, color: 'var(--color-accent)' },
  { key: 'enemies', label: 'Enemies', icon: Skull, color: 'var(--color-enemy)' },
  { key: 'areas', label: 'Areas', icon: Map, color: 'var(--color-area)' },
  { key: 'subskills', label: 'Subskills', icon: GraduationCap, color: 'var(--color-quest)' },
  { key: 'tags', label: 'Tags', icon: Tag, color: 'var(--color-item)' },
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
  subskills: 'addSubskill',
  tags: 'addTag',
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
  const subskills = useEntityStore((s) => s.subskills || {});

  const entityType = activeTab === 'enemies' ? 'enemy' : activeTab === 'lootTables' ? 'lootTable' : activeTab === 'tags' ? 'tag' : activeTab.slice(0, -1);

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
        const sub = subskills[entity.subskillId];
        groupName = sub ? sub.name : (entity.subskillId || 'Uncategorized');
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
        group.sort((a, b) => (a.skillRequirement || 1) - (b.skillRequirement || 1));
      } else if (activeTab === 'tasks') {
        group.sort((a, b) => (a.skillRequirement || 1) - (b.skillRequirement || 1));
      } else {
        group.sort((a, b) => a.name.localeCompare(b.name));
      }
    });
    return groups;
  }, [filteredEntities, activeTab, areas, subskills]);

  const handleAdd = () => {
    if (typeof addEntity !== 'function') {
      console.error('addEntity is not a function for tab:', activeTab);
      return;
    }
    const id = addEntity();
    setActiveEntity(id, entityType);
  };

  // Hybrid Real-Time & Sim Balance Status dot resolver
  const getEntityStatus = (entity, type) => {
    if (!['tasks', 'recipes', 'enemies'].includes(type)) return null;

    const isActiveTab = activeTab === type;
    const globals = useGlobalStore.getState();
    const items = useEntityStore.getState().items || {};
    const combinedGlobals = {
      ...globals,
      lootTables: useEntityStore.getState().lootTables || {},
      enemyUpdates: useSimulationStore.getState().enemyUpdates || {},
    };

    if (type === 'tasks') {
      let liveDiag;
      if (isActiveTab) {
        liveDiag = calculateTaskEV(entity, items, combinedGlobals);
      } else {
        const update = useSimulationStore.getState().taskUpdates?.[entity.id];
        if (!update) return null;
        liveDiag = {
          calculatedEV: update.calculatedEV,
          goldPerMinute: update.goldPerMinute,
          xpPerMinute: update.xpPerMinute,
        };
      }

      const level = entity.skillRequirement || 1;
      const targetEV = entity.targetEV || calculateTargetEV(level);
      const variance = calculateEVVariance(level);
      
      const inputs = entity.inputs || [];
      const outputs = entity.outputs || entity.drops || [];
      const inputCount = inputs.length;
      const outputCount = outputs.length;

      let gphMult = 1.0;
      let xphMult = 1.0;

      if (inputCount === 0 && outputCount > 0) {
        gphMult = 1.0; // Gathering: Option B uses standard 1.0x GPH
        xphMult = 0.5; // Gathering: nerfed 0.5x XP
      } else if (inputCount > 0 && outputCount > 0) {
        gphMult = 1.0; // Refining: standard 1.0x GPH
        xphMult = 1.0; // Refining: standard 1.0x XP
      } else if (inputCount > 0 && outputCount === 0) {
        gphMult = 0.0; // Training: zero GP output
        xphMult = 2.0; // Training: boosted 2.0x XP
      }

      const velocityTargets = getVelocityTargets(level, globals);
      const targetGPM = velocityTargets.gpm * gphMult;
      const targetXPM = velocityTargets.xpm * xphMult;
      const liveGPM = liveDiag.goldPerMinute;
      const liveXPM = liveDiag.xpPerMinute;

      const isEVWithinVariance = Math.abs(liveDiag.calculatedEV - targetEV) <= variance;
      let isNetGPMBalanced = true;
      if (entity.isGoldSink || gphMult === 0) {
        isNetGPMBalanced = liveGPM <= 0;
      } else {
        isNetGPMBalanced = liveGPM >= 0 && liveGPM <= targetGPM * 1.15;
      }
      const isXpTooFast = liveXPM > targetXPM * 1.15;

      if (!isEVWithinVariance || isXpTooFast || ((entity.isGoldSink || gphMult === 0) && liveGPM > 0) || (!(entity.isGoldSink || gphMult === 0) && liveGPM > targetGPM * 1.15)) {
        return 'red';
      }
      if (!isNetGPMBalanced) {
        return 'yellow';
      }
      return 'green';
    }

    if (type === 'recipes') {
      let liveDiag;
      if (isActiveTab) {
        liveDiag = calculateTaskEV(entity, items, combinedGlobals);
      } else {
        const update = useSimulationStore.getState().recipeUpdates?.[entity.id];
        if (!update) return null;
        liveDiag = {
          calculatedEV: update.calculatedEV,
          goldPerMinute: update.goldPerMinute,
          xpPerMinute: update.xpPerMinute,
        };
      }

      const level = entity.skillRequirement || 1;
      const targetEV = entity.targetEV || calculateTargetEV(level);
      const variance = calculateEVVariance(level);
      const velocityTargets = getVelocityTargets(level, globals);
      const targetGPM = velocityTargets.gpm;
      const targetXPM = velocityTargets.xpm;
      const liveGPM = liveDiag.goldPerMinute;
      const liveXPM = liveDiag.xpPerMinute;

      const isEVWithinVariance = Math.abs(liveDiag.calculatedEV - targetEV) <= variance;
      let isNetGPMBalanced = true;
      if (entity.isGoldSink) {
        isNetGPMBalanced = liveGPM <= 0;
      } else {
        isNetGPMBalanced = liveGPM >= 0 && liveGPM <= targetGPM * 1.15;
      }
      const isXpTooFast = liveXPM > targetXPM * 1.15;

      if (!isEVWithinVariance || isXpTooFast || (entity.isGoldSink && liveGPM > 0) || (!entity.isGoldSink && liveGPM > targetGPM * 1.15)) {
        return 'red';
      }
      if (!isNetGPMBalanced) {
        return 'yellow';
      }
      return 'green';
    }

    if (type === 'enemies') {
      if (isActiveTab) {
        const liveDiag = calculateCombatEV(entity, items, combinedGlobals);
        const liveSim = liveDiag.combat;
        const targetEV = 1.05;
        const variance = 0.05;
        const isEVWithinVariance = Math.abs(liveDiag.calculatedEV - targetEV) <= variance;

        let isTooEasy = false;
        if (entity.tier > 1) {
          const tMinus1 = entity.tier - 1;
          const lowerTierSim = simulateCombat(entity, globals, tMinus1, 'melee');
          if (lowerTierSim.canHeroSurvive && !lowerTierSim.isFoodKillThreat) {
            isTooEasy = true;
          }
        }

        const isDeadly = liveSim.timeToKill === Infinity || !liveSim.canHeroSurvive;
        const isFoodThreat = liveSim.isFoodKillThreat;

        if (isDeadly || isTooEasy) {
          return 'red';
        }
        if (!isEVWithinVariance || isFoodThreat) {
          return 'yellow';
        }
        return 'green';
      } else {
        const update = useSimulationStore.getState().enemyUpdates?.[entity.id];
        if (!update) return null;
        
        const targetEV = 1.05;
        const variance = 0.05;
        const isEVWithinVariance = Math.abs(update.calculatedEV - targetEV) <= variance;

        let isTooEasy = false;
        if (entity.tier > 1) {
          const tMinus1 = entity.tier - 1;
          const lowerTierSim = simulateCombat(entity, globals, tMinus1, 'melee');
          if (lowerTierSim.canHeroSurvive && !lowerTierSim.isFoodKillThreat) {
            isTooEasy = true;
          }
        }

        const isDeadly = update.timeToKill === Infinity || !update.canHeroSurvive;
        
        const liveSim = simulateCombat(entity, globals, entity.tier, 'melee');
        const isFoodThreat = liveSim.isFoodKillThreat;

        if (isDeadly || isTooEasy) {
          return 'red';
        }
        if (!isEVWithinVariance || isFoodThreat) {
          return 'yellow';
        }
        return 'green';
      }
    }

    return null;
  };

  const renderEntityButton = (entity) => {
    const isSelected = entity.id === activeEntityId;
    const statusColor = getEntityStatus(entity, activeTab);

    return (
      <button
        key={entity.id}
        onClick={() => setActiveEntity(entity.id, entityType)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors hover:bg-white/5"
        style={{
          background: isSelected ? 'var(--color-bg-hover)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        }}
      >
        {statusColor && (
          <div 
            className={`w-2 h-2 rounded-full mr-0.5 shrink-0 ${
              statusColor === 'red' 
                ? 'bg-red-500 shadow-[0_0_6px_#ef4444]' 
                : statusColor === 'yellow' 
                  ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' 
                  : 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
            }`} 
            title={
              statusColor === 'red' 
                ? 'Imbalanced / Critical Error' 
                : statusColor === 'yellow' 
                  ? 'Minor Skew / Warning' 
                  : 'Balanced'
            }
          />
        )}
        {(() => {
          const path = resolveSpritePath(entity);
          const isEnemy = activeTab === 'enemies';
          const isBg = activeTab === 'tasks' || activeTab === 'workstations' || activeTab === 'areas';
          const tabConfig = ENTITY_TABS.find(t => t.key === activeTab);
          const FallbackIcon = tabConfig ? tabConfig.icon : Package;
          
          if (path) {
            const imgSrc = path.startsWith('/') ? path : `/${path}`;
            return (
              <div className={`${isEnemy ? 'w-8 h-8' : 'w-5 h-5'} flex items-center justify-center shrink-0 overflow-hidden relative select-none rounded border border-white/5 bg-black/20`}>
                <img 
                  src={imgSrc}
                  className={`${isEnemy ? 'w-8 h-8 object-contain' : isBg ? 'w-full h-full object-cover' : 'w-5 h-5 object-contain'} pixel-art animate-fade-in`}
                  alt=""
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
                <div style={{ display: 'none' }} className="items-center justify-center w-full h-full text-gray-500">
                  <FallbackIcon size={12} />
                </div>
              </div>
            );
          }
          return (
            <div className={`${isEnemy ? 'w-8 h-8' : 'w-5 h-5'} flex items-center justify-center shrink-0 select-none rounded border border-white/5 bg-black/20 text-gray-500`}>
              <FallbackIcon size={12} />
            </div>
          );
        })()}
        <span className="flex-1 text-sm truncate">
          {activeTab === 'recipes' && <span className="mr-1.5 text-xs opacity-70">Lv.{entity.skillRequirement || 1}</span>}
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
                  type="button"
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
