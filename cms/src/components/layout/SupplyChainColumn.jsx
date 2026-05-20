import React, { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { ArrowRight, Plus, Trash2, Ghost, Package, Sword, Scroll, Activity, Lock, Unlock } from 'lucide-react';
import EntitySelect from '../shared/EntitySelect';

/**
 * SupplyChainColumn — The "Origin" (Left) or "Product" (Right) column for the editor.
 * Handles display and editing of linked entities.
 */
export default function SupplyChainColumn({ title, side, type, entities, onAdd, onUpdate, onRemove }) {
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const recipes = useEntityStore((s) => s.recipes);
  const itemUpdates = useSimulationStore((s) => s.itemUpdates) || {};
  const taskUpdates = useSimulationStore((s) => s.taskUpdates) || {};
  const recipeUpdates = useSimulationStore((s) => s.recipeUpdates) || {};
  const activeId = useEntityStore((s) => s.activeEntityId);
  const activeType = useEntityStore((s) => s.activeEntityType);

  const getEntityData = (id) => {
    if (items[id]) return { ...items[id], type: 'item', updates: itemUpdates[id] };
    if (tasks[id]) return { ...tasks[id], type: 'task', updates: taskUpdates[id] };
    if (recipes[id]) return { ...recipes[id], type: 'recipe', updates: recipeUpdates[id] };
    if (useEntityStore.getState().enemies[id]) return { ...useEntityStore.getState().enemies[id], type: 'enemy', updates: useSimulationStore.getState().enemyUpdates?.[id] };
    if (useEntityStore.getState().lootTables[id]) return { ...useEntityStore.getState().lootTables[id], type: 'lootTable', icon: '🎲' };
    if (useEntityStore.getState().encounterTables[id]) return { ...useEntityStore.getState().encounterTables[id], type: 'encounterTable', icon: '⚔️' };
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#16161a] border-x border-white/5 w-80 shrink-0 overflow-hidden">
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          {side === 'left' ? <Activity size={12} className="rotate-180" /> : <Activity size={12} />}
          {title}
        </h3>
      </div>

      <div className="p-2 bg-black/20 border-b border-white/5 space-y-2">
         <div className="flex gap-2">
           <div className="flex-1">
             <EntitySelect 
               entityTypes={side === 'right' ? ['item', 'lootTable'] : ['item']}
               onChange={(id, type) => {
                 if (id) onAdd(id, type);
               }} 
               placeholder="Search or create..."
             />
           </div>
           {side === 'right' && (activeType === 'task' || activeType === 'recipe' || activeType === 'enemy') && (
             <button 
               onClick={() => {
                 const encIndex = entities.findIndex(e => e.type === 'encounter');
                 if (encIndex !== -1) {
                   onRemove(encIndex);
                 } else {
                   onAdd(Date.now().toString(), 'encounter');
                 }
               }}
               className={`flex items-center justify-center shrink-0 w-8 h-8 rounded border transition-colors ${
                 entities.some(e => e.type === 'encounter') 
                   ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-300' 
                   : 'bg-white/5 text-gray-400 border-white/10 hover:bg-emerald-500/20 hover:text-emerald-400'
               }`}
               title={entities.some(e => e.type === 'encounter') ? "Remove Encounter Pool" : "Add Encounter Pool"}
             >
               <Sword size={14} />
             </button>
           )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {entities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10">
            <div className="text-4xl mb-2">⛓️</div>
            <p className="text-[10px] uppercase font-bold tracking-tight">No links configured</p>
          </div>
        ) : entities.map((e, i) => {
          if (e.type === 'encounter') {
            const totalWeight = (e.enemies || []).reduce((sum, en) => sum + (en.weight || 100), 0);
            return (
              <div key={`enc-${i}`} className="group relative rounded-xl border border-rose-500/30 bg-rose-500/[0.02] p-3 space-y-3 overflow-visible">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl shrink-0">
                      ⚔️
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-400 uppercase tracking-widest">Encounter Pool</div>
                      <div className="text-[10px] text-gray-500 leading-none">Triggers combat phase</div>
                    </div>
                  </div>
                  <button onClick={() => onRemove(i)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-black/40 p-2 rounded border border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Trigger Chance</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" min="0" max="100" 
                      value={e.chance ?? 100} 
                      onChange={(ev) => onUpdate(i, { chance: Number(ev.target.value) })} 
                      className="w-14 text-xs font-bold bg-white/5 border border-white/10 h-6 px-1.5 rounded text-right outline-none focus:border-rose-500/50 transition-colors" 
                    />
                    <span className="text-xs font-bold text-gray-500">%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-1">Enemy Drops</div>
                  <div className="space-y-1">
                    {(e.enemies || []).map((en, enIdx) => {
                      const enemyData = useEntityStore.getState().enemies[en.enemyId];
                      const realChance = totalWeight > 0 ? ((en.weight || 100) / totalWeight) * (e.chance ?? 100) : 0;
                      return (
                        <div key={enIdx} className="flex items-center gap-2 bg-black/20 p-1.5 rounded border border-white/5">
                          <span className="text-sm shrink-0">{enemyData?.icon || '💀'}</span>
                          <span className="text-xs font-bold text-white truncate flex-1">{enemyData?.name || 'Unknown'}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <input 
                              type="number" 
                              value={en.weight || 100} 
                              onChange={(ev) => {
                                const newEnemies = [...(e.enemies || [])];
                                newEnemies[enIdx].weight = Number(ev.target.value);
                                onUpdate(i, { enemies: newEnemies });
                              }} 
                              className="w-12 text-xs font-bold text-right bg-white/5 border border-white/10 rounded h-5 px-1 outline-none focus:border-rose-500/50" 
                              title="Weight" 
                            />
                            <span className="text-[9px] text-gray-500 w-8 text-right font-mono">{realChance.toFixed(1)}%</span>
                            <button 
                              onClick={() => {
                                const newEnemies = [...(e.enemies || [])].filter((_, idx) => idx !== enIdx);
                                onUpdate(i, { enemies: newEnemies });
                              }} 
                              className="p-0.5 text-gray-600 hover:text-red-400 ml-1 transition-colors"
                            >
                              <Trash2 size={10}/>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-1">
                    <EntitySelect 
                      entityTypes={['enemy']} 
                      placeholder="Add enemy to pool..." 
                      onChange={(enemyId) => {
                        const newEnemies = [...(e.enemies || []), { enemyId, weight: 100 }];
                        onUpdate(i, { enemies: newEnemies });
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }

          const id = e.id || e.itemId;
          const data = getEntityData(id);
          const updates = data?.updates || {};

          return (
            <div key={`${id}-${i}`} className="group relative rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all p-3 space-y-3 overflow-hidden">
              {/* Header: Identity & Jump */}
              <div className="flex items-center justify-between gap-2 relative">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center border border-white/5 shrink-0 text-2xl">
                    {data?.icon || (data?.type === 'task' ? '⚔️' : data?.type === 'recipe' ? '📜' : data?.type === 'enemy' ? '💀' : '📦')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white truncate group-hover:text-emerald-400 transition-colors leading-tight">
                      {data?.name || 'Unknown Entity'}
                    </div>
                    <div className="text-[10px] font-mono text-gray-600 truncate uppercase tracking-tighter">
                      {id}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveEntity(id, data?.type || 'item')}
                  className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-emerald-400 hover:bg-white/10 transition-all shrink-0"
                  title="Jump to Entity"
                >
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Controls: Qty / Chance / Locks */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                        <span>Quantity (Min-Max)</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="1" 
                          value={e.minQty ?? e.quantity ?? 1} 
                          onChange={(ev) => onUpdate(i, { minQty: Number(ev.target.value) })}
                          className="w-full text-xs font-bold bg-black/40 border-white/5 h-8 px-2 rounded-lg focus:border-emerald-500/50 outline-none"
                        />
                        <span className="text-gray-600">-</span>
                        <input 
                          type="number" 
                          min="1" 
                          value={e.maxQty ?? e.quantity ?? 1} 
                          onChange={(ev) => onUpdate(i, { maxQty: Number(ev.target.value) })}
                          className="w-full text-xs font-bold bg-black/40 border-white/5 h-8 px-2 rounded-lg focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                   </div>
                   {(side === 'right' || e.dropChance !== undefined || e.chance !== undefined) && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between">
                          <span>Chance %</span>
                          {side === 'right' && (
                            <button 
                              onClick={() => onUpdate(i, { isLocked: !e.isLocked })}
                              className={`p-0.5 rounded ${e.isLocked ? 'text-amber-400 bg-amber-400/10' : 'text-gray-600 hover:text-gray-400'}`}
                              title={e.isLocked ? "Drop Chance Locked" : "Solver can adjust Drop Chance"}
                            >
                              {e.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>
                          )}
                        </label>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" max="100"
                          value={e.dropChance ?? e.chance ?? 100} 
                          onChange={(ev) => onUpdate(i, { dropChance: Number(ev.target.value) })}
                          className="w-full text-xs font-bold bg-black/40 border-white/5 h-8 px-2 rounded-lg focus:border-emerald-500/50 outline-none"
                          disabled={e.isLocked}
                          style={{ opacity: e.isLocked ? 0.7 : 1 }}
                        />
                      </div>
                   )}
                </div>
              </div>

              {/* Metrics Readout */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-white/5">
                {data?.type === 'item' ? (
                  <>
                    <Metric label="TRUE COST" value={updates.trueCost ?? data?.trueCost} suffix="GP" />
                    <Metric label="SELL PRICE" value={updates.sellPrice ?? data?.sellPrice} suffix="GP" color="text-emerald-400" />
                  </>
                ) : (
                  <>
                    <Metric label="EV" value={updates.calculatedEV ?? data?.calculatedEV} color="text-emerald-400" />
                    <Metric label="GPH" value={updates.goldPerMinute ?? data?.goldPerMinute} suffix="/m" />
                    <Metric label="XPH" value={updates.xpPerMinute ?? data?.xpPerMinute} suffix="/m" color="text-amber-400" />
                    <Metric label="TIME" value={data?.baseTickTime ? (data.baseTickTime / 1000).toFixed(1) : '—'} suffix="s" />
                  </>
                )}
              </div>

              {/* Delete Button (Bottom Right) */}
              <button 
                onClick={() => onRemove(i)}
                className="absolute bottom-2 right-2 p-1.5 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                title="Remove Connection"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>


    </div>
  );
}

function Metric({ label, value, suffix = '', color = 'text-gray-400' }) {
  // Round to integers for readability as requested
  const formatted = typeof value === 'number' ? Math.round(value) : (value || '—');
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{label}</span>
      <span className={`text-xs font-mono font-black truncate ${color}`}>
        {formatted}{formatted !== '—' && suffix}
      </span>
    </div>
  );
}
