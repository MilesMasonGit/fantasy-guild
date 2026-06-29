import { useState } from 'react';
import { Sparkles, X, Loader2, Check, AlertTriangle, Key } from 'lucide-react';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { generateContent, resolveAndImport } from '../../engine/contentGenerator';
import { SKILLS } from '../../utils/constants';

const GENERATION_MODES = [
  { key: 'generate_single', label: 'AI Suggest / Auto-Fill', desc: 'Auto-fill inputs, outputs, requirements, and settings for the active editing entity' },
  { key: 'generate_area', label: 'Generate Area Content', desc: 'Create a full set of gathering + processing chains for a skill range' },
  { key: 'generate_combat', label: 'Generate Combat Encounters', desc: 'Create enemies and combat encounter cards for a specific tier' },
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
  const [skill, setSkill] = useState(prefill?.skill || 'nature');
  const [levelMin, setLevelMin] = useState(prefill?.levelMin || 1);
  const [levelMax, setLevelMax] = useState(prefill?.levelMax || 15);
  const [tier, setTier] = useState(prefill?.tier || 1);
  const [skills, setSkills] = useState(prefill?.skills || ['nature']);
  const [customPrompt, setCustomPrompt] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [areaId, setAreaId] = useState(prefill?.areaId || '');
  const [showStyleGuide, setShowStyleGuide] = useState(false);

  const [status, setStatus] = useState('idle'); // idle, generating, preview, importing, done, error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
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
        tier,
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

  const handleImport = () => {
    if (!preview) return;
    setStatus('importing');

    try {
      const importResult = resolveAndImport(preview, useEntityStore, areaId, prefill?.activeId, prefill?.entityType);
      setResult(importResult);
      setStatus('done');
    } catch (err) {
      setError('Import failed: ' + err.message);
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>AI Content Generator</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* API Key Section */}
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

          {/* Mode Selection */}
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

              {/* Config Fields */}
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

              {(mode === 'fill_skill_gap' || mode === 'generate_area' || mode === 'generate_combat') && (
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
                  {mode === 'generate_combat' && (
                    <div className="col-span-2">
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Enemy Tier</label>
                      <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className="w-full">
                        {[1, 2, 3, 4, 5].map((t) => <option key={t} value={t}>Tier {t}</option>)}
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
                    placeholder={mode === 'generate_single' ? 'e.g., should yield a fish and rarely an old boot' : 'e.g., I need 3 combat encounters for tier 2, dropping raw materials used in Culinary crafting...'}
                  />
                </div>
              )}

              {/* Area Assignment */}
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

              {/* Style Guide Toggle */}
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

          {/* Generating Status */}
          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Generating balanced content...</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Teaching Gemini your economic model and constraints</p>
            </div>
          )}

          {/* Preview */}
          {status === 'preview' && preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
                <Check size={14} /> Generated Successfully — Review Before Import
              </div>

              <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Items ({(preview.items || []).length})</h4>
                <div className="space-y-1">
                  {(preview.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-base)' }}>
                      <span>{item.icon || '📦'}</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>{item.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{item.type}</span>
                      {item.trueCost > 0 && <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-success)', color: '#000', fontSize: 10 }}>{item.trueCost}GP</span>}
                    </div>
                  ))}
                </div>
              </div>

              {(preview.enemies || []).length > 0 && (
                <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Enemies ({(preview.enemies || []).length})</h4>
                  <div className="space-y-1">
                    {(preview.enemies || []).map((enemy, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: 'var(--color-bg-base)' }}>
                        <span>💀</span>
                        <span style={{ color: 'var(--color-text-primary)' }}>{enemy.name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>T{enemy.tier} {enemy.combatType}</span>
                        <span style={{ color: 'var(--color-warning)' }}>{enemy.hp} HP</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>Drops: {enemy.drops?.length || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                          <span style={{ color: 'var(--color-text-muted)' }}>Lv.{recipe.levelRequirement} {recipe.subskillId}</span>
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

              {(preview.encounters || []).length > 0 && (
                <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Encounters ({(preview.encounters || []).length})</h4>
                  <div className="space-y-1">
                    {(preview.encounters || []).map((enc, i) => (
                      <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-bg-base)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--color-text-primary)' }}>{enc.name}</span>
                          <span style={{ color: 'var(--color-enemy)' }}>Combat Encounter</span>
                        </div>
                        <div className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          <span>Enemies: {(enc.assignedEnemies || []).map(e => `${e.enemyName} (${Math.round(e.spawnChance * 100)}%)`).join(', ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(preview.workstations || []).length > 0 && (
                <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-subtle)' }}>
                  <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Workstations ({(preview.workstations || []).length})</h4>
                  <div className="space-y-1">
                    {(preview.workstations || []).map((ws, i) => (
                      <div key={i} className="text-xs px-2 py-1.5 rounded" style={{ background: 'var(--color-bg-base)' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--color-text-primary)' }}>{ws.name}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}>{ws.subskillId} (Cap: Lv.{ws.skillCap})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {status === 'done' && result && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-success)', color: '#000' }}>
                <Check size={24} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Import Complete!</p>
              <p className="text-xs text-center px-4" style={{ color: 'var(--color-text-secondary)' }}>
                {result.tasksUpdated > 0 && `Updated task "${prefill?.name}". `}
                {result.recipesUpdated > 0 && `Updated recipe "${prefill?.name}". `}
                {result.itemsUpdated > 0 && `Updated item "${prefill?.name}". `}
                {result.enemiesUpdated > 0 && `Updated enemy "${prefill?.name}". `}
                Created {result.areasCreated || 0} areas, {result.itemsCreated} items, {result.enemiesCreated || 0} enemies, {result.tasksCreated} tasks, {result.recipesCreated} recipes, {result.encountersCreated} encounters, {result.workstationsCreated} workstations, and {result.questsCreated || 0} quests.
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Run the simulation to calculate values, then rename and theme your new content.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-error)', color: 'white' }}>
              <AlertTriangle size={14} />
              <span className="text-xs">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {status === 'idle' && (
            <button onClick={handleGenerate} className="btn-primary flex items-center gap-2" disabled={!apiKey}>
              <Sparkles size={14} /> Generate
            </button>
          )}
          {status === 'preview' && (
            <>
              <button onClick={() => { setStatus('idle'); setPreview(null); }} className="btn-ghost">Regenerate</button>
              <button onClick={handleImport} className="btn-primary flex items-center gap-2">
                <Check size={14} /> Import {(preview?.items || []).length + (preview?.tasks || []).length + (preview?.enemies || []).length + (preview?.recipes || []).length + (preview?.encounters || []).length + (preview?.workstations || []).length} Entities
              </button>
            </>
          )}
          {status === 'done' && (
            <button onClick={onClose} className="btn-primary">Close</button>
          )}
          {status === 'error' && (
            <button onClick={() => { setStatus('idle'); setError(''); }} className="btn-ghost">Try Again</button>
          )}
        </div>
      </div>
    </div>
  );
}
