import { useState, useEffect, useRef } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { calculateCombatEV } from '../../engine/mockBattle';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import PlaymatGridEditor from './PlaymatGridEditor';
import { Grid, Image, HelpCircle, Scroll, Plus, ChevronDown, ChevronRight, Trash2, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import SpritePickerModal from './SpritePickerModal';
import EntitySelect from '../shared/EntitySelect';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function AreaEditor({ openGenerate }) {
  const [pickerField, setPickerField] = useState(null);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const area = useEntityStore((s) => s.areas[activeId]);
  const updateArea = useEntityStore((s) => s.updateArea);
  const deleteArea = useEntityStore((s) => s.deleteArea);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);

  const quests = useEntityStore((s) => s.quests || {});
  const tasks = useEntityStore((s) => s.tasks || {});
  const addQuest = useEntityStore((s) => s.addQuest);
  const updateQuest = useEntityStore((s) => s.updateQuest);
  const deleteQuest = useEntityStore((s) => s.deleteQuest);
  const items = useEntityStore((s) => s.items || {});
  const enemies = useEntityStore((s) => s.enemies || {});
  const areas = useEntityStore((s) => s.areas || {});

  const [expandedQuestIndex, setExpandedQuestIndex] = useState(null);
  const globals = useGlobalStore();

  if (!area) return <Empty text="Select an area from the sidebar to edit" />;

  const update = (key, value) => updateArea(activeId, { [key]: value });

  const childAreasList = Object.values(areas).filter(a => a.parentAreaId === area.id);

  // Group and sort quests: sort by mapFragmentTarget first, then by stable createdAt
  const areaQuests = Object.values(quests)
    .filter(q => q.areaId === area.id)
    .sort((a, b) => {
      const targetA = a.mapFragmentTarget || '';
      const targetB = b.mapFragmentTarget || '';
      if (targetA !== targetB) return targetA.localeCompare(targetB);
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

  // Calculate missing quests for each child area
  const missingQuests = [];
  childAreasList.forEach(child => {
    const actual = areaQuests.filter(q => q.mapFragmentTarget === child.id).length;
    const required = child.totalFragments || 0;
    if (actual < required) {
      const missingCount = required - actual;
      for (let i = 0; i < missingCount; i++) {
        missingQuests.push({
          childId: child.id,
          childName: child.name
        });
      }
    }
  });

  const handleCreateQuest = () => {
    addQuest({
      name: 'New Area Quest',
      areaId: area.id,
      targetEvent: 'Gain Item',
      targetId: '',
      maxProgress: 1,
      rewards: []
    });
    setExpandedQuestIndex(areaQuests.length);
  };

  const getObjectiveValue = (targetEvent, targetId, maxProgress) => {
    if (targetEvent === 'Gain Item' || targetEvent === 'ON_ITEM_GAINED') {
      const item = items[targetId];
      return item ? (item.trueCost || 0) * maxProgress : 0;
    } else if (targetEvent === 'Kill Enemy' || targetEvent === 'ON_ENEMY_KILLED') {
      const enemyObj = enemies[targetId];
      if (enemyObj) {
        const combatEV = calculateCombatEV(enemyObj, items, globals);
        return combatEV.reward?.total ? combatEV.reward.total * maxProgress : 0;
      }
    }
    return 0;
  };

  const handleRewardItemUpdate = (q, rewardItemId, qty) => {
    const currentRewards = q.rewards || [];
    const otherRewards = currentRewards.filter(r => r.type !== 'item');
    const updatedRewards = [
      ...otherRewards,
      { type: 'item', id: rewardItemId, itemId: rewardItemId, amount: qty }
    ];
    updateQuest(q.id, { rewards: updatedRewards });
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        name={area.name}
        id={area.id}
        sprite={area.sprite}
        isBackground={true}
        onDelete={() => { deleteArea(activeId); clearActive(); }}
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'area',
          name: area.name,
        }) : null}
      />

      {/* Sprites Section */}
      <Section title="Background Sprites" icon={<Image size={14} />}>
        <div className="space-y-4">
          <SpriteField 
            label="Area Hub Background (Main)" 
            value={area.sprite || ''} 
            onChange={(val) => update('sprite', val)} 
            onChoose={() => setPickerField('sprite')} 
          />
          <SpriteField 
            label="Quest Background" 
            value={area.questBackground || ''} 
            onChange={(val) => update('questBackground', val)} 
            onChoose={() => setPickerField('questBackground')} 
          />
          <SpriteField 
            label="Invasion Background" 
            value={area.invasionBackground || ''} 
            onChange={(val) => update('invasionBackground', val)} 
            onChoose={() => setPickerField('invasionBackground')} 
          />
          <SpriteField 
            label="Playmat Table Background" 
            value={area.backgroundImage || ''} 
            onChange={(val) => update('backgroundImage', val)} 
            onChoose={() => setPickerField('backgroundImage')} 
          />
        </div>
      </Section>

      {/* Diagnostics */}
      <Section title="Diagnostics">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expected Pack Value">
            <div className="px-3 py-1.5 rounded-lg text-sm font-mono bg-black/40 border border-white/5 text-emerald-400 font-bold">
              {area.expectedPackValue != null ? `${Math.round(area.expectedPackValue)} GP` : '—'}
            </div>
          </Field>
          <Field label="Est. Time to Purchase">
            <div className="px-3 py-1.5 rounded-lg text-sm font-mono bg-black/40 border border-white/5 text-amber-400 font-bold">
              {area.estimatedTimeToPurchase != null ? `${Math.round(area.estimatedTimeToPurchase)}s` : '—'}
            </div>
          </Field>
        </div>
      </Section>

      {/* Area Deck Loop Slots (Deck Loop rework, Phase 2 §2H) */}
      <Section title="Area Deck Loop Slots" icon={<Layers size={14} />}>
        <DeckSlotsEditor area={area} update={update} tasks={tasks} />
      </Section>

      {/* Playmat Board Layout (legacy grid system — retired by the Deck Loop rework) */}
      <Section title="Playmat Board Layout (Legacy)" icon={<Grid size={14} />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Tile Template Name">
            <input 
              type="text" 
              value={area.gridConfig?.baseTileTemplate || ''} 
              onChange={(e) => {
                const nextGrid = { ...(area.gridConfig || {}) };
                nextGrid.baseTileTemplate = e.target.value;
                update('gridConfig', nextGrid);
              }}
              placeholder="e.g. guild_hall, forest, mountain"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50" 
            />
          </Field>
          <Field label="Tile Variants Count">
            <input 
              type="number" 
              min="1"
              value={area.gridConfig?.baseTileVariants != null ? area.gridConfig.baseTileVariants : 1} 
              onChange={(e) => {
                const nextGrid = { ...(area.gridConfig || {}) };
                nextGrid.baseTileVariants = Number(e.target.value);
                update('gridConfig', nextGrid);
              }}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" 
            />
          </Field>
        </div>
        <PlaymatGridEditor area={area} onUpdate={update} />
      </Section>

      {/* Configuration */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input type="text" value={area.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          
          <div className="col-span-2">
            <IdSyncField entity={area} entityType="area" onUpdate={update} />
          </div>



          <Field label="Parent Area (Unlock Source)">
            <select
              value={area.parentAreaId || ''}
              onChange={(e) => update('parentAreaId', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
            >
              <option value="">None (Unlocked at Start / Standalone)</option>
              {Object.values(areas)
                .filter(a => a.id !== area.id)
                .map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))
              }
            </select>
          </Field>

          <Field label="Invasion Spawn Pool" className="col-span-2">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-black/40 border border-white/10 min-h-[42px] items-center">
                {(area.invasionSpawnPool || []).length === 0 ? (
                  <span className="text-xs text-gray-500 italic px-2">No enemies in pool (defaults to template primary enemy)</span>
                ) : (
                  (area.invasionSpawnPool || []).map((enemyId) => (
                    <span key={enemyId} className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-2 py-1 font-mono">
                      <span>{enemies[enemyId]?.name || enemyId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextPool = (area.invasionSpawnPool || []).filter(id => id !== enemyId);
                          update('invasionSpawnPool', nextPool);
                        }}
                        className="hover:text-red-400 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <EntitySelect 
                  value="" 
                  onChange={(enemyId) => {
                    if (enemyId && !(area.invasionSpawnPool || []).includes(enemyId)) {
                      const nextPool = [...(area.invasionSpawnPool || []), enemyId];
                      update('invasionSpawnPool', nextPool);
                    }
                  }} 
                  entityTypes={['enemy']}
                  placeholder="Add enemy to pool..."
                />
              </div>
            </div>
          </Field>

          <Field label="Total Fragments">
            <div className="space-y-2">
              <input 
                type="number" 
                value={area.totalFragments} 
                disabled={area.totalFragments === 0}
                onChange={(e) => update('totalFragments', Number(e.target.value))} 
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed" 
              />
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={area.totalFragments === 0} 
                  onChange={(e) => update('totalFragments', e.target.checked ? 0 : 3)}
                  className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer"
                />
                Unlocked at Start (0 Fragments Required)
              </label>
            </div>
          </Field>

          <Field label="Pack Base Cost (GP)">
            <input type="number" value={area.packBaseGoldCost} onChange={(e) => update('packBaseGoldCost', Number(e.target.value))} className="w-full" />
          </Field>

          <Field label="Pack Cost Scaling">
            <input type="number" step="0.01" value={area.packCostScaling} onChange={(e) => update('packCostScaling', Number(e.target.value))} className="w-full" />
          </Field>
        </div>
      </Section>

      {/* Area Quests */}
      <Section title="Area Quests" icon={<Scroll size={14} />}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              Quests linked to this area. Draw as cards from this area's packs.
            </span>
            <button 
              type="button"
              onClick={handleCreateQuest}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
            >
              <Plus size={12} /> New Quest
            </button>
          </div>

          {areaQuests.length === 0 && missingQuests.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-white/10 bg-black/10 text-center text-xs text-gray-500 italic">
              No quests configured for this area.
            </div>
          ) : (
            <div className="space-y-2">
              {areaQuests.map((q, idx) => {
                const isExpanded = expandedQuestIndex === idx;
                
                // Helper variables for calculator
                const targetEvent = q.targetEvent || 'Gain Item';
                const targetId = q.targetId || '';
                const maxProgress = q.maxProgress || 1;
                
                // Rewards parsing
                const rewardItemObj = (q.rewards || []).find(r => r.type === 'item') || {};
                const rewardItemId = rewardItemObj.id || rewardItemObj.itemId || '';
                const rewardItemQty = rewardItemObj.amount || 0;
                
                const premiumMultiplier = q.premiumMultiplier ?? 1.5;
                
                // Calculate objective value
                const objVal = getObjectiveValue(targetEvent, targetId, maxProgress);
                
                // Calculate recommended reward quantity
                const rewardItem = items[rewardItemId];
                const rewardItemPrice = rewardItem ? (rewardItem.trueCost || 0) : 0;
                const recommendedQty = rewardItemPrice > 0 ? Math.ceil((objVal * premiumMultiplier) / rewardItemPrice) : 0;

                return (
                  <div key={idx} className="rounded-xl border border-white/10 bg-[#16161a] overflow-hidden">
                    {/* Header */}
                    <div 
                      onClick={() => setExpandedQuestIndex(isExpanded ? null : idx)}
                      className="flex items-center justify-between px-4 py-3 bg-black/20 hover:bg-black/30 transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                        <span className="font-bold text-sm text-white">{q.name || 'Untitled Quest'}</span>
                        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-tighter px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{q.id}</span>
                        {q.mapFragmentTarget && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded select-none">
                            ↳ Fragment: {areas[q.mapFragmentTarget]?.name || q.mapFragmentTarget}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400">
                          {targetEvent === 'Gain Item' ? 'Deliver' : 'Kill'} {maxProgress}x {items[targetId]?.name || enemies[targetId]?.name || '...'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this quest?')) {
                              deleteQuest(q.id);
                              if (expandedQuestIndex === idx) setExpandedQuestIndex(null);
                            }
                          }}
                          className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-white/5 space-y-4 text-left">
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Quest Name">
                            <input 
                              type="text" 
                              value={q.name || ''} 
                              onChange={(e) => updateQuest(q.id, { name: e.target.value })} 
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
                            />
                          </Field>
                          
                          <IdSyncField entity={q} entityType="quest" onUpdate={(k, v) => updateQuest(q.id, { [k]: v })} />

                          {childAreasList.length > 0 && (
                            <Field label="Map Fragment Target">
                              <select
                                value={q.mapFragmentTarget || ''}
                                onChange={(e) => updateQuest(q.id, { mapFragmentTarget: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
                              >
                                <option value="">None (Generic Fragment)</option>
                                {childAreasList.map(c => (
                                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                                ))}
                              </select>
                            </Field>
                          )}

                          <Field label="Objective Type">
                            <select 
                              value={targetEvent} 
                              onChange={(e) => updateQuest(q.id, { targetEvent: e.target.value, targetId: '' })}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
                            >
                              <option value="Gain Item">Gain Item (Turn In)</option>
                              <option value="Kill Enemy">Kill Enemy (Combat)</option>
                            </select>
                          </Field>

                          <Field label="Objective Target">
                            <EntitySelect 
                              value={targetId} 
                              onChange={(id) => updateQuest(q.id, { targetId: id })} 
                              entityTypes={targetEvent === 'Gain Item' ? ['item'] : ['enemy']}
                              placeholder={`Select target ${targetEvent === 'Gain Item' ? 'item' : 'enemy'}...`}
                            />
                          </Field>

                          <Field label="Required Quantity">
                            <input 
                              type="number" 
                              min={1} 
                              value={maxProgress} 
                              onChange={(e) => updateQuest(q.id, { maxProgress: Number(e.target.value) })}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono"
                            />
                          </Field>

                          <Field label="Description / Story Text" className="col-span-2">
                            <textarea 
                              value={q.description || ''} 
                              onChange={(e) => updateQuest(q.id, { description: e.target.value })}
                              rows={2}
                              placeholder="Write flavor text or mission story here..."
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50"
                            />
                          </Field>
                        </div>

                        {/* Reward Calculator Section */}
                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Quest Reward Calculator</h4>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <Field label="Reward Item">
                              <EntitySelect 
                                value={rewardItemId}
                                onChange={(itemId) => handleRewardItemUpdate(q, itemId, rewardItemQty)}
                                entityTypes={['item']}
                                placeholder="Choose reward item..."
                              />
                            </Field>

                            <Field label="Value Premium (Multiplier)">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  step="0.1" 
                                  min="1.0"
                                  value={premiumMultiplier}
                                  onChange={(e) => updateQuest(q.id, { premiumMultiplier: Number(e.target.value) })}
                                  className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono"
                                />
                                <span className="text-[10px] text-gray-500 italic">Defaults to 1.5x (150% value premium)</span>
                              </div>
                            </Field>
                          </div>

                          {/* Diagnostics & Apply */}
                          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex gap-6 text-xs font-mono">
                              <div>
                                <span className="text-gray-500 uppercase tracking-widest text-[9px] block">Objective Value</span>
                                <span className="text-white font-bold">{objVal.toFixed(2)} GP</span>
                              </div>
                              <div>
                                <span className="text-gray-500 uppercase tracking-widest text-[9px] block">Premium Goal Value</span>
                                <span className="text-emerald-400 font-bold">{(objVal * premiumMultiplier).toFixed(2)} GP</span>
                              </div>
                              <div>
                                <span className="text-gray-500 uppercase tracking-widest text-[9px] block">Recommended Qty</span>
                                <span className="text-amber-400 font-bold">{recommendedQty > 0 ? `${recommendedQty}x` : '—'}</span>
                              </div>
                            </div>
                            
                            {rewardItemId && recommendedQty > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRewardItemUpdate(q, rewardItemId, recommendedQty)}
                                className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
                              >
                                Apply Recommended Qty
                              </button>
                            )}
                          </div>

                          {/* Manual Override Qty */}
                          <div className="flex items-center gap-4">
                            <Field label="Actual Reward Quantity">
                              <input 
                                type="number" 
                                min={1} 
                                value={rewardItemQty || ''} 
                                onChange={(e) => handleRewardItemUpdate(q, rewardItemId, Number(e.target.value))}
                                placeholder="Override quantity..."
                                className="w-40 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono"
                              />
                            </Field>
                            <div className="pt-4 text-xs font-semibold text-gray-500">
                              {rewardItemQty > 0 && rewardItemPrice > 0 ? (
                                <span>
                                  Actual Reward Value: <strong className="text-white">{(rewardItemQty * rewardItemPrice).toFixed(2)} GP</strong> ({Math.round(((rewardItemQty * rewardItemPrice) / (objVal || 1)) * 100)}% Premium)
                                </span>
                              ) : (
                                <span>Select a reward item and input quantity</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {missingQuests.map((m, mIdx) => (
                <div 
                  key={`missing-${m.childId}-${mIdx}`}
                  onClick={() => {
                    addQuest({
                      name: `Unlock ${m.childName} Fragment`,
                      areaId: area.id,
                      targetEvent: 'Gain Item',
                      targetId: '',
                      maxProgress: 1,
                      mapFragmentTarget: m.childId,
                      rewards: []
                    });
                    setExpandedQuestIndex(areaQuests.length);
                  }}
                  className="rounded-xl border border-dashed border-red-500/20 hover:border-red-500/40 bg-red-500/[0.01] hover:bg-red-500/[0.03] transition-all px-4 py-3 flex items-center justify-between cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-2">
                    <Scroll size={14} className="text-red-500/50 group-hover:text-red-500 animate-pulse" />
                    <span className="font-semibold text-xs text-red-400/80 group-hover:text-red-400">Missing Map Fragment Quest</span>
                  </div>
                  <span className="text-[10px] text-red-500/70 group-hover:text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    + Create Quest for {m.childName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {pickerField && (
        <SpritePickerModal
          isOpen={!!pickerField}
          onClose={() => setPickerField(null)}
          onSelect={(spriteKey) => {
            update(pickerField, spriteKey);
            setPickerField(null);
          }}
        />
      )}
    </div>
  );
}

const SLOT_TYPES = [
  { value: 'regular', label: 'Regular (any card)' },
  { value: 'specialized', label: 'Specialized (tag-locked)' },
  { value: 'boost', label: 'Boost (modifies matching cards)' },
  { value: 'locked', label: 'Locked (environmental hazard)' }
];

/**
 * Ordered-list editor for an area's deck loop slots (roadmap Phase 2 §2H).
 * Writes the authored `deckSlots` schema: { slotType, templateId,
 * specializedTags?, hazard? }. Runtime fields (progress/status) never
 * appear here — they're created in-game when the areaState is initialized.
 */
function DeckSlotsEditor({ area, update, tasks }) {
  const slots = Array.isArray(area.deckSlots) ? area.deckSlots : [];

  const writeSlots = (nextSlots) => update('deckSlots', nextSlots);

  const updateSlot = (index, patch) => {
    const next = slots.map((s, i) => (i === index ? { ...s, ...patch } : s));
    writeSlots(next);
  };

  const moveSlot = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= slots.length) return;
    const next = [...slots];
    [next[index], next[target]] = [next[target], next[index]];
    writeSlots(next);
  };

  const removeSlot = (index) => {
    writeSlots(slots.filter((_, i) => i !== index));
  };

  const addSlot = () => {
    writeSlots([...slots, { slotType: 'regular', templateId: null }]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        The hero runs these slots in order (top = slot 1), then loops back to the start.
        Pre-filled cards are the area's default deck on a fresh unlock; empty slots are
        left for the player to fill.
      </p>

      {slots.length === 0 && (
        <div className="p-4 rounded-xl border border-dashed border-white/10 bg-black/10 text-center text-xs text-gray-500 italic">
          No deck slots configured — this area has no loop yet.
        </div>
      )}

      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const slotType = slot.slotType || 'regular';
          const isLocked = slotType === 'locked';
          const showTags = slotType === 'specialized' || slotType === 'boost';
          const hazard = slot.hazard || {};

          return (
            <div key={idx} className="rounded-xl border border-white/10 bg-[#16161a] p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500 w-10 shrink-0">#{idx + 1}</span>

                <select
                  value={slotType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    const patch = { slotType: nextType };
                    if (nextType === 'locked') {
                      patch.templateId = null;
                      patch.hazard = slot.hazard || { type: 'poison', damagePerPass: 5, tickTime: 2000 };
                    }
                    updateSlot(idx, patch);
                  }}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500/50"
                >
                  {SLOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                {!isLocked && (
                  <div className="flex-1 min-w-0">
                    <EntitySelect
                      value={slot.templateId || ''}
                      onChange={(taskId) => updateSlot(idx, { templateId: taskId || null })}
                      entityTypes={['task']}
                      placeholder="Empty slot (player fills it)..."
                    />
                  </div>
                )}
                {isLocked && (
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-red-400/80">
                    Hazard — permanent, not player-removable
                  </span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => moveSlot(idx, -1)} disabled={idx === 0}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-20 rounded hover:bg-white/5">
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" onClick={() => moveSlot(idx, 1)} disabled={idx === slots.length - 1}
                    className="p-1 text-gray-400 hover:text-white disabled:opacity-20 rounded hover:bg-white/5">
                    <ArrowDown size={13} />
                  </button>
                  <button type="button" onClick={() => removeSlot(idx)}
                    className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {slot.templateId && !tasks[slot.templateId] && !isLocked && (
                <p className="text-[10px] text-amber-400/80">
                  ⚠ Card "{slot.templateId}" isn't in the CMS task list — it may be authored directly in the game data.
                </p>
              )}

              {showTags && (
                <Field label="Accepted Tags (comma separated, e.g. nature, fishing)">
                  <input
                    type="text"
                    value={(slot.specializedTags || []).join(', ')}
                    onChange={(e) => updateSlot(idx, {
                      specializedTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 text-xs font-mono"
                  />
                </Field>
              )}

              {isLocked && (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Hazard Type">
                    <input
                      type="text"
                      value={hazard.type || ''}
                      placeholder="poison, fire, bleed, slow..."
                      onChange={(e) => updateSlot(idx, { hazard: { ...hazard, type: e.target.value } })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 text-xs font-mono"
                    />
                  </Field>
                  <Field label="Damage / Pass (HP)">
                    <input
                      type="number"
                      min={0}
                      value={hazard.damagePerPass ?? 0}
                      onChange={(e) => updateSlot(idx, { hazard: { ...hazard, damagePerPass: Number(e.target.value) } })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 text-xs font-mono"
                    />
                  </Field>
                  <Field label="Time Cost (ms)">
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={hazard.tickTime ?? 2000}
                      onChange={(e) => updateSlot(idx, { hazard: { ...hazard, tickTime: Number(e.target.value) } })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 text-xs font-mono"
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addSlot}
        className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold"
        style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <Plus size={12} /> Add Slot
      </button>

      <p className="text-[10px] text-gray-500 italic">
        Unlock quests are not edited here — they're derived automatically from the Area Quests
        section below (any quest whose Map Fragment Target points at an area becomes that
        area's unlock quest on sync).
      </p>
    </div>
  );
}

function SpriteField({ label, value, onChange, onChoose }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <div className="w-16 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
          {(() => {
            const resolvedPath = value ? resolveSpritePath(value) : null;
            if (resolvedPath) {
              const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
              return (
                <img 
                  src={imgSrc} 
                  className="w-full h-full object-cover pixel-art animate-fade-in" 
                  alt="Preview" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const fb = e.target.nextElementSibling;
                    if (fb) fb.style.display = 'block';
                  }} 
                />
              );
            }
            return <HelpCircle size={16} className="text-gray-600" />;
          })()}
        </div>
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder="sprite_id or assets/..." 
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 h-10" 
        />
        <button 
          type="button" 
          onClick={onChoose}
          className="btn-ghost px-3 h-10 border border-white/10 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          style={{ background: 'transparent', borderColor: 'var(--color-border-subtle)' }}
        >
          <Image size={14} /> Choose Sprite
        </button>
      </div>
    </Field>
  );
}

