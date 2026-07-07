import { useState, useEffect } from 'react';
import { useEntityStore } from '../../stores/useEntityStore';
import { AlertCircle, HelpCircle, Image, RefreshCw, Layers, Copy, Check } from 'lucide-react';

export default function SpriteAuditDashboard() {
  const items = useEntityStore((s) => s.items);
  const tasks = useEntityStore((s) => s.tasks);
  const enemies = useEntityStore((s) => s.enemies);
  const areas = useEntityStore((s) => s.areas);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const runAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sprite-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, tasks, enemies, areas })
      });
      if (!res.ok) throw new Error('Failed to fetch sprite audit results');
      const data = await res.json();
      setAuditData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [items, tasks, enemies, areas]);

  const copyPromptText = (entityName, type) => {
    const is32px = type === 'item';
    const cleanTypeName = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Auto outline styling matching item-gen.md
    let outlineStr = "solid black";
    if (is32px) {
      const isOrganic = ['food', 'potion', 'material'].includes(type) || entityName.toLowerCase().includes('shrimp') || entityName.toLowerCase().includes('fruit') || entityName.toLowerCase().includes('vegetable');
      outlineStr = isOrganic ? "dark colored" : "solid black";
    } else {
      outlineStr = "dark charcoal colored";
    }

    const prompt = is32px 
      ? `[SUBJECT: a fresh ${entityName.toLowerCase()}] [STYLE: 32x32 Pixel Art] [DENSITY: Perfect 32x32 logic-pixel blocks, clearly defined ${outlineStr} outline border around the ${entityName.toLowerCase()} shape] [LIGHTING: Top-Left Volumetric] [BACKGROUND: Pure White #FFFFFF] [NEGATIVE: blurring, anti-aliasing, soft edges, gradients, dithering]
MANDATORY: 32x32 drawing complexity rendered on a 1024x1024 canvas.
MANDATORY: Every single logic-pixel MUST be a solid 32x32 pixel square block.
MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.
MANDATORY: Solid white #FFFFFF background, grid-less.
MANDATORY: Distinct ${outlineStr} border outline around the asset silhouette.`
      : `[SUBJECT: a fantasy ${entityName.toLowerCase()} character, full body action stance, fully in-frame and centered] [STYLE: 64x64 Pixel Art] [DENSITY: Perfect 64x64 logic-pixel blocks, clearly defined dark charcoal colored outline border around the character shape] [LIGHTING: Top-Left Volumetric] [BACKGROUND: Pure White #FFFFFF] [NEGATIVE: cropping, out of frame, cut off, magic elements leaving frame, blurring, anti-aliasing, soft edges, gradients, dithering]
MANDATORY: 64x64 drawing complexity rendered on a 1024x1024 canvas.
MANDATORY: Every single logic-pixel MUST be a solid 16x16 pixel square block.
MANDATORY: Zero anti-aliasing, no sub-pixel rendering, no blur, no gradients.
MANDATORY: Solid white #FFFFFF background, grid-less.
MANDATORY: Distinct dark charcoal colored border outline around the asset silhouette.`;

    navigator.clipboard.writeText(prompt);
    setCopiedId(entityName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCleanFilename = (spritePath) => {
    return spritePath.split('/').pop().replace('.png', '');
  };

  if (loading && !auditData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3" style={{ color: 'var(--color-text-muted)' }}>
        <RefreshCw size={24} className="animate-spin" />
        <p className="text-sm">Running sprite catalog audit...</p>
      </div>
    );
  }

  const { unassigned = [], missing = [], duplicates = {} } = auditData || {};

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto pr-1">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Unassigned Sprites</span>
          <span className="text-xl font-black" style={{ color: unassigned.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{unassigned.length}</span>
        </div>
        <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Missing Sprites</span>
          <span className="text-xl font-black" style={{ color: missing.length > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{missing.length}</span>
        </div>
        <div className="p-4 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Duplicate Assignments</span>
          <span className="text-xl font-black" style={{ color: Object.keys(duplicates).length > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{Object.keys(duplicates).length}</span>
        </div>
      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Missing / Art To-Do List */}
        <div className="flex flex-col gap-3 p-5 rounded-xl border bg-black/10" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} style={{ color: 'var(--color-error)' }} />
              Art To-Do List (Missing Sprites)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>{missing.length} items</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-1">
            {missing.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: 'var(--color-success)' }}>
                ✨ All entities have valid, existing sprites connected!
              </div>
            ) : (
              missing.map(entity => (
                <div key={entity.id} className="flex items-center justify-between p-3 rounded-lg border hover:border-white/20 transition-all" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                        {entity.type}
                      </span>
                      <span className="text-sm font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-text-primary)' }} onClick={() => setActiveEntity(entity.id, entity.type)}>
                        {entity.name}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--color-error)' }}>{entity.reason}</span>
                  </div>
                  <button 
                    onClick={() => copyPromptText(entity.name, entity.type)} 
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
                    style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
                  >
                    {copiedId === entity.name ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === entity.name ? 'Copied!' : 'Copy Prompt'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Duplicate assignments */}
        <div className="flex flex-col gap-3 p-5 rounded-xl border bg-black/10" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Layers size={16} style={{ color: 'var(--color-warning)' }} />
              Duplicate Sprite Warnings
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>{Object.keys(duplicates).length} warnings</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-1">
            {Object.keys(duplicates).length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: 'var(--color-success)' }}>
                ✅ No duplicate sprite assignments detected.
              </div>
            ) : (
              Object.entries(duplicates).map(([spritePath, list]) => (
                <div key={spritePath} className="p-3 rounded-lg border flex flex-col gap-2" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                  <div className="flex items-center gap-2 pb-1 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <img src={`/${spritePath}`} className="w-6 h-6 object-contain pixel-art bg-black/20 rounded" alt="Sprite" onError={(e) => e.target.style.display = 'none'} />
                    <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>{spritePath}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.map(entity => (
                      <span key={entity.id} onClick={() => setActiveEntity(entity.id, entity.type)} className="text-[11px] px-2 py-1 rounded cursor-pointer transition-all border border-dashed hover:border-white/40" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}>
                        [{entity.type}] {entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Unassigned physical assets library */}
      <div className="flex flex-col gap-3 p-5 rounded-xl border bg-black/10" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Image size={16} style={{ color: 'var(--color-accent)' }} />
            Unassigned Sprites Library
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>{unassigned.length} files</span>
        </div>

        {unassigned.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No unassigned sprite files found in public/assets/. All processed PNG files are currently linked to entities!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 max-h-[400px] overflow-y-auto p-1">
            {unassigned.map(spritePath => {
              const cleanFilename = getCleanFilename(spritePath);
              return (
                <div key={spritePath} className="flex flex-col items-center p-3 rounded-lg border text-center transition-all hover:border-white/30" style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}>
                  <div className="w-12 h-12 rounded bg-black/25 flex items-center justify-center mb-2 overflow-hidden">
                    <img src={`/${spritePath}`} className="w-10 h-10 object-contain pixel-art" alt="Unassigned sprite" />
                  </div>
                  <div className="text-[11px] font-semibold truncate w-full" style={{ color: 'var(--color-text-primary)' }} title={cleanFilename}>
                    {cleanFilename}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {spritePath.split('/')[1] || 'assets'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
