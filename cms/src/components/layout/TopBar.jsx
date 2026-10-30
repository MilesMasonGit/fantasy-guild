import { useState } from 'react';
import { Settings, DatabaseBackup, Download, Sparkles, Calculator, Check, UploadCloud, AlertCircle, Inbox } from 'lucide-react';
import { exportWorkspace, syncToGame, sendSync, restoreFromGame } from '../../engine/fileUtils';
import SyncGuardPanel from '../shared/SyncGuardPanel';
import { useEntityStore } from '../../stores/useEntityStore';
import { useGlobalStore } from '../../stores/useGlobalStore';
import { useReviewStore } from '../../stores/useReviewStore';

const VIEWS = [
  { key: 'editor', label: 'Editor' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'progression', label: 'Progression' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'starterCamp', label: 'Starter Camp' },
  { key: 'perks', label: 'Skill Perks' },
  { key: 'audit', label: 'Economy Audit' },
  { key: 'sprites', label: 'Sprite Audit' },
];

export default function TopBar({ onViewChange, currentView, onOpenGenerate, onOpenSettings, onOpenFileManager }) {
  const [recalcDone, setRecalcDone] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [guard, setGuard] = useState(null);
  const [guardBusy, setGuardBusy] = useState(false);
  const recalculateEconomy = useEntityStore((s) => s.recalculateEconomy);
  const globals = useGlobalStore();
  const waiting = useReviewStore((s) => s.listing?.inbox?.length ?? 0);

  const handleRecalculate = () => {
    recalculateEconomy(globals);
    setRecalcDone(true);
    setTimeout(() => setRecalcDone(false), 2000);
  };

  const handleSync = async () => {
    if (!window.confirm('Sync workspace to game data files? This will overwrite data/items.json (maps included), data/tokens.json, data/tokenRecipes.json and data/effects.json, data/starterCamp.json when the Starter Camp page holds one and data/skillPerks.json when the workspace holds perk tables, with the CMS dataset.')) {
      return;
    }
    setSyncStatus('syncing');
    try {
      const result = await syncToGame();
      if (result?.needsConfirm) {
        setGuard(result);
        return;
      }
      showSynced();
    } catch (err) {
      showSyncError(err);
    }
  };

  const showSynced = () => {
    setSyncStatus('synced');
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  const showSyncError = (err) => {
    console.error('Sync failed:', err);
    setSyncStatus('error');
    setTimeout(() => setSyncStatus('idle'), 4000);
  };

  const closeGuard = () => {
    setGuard(null);
    setGuardBusy(false);
  };

  const handleSyncAnyway = async () => {
    setGuardBusy(true);
    try {
      await sendSync(guard.files, { confirmRemovals: true });
      closeGuard();
      showSynced();
    } catch (err) {
      closeGuard();
      showSyncError(err);
    }
  };

  const handleRestoreInstead = async () => {
    setGuardBusy(true);
    try {
      await restoreFromGame();
      closeGuard();
      setSyncStatus('idle');
    } catch (err) {
      closeGuard();
      showSyncError(err);
    }
  };

  const handleCancelGuard = () => {
    closeGuard();
    setSyncStatus('idle');
  };

  return (
    <header
      className="flex items-center justify-between px-4 border-b shrink-0"
      style={{
        minHeight: 52,
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-accent)' }}>
          ⚔️ Fantasy Guild CMS
        </h1>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}
        >
          v2 · phase 10
        </span>
      </div>

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

      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewChange('changes')}
          className="btn-ghost flex items-center gap-1.5"
          data-testid="changes-badge"
          style={{
            padding: '6px 10px',
            background: currentView === 'changes' ? 'var(--color-bg-elevated)' : waiting > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-surface)',
            color: waiting > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
            borderColor: waiting > 0 ? 'var(--color-warning)' : 'var(--color-border-subtle)',
          }}
          title="Change packs agents have written into cms/incoming/, waiting for your review"
        >
          <Inbox size={14} />
          <span className="text-xs font-semibold">Changes to review ({waiting})</span>
        </button>

        <button
          onClick={handleRecalculate}
          className="btn-accent flex items-center gap-1.5"
          style={{
            padding: '6px 12px',
            background: recalcDone ? 'var(--color-success, #10b981)' : 'var(--color-accent)',
            color: '#fff',
            fontWeight: 600,
          }}
          title="Recalculate — derives cycle times from Tempo, elects one anchor source per item, and prices everything downstream"
        >
          {recalcDone ? <Check size={14} /> : <Calculator size={14} />}
          <span className="text-xs">{recalcDone ? 'Calculated!' : 'Recalculate'}</span>
        </button>

        <button
          onClick={handleSync}
          disabled={syncStatus === 'syncing'}
          className="btn-ghost flex items-center gap-1.5"
          style={{
            padding: '6px 12px',
            background: syncStatus === 'synced' ? 'rgba(16, 185, 129, 0.15)' : syncStatus === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-bg-surface)',
            color: syncStatus === 'synced' ? 'var(--color-success, #10b981)' : syncStatus === 'error' ? 'var(--color-error, #ef4444)' : 'var(--color-accent-hover)',
            borderColor: syncStatus === 'synced' ? 'var(--color-success, #10b981)' : syncStatus === 'error' ? 'var(--color-error, #ef4444)' : 'var(--color-border-subtle)',
          }}
          title="Sync to Game — overwrites data/*.json with everything loaded here"
        >
          {syncStatus === 'synced' ? (
            <Check size={14} />
          ) : syncStatus === 'error' ? (
            <AlertCircle size={14} />
          ) : (
            <UploadCloud size={14} />
          )}
          <span className="text-xs font-semibold">
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced to Game!' : syncStatus === 'error' ? 'Sync Error' : 'Sync to Game'}
          </span>
        </button>

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
          title="Global Values (CMS Dials)"
        >
          <Settings size={14} />
        </button>
      </div>

      {guard && (
        <SyncGuardPanel
          diff={guard.diff}
          busy={guardBusy}
          onRestore={handleRestoreInstead}
          onSyncAnyway={handleSyncAnyway}
          onCancel={handleCancelGuard}
        />
      )}
    </header>
  );
}
