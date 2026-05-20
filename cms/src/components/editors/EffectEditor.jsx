import { useEntityStore } from '../../stores/useEntityStore';

const TARGET_ENTITY_TYPES = [
  'All', 'Enemy', 'Food', 'Drink', 'Weapon', 'Armor', 'Tool', 'Consumable', 'Quest Item'
];

const DRAIN_TRIGGERS = [
  'NONE', 'ON_HIT_TAKEN', 'ON_DAMAGE_DEALT', 'ON_TICK_COMPLETE', 'ON_KILL'
];

export default function EffectEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const effect = useEntityStore((s) => s.effects[activeId]);
  const updateEffect = useEntityStore((s) => s.updateEffect);
  const deleteEffect = useEntityStore((s) => s.deleteEffect);

  if (!effect) return <div className="p-4">Effect not found</div>;

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
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[var(--color-bg-elevated)] flex items-center justify-center text-xl shadow-inner">
            ✨
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
              {effect.name || 'Unnamed Effect'}
            </h2>
            <div className="text-xs text-[var(--color-text-muted)] font-mono">{effect.id}</div>
          </div>
        </div>
        <button
          onClick={() => {
            if (confirm('Delete this effect?')) {
              deleteEffect(activeId);
              useEntityStore.getState().clearActiveEntity();
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
        >
          Delete Effect
        </button>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Core Metadata */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-accent)] uppercase tracking-wider flex items-center gap-2">
            <span>Core Identification</span>
            <div className="h-px bg-[var(--color-border-subtle)] flex-1"></div>
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Field label="Effect Name">
              <input
                type="text"
                value={effect.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input-primary"
                placeholder="e.g. Minor Thorns"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={effect.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="input-primary min-h-[80px]"
              placeholder="e.g. Reflects 1 damage to melee attackers."
            />
          </Field>
        </section>

        {/* Mechanics */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-accent)] uppercase tracking-wider flex items-center gap-2">
            <span>Targeting & Durability</span>
            <div className="h-px bg-[var(--color-border-subtle)] flex-1"></div>
          </h3>

          <div className="space-y-4">
            <Field label="Target Entity Type(s)" helpText="Which items or entities can grant or receive this effect. Select all that apply.">
              <div className="grid grid-cols-3 gap-2 mt-2">
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
                          : 'bg-black/20 border-white/5 text-[var(--color-text-muted)] hover:border-white/15 hover:text-white'
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
              <Field label="Drain Trigger" helpText="Used only for Special Items (Slot 5) to know when to drain durability.">
                <select
                  value={effect.drainTrigger || 'NONE'}
                  onChange={(e) => handleChange('drainTrigger', e.target.value)}
                  className="input-primary"
                >
                  {DRAIN_TRIGGERS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function Field({ label, helpText, children }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</label>
      {helpText && <p className="text-[10px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{helpText}</p>}
      {children}
    </div>
  );
}
