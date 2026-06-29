import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';

export default function EncounterTableEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const encounterTable = useEntityStore((s) => s.encounterTables[activeId]);
  const updateEncounterTable = useEntityStore((s) => s.updateEncounterTable);
  const deleteEncounterTable = useEntityStore((s) => s.deleteEncounterTable);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);

  if (!encounterTable) return <Empty text="Select an encounter table from the sidebar to edit" />;

  const update = (key, value) => updateEncounterTable(activeId, { [key]: value });

  const totalWeight = (encounterTable.entries || []).reduce((sum, e) => sum + (e.dropWeight || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header 
        icon="⚔️" 
        name={encounterTable.name} 
        id={encounterTable.id} 
        onDelete={() => { deleteEncounterTable(activeId); clearActive(); }}
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'encounterTable',
          name: encounterTable.name,
        }) : null}
      />

      {/* Configuration */}
      <Section title="Configuration">
        <div className="grid grid-cols-1 gap-4">
          <Field label="Name">
            <input type="text" value={encounterTable.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="Description">
            <input type="text" value={encounterTable.description || ''} onChange={(e) => update('description', e.target.value)} className="w-full" />
          </Field>
        </div>
      </Section>

      {/* Pool Entries summary */}
      <Section title="Encounter Pool Status">
        <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
          <span className="text-xs font-semibold text-gray-400">Total Pool Weight</span>
          <span className="text-sm font-black font-mono text-emerald-400">{totalWeight}</span>
        </div>
        <p className="text-[10px] text-gray-500 leading-normal">
          Manage the encounter pool entries and weight distributions in the right sidebar.
        </p>
      </Section>
    </div>
  );
}
