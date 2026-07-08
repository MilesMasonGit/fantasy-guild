import { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import { Image, HelpCircle } from 'lucide-react';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function StationEditor({ openGenerate }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const station = useEntityStore((s) => s.stations[activeId]);
  const updateStation = useEntityStore((s) => s.updateStation);
  const deleteStation = useEntityStore((s) => s.deleteStation);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const subskills = useEntityStore((s) => s.subskills);

  if (!station) return <Empty text="Select a station from the sidebar to edit" />;

  const update = (key, value) => updateStation(activeId, { [key]: value });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header
        icon="🔨"
        name={station.name}
        id={station.id}
        sprite={station.sprite}
        isBackground={true}
        onDelete={() => { deleteStation(activeId); clearActive(); }}
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'station',
          name: station.name,
        }) : null}
      />

      {/* Visual Background Preview (256px layout) */}
      {station.sprite && (
        <Section title="Background Sprite Preview" icon={<Image size={14} />}>
          <div className="w-full flex justify-center bg-black/40 border border-white/5 rounded-xl p-4">
            {(() => {
              const resolvedPath = resolveSpritePath(station.sprite);
              if (resolvedPath) {
                const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                return (
                  <div className="relative group max-w-xs w-full aspect-video border border-white/10 rounded-lg overflow-hidden bg-black/20 flex items-center justify-center">
                    <img
                      src={imgSrc}
                      className="w-full h-full object-cover pixel-art animate-fade-in"
                      alt="Background Preview"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fb = e.target.nextElementSibling;
                        if (fb) fb.style.display = 'block';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 transition-opacity select-none">
                      256px Background Asset
                    </div>
                    <span className="text-3xl" style={{ display: 'none' }}>{station.icon || '🔨'}</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </Section>
      )}

      {/* Core Fields */}
      <Section title="Configuration">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input type="text" value={station.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="Area Placement (Host Area)">
            <select value={station.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Associated Subskill">
            <select value={station.subskillId} onChange={(e) => update('subskillId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(subskills).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Skill Cap (Max Level)">
            <input type="number" min={1} max={99} value={station.skillCap} onChange={(e) => update('skillCap', Number(e.target.value))} className="w-full" />
          </Field>

          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = station.sprite ? resolveSpritePath(station.sprite) : null;
                  if (resolvedPath) {
                    const imgSrc = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
                    return (
                      <>
                        <img
                          src={imgSrc}
                          className="w-full h-full object-cover pixel-art animate-fade-in"
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
                value={station.sprite || ''}
                onChange={(e) => update('sprite', e.target.value)}
                placeholder="sprite_id or assets/..."
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500/50 h-10"
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
        </div>
      </Section>

      {/* Station Card Settings (Deck Loop rework, Phase 2 §2H — consumed in Phase 4) */}
      <Section title="Station Card Settings (Deck Loop)">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={station.hasCraftingQueue ?? true}
              onChange={(e) => update('hasCraftingQueue', e.target.checked)}
              className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            Has Crafting Queue (hero can work this station in Stationed Mode)
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={!!station.passiveBuff}
              onChange={(e) => update('passiveBuff', e.target.checked
                ? { type: 'output_double', target: { category: '' }, value: 0.15, description: '' }
                : null)}
              className="rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            Provides Passive Area Buff (active whenever slotted, in both modes)
          </label>

          {station.passiveBuff && (
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-black/20 border border-white/5">
              <Field label="Buff Type">
                <input
                  type="text"
                  value={station.passiveBuff.type || ''}
                  placeholder="e.g. output_double, task_haste"
                  onChange={(e) => update('passiveBuff', { ...station.passiveBuff, type: e.target.value })}
                  className="w-full font-mono text-xs"
                />
              </Field>
              <Field label="Target Category">
                <input
                  type="text"
                  value={station.passiveBuff.target?.category || ''}
                  placeholder="e.g. water, ore"
                  onChange={(e) => update('passiveBuff', {
                    ...station.passiveBuff,
                    target: { ...(station.passiveBuff.target || {}), category: e.target.value }
                  })}
                  className="w-full font-mono text-xs"
                />
              </Field>
              <Field label="Value (0.15 = 15%)">
                <input
                  type="number"
                  step="0.05"
                  value={station.passiveBuff.value ?? 0}
                  onChange={(e) => update('passiveBuff', { ...station.passiveBuff, value: Number(e.target.value) })}
                  className="w-full font-mono text-xs"
                />
              </Field>
              <Field label="Buff Description">
                <input
                  type="text"
                  value={station.passiveBuff.description || ''}
                  placeholder="e.g. 15% chance to double Water outputs"
                  onChange={(e) => update('passiveBuff', { ...station.passiveBuff, description: e.target.value })}
                  className="w-full text-xs"
                />
              </Field>
            </div>
          )}
        </div>
      </Section>

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
