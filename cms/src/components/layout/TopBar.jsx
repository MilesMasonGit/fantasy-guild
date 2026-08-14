import { Settings, DatabaseBackup, Download, Sparkles } from 'lucide-react';
import { exportWorkspace } from '../../engine/fileUtils';

/**
 * ## What is missing here, and why
 *
 * **Run Simulation** is gone until Phase 8. The old solver balanced tasks,
 * encounters and quests against EV curves — entity types that no longer exist.
 * CMS-16 also changed the shape of the action: it becomes "Recalculate Economy",
 * an explicit on-demand pass, not a background simulation.
 *
 * **Sync to Game** and **Import from Game** are gone until Phase 10. CMS-4
 * removed the import path outright, and CMS-53 replaced the field-level merge
 * with a one-way full-file write — a different action with different safety
 * properties, so the old button would be actively misleading if left wired up.
 *
 * ⚠️ Until Phase 10 there is deliberately **no way to write to `data/`**. That
 * matches CMS-53's intended workflow: content is built up completely inside the
 * CMS, then pushed once as a deliberate full replacement. Work is kept safe by
 * localStorage persistence plus the backup/export paths below, not by syncing.
 */
const VIEWS = [
  { key: 'editor', label: 'Editor' },
  { key: 'sprites', label: 'Sprite Audit' },
  { key: 'recolor', label: 'Recolor' },
];

export default function TopBar({ onViewChange, currentView, onOpenGenerate, onOpenSettings, onOpenFileManager }) {
  return (
    <header
      className="flex items-center justify-between px-4 border-b shrink-0"
      style={{
        minHeight: 52,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-accent)' }}>
          ⚔️ Fantasy Guild CMS
        </h1>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}
        >
          v2 · phase 2
        </span>
      </div>

      {/* Center: view toggle */}
      <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--color-bg-base)' }}>
        {VIEWS.map((view) => (
          <button
            key={view.key}
            onClick={() => onViewChange(view.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: currentView === view.key ? 'var(--color-bg-elevated)' : 'transparent',
              color: currentView === view.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenGenerate}
          className="btn-ghost flex items-center gap-1.5"
          style={{ padding: '6px 10px' }}
          title="AI content generator (parked — unchanged by the rework)"
        >
          <Sparkles size={14} />
          <span className="text-xs">Generate</span>
        </button>

        <button
          onClick={onOpenFileManager}
          className="btn-ghost flex items-center gap-1.5"
          style={{ padding: '6px 10px' }}
          title="Backups — save and restore the whole workspace"
        >
          <DatabaseBackup size={14} />
          <span className="text-xs">Backups</span>
        </button>

        <button
          onClick={exportWorkspace}
          className="btn-ghost flex items-center gap-1.5"
          style={{ padding: '6px 10px' }}
          title="Download the workspace as a JSON file"
        >
          <Download size={14} />
          <span className="text-xs">Export</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="btn-ghost flex items-center"
          style={{ padding: '6px 8px' }}
          title="Global Values"
        >
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
}
