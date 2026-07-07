import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';

export default function EncounterEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const encounter = useEntityStore((s) => s.encounters[activeId]);
  const updateEncounter = useEntityStore((s) => s.updateEncounter);
  const deleteEncounter = useEntityStore((s) => s.deleteEncounter);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);

  if (!encounter) return <Empty text="Select an encounter from the sidebar to edit" />;

  const update = (key, value) => updateEncounter(activeId, { [key]: value });

  const assignedEnemies = encounter.assignedEnemies || [];
  const totalSpawnChance = assignedEnemies.reduce((sum, e) => sum + (e.spawnChance || 0), 0);
  const isValidDeck = Math.abs(totalSpawnChance - 1) < 0.001;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header 
        icon="⚔️" 
        name={encounter.name} 
        id={encounter.id} 
        onDelete={() => { deleteEncounter(activeId); clearActive(); }}
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'encounter',
          name: encounter.name,
        }) : null}
      />

      {/* Diagnostics */}
      <Section title="Diagnostics (Calculated)">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Calculated EV">
            <div className="px-3 py-1.5 rounded-lg text-sm font-mono bg-black/40 border border-white/5 text-emerald-400 font-bold">
              {encounter.calculatedEV != null ? encounter.calculatedEV.toFixed(2) : '—'}
            </div>
          </Field>
          <Field label="GP/min">
            <div className="px-3 py-1.5 rounded-lg text-sm font-mono bg-black/40 border border-white/5 text-amber-400 font-bold">
              {encounter.goldPerMinute != null ? encounter.goldPerMinute.toFixed(1) : '—'}
            </div>
          </Field>
          <Field label="XP/min">
            <div className="px-3 py-1.5 rounded-lg text-sm font-mono bg-black/40 border border-white/5 text-blue-400 font-bold">
              {encounter.xpPerMinute != null ? encounter.xpPerMinute.toFixed(1) : '—'}
            </div>
          </Field>
        </div>
      </Section>

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input type="text" value={encounter.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="Area">
            <select value={encounter.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* Deck Diagnostics summary */}
      <Section title="Deck Status">
        <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
          <span className="text-xs font-semibold text-gray-400">Total Deck Spawn Chance</span>
          <span className={`text-sm font-black font-mono ${isValidDeck ? 'text-emerald-400' : 'text-red-400'}`}>
            {(totalSpawnChance * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-[10px] text-gray-500 leading-normal">
          Manage enemies and spawn weight distribution in the right sidebar. The total spawn chance should sum to 100%.
        </p>
      </Section>
    </div>
  );
}
