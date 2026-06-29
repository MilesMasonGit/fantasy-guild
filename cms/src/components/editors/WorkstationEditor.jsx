import { useState } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import { Image, HelpCircle } from 'lucide-react';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

export default function WorkstationEditor({ openGenerate }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const activeId = useEntityStore((s) => s.activeEntityId);
  const workstation = useEntityStore((s) => s.workstations[activeId]);
  const updateWorkstation = useEntityStore((s) => s.updateWorkstation);
  const deleteWorkstation = useEntityStore((s) => s.deleteWorkstation);
  const clearActive = useEntityStore((s) => s.clearActiveEntity);
  const areas = useEntityStore((s) => s.areas);
  const subskills = useEntityStore((s) => s.subskills);

  if (!workstation) return <Empty text="Select a workstation from the sidebar to edit" />;

  const update = (key, value) => updateWorkstation(activeId, { [key]: value });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Header 
        icon="🔨" 
        name={workstation.name} 
        id={workstation.id} 
        sprite={workstation.sprite}
        isBackground={true}
        onDelete={() => { deleteWorkstation(activeId); clearActive(); }} 
        onSuggest={openGenerate ? () => openGenerate({
          type: 'generate_single',
          activeId,
          entityType: 'workstation',
          name: workstation.name,
        }) : null}
      />

      {/* Visual Background Preview (256px layout) */}
      {workstation.sprite && (
        <Section title="Background Sprite Preview" icon={<Image size={14} />}>
          <div className="w-full flex justify-center bg-black/40 border border-white/5 rounded-xl p-4">
            {(() => {
              const resolvedPath = resolveSpritePath(workstation.sprite);
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
                    <span className="text-3xl" style={{ display: 'none' }}>{workstation.icon || '🔨'}</span>
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
            <input type="text" value={workstation.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="Area Placement (Host Area)">
            <select value={workstation.areaId} onChange={(e) => update('areaId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Associated Subskill">
            <select value={workstation.subskillId} onChange={(e) => update('subskillId', e.target.value)} className="w-full">
              <option value="">None</option>
              {Object.values(subskills).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Skill Cap (Max Level)">
            <input type="number" min={1} max={99} value={workstation.skillCap} onChange={(e) => update('skillCap', Number(e.target.value))} className="w-full" />
          </Field>

          <Field label="Sprite Reference" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {(() => {
                  const resolvedPath = workstation.sprite ? resolveSpritePath(workstation.sprite) : null;
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
                value={workstation.sprite || ''} 
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
