import { useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { ITEM_TYPES, EQUIP_SLOTS, RESTORE_TYPES, PERSONALITY_TAGS } from '../../utils/constants';
import { Trash2, TrendingUp, Heart, Zap, DollarSign, Ghost, ArrowRight, Factory, ShoppingCart, Settings2, Sword, Shield, Coffee, Tag as TagIcon, Plus, Search, X, Sparkles, HelpCircle, Image } from 'lucide-react';
import { useState } from 'react';
import { slugify } from '../../utils/idGenerator';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function ItemEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const item = useEntityStore((s) => s.items[activeId]);
  const updateItem = useEntityStore((s) => s.updateItem);
  const deleteItem = useEntityStore((s) => s.deleteItem);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const itemUpdates = useSimulationStore((s) => s.itemUpdates);
  const tasks = useEntityStore((s) => s.tasks);
  const recipes = useEntityStore((s) => s.recipes);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const effectsObj = useEntityStore((s) => s.effects);
  const effectsList = Object.values(effectsObj || {});
  const tagsDb = useEntityStore((s) => s.tags || {});
  const [tagSearch, setTagSearch] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const filteredEffects = useMemo(() => {
    if (!item) return [];
    return effectsList.filter(eff => {
      const types = eff.targetEntityTypes || (eff.targetEntityType ? [eff.targetEntityType] : []);
      return types.length === 0 || types.includes('All') || types.includes(item.type);
    });
  }, [effectsList, item]);



  if (!item) return <Empty text="Select an item from the sidebar to edit" />;

  const update = (key, value) => updateItem(activeId, { [key]: value });
  const updateProfile = (patch) => update('valueProfile', { ...(item.valueProfile || { hp: 0, energy: 0, sellValue: 1 }), ...patch });

  const tags = item.tags || [];
  const tagsLower = tags.map(t => t.toLowerCase());
  const typeLower = (item.type || '').toLowerCase();
  
  // Custom Tag-based Gating logic
  const isFood = tagsLower.includes('food');
  const isDrink = tagsLower.includes('drink');
  const isWeapon = tagsLower.includes('weapon');
  const isArmor = tagsLower.includes('armor');
  const isTool = tagsLower.includes('tool');
  const isEquip = isWeapon || isArmor || isTool;
  
  const isConsumable = isFood || isDrink || tagsLower.includes('consumable') || typeLower === 'special' || item.equipSlot === 'food' || item.equipSlot === 'drink' || item.equipSlot === 'special';
  const canHaveEffects = isEquip || isFood || tagsLower.includes('consumable');

  // Helper to get preview path (resolving direct vs manifest)
  const getSpritePreviewPath = () => {
    if (!item.sprite) return null;
    if (item.sprite.startsWith('assets/')) return `/${item.sprite}`;
    // Guess path based on manifest / prefixes if not direct path
    // We'll rely on the picker loading it properly, but here we can try resolving relative to common folders
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        name={item.name}
        id={item.id}
        sprite={item.sprite}
        onDelete={() => { deleteItem(activeId); clearActive(); }}
        onSuggest={() => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'item',
          name: item.name,
        })}
      />

      {/* Identity & Meta */}
      <Section title="Identity & Meta" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2"><input type="text" value={item.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          
          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-10 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = item.sprite ? resolveSpritePath(item.sprite) : null;
                  if (resolvedPath) {
                    const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                    return (
                      <>
                        <img 
                          src={imgSrc} 
                          className="w-8 h-8 object-contain pixel-art" 
                          alt="Sprite" 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fb = e.target.nextElementSibling;
                            if (fb) fb.style.display = 'block';
                          }} 
                        />
                        <HelpCircle size={16} className="text-gray-600" style={{ display: 'none' }} />
                      </>
                    );
                  }
                  return <HelpCircle size={16} className="text-gray-600" />;
                })()}
              </div>
              <input 
                type="text" 
                value={item.sprite || ''} 
                onChange={(e) => update('sprite', e.target.value)} 
                placeholder="sprite_id or assets/..." 
                className="flex-1 min-w-0" 
              />
              <button 
                type="button" 
                onClick={() => setIsPickerOpen(true)}
                className="btn-ghost px-3 h-10 border border-white/10 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                <Image size={14} /> Choose Sprite
              </button>
            </div>
          </Field>
          
          <IdSyncField entity={item} entityType="item" onUpdate={update} />

          <Field label="Entity Tags" className="col-span-2">
            <div className="space-y-3">
              {/* Search & Add */}
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Search or Create Tags (e.g. Food, Quest, Poison)..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagSearch.trim()) {
                      const typed = tagSearch.trim();
                      const slug = slugify(typed, 'tag');
                      // Find if it exists in DB, otherwise create it
                      let matchedTagId = Object.keys(tagsDb).find(k => k.toLowerCase() === slug.toLowerCase() || tagsDb[k].name.toLowerCase() === typed.toLowerCase());
                      if (!matchedTagId) {
                        matchedTagId = useEntityStore.getState().addTag({ name: typed, icon: '🏷️' });
                      }
                      if (!(item.tags || []).includes(matchedTagId)) {
                        update('tags', [...(item.tags || []), matchedTagId]);
                      }
                      setTagSearch('');
                    }
                  }}
                  className="w-full pl-10 pr-4 h-10 bg-black/40 border-white/5 rounded-xl focus:border-emerald-500/50 outline-none font-medium placeholder:text-gray-600"
                />
              </div>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl bg-white/[0.02] border border-white/5">
                {(item.tags || []).length === 0 && <span className="text-[10px] text-gray-600 p-1 italic">No tags assigned. Tag with "Food" or "Drink" to enable restoration value logic.</span>}
                {(item.tags || []).map(t => {
                  const tagDetail = tagsDb[t];
                  return (
                    <button
                      key={t}
                      onClick={() => update('tags', (item.tags || []).filter(x => x !== t))}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all cursor-pointer"
                    >
                      {tagDetail ? `${tagDetail.icon} ${tagDetail.name}` : t} <X size={10} />
                    </button>
                  );
                })}
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Approved Suggestions</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(tagsDb)
                    .filter(t => !(item.tags || []).includes(t.id))
                    .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()) || t.id.toLowerCase().includes(tagSearch.toLowerCase()))
                    .slice(0, 12)
                    .map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          update('tags', [...(item.tags || []), t.id]);
                          setTagSearch('');
                        }}
                        className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-gray-500 hover:text-gray-300 hover:border-white/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t.icon}</span>
                        <span>+ {t.name}</span>
                      </button>
                    ))}
                  {tagSearch && !Object.values(tagsDb).some(t => t.name.toLowerCase() === tagSearch.toLowerCase() || t.id === tagSearch) && (
                    <button
                      onClick={() => {
                        const newTagId = useEntityStore.getState().addTag({ name: tagSearch, icon: '🏷️' });
                        update('tags', [...(item.tags || []), newTagId]);
                        setTagSearch('');
                      }}
                      className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold cursor-pointer"
                    >
                      Create tag "{tagSearch}"
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Field>
        </div>
      </Section>

      {/* Value Profile (Unified Item Value) */}
      <Section title="Economic Value Profile" icon={<TrendingUp size={14} />}>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4 col-span-2 sm:col-span-1">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 mb-2">
              <input 
                type="checkbox" 
                id="isRoot"
                checked={!!item.isRoot} 
                onChange={(e) => updateItem(activeId, { isRoot: e.target.checked })}
                className="mt-0.5 rounded border-white/10 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
              />
              <div className="flex flex-col">
                <label htmlFor="isRoot" className="text-xs font-bold text-white select-none cursor-pointer">
                  Root Item (Manual Price)
                </label>
              </div>
            </div>

            <Field label="Item Value (GP)">
              <div className="flex flex-col gap-1.5">
                <input 
                  type="number" 
                  step="0.01" 
                  value={item.trueCost || 0} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateItem(activeId, { trueCost: val, sellPrice: val });
                  }} 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" 
                />
                <span className="text-[9px] text-gray-500 italic">
                  {item.isRoot 
                    ? "This item's price is manually locked and will not be overwritten by gathering task values."
                    : "If this item is crafted/gathered, this value is automatically calculated based on materials and labor effort."
                  }
                </span>
              </div>
            </Field>

            <Field label="Value Scale (Multiplier)">
              <div className="flex flex-col gap-1.5">
                <input 
                  type="number" 
                  step="0.1" 
                  min="0.1"
                  max="10.0"
                  value={item.valueScale ?? 1.0} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    updateItem(activeId, { valueScale: val });
                  }} 
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 font-mono" 
                />
                <span className="text-[9px] text-gray-500 italic">
                  Multiplies the raw commodity base value. For gathering tasks, a value of 2.0 makes this commodity worth twice as much as same-level items, and task times solve proportionally slower to keep GPH balanced.
                </span>
              </div>
            </Field>
          </div>

          <div className="space-y-4 col-span-2 sm:col-span-1">
            <Field label="Calculated Profile (Diagnostics)">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/5 bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-500">RESTORES ({item.restoreType || 'None'})</span>
                  <span className="font-mono text-sm text-emerald-400">+{item.restoreAmount || 0} (20% Auto)</span>
                </div>
                {itemUpdates[item.id] && Math.abs(itemUpdates[item.id].trueCost - item.trueCost) > 0.01 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/15 border border-emerald-500/20 text-emerald-400 text-xs gap-2">
                    <Ghost size={12} className="flex-shrink-0 animate-pulse" />
                    <span>
                      <strong>Proposed Value:</strong> {itemUpdates[item.id].trueCost.toFixed(2)} GP (calculated downstream)
                    </span>
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>
      </Section>



      {/* Equipment & Tool Specifics */}
      {(isEquip || isTool) && (
        <Section title="Equipment & Durability" icon={<Sword size={14} />}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Item Tier (Quality)">
              <input
                type="number" min="0" max="10"
                value={item.tier || 0}
                onChange={(e) => update('tier', Number(e.target.value))}
                className="w-full"
                placeholder="Tier 0-10"
              />
            </Field>
            <Field label="Max Durability (Uses)">
              <input
                type="number" min="0"
                value={item.durability || 0}
                onChange={(e) => update('durability', Number(e.target.value))}
                className="w-full"
                placeholder="0 = Indestructible"
              />
            </Field>
          </div>
        </Section>
      )}

      {/* Gating & Requirements Section */}
      {!isConsumable && (() => {
        const requirements = Array.isArray(item.requirements) 
          ? item.requirements 
          : (item.skillRequired && item.skillRequired !== 'none' ? [{ skill: item.skillRequired, level: item.levelRequired || item.levelRequirement || 1 }] : []);

        return (
          <Section title="Item Gating & Requirements" icon={<Shield size={14} />}>
            <div className="space-y-4">
              {/* Active Requirements List */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                  Active Gating Requirements
                </span>
                {requirements.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-white/10 bg-black/10 text-center text-xs text-gray-500 italic">
                    No gating active. This item can be equipped by any hero.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {requirements.map((req) => {
                      const proposedReq = itemUpdates[item.id]?.requirements?.find(r => r.skill === req.skill);
                      return (
                        <div
                          key={req.skill}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group hover:border-white/10 transition-all"
                        >
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                              {req.skill} Requirement
                            </span>
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-sm text-amber-400 font-black">
                                Level {req.level || 1}
                              </span>
                              {proposedReq && proposedReq.level !== req.level && (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                                  <Ghost size={8} /> Level {proposedReq.level} (Proposed)
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const newReqs = requirements.filter(r => r.skill !== req.skill);
                              update('requirements', newReqs.length > 0 ? newReqs.map(r => ({ skill: r.skill })) : []);
                              // Also sync back to legacy fields for backward compatibility
                              if (newReqs.length > 0) {
                                update('skillRequired', newReqs[0].skill);
                              } else {
                                update('skillRequired', 'none');
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 opacity-50 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer border-0"
                            title="Remove Gating"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add New Requirement */}
              {requirements.length < 5 && (
                <div className="pt-2 border-t border-white/5 flex gap-4 items-end">
                  <Field label="Add Skill Gating Requirement" className="flex-1">
                    <select
                      value=""
                      onChange={(e) => {
                        const selected = e.target.value;
                        if (selected && !requirements.some(r => r.skill === selected)) {
                          const newReqs = [...requirements.map(r => ({ skill: r.skill })), { skill: selected }];
                          update('requirements', newReqs);
                          update('skillRequired', newReqs[0].skill);
                        }
                      }}
                      className="w-full select-input bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm font-medium"
                      style={{
                        backgroundColor: 'var(--color-bg-base)',
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-border-subtle)',
                      }}
                    >
                      <option value="" disabled>-- Select a Skill to Add --</option>
                      {[
                        { id: 'combat', name: 'Combat' },
                        { id: 'nature', name: 'Nature' },
                        { id: 'industry', name: 'Industry' },
                        { id: 'culinary', name: 'Culinary' },
                        { id: 'occult', name: 'Occult' },
                        { id: 'crime', name: 'Crime' },
                        { id: 'social', name: 'Social' },
                        { id: 'nautical', name: 'Nautical' },
                        { id: 'science', name: 'Science' },
                      ]
                        .filter(s => !requirements.some(r => r.skill === s.id))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </Field>
                  <div className="h-9 flex items-center">
                    <span className="text-[10px] text-gray-500 italic">
                      Levels will be derived from trueCost when you run the simulation.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Section>
        );
      })()}

      {/* Combat / Stat Modifiers */}
      {canHaveEffects && (
        <Section title="Combat / Stat Modifiers">
          <div className="flex gap-4">
            <Field label="Assigned Effect" className="flex-1">
              <select
                value={typeof item.assignedEffect === 'string' ? item.assignedEffect : item.assignedEffect?.effectId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  update('assignedEffect', val ? { effectId: val, scale: item.assignedEffect?.scale || 1 } : null);
                }}
                className="w-full"
              >
                <option value="">None</option>
                {filteredEffects.map((eff) => (
                  <option key={eff.id} value={eff.id}>{eff.name} ({eff.type})</option>
                ))}
              </select>
            </Field>
            <Field label="Scale" className="w-24">
              <input
                type="number" min="1" max="5"
                value={item.assignedEffect?.scale || 1}
                onChange={(e) => update('assignedEffect', { ...item.assignedEffect, scale: Number(e.target.value) })}
                className="w-full"
              />
            </Field>
          </div>
        </Section>
      )}

      {isPickerOpen && (
        <SpritePickerModal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(spriteKey) => update('sprite', spriteKey)}
        />
      )}
    </div>
  );
}


