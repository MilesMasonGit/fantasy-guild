import { useEntityStore } from '../../stores/useEntityStore';
import EntitySelect from '../shared/EntitySelect';
import { Trash2, Plus } from 'lucide-react';

export default function QuestEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const quest = useEntityStore((s) => s.quests[activeId]);
  const updateQuest = useEntityStore((s) => s.updateQuest);
  const deleteQuest = useEntityStore((s) => s.deleteQuest);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);

  if (!quest) return <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-text-muted)' }}><p className="text-sm">Select a quest to edit</p></div>;

  const update = (key, value) => updateQuest(activeId, { [key]: value });

  const addReward = () => update('rewards', [...quest.rewards, { type: 'gold', amount: 100 }]);
  const removeReward = (i) => update('rewards', quest.rewards.filter((_, idx) => idx !== i));
  const updateReward = (i, patch) => update('rewards', quest.rewards.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <div><h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{quest.name}</h2><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{quest.id}</span></div>
        </div>
        <button onClick={() => { deleteQuest(activeId); clearActive(); }} className="btn-ghost flex items-center gap-1" style={{ color: 'var(--color-error)' }}><Trash2 size={14} /> Delete</button>
      </div>

      <S title="Configuration">
        <div className="grid grid-cols-2 gap-3">
          <F label="Name"><input type="text" value={quest.name} onChange={(e) => update('name', e.target.value)} className="w-full" /></F>
          <F label="Target Event">
            <select value={quest.targetEvent} onChange={(e) => update('targetEvent', e.target.value)} className="w-full">
              <option value="Gain Item">Gain Item</option>
              <option value="Kill Enemy">Kill Enemy</option>
            </select>
          </F>
          <F label="Target"><EntitySelect value={quest.targetId} onChange={(id) => update('targetId', id)} placeholder="Select target..." /></F>
          <F label="Required Quantity"><input type="number" min={1} value={quest.maxProgress} onChange={(e) => update('maxProgress', Number(e.target.value))} className="w-full" /></F>
          <F label="Unlocks Area (Fragment Target)">
            <select value={quest.mapFragmentTarget} onChange={(e) => update('mapFragmentTarget', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </F>
        </div>
        <F label="Description"><textarea value={quest.description} onChange={(e) => update('description', e.target.value)} className="w-full" rows={2} /></F>
      </S>

      <S title="Rewards">
        {quest.rewards.map((reward, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <select value={reward.type} onChange={(e) => updateReward(i, { type: e.target.value })} className="w-24">
              <option value="gold">Gold</option>
              <option value="item">Item</option>
            </select>
            {reward.type === 'item' && <div className="flex-1"><EntitySelect value={reward.itemId || ''} onChange={(id) => updateReward(i, { itemId: id })} /></div>}
            <input type="number" value={reward.amount} onChange={(e) => updateReward(i, { amount: Number(e.target.value) })} className="w-20" placeholder="Amount" />
            <button onClick={() => removeReward(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addReward} className="btn-ghost flex items-center gap-1 text-xs"><Plus size={12} /> Add Reward</button>
      </S>
    </div>
  );
}

function S({ title, children }) { return <section className="rounded-lg p-4 border space-y-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}><h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>{children}</section>; }
function F({ label, children }) { return <div><label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>{children}</div>; }
