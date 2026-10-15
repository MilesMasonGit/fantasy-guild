import { useState } from 'react';
import RecolorEditor from '../components/editors/RecolorEditor';
import AnimationEditor from '../components/editors/AnimationEditor';

/**
 * The Studio (`npm run studio`): the art tools on their own, beside the CMS. ⚠️ It must never
 * import a CMS store or game data: its server refuses the game-data routes, and a test walks
 * this entry's imports.
 */
const TABS = [
  { key: 'recolor', label: 'Recolor', Editor: RecolorEditor },
  { key: 'animation', label: 'Animation', Editor: AnimationEditor },
];

export default function StudioApp() {
  const [tab, setTab] = useState('recolor');
  const { Editor } = TABS.find((t) => t.key === tab);

  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: 'var(--color-bg-deep)' }}>
      <header
        className="flex items-center gap-4 px-4 border-b shrink-0"
        style={{ minHeight: 52, backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-accent)' }}>
          🎨 Fantasy Guild Studio
        </h1>
        <div role="tablist" className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--color-bg-base)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: tab === t.key ? 'var(--color-bg-elevated)' : 'transparent',
                color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <Editor />
      </main>
    </div>
  );
}
