import { useState } from 'react';
import { Sparkles, X, Loader2, Check, AlertTriangle, Key } from 'lucide-react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { generateContent, DEFAULT_GENERATOR_SKILL } from '../../engine/contentGenerator';
import { SKILLS } from '../../utils/constants';

const GENERATION_MODES = [
  { key: 'generate_single', label: 'AI Suggest / Auto-Fill', desc: 'Auto-fill inputs, outputs, requirements, and settings for the active editing entity' },
  { key: 'generate_area', label: 'Generate Area Content', desc: 'Create a full set of gathering + processing chains for a skill range' },
  { key: 'fill_skill_gap', label: 'Fill Skill Gap', desc: 'Generate content for a specific skill + level range with no tasks' },
  { key: 'custom', label: 'Custom Prompt', desc: 'Describe exactly what you need in natural language' },
];

export default function GenerateModal({ isOpen, onClose, prefill }) {
  const apiKey = useGlobalStore((s) => s.geminiApiKey);
  const setGlobal = useGlobalStore((s) => s.setGlobal);
  const globals = useGlobalStore.getState();
  const items = useEntityStore((s) => s.items);
  const areas = useEntityStore((s) => s.areas);
  const effects = useEntityStore((s) => s.effects);
  const styleGuide = useGlobalStore((s) => s.generatorStyleGuide);

  const [mode, setMode] = useState(prefill?.type || 'generate_single');
  const [skill, setSkill] = useState(prefill?.skill || DEFAULT_GENERATOR_SKILL);
  const [levelMin, setLevelMin] = useState(prefill?.levelMin || 1);
  const [levelMax, setLevelMax] = useState(prefill?.levelMax || 15);
  const [skills, setSkills] = useState(prefill?.skills || [DEFAULT_GENERATOR_SKILL]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [areaId, setAreaId] = useState(prefill?.areaId || '');
  const [showStyleGuide, setShowStyleGuide] = useState(false);

  const [status, setStatus] = useState('idle');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const [keyInput, setKeyInput] = useState(apiKey);

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('Please enter your Gemini API key first.');
      return;
    }

    setStatus('generating');
    setError('');
    setPreview(null);

    try {
      const request = {
        type: mode,
        skill,
        skills,
        levelMin,
        levelMax,
        prompt: customPrompt,
        additionalContext,
        areaId,
        entityType: prefill?.entityType,
        name: prefill?.name,
        levelRequirement: prefill?.levelRequirement,
      };

        const generated = await generateContent(apiKey, globals, items, request, areas, effects);
      setPreview(generated);
      setStatus('preview');
    } catch (err) {
      setError(err.message || 'Generation failed');
      setStatus('error');
    }
  };

  const handleSaveKey = () => {
    setGlobal('geminiApiKey', keyInput);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl shadow-2xl border flex flex-col" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', width: 640, maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>AI Content Generator</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!apiKey && (
            <div className="rounded-lg p-4 border space-y-2" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-warning)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>
                <Key size={14} /> Gemini API Key Required
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Your key is stored locally in your browser and never sent anywhere except Google's API.</p>
              <div className="flex gap-2">
                <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="AIza..." className="flex-1" />
                <button onClick={handleSaveKey} className="btn-primary text-xs">Save Key</button>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <>
              <div className="space-y-2">
                {GENERATION_MODES.map((m) => (
                  <button key={m.key} onClick={() => setMode(m.key)} className="w-full text-left px-4 py-3 rounded-lg border transition-all" style={{
                    background: mode === m.key ? 'var(--color-accent-muted)' : 'var(--color-bg-elevated)',
                    borderColor: mode === m.key ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                    cursor: 'pointer',
                  }}>
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </button>
                ))}
              </div>

              {mode === 'generate_single' && prefill && (
                <div className="rounded-lg p-3 border space-y-1.5" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Target Entity: <span className="text-emerald-400 font-bold">{prefill.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    <div>Type: <span className="font-mono text-white capitalize">{prefill.entityType}</span></div>
                    {prefill.skill && <div>Skill: <span className="font-mono text-white capitalize">{prefill.skill}</span></div>}
                    {prefill.levelRequirement && <div>Level Requirement: <span className="font-mono text-white">{prefill.levelRequirement}</span></div>}
                  </div>
                </div>
              )}

              {(mode === 'fill_skill_gap' || mode === 'generate_area') && (
                <div className="grid grid-cols-2 gap-3">
                  {mode === 'fill_skill_gap' && (
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Skill</label>
                      <select value={skill} onChange={(e) => setSkill(e.target.value)} className="w-full">
                        {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {mode === 'generate_area' && (
                    <div className="col-span-2">
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Primary Skills (hold Ctrl to multi-select)</label>
                      <select multiple value={skills} onChange={(e) => setSkills(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full" style={{ height: 80 }}>
                        {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {(mode === 'fill_skill_gap' || mode === 'generate_area') && (
                    <>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Level Min</label>
                        <input type="number" min={1} max={99} value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))} className="w-full" />
                      </div>
                      <div>
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Level Max</label>
                        <input type="number" min={1} max={99} value={levelMax} onChange={(e) => setLevelMax(Number(e.target.value))} className="w-full" />
                      </div>
                    </>
                  )}
                </div>
              )}

              {(mode === 'custom' || mode === 'generate_single') && (
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {mode === 'generate_single' ? 'Specific Directions / Theme (optional)' : 'Describe what you need'}
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full"
                    rows={mode === 'generate_single' ? 3 : 4}
                    placeholder={mode === 'generate_single' ? 'e.g., should yield a fish and rarely an old boot' : 'e.g., I need 3 gathering tasks for Fishing, levels 10 to 20...'}
                  />
                </div>
              )}

              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Assign to Area</label>
                <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-full">
                  <option value="">No Area</option>
                  {Object.values(areas).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Additional Context (optional)</label>
                <textarea value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} className="w-full" rows={2} placeholder="e.g., Should use existing Iron Ore as an input..." />
              </div>

              <div>
                <button onClick={() => setShowStyleGuide(!showStyleGuide)} className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showStyleGuide ? '▼' : '▶'} Edit Style Guide
                </button>
                {showStyleGuide && (
                  <textarea
                    value={styleGuide}
                    onChange={(e) => setGlobal('generatorStyleGuide', e.target.value)}
                    className="w-full mt-2"
                    rows={8}
                    style={{ fontSize: 11, fontFamily: 'monospace' }}
                  />
                )}
              </div>
            </>
          )}

          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Generating balanced content...</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Teaching Gemini your economic model and constraints</p>
            </div>
          )}

          {status === 'preview' && preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
                <Check size={14} /> Generated Successfully
              </div>

              <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Items ({(preview.items || []).length})</h4>
                <div className="space-y-1">
                  {(preview.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-base)' }}>
                      <span>{item.icon || '📦'}</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{item.type}</span>
                      {item.value > 0 && <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-success)', color: '#000', fontSize: 10 }}>{item.value}GP</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Tasks ({(preview.tasks || []).length})</h4>
                <div className="space-y-1">
                  {(preview.tasks || []).map((task, i) => (
                    <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-bg-base)' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--color-text-primary)' }}>{task.name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>Lv.{task.skillRequirement} {task.skill}</span>
                        <span style={{ color: 'var(--color-accent)' }}>EV:{task.targetEV}</span>
                      </div>
                      <div className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {(task.inputs || []).length > 0 && <span>In: {task.inputs.map((i) => `${i.itemName}×${i.quantity}`).join(', ')} → </span>}
                        <span>Out: {(task.outputs || []).map((o) => `${o.itemName}×${o.quantity}${o.chance < 1 ? ` (${Math.round(o.chance * 100)}%)` : ''}`).join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(preview.recipes || []).length > 0 && (
                <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Recipes ({(preview.recipes || []).length})</h4>
                  <div className="space-y-1">
                    {(preview.recipes || []).map((recipe, i) => (
                      <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-bg-base)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--color-text-primary)' }}>{recipe.name}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>Lv.{recipe.levelRequirement} {recipe.skill}</span>
                          <span style={{ color: 'var(--color-accent)' }}>EV:{recipe.targetEV}</span>
                        </div>
                        <div className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          {(recipe.inputs || []).length > 0 && <span>In: {recipe.inputs.map((i) => `${i.itemName}×${i.quantity}`).join(', ')} → </span>}
                          <span>Out: {(recipe.outputs || []).map((o) => `${o.itemName}×${o.quantity}${o.chance < 1 ? ` (${Math.round(o.chance * 100)}%)` : ''}`).join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(preview.stations || []).length > 0 && (
                <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Stations ({(preview.stations || []).length})</h4>
                  <div className="space-y-1">
                    {(preview.stations || []).map((ws, i) => (
                      <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-bg-base)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--color-text-primary)' }}>{ws.name}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{ws.skill} (Cap: Lv.{ws.skillCap})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-error)', color: 'white' }}>
              <AlertTriangle size={14} />
              <span className="text-xs">{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {status === 'idle' && (
            <button onClick={handleGenerate} className="btn-primary flex items-center gap-2" disabled={!apiKey}>
              <Sparkles size={14} /> Generate
            </button>
          )}
          {status === 'preview' && (
            <>
              <button onClick={() => { setStatus('idle'); setPreview(null); }} className="btn-ghost">Regenerate</button>
              <button onClick={onClose} className="btn-primary">Close</button>
            </>
          )}
          {status === 'error' && (
            <button onClick={() => { setStatus('idle'); setError(''); }} className="btn-ghost">Try Again</button>
          )}
        </div>
      </div>
    </div>
  );
}
