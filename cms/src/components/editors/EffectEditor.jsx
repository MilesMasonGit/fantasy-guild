import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';

const TARGET_ENTITY_TYPES = [
  'All', 'Enemy', 'Food', 'Drink', 'Weapon', 'Armor', 'Tool', 'Consumable', 'Quest Item'
];

const DRAIN_TRIGGERS = [
  'NONE', 'ON_HIT_TAKEN', 'ON_DAMAGE_DEALT', 'ON_TICK_COMPLETE', 'ON_KILL'
];

export default function EffectEditor({ openGenerate }) {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const effect = useEntityStore((s) => s.effects[activeId]);
  const updateEffect = useEntityStore((s) => s.updateEffect);
  const deleteEffect = useEntityStore((s) => s.deleteEffect);

  if (!effect) return <Empty text="Select an effect from the sidebar to edit" />;

  const handleChange = (field, value) => {
    updateEffect(activeId, { [field]: value });
  };

  const currentTypes = effect.targetEntityTypes || (effect.targetEntityType ? [effect.targetEntityType] : []);

  const toggleEntityType = (type) => {
    let nextTypes;
    if (currentTypes.includes(type)) {
      nextTypes = currentTypes.filter(t => t !== type);
    } else {
      nextTypes = [...currentTypes, type];
    }
    updateEffect(activeId, { targetEntityTypes: nextTypes, targetEntityType: nextTypes[0] || 'All' });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        icon="✨"
        name={effect.name || 'Unnamed Effect'}
        id={effect.id}
        onDelete={() => {
          if (confirm('Delete this effect?')) {
            deleteEffect(activeId);
            useEntityStore.getState().clearActiveEntity();
          }
        }}
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'effect',
          name: effect.name,
        }) : null}
      />

      {/* Core Metadata */}
      <Section title="Core Identification">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Effect Name">
            <input
              type="text"
              value={effect.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full"
              placeholder="e.g. Minor Thorns"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={effect.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full min-h-[80px]"
            placeholder="e.g. Reflects 1 damage to melee attackers."
          />
        </Field>
      </Section>

      {/* Mechanics */}
      <Section title="Targeting & Durability">
        <div className="space-y-4">
          <Field label="Target Entity Type(s)">
            <span className="text-[9px] text-gray-500 block -mt-1 mb-2">
              Which items or entities can grant or receive this effect. Select all that apply.
            </span>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_ENTITY_TYPES.map(type => {
                const isSelected = currentTypes.includes(type) || (type === 'All' && currentTypes.length === 0);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleEntityType(type)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                      isSelected 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/5' 
                        : 'bg-black/20 border-white/5 text-gray-400 hover:border-white/15 hover:text-white'
                    }`}
                  >
                    <span>{type}</span>
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                      isSelected 
                        ? 'border-emerald-400 bg-emerald-500 text-black text-[9px] font-black' 
                        : 'border-white/20 bg-transparent'
                    }`}>
                      {isSelected && '✓'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Drain Trigger">
              <span className="text-[9px] text-gray-500 block -mt-1 mb-2">
                Used only for Special Items (Slot 5) to know when to drain durability.
              </span>
              <select
                value={effect.drainTrigger || 'NONE'}
                onChange={(e) => handleChange('drainTrigger', e.target.value)}
                className="w-full"
              >
                {DRAIN_TRIGGERS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Section>
    </div>
  );
}
