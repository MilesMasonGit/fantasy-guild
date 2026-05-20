import { useMemo } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { ITEM_TYPES, EQUIP_SLOTS, RESTORE_TYPES, PERSONALITY_TAGS } from '../../utils/constants';
import { Trash2, TrendingUp, Heart, Zap, DollarSign, Ghost, ArrowRight, Factory, ShoppingCart, Settings2, Sword, Shield, Coffee, Tag as TagIcon, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';

export default function ItemEditor() {
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
  const [tagSearch, setTagSearch] = useState('');

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
  const isFood = item.type === 'Food' || item.type === 'Drink' || tags.includes('Food') || tags.includes('Drink') || tags.includes('Consumable');
  const isEquip = ['Weapon', 'Armor', 'Tool'].includes(item.type) || tags.includes('Equipment') || tags.includes('Weapon') || tags.includes('Armor') || tags.includes('Tool');
  const isTool = item.type === 'Tool' || tags.includes('Tool');
  const canHaveEffects = isEquip || isFood || tags.includes('Consumable');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header icon={item.icon} name={item.name} id={item.id} onDelete={() => { deleteItem(activeId); clearActive(); }} />

      {/* Identity & Meta */}
      <Section title="Identity & Meta" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name"><input type="text" value={item.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></Field>
          <Field label="Icon Emoji"><input type="text" value={item.icon} onChange={(e) => update('icon', e.target.value)} className="w-full" /></Field>
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
                      const newTag = tagSearch.trim();
                      if (!(item.tags || []).includes(newTag)) {
                        update('tags', [...(item.tags || []), newTag]);
                      }
                      setTagSearch('');
                    }
                  }}
                  className="w-full pl-10 pr-4 h-10 bg-black/40 border-white/5 rounded-xl focus:border-emerald-500/50 outline-none font-medium placeholder:text-gray-600"
                />
              </div>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl bg-white/[0.02] border border-white/5">
                {(item.tags || []).length === 0 && <span className="text-[10px] text-gray-600 p-1 italic">No tags assigned. Restoration logic requires "Food" or "Drink" tags.</span>}
                {(item.tags || []).map(t => (
                  <button
                    key={t}
                    onClick={() => update('tags', (item.tags || []).filter(x => x !== t))}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                  >
                    {t} <X size={10} />
                  </button>
                ))}
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Approved Suggestions</span>
                <div className="flex flex-wrap gap-1.5">
                  {PERSONALITY_TAGS
                    .filter(t => !(item.tags || []).includes(t))
                    .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                    .slice(0, 12)
                    .map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          update('tags', [...(item.tags || []), t]);
                          setTagSearch('');
                        }}
                        className="px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-gray-500 hover:text-gray-300 hover:border-white/20 transition-all"
                      >
                        + {t}
                      </button>
                    ))}
                  {tagSearch && !PERSONALITY_TAGS.includes(tagSearch) && !(item.tags || []).includes(tagSearch) && (
                    <button
                      onClick={() => {
                        update('tags', [...(item.tags || []), tagSearch]);
                        setTagSearch('');
                      }}
                      className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold"
                    >
                      Create "{tagSearch}"
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Field>
        </div>
      </Section>

      {/* Value Profile (The Cascading Split) */}
      <Section title="Economic Value Profile" icon={<TrendingUp size={14} />}>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Field label="Market Markup (Profit)">
              <div className="flex flex-col gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-emerald-400">
                    <span className="flex items-center gap-1"><DollarSign size={10} /> Markup Multiplier</span>
                    <span>x{item.valueProfile?.sellValue ?? 1}</span>
                  </div>
                  <input
                    type="range" min="1" max="5" step="0.1"
                    value={item.valueProfile?.sellValue ?? 1}
                    onChange={(e) => updateProfile({ sellValue: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <p className="text-[9px] text-gray-500 italic">
                  Higher markups increase sell price but lower GPH/XPH efficiency for heroes.
                </p>
              </div>
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Calculated Stats (Locked)">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] font-bold text-gray-500">TRUE COST</span>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-sm text-white">{item.trueCost?.toFixed(2)} GP</span>
                    {itemUpdates[item.id] && Math.abs(itemUpdates[item.id].trueCost - item.trueCost) > 0.01 && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                        <Ghost size={10} /> {itemUpdates[item.id].trueCost.toFixed(2)} (Proposal)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] font-bold text-gray-500">SELL PRICE</span>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-sm text-emerald-400">{item.sellPrice} GP</span>
                    {itemUpdates[item.id] && Math.abs(itemUpdates[item.id].sellPrice - item.sellPrice) > 0.01 && (
                      <span className="text-[10px] text-emerald-400/70 flex items-center gap-1 font-bold">
                        <Ghost size={10} /> {itemUpdates[item.id].sellPrice} (Proposal)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5 bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] font-bold text-emerald-500">RESTORES ({item.restoreType || 'None'})</span>
                  <span className="font-mono text-sm text-emerald-400">+{item.restoreAmount || 0} (20% Auto)</span>
                </div>
              </div>
            </Field>
            <Field label="Base GP Value (True Cost)">
              <div className="flex flex-col gap-1">
                <input type="number" step="0.01" value={item.trueCost || 0} onChange={(e) => update('trueCost', Number(e.target.value))} className="w-full" />
                <span className="text-[9px] text-gray-500 italic">If this item is crafted in a Recipe, this value will be overwritten by the Solver based on material costs.</span>
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
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <section className="rounded-xl p-5 border bg-[#1a1a1e] border-white/10 space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-gray-500">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Header({ icon, name, id, onDelete }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-3xl border border-white/10">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-white">{name}</h2>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter">{id}</span>
        </div>
      </div>
      <button onClick={onDelete} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-xs font-bold">
        <Trash2 size={14} /> DELETE ITEM
      </button>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-2xl opacity-50">📦</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
